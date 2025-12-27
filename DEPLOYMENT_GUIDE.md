# 三傻的灵感屋 - 部署指南

本指南将手把手带你完成项目的生产环境部署，包括用户系统、云端存储、支付等功能。

---

## 目录

1. [准备工作](#1-准备工作)
2. [配置 Supabase 数据库](#2-配置-supabase-数据库)
3. [配置阿里云 OSS](#3-配置阿里云-oss)
4. [配置阿里云短信](#4-配置阿里云短信)
5. [配置微信登录](#5-配置微信登录)
6. [后端代码开发](#6-后端代码开发)
7. [前端代码开发](#7-前端代码开发)
8. [购买并配置服务器](#8-购买并配置服务器)
9. [部署后端](#9-部署后端)
10. [部署前端到 Vercel](#10-部署前端到-vercel)
11. [域名与备案](#11-域名与备案)
12. [支付系统（可选）](#12-支付系统可选)

---

## 1. 准备工作

### 1.1 需要注册的账号

| 平台 | 用途 | 链接 |
|------|------|------|
| Supabase | 数据库 + 认证 | https://supabase.com |
| 阿里云 | OSS + 短信 + 服务器 | https://www.aliyun.com |
| Vercel | 前端托管 | https://vercel.com |
| 微信开放平台 | 微信登录 | https://open.weixin.qq.com |
| GitHub | 代码托管 | https://github.com |

### 1.2 需要准备的材料（企业）

- 营业执照扫描件
- 法人身份证正反面
- 对公银行账户信息
- 企业联系人手机号
- 已实名认证的域名

### 1.3 预估费用

| 项目 | 首年费用 | 说明 |
|------|----------|------|
| 域名 | 50-100元 | .com/.cn |
| 轻量服务器 | 99-500元 | 新用户优惠 |
| OSS 存储 | 100-200元 | 按量付费 |
| 短信服务 | 100-200元 | 按条计费 |
| **总计** | **约 500元** | 首年 |

---

## 2. 配置 Supabase 数据库

### 2.1 创建项目

1. 访问 https://supabase.com 并注册/登录
2. 点击 "New Project"
3. 填写信息：
   - **Name**: `sansha-canvas`
   - **Database Password**: 生成一个强密码（记录下来！）
   - **Region**: 选择 `Northeast Asia (Tokyo)` 或 `Singapore`
4. 点击 "Create new project"，等待 2-3 分钟

### 2.2 获取连接信息

项目创建完成后，进入 **Settings > Database**：

```
记录以下信息：
- Host: xxx.supabase.co
- Database name: postgres
- Port: 5432
- User: postgres
- Password: 你设置的密码
```

进入 **Settings > API**：

```
记录以下信息：
- Project URL: https://xxx.supabase.co
- anon public key: eyJhbGci...
- service_role key: eyJhbGci... (保密！)
```

### 2.3 创建数据库表

进入 **SQL Editor**，执行以下 SQL：

```sql
-- ============================================
-- 用户表
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE,
  wechat_openid VARCHAR(100) UNIQUE,
  wechat_unionid VARCHAR(100),
  nickname VARCHAR(100),
  avatar_url TEXT,
  membership_type VARCHAR(20) DEFAULT 'free', -- free/monthly/yearly
  membership_expires_at TIMESTAMP WITH TIME ZONE,
  daily_quota INT DEFAULT 10,
  total_usage INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_wechat_openid ON users(wechat_openid);

-- ============================================
-- 项目表
-- ============================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL DEFAULT '未命名项目',
  thumbnail TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  viewport JSONB DEFAULT '{"scale": 1, "pan": {"x": 0, "y": 0}}'::jsonb,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_updated_at ON projects(updated_at DESC);

-- ============================================
-- 用量记录表
-- ============================================
CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- generate/edit/inpaint/chat/upscale
  tokens_used INT DEFAULT 0,
  cost_cents INT DEFAULT 0, -- 成本（分）
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_usage_records_user_id ON usage_records(user_id);
CREATE INDEX idx_usage_records_created_at ON usage_records(created_at);

-- ============================================
-- 验证码表（短信验证码）
-- ============================================
CREATE TABLE verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_verification_codes_phone ON verification_codes(phone);

-- 自动清理过期验证码（可选）
CREATE OR REPLACE FUNCTION cleanup_expired_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM verification_codes WHERE expires_at < NOW() OR used = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 更新时间触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 每日用量统计视图
-- ============================================
CREATE OR REPLACE VIEW daily_usage AS
SELECT
  user_id,
  DATE(created_at) as usage_date,
  action_type,
  COUNT(*) as count,
  SUM(tokens_used) as total_tokens
FROM usage_records
GROUP BY user_id, DATE(created_at), action_type;

-- ============================================
-- RLS (Row Level Security) 策略
-- ============================================

-- 启用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的数据（通过 service_role 绑定后端使用）
-- 如果使用 Supabase Auth，可以添加更细粒度的策略
```

### 2.4 验证表创建成功

在 **Table Editor** 中应该能看到：
- users
- projects
- usage_records
- verification_codes

---

## 3. 配置阿里云 OSS

### 3.1 开通 OSS 服务

1. 登录阿里云控制台
2. 搜索 "对象存储 OSS" 并开通
3. 进入 OSS 控制台

### 3.2 创建 Bucket

1. 点击 "创建 Bucket"
2. 填写信息：
   - **Bucket 名称**: `sansha-canvas-images`（需全局唯一）
   - **地域**: 选择离用户近的，如 `华东1（杭州）`
   - **存储类型**: 标准存储
   - **读写权限**: **公共读**（图片需要公开访问）
3. 点击确定

### 3.3 配置跨域 (CORS)

进入 Bucket > **数据安全** > **跨域设置**：

```json
[
  {
    "AllowedOrigin": ["*"],
    "AllowedMethod": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "AllowedHeader": ["*"],
    "ExposeHeader": ["ETag", "x-oss-request-id"],
    "MaxAgeSeconds": 3600
  }
]
```

### 3.4 创建 AccessKey

1. 点击右上角头像 > **AccessKey 管理**
2. 选择 "使用子用户 AccessKey"（更安全）
3. 创建用户，勾选 "OpenAPI 调用访问"
4. 给用户添加权限：`AliyunOSSFullAccess`
5. 记录 AccessKey ID 和 AccessKey Secret

```
记录以下信息：
- Bucket: sansha-canvas-images
- Region: oss-cn-hangzhou
- AccessKey ID: LTAI...
- AccessKey Secret: xxx...
- Endpoint: https://oss-cn-hangzhou.aliyuncs.com
- 图片访问域名: https://sansha-canvas-images.oss-cn-hangzhou.aliyuncs.com
```

---

## 4. 配置阿里云短信

### 4.1 开通短信服务

1. 阿里云控制台搜索 "短信服务" 并开通
2. 进入短信服务控制台

### 4.2 添加签名

1. 进入 **国内消息** > **签名管理** > **添加签名**
2. 填写：
   - **签名名称**: 你的产品名，如 `三傻灵感屋`
   - **签名来源**: 企事业单位的全称或简称
   - **上传证明**: 营业执照
3. 等待审核（1-2 个工作日）

### 4.3 添加模板

1. 进入 **模板管理** > **添加模板**
2. 填写：
   - **模板名称**: 验证码
   - **模板类型**: 验证码
   - **模板内容**: `您的验证码是${code}，5分钟内有效。如非本人操作，请忽略。`
3. 等待审核

审核通过后记录：
```
- 签名名称: 三傻灵感屋
- 模板 CODE: SMS_xxxxx
- AccessKey: 同 OSS
```

---

## 5. 配置微信登录

### 5.1 注册微信开放平台

1. 访问 https://open.weixin.qq.com
2. 使用企业资质注册开发者账号
3. 完成开发者资质认证（需 300 元认证费）

### 5.2 创建网站应用

1. 进入 **管理中心** > **网站应用** > **创建网站应用**
2. 填写应用信息
3. 等待审核（3-5 个工作日）

审核通过后记录：
```
- AppID: wx...
- AppSecret: xxx...
- 授权回调域: yourdomain.com
```

---

## 6. 后端代码开发

### 6.1 安装依赖

```bash
cd packages/server
npm install @supabase/supabase-js ali-oss @alicloud/dysmsapi20170525 @alicloud/openapi-client jsonwebtoken bcryptjs
npm install -D @types/jsonwebtoken @types/bcryptjs
```

### 6.2 更新环境变量

编辑 `packages/server/.env`，添加：

```env
# ============ Supabase ============
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# ============ JWT ============
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# ============ 阿里云 ============
ALIYUN_ACCESS_KEY_ID=LTAI...
ALIYUN_ACCESS_KEY_SECRET=xxx...

# ============ OSS ============
OSS_BUCKET=sansha-canvas-images
OSS_REGION=oss-cn-hangzhou
OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com

# ============ 短信 ============
SMS_SIGN_NAME=三傻灵感屋
SMS_TEMPLATE_CODE=SMS_xxxxx

# ============ 微信 ============
WECHAT_APP_ID=wx...
WECHAT_APP_SECRET=xxx...
```

### 6.3 创建 Supabase 客户端

创建文件 `packages/server/src/lib/supabase.ts`：

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// 使用 service_role key，拥有完整数据库访问权限
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
```

### 6.4 创建认证服务

创建文件 `packages/server/src/services/auth.ts`：

```typescript
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '7d';

export interface JWTPayload {
  userId: string;
  phone?: string;
}

/**
 * 生成 JWT Token
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 验证 JWT Token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * 生成 6 位验证码
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 保存验证码到数据库
 */
export async function saveVerificationCode(phone: string, code: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 分钟后过期

  await supabase.from('verification_codes').insert({
    phone,
    code,
    expires_at: expiresAt.toISOString(),
  });
}

/**
 * 验证验证码
 */
export async function verifyCode(phone: string, code: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('verification_codes')
    .select('*')
    .eq('phone', phone)
    .eq('code', code)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return false;
  }

  // 标记为已使用
  await supabase.from('verification_codes').update({ used: true }).eq('id', data.id);

  return true;
}

/**
 * 获取或创建用户（手机号）
 */
export async function getOrCreateUserByPhone(phone: string) {
  // 查找现有用户
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single();

  if (existingUser) {
    return existingUser;
  }

  // 创建新用户
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      phone,
      nickname: `用户${phone.slice(-4)}`,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`创建用户失败: ${error.message}`);
  }

  return newUser;
}

/**
 * 获取或创建用户（微信）
 */
export async function getOrCreateUserByWechat(openid: string, userInfo?: {
  nickname?: string;
  avatar_url?: string;
  unionid?: string;
}) {
  // 查找现有用户
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('wechat_openid', openid)
    .single();

  if (existingUser) {
    return existingUser;
  }

  // 创建新用户
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      wechat_openid: openid,
      wechat_unionid: userInfo?.unionid,
      nickname: userInfo?.nickname || '微信用户',
      avatar_url: userInfo?.avatar_url,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`创建用户失败: ${error.message}`);
  }

  return newUser;
}
```

### 6.5 创建短信服务

创建文件 `packages/server/src/services/sms.ts`：

```typescript
import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525';
import * as $OpenApi from '@alicloud/openapi-client';

const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID!;
const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET!;
const signName = process.env.SMS_SIGN_NAME!;
const templateCode = process.env.SMS_TEMPLATE_CODE!;

let client: Dysmsapi20170525 | null = null;

function getClient(): Dysmsapi20170525 {
  if (!client) {
    const config = new $OpenApi.Config({
      accessKeyId,
      accessKeySecret,
      endpoint: 'dysmsapi.aliyuncs.com',
    });
    client = new Dysmsapi20170525(config);
  }
  return client;
}

/**
 * 发送短信验证码
 */
export async function sendSmsCode(phone: string, code: string): Promise<boolean> {
  try {
    const request = new $Dysmsapi20170525.SendSmsRequest({
      phoneNumbers: phone,
      signName: signName,
      templateCode: templateCode,
      templateParam: JSON.stringify({ code }),
    });

    const response = await getClient().sendSms(request);

    if (response.body.code === 'OK') {
      console.log(`[SMS] 验证码发送成功: ${phone}`);
      return true;
    } else {
      console.error(`[SMS] 发送失败: ${response.body.message}`);
      return false;
    }
  } catch (error) {
    console.error('[SMS] 发送异常:', error);
    return false;
  }
}
```

### 6.6 创建 OSS 服务

创建文件 `packages/server/src/services/oss.ts`：

```typescript
import OSS from 'ali-oss';
import { v4 as uuidv4 } from 'uuid';

const client = new OSS({
  region: process.env.OSS_REGION!,
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID!,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET!,
  bucket: process.env.OSS_BUCKET!,
});

/**
 * 上传 Base64 图片到 OSS
 */
export async function uploadBase64Image(base64Data: string, folder = 'images'): Promise<string> {
  // 解析 Base64
  const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 image format');
  }

  const ext = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');

  // 生成唯一文件名
  const date = new Date();
  const dateFolder = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  const fileName = `${folder}/${dateFolder}/${uuidv4()}.${ext}`;

  // 上传到 OSS
  const result = await client.put(fileName, buffer, {
    headers: {
      'Content-Type': `image/${ext}`,
    },
  });

  // 返回公开访问 URL
  return result.url;
}

/**
 * 删除 OSS 文件
 */
export async function deleteFile(url: string): Promise<void> {
  // 从 URL 提取文件路径
  const bucket = process.env.OSS_BUCKET!;
  const urlObj = new URL(url);
  const filePath = urlObj.pathname.slice(1); // 移除开头的 /

  await client.delete(filePath);
}
```

### 6.7 创建认证路由

创建文件 `packages/server/src/routes/auth.ts`：

```typescript
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/index.js';
import {
  generateVerificationCode,
  saveVerificationCode,
  verifyCode,
  getOrCreateUserByPhone,
  getOrCreateUserByWechat,
  generateToken,
  verifyToken,
} from '../services/auth.js';
import { sendSmsCode } from '../services/sms.js';
import { supabase } from '../lib/supabase.js';

export const authRouter = Router();

/**
 * POST /api/auth/send-code
 * 发送短信验证码
 */
authRouter.post(
  '/send-code',
  asyncHandler(async (req: Request, res: Response) => {
    const { phone } = req.body;

    // 验证手机号格式
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        error: '请输入正确的手机号',
      });
    }

    // 检查发送频率（1 分钟内只能发一次）
    const { data: recentCode } = await supabase
      .from('verification_codes')
      .select('created_at')
      .eq('phone', phone)
      .gt('created_at', new Date(Date.now() - 60 * 1000).toISOString())
      .limit(1)
      .single();

    if (recentCode) {
      return res.status(429).json({
        success: false,
        error: '发送太频繁，请稍后再试',
      });
    }

    // 生成并保存验证码
    const code = generateVerificationCode();
    await saveVerificationCode(phone, code);

    // 发送短信
    const sent = await sendSmsCode(phone, code);

    if (!sent) {
      return res.status(500).json({
        success: false,
        error: '短信发送失败，请稍后重试',
      });
    }

    res.json({
      success: true,
      message: '验证码已发送',
    });
  })
);

/**
 * POST /api/auth/login-phone
 * 手机号登录
 */
authRouter.post(
  '/login-phone',
  asyncHandler(async (req: Request, res: Response) => {
    const { phone, code } = req.body;

    // 验证参数
    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        error: '请输入手机号和验证码',
      });
    }

    // 验证验证码
    const isValid = await verifyCode(phone, code);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: '验证码错误或已过期',
      });
    }

    // 获取或创建用户
    const user = await getOrCreateUserByPhone(phone);

    // 生成 Token
    const token = generateToken({ userId: user.id, phone });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname,
          avatar_url: user.avatar_url,
          membership_type: user.membership_type,
        },
      },
    });
  })
);

