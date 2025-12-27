import { Router, Request, Response } from 'express';
import { config } from '../config.js';
import {
  generateToken,
  generateVerificationCode as generateCode,
  saveVerificationCode,
  verifyCode as verifyDbCode,
  canSendCode,
  getOrCreateUserByPhone,
} from '../services/authService.js';
import { isSupabaseAvailable } from '../lib/supabase.js';

export const authRouter = Router();

// 手机号脱敏（只显示前3位和后4位）
function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return '***';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

// 存储登录状态（生产环境应使用 Redis）
const loginStates = new Map<string, {
  status: 'pending' | 'scanned' | 'confirmed' | 'expired';
  user?: WechatUser;
  createdAt: number;
}>();

// 用户存储（生产环境应使用数据库）
const users = new Map<string, User>();

// 手机用户存储（按手机号索引）
const phoneUsers = new Map<string, PhoneUser>();

// 验证码存储
const verificationCodes = new Map<string, {
  code: string;
  createdAt: number;
  attempts: number;
}>();

interface PhoneUser {
  id: string;
  phone: string;
  nickname: string;
  avatar: string;
  createdAt: number;
}

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
authRouter.get('/wechat/qrcode', (_req: Request, res: Response) => {
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
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: '已登出',
  });
});

// ============ 手机号登录/注册 ============

// 清理过期验证码
setInterval(() => {
  const now = Date.now();
  for (const [phone, data] of verificationCodes.entries()) {
    // 5分钟过期
    if (now - data.createdAt > 5 * 60 * 1000) {
      verificationCodes.delete(phone);
    }
  }
}, 60 * 1000);

/**
 * POST /api/auth/phone/send-code
 * 发送手机验证码
 */
authRouter.post('/phone/send-code', async (req: Request, res: Response) => {
  const { phone } = req.body;

  // 验证手机号格式
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return res.json({
      success: false,
      error: '请输入正确的手机号',
    });
  }

  // 如果 Supabase 可用，使用数据库检查发送频率
  if (isSupabaseAvailable()) {
    const allowed = await canSendCode(phone);
    if (!allowed) {
      return res.json({
        success: false,
        error: '发送太频繁，请稍后再试',
      });
    }
  } else {
    // 回退到内存检查
    const existing = verificationCodes.get(phone);
    if (existing && Date.now() - existing.createdAt < 60 * 1000) {
      return res.json({
        success: false,
        error: '发送太频繁，请稍后再试',
      });
    }
  }

  // 生成验证码
  const code = generateCode();

  // 存储验证码
  if (isSupabaseAvailable()) {
    await saveVerificationCode(phone, code);
  }
  // 同时保存到内存（作为回退）
  verificationCodes.set(phone, {
    code,
    createdAt: Date.now(),
    attempts: 0,
  });

  // TODO: 实际项目中需要调用短信服务发送验证码
  // 日志脱敏：不输出完整手机号和验证码
  console.log(`[SMS] 发送验证码到 ${maskPhone(phone)}`);

  res.json({
    success: true,
    message: '验证码已发送',
    // 开发环境返回验证码，方便测试
    ...(process.env.NODE_ENV === 'development' && { devCode: code }),
  });
});

/**
 * POST /api/auth/phone/verify
 * 验证手机验证码并登录/注册
 */
authRouter.post('/phone/verify', async (req: Request, res: Response) => {
  const { phone, code, mode: _mode } = req.body;

  // 验证参数
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return res.json({
      success: false,
      error: '请输入正确的手机号',
    });
  }

  if (!code || code.length !== 6) {
    return res.json({
      success: false,
      error: '请输入6位验证码',
    });
  }

  // 验证验证码
  let isValid = false;

  // 优先使用 Supabase 验证
  if (isSupabaseAvailable()) {
    isValid = await verifyDbCode(phone, code);
  }

  // 如果 Supabase 验证失败，尝试内存验证（回退）
  if (!isValid) {
    const stored = verificationCodes.get(phone);

    if (!stored) {
      return res.json({
        success: false,
        error: '验证码已过期，请重新获取',
      });
    }

    if (stored.attempts >= 5) {
      verificationCodes.delete(phone);
      return res.json({
        success: false,
        error: '验证码错误次数过多，请重新获取',
      });
    }

    if (Date.now() - stored.createdAt > 5 * 60 * 1000) {
      verificationCodes.delete(phone);
      return res.json({
        success: false,
        error: '验证码已过期，请重新获取',
      });
    }

    if (stored.code !== code) {
      stored.attempts++;
      return res.json({
        success: false,
        error: '验证码错误',
      });
    }

    isValid = true;
  }

  // 验证成功，清理内存中的验证码
  verificationCodes.delete(phone);

  // 查找或创建用户
  let user;
  let token = '';

  if (isSupabaseAvailable()) {
    // 使用 Supabase
    user = await getOrCreateUserByPhone(phone);
    if (user) {
      token = generateToken({ userId: user.id, phone });
    }
  }

  // 回退到内存存储
  if (!user) {
    let memoryUser = phoneUsers.get(phone);
    if (!memoryUser) {
      memoryUser = {
        id: generateState(),
        phone,
        nickname: `用户${phone.slice(-4)}`,
        avatar: '',
        createdAt: Date.now(),
      };
      phoneUsers.set(phone, memoryUser);
      console.log(`[Auth] 新用户注册 (内存): ${maskPhone(phone)}`);
    }
    user = {
      id: memoryUser.id,
      nickname: memoryUser.nickname,
      avatar_url: memoryUser.avatar,
      membership_type: 'free',
      daily_quota: 10,
    };
    token = generateToken({ userId: memoryUser.id, phone });
  }

  console.log(`[Auth] 用户登录: ${maskPhone(phone)}`);

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar_url || '',
        membership_type: user.membership_type,
      },
    },
  });
});
