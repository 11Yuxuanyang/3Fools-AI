import { Router, Request, Response } from 'express';
import { config } from '../config.js';

export const authRouter = Router();

// 存储登录状态（生产环境应使用 Redis）
const loginStates = new Map<string, {
  status: 'pending' | 'scanned' | 'confirmed' | 'expired';
  user?: WechatUser;
  createdAt: number;
}>();

// 用户存储（生产环境应使用数据库）
const users = new Map<string, User>();

interface WechatUser {
  openid: string;
  nickname: string;
  headimgurl: string;
  unionid?: string;
}

interface User {
  id: string;
  openid: string;
  nickname: string;
  avatar: string;
  createdAt: number;
}

// 生成随机状态码
function generateState(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// 清理过期的登录状态
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of loginStates.entries()) {
    // 5分钟过期
    if (now - data.createdAt > 5 * 60 * 1000) {
      loginStates.delete(state);
    }
  }
}, 60 * 1000);

/**
 * GET /api/auth/wechat/qrcode
 * 获取微信登录二维码信息
 */
authRouter.get('/wechat/qrcode', (req: Request, res: Response) => {
  const state = generateState();

  // 保存登录状态
  loginStates.set(state, {
    status: 'pending',
    createdAt: Date.now(),
  });

  // 构建微信授权 URL
  // 微信开放平台网站应用扫码登录
  const qrcodeUrl = `https://open.weixin.qq.com/connect/qrconnect?` +
    `appid=${config.wechat.appId}` +
    `&redirect_uri=${encodeURIComponent(config.wechat.redirectUri)}` +
    `&response_type=code` +
    `&scope=snsapi_login` +
    `&state=${state}` +
    `#wechat_redirect`;

  res.json({
    success: true,
    data: {
      state,
      qrcodeUrl,
      // 如果没有配置 appId，返回提示
      configured: !!config.wechat.appId,
    },
  });
});

/**
 * GET /api/auth/wechat/callback
 * 微信扫码后的回调地址
 */
authRouter.get('/wechat/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.redirect(`${config.corsOrigin}?error=invalid_request`);
  }

  const loginState = loginStates.get(state);
  if (!loginState) {
    return res.redirect(`${config.corsOrigin}?error=state_expired`);
  }

  try {
    // 1. 用 code 换取 access_token
    const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?` +
      `appid=${config.wechat.appId}` +
      `&secret=${config.wechat.appSecret}` +
      `&code=${code}` +
      `&grant_type=authorization_code`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json() as {
      errcode?: number;
      access_token?: string;
      openid?: string;
    };

    if (tokenData.errcode) {
      console.error('微信获取 token 失败:', tokenData);
      loginState.status = 'expired';
      return res.redirect(`${config.corsOrigin}?error=wechat_error`);
    }

    const { access_token, openid } = tokenData;

    // 2. 获取用户信息
    const userUrl = `https://api.weixin.qq.com/sns/userinfo?` +
      `access_token=${access_token}` +
      `&openid=${openid}`;

    const userRes = await fetch(userUrl);
    const userData = await userRes.json() as WechatUser & { errcode?: number };

    if (userData.errcode) {
      console.error('微信获取用户信息失败:', userData);
      loginState.status = 'expired';
      return res.redirect(`${config.corsOrigin}?error=wechat_error`);
    }

    // 3. 创建或更新用户
    let user = users.get(userData.openid);
    if (!user) {
      user = {
        id: generateState(),
        openid: userData.openid,
        nickname: userData.nickname,
        avatar: userData.headimgurl,
        createdAt: Date.now(),
      };
      users.set(userData.openid, user);
    } else {
      // 更新用户信息
      user.nickname = userData.nickname;
      user.avatar = userData.headimgurl;
    }

    // 4. 更新登录状态
    loginState.status = 'confirmed';
    loginState.user = userData;

    // 5. 重定向回前端（带上成功标记）
    res.redirect(`${config.corsOrigin}?login=success&state=${state}`);

  } catch (error) {
    console.error('微信登录回调错误:', error);
    loginState.status = 'expired';
    res.redirect(`${config.corsOrigin}?error=server_error`);
  }
});

/**
 * GET /api/auth/wechat/status/:state
 * 轮询检查登录状态
 */
authRouter.get('/wechat/status/:state', (req: Request, res: Response) => {
  const { state } = req.params;
  const loginState = loginStates.get(state);

  if (!loginState) {
    return res.json({
      success: false,
      error: '登录已过期，请重新扫码',
    });
  }

  // 检查是否过期（5分钟）
  if (Date.now() - loginState.createdAt > 5 * 60 * 1000) {
    loginStates.delete(state);
    return res.json({
      success: false,
      error: '登录已过期，请重新扫码',
    });
  }

  if (loginState.status === 'confirmed' && loginState.user) {
    // 登录成功，返回用户信息
    const user = users.get(loginState.user.openid);

    // 清理登录状态
    loginStates.delete(state);

    return res.json({
      success: true,
      data: {
        status: 'confirmed',
        user: user ? {
          id: user.id,
          nickname: user.nickname,
          avatar: user.avatar,
        } : null,
      },
    });
  }

  res.json({
    success: true,
    data: {
      status: loginState.status,
    },
  });
});

/**
 * GET /api/auth/user
 * 获取当前用户信息（通过 cookie 或 header）
 */
authRouter.get('/user', (req: Request, res: Response) => {
  // 简化版：从 header 获取用户 ID
  const userId = req.headers['x-user-id'] as string;

  if (!userId) {
    return res.json({
      success: true,
      data: { user: null },
    });
  }

  // 查找用户
  for (const user of users.values()) {
    if (user.id === userId) {
      return res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatar,
          },
        },
      });
    }
  }

  res.json({
    success: true,
    data: { user: null },
  });
});

/**
 * POST /api/auth/logout
 * 登出
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: '已登出',
  });
});