/**
 * POST /api/auth/login-wechat
 * 微信登录
 */
authRouter.post(
  '/login-wechat',
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: '缺少微信授权码',
      });
    }

    // 用 code 换取 access_token 和 openid
    const appId = process.env.WECHAT_APP_ID!;
    const appSecret = process.env.WECHAT_APP_SECRET!;
    const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (tokenData.errcode) {
      return res.status(400).json({
        success: false,
        error: `微信授权失败: ${tokenData.errmsg}`,
      });
    }

    const { access_token, openid, unionid } = tokenData;

    // 获取用户信息
    const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}`;
    const userInfoResponse = await fetch(userInfoUrl);
    const userInfo = await userInfoResponse.json();

    // 获取或创建用户
    const user = await getOrCreateUserByWechat(openid, {
      nickname: userInfo.nickname,
      avatar_url: userInfo.headimgurl,
      unionid,
    });

    // 生成 Token
    const token = generateToken({ userId: user.id });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          nickname: user.nickname,
          avatar_url: user.avatar_url,
          membership_type: user.membership_type,
        },
      },
    });
  })
);

/**
 * GET /api/auth/me
 * 获取当前用户信息
 */
authRouter.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    if (!payload) {
      return res.status(401).json({
        success: false,
        error: 'Token 无效或已过期',
      });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, phone, nickname, avatar_url, membership_type, daily_quota')
      .eq('id', payload.userId)
      .single();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在',
      });
    }

    res.json({
      success: true,
      data: { user },
    });
  })
);
```

