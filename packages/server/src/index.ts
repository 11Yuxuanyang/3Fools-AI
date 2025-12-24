import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { aiRouter } from './routes/ai.js';
import { authRouter } from './routes/auth.js';
import { chatRouter } from './routes/chat.js';
import { errorHandler, notFoundHandler } from './middleware/index.js';

const app = express();

// 安全中间件
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // 前端单独处理
}));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 每个 IP 最多 100 个请求
  message: {
    success: false,
    error: '请求过于频繁，请稍后再试',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI 路由的更严格速率限制
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 10, // 每分钟最多 10 个 AI 请求
  message: {
    success: false,
    error: 'AI 请求过于频繁，请稍后再试',
  },
});

// CORS
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
}));

// 解析请求体
app.use(express.json({ limit: '10mb' })); // 减小限制
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志（开发环境）
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// 应用全局速率限制
app.use(limiter);

// 路由
app.use('/api/ai', aiLimiter, aiRouter);
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// 获取配置
app.get('/api/config', (_req, res) => {
  res.json({
    provider: config.ai.provider,
    defaultModel: config.ai.defaultModel,
    // 不暴露 API 密钥
  });
});

// 404 处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

// 启动服务器
app.listen(config.port, () => {
  console.log(`🚀 服务器运行在 http://localhost:${config.port}`);
  console.log(`📦 AI 提供商: ${config.ai.provider}`);
  console.log(`🔒 安全中间件已启用: helmet, rate-limit`);
});