### 6.8 创建项目路由

创建文件 `packages/server/src/routes/projects.ts`：

```typescript
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/index.js';
import { verifyToken } from '../services/auth.js';
import { supabase } from '../lib/supabase.js';
import { uploadBase64Image } from '../services/oss.js';

export const projectsRouter = Router();

// 认证中间件
async function authMiddleware(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未登录' });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ success: false, error: 'Token 无效' });
  }

  (req as any).userId = payload.userId;
  next();
}

// 所有路由需要认证
projectsRouter.use(authMiddleware);

/**
 * GET /api/projects
 * 获取用户所有项目
 */
projectsRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;

    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, name, thumbnail, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      data: { projects },
    });
  })
);

/**
 * GET /api/projects/:id
 * 获取单个项目详情
 */
projectsRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { id } = req.params;

    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .single();

    if (error || !project) {
      return res.status(404).json({
        success: false,
        error: '项目不存在',
      });
    }

    res.json({
      success: true,
      data: { project },
    });
  })
);

/**
 * POST /api/projects
 * 创建新项目
 */
projectsRouter.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { name, items, viewport, thumbnail } = req.body;

    // 如果有缩略图，上传到 OSS
    let thumbnailUrl = thumbnail;
    if (thumbnail?.startsWith('data:image')) {
      thumbnailUrl = await uploadBase64Image(thumbnail, 'thumbnails');
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: name || '未命名项目',
        items: items || [],
        viewport: viewport || { scale: 1, pan: { x: 0, y: 0 } },
        thumbnail: thumbnailUrl,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      data: { project },
    });
  })
);

/**
 * PUT /api/projects/:id
 * 更新项目
 */
projectsRouter.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { id } = req.params;
    const { name, items, viewport, thumbnail } = req.body;

    // 验证项目归属
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '项目不存在',
      });
    }

    // 准备更新数据
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (items !== undefined) updateData.items = items;
    if (viewport !== undefined) updateData.viewport = viewport;

    // 如果有新缩略图，上传到 OSS
    if (thumbnail?.startsWith('data:image')) {
      updateData.thumbnail = await uploadBase64Image(thumbnail, 'thumbnails');
    } else if (thumbnail !== undefined) {
      updateData.thumbnail = thumbnail;
    }

    const { data: project, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      data: { project },
    });
  })
);

/**
 * DELETE /api/projects/:id
 * 删除项目（软删除）
 */
projectsRouter.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { id } = req.params;

    const { error } = await supabase
      .from('projects')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      message: '项目已删除',
    });
  })
);
```

### 6.9 创建上传路由

创建文件 `packages/server/src/routes/upload.ts`：

```typescript
import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/index.js';
import { verifyToken } from '../services/auth.js';
import { uploadBase64Image } from '../services/oss.js';

export const uploadRouter = Router();

// 认证中间件
async function authMiddleware(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未登录' });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ success: false, error: 'Token 无效' });
  }

  (req as any).userId = payload.userId;
  next();
}

uploadRouter.use(authMiddleware);

/**
 * POST /api/upload/image
 * 上传图片到 OSS
 */
uploadRouter.post(
  '/image',
  asyncHandler(async (req: Request, res: Response) => {
    const { image, folder = 'images' } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: '缺少图片数据',
      });
    }

    const url = await uploadBase64Image(image, folder);

    res.json({
      success: true,
      data: { url },
    });
  })
);
```

### 6.10 注册路由

编辑 `packages/server/src/index.ts`，添加新路由：

```typescript
// 在现有 import 后添加
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { uploadRouter } from './routes/upload.js';

// 在现有路由注册后添加
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/upload', uploadRouter);
```

---

## 7. 前端代码开发

### 7.1 创建认证服务

创建文件 `packages/client/src/services/auth.ts`：

```typescript
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export interface User {
  id: string;
  phone?: string;
  nickname: string;
  avatar_url?: string;
  membership_type: 'free' | 'monthly' | 'yearly';
}

/**
 * 保存登录状态
 */
export function saveAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * 获取 Token
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * 获取用户信息
 */
export function getUser(): User | null {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * 是否已登录
 */
export function isLoggedIn(): boolean {
  return !!getToken();
}

/**
 * 退出登录
 */
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * 发送验证码
 */
export async function sendCode(phone: string): Promise<void> {
  const response = await fetch('/api/auth/send-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error);
  }
}

/**
 * 手机号登录
 */
export async function loginWithPhone(phone: string, code: string): Promise<User> {
  const response = await fetch('/api/auth/login-phone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error);
  }

  saveAuth(data.data.token, data.data.user);
  return data.data.user;
}

/**
 * 获取当前用户
 */
export async function fetchCurrentUser(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const response = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    if (!data.success) {
      logout();
      return null;
    }

    return data.data.user;
  } catch {
    return null;
  }
}
```

### 7.2 创建登录组件

创建文件 `packages/client/src/components/LoginModal.tsx`：

```tsx
import { useState } from 'react';
import { sendCode, loginWithPhone } from '../services/auth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  if (!isOpen) return null;

  const handleSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await sendCode(phone);
      setStep('code');
      // 60 秒倒计时
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (code.length !== 6) {
      setError('请输入 6 位验证码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await loginWithPhone(phone, code);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-80 shadow-xl">
        <h2 className="text-xl font-bold text-center mb-6">登录</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <>
            <input
              type="tel"
              placeholder="请输入手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 border rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={11}
            />
            <button
              onClick={handleSendCode}
              disabled={loading}
              className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? '发送中...' : '获取验证码'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              验证码已发送至 {phone}
            </p>
            <input
              type="text"
              placeholder="请输入验证码"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-3 border rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={6}
            />
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 mb-3"
            >
              {loading ? '登录中...' : '登录'}
            </button>
            <button
              onClick={handleSendCode}
              disabled={countdown > 0}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              {countdown > 0 ? `${countdown}s 后重新发送` : '重新发送'}
            </button>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full text-sm text-gray-400 hover:text-gray-600"
        >
          取消
        </button>
      </div>
    </div>
  );
}
```

### 7.3 更新 API 请求添加认证

编辑 `packages/client/src/services/api.ts`，添加 Token：

```typescript
import { getToken } from './auth';

// 创建带认证的 fetch 函数
async function authFetch(url: string, options: RequestInit = {}) {
  const token = getToken();

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

// 更新现有 API 调用使用 authFetch
// 例如:
export async function generateImage(prompt: string) {
  const response = await authFetch('/api/ai/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
  // ...
}
```

---

## 8. 购买并配置服务器

### 8.1 购买轻量应用服务器

1. 访问阿里云控制台
2. 搜索 "轻量应用服务器"
3. 选择配置：
   - **地域**: 华东1（杭州）或离你近的
   - **镜像**: Ubuntu 22.04
   - **套餐**: 2核4G（够用）
   - **时长**: 1年（通常有优惠）

### 8.2 配置安全组

进入实例 > **防火墙**，添加规则：

| 端口 | 协议 | 说明 |
|------|------|------|
| 22 | TCP | SSH |
| 80 | TCP | HTTP |
| 443 | TCP | HTTPS |
| 3001 | TCP | 后端 API（调试用） |

### 8.3 连接服务器

```bash
ssh root@你的服务器IP
```

### 8.4 安装环境

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 验证安装
node -v  # 应显示 v20.x.x
npm -v   # 应显示 10.x.x

# 安装 PM2（进程管理）
npm install -g pm2

# 安装 Nginx
apt install -y nginx

# 安装 Git
apt install -y git
```

---

## 9. 部署后端

### 9.1 克隆代码

```bash
cd /var/www
git clone https://github.com/你的用户名/三傻的灵感屋.git
cd 三傻的灵感屋
```

### 9.2 安装依赖并构建

```bash
npm install
npm run build
```

### 9.3 配置环境变量

```bash
cp packages/server/.env.example packages/server/.env
nano packages/server/.env
# 填入所有配置...
```

### 9.4 使用 PM2 启动

```bash
cd packages/server

# 启动服务
pm2 start dist/index.js --name sansha-api

# 设置开机自启
pm2 startup
pm2 save

# 查看日志
pm2 logs sansha-api
```

### 9.5 配置 Nginx 反向代理

```bash
nano /etc/nginx/sites-available/sansha
```

写入：

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;

        # SSE 支持
        proxy_buffering off;
        proxy_read_timeout 86400;
    }
}
```

启用配置：

```bash
ln -s /etc/nginx/sites-available/sansha /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 9.6 配置 HTTPS（可选但推荐）

```bash
# 安装 Certbot
apt install -y certbot python3-certbot-nginx

# 获取证书（需要先解析域名）
certbot --nginx -d api.yourdomain.com
```

---

## 10. 部署前端到 Vercel

### 10.1 推送代码到 GitHub

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 10.2 连接 Vercel

1. 访问 https://vercel.com
2. 用 GitHub 登录
3. 点击 "Import Project"
4. 选择你的仓库

### 10.3 配置构建

- **Framework Preset**: Vite
- **Root Directory**: `packages/client`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### 10.4 配置环境变量

在 Vercel 项目设置中添加：

```
VITE_API_URL=https://api.yourdomain.com
```

### 10.5 配置 API 代理

在 `packages/client` 下创建 `vercel.json`：

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.yourdomain.com/api/:path*"
    }
  ]
}
```

### 10.6 部署

点击 Deploy，等待构建完成。

---

## 11. 域名与备案

### 11.1 购买域名

1. 在阿里云/腾讯云购买域名
2. 完成实名认证

### 11.2 DNS 解析

添加以下记录：

| 主机记录 | 记录类型 | 记录值 |
|----------|----------|--------|
| @ | A | 你的服务器 IP |
| api | A | 你的服务器 IP |
| www | CNAME | cname.vercel-dns.com |

### 11.3 ICP 备案

1. 在阿里云/腾讯云提交备案申请
2. 准备材料：营业执照、法人身份证、网站负责人身份证
3. 等待审核（10-20 个工作日）

备案期间可以先用 IP 访问测试。

---

## 12. 支付系统（可选）

### 12.1 接入微信支付

1. 登录微信商户平台 https://pay.weixin.qq.com
2. 申请开通 Native 支付
3. 获取：商户号、API 密钥、证书

### 12.2 创建支付服务

这部分代码较复杂，建议后续单独实现。主要包括：

- 创建订单
- 生成支付二维码
- 处理支付回调
- 更新用户会员状态

---

## 检查清单

### 上线前必须完成

- [ ] Supabase 数据库表创建完成
- [ ] 后端环境变量全部配置
- [ ] 短信签名和模板审核通过
- [ ] 服务器安全组端口开放
- [ ] Nginx 配置并启动
- [ ] PM2 进程正常运行
- [ ] 前端部署到 Vercel
- [ ] 域名解析生效
- [ ] HTTPS 证书配置
- [ ] ICP 备案通过

### 功能测试清单

- [ ] 发送验证码正常
- [ ] 手机号登录成功
- [ ] 创建/保存项目成功
- [ ] 图片上传到 OSS 成功
- [ ] AI 生成图片正常
- [ ] 聊天功能正常

---

如有问题，请检查：
1. 服务器日志：`pm2 logs sansha-api`
2. Nginx 日志：`tail -f /var/log/nginx/error.log`
3. 浏览器控制台错误
