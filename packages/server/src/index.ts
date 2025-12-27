import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config.js';
import { aiRouter } from './routes/ai.js';
import { authRouter } from './routes/auth.js';
import { chatRouter } from './routes/chat.js';
import { projectsRouter } from './routes/projects.js';
import { errorHandler, notFoundHandler } from './middleware/index.js';
import { logProviderStatus } from './providers/index.js';
import { collaborationService } from './services/collaboration.js';

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
app.use('/api/projects', projectsRouter);

// 健康检查（生产环境简化输出，避免信息泄露）
app.get('/api/health', (_req, res) => {
  const isDev = config.nodeEnv === 'development';

  // 生产环境只返回基本状态
  if (!isDev) {
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }

  // 开发环境返回详细信息
  const memoryUsage = process.memoryUsage();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
    },
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

// 创建 HTTP 服务器
const httpServer = createServer(app);

// 初始化 Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigin,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// 初始化协作服务
collaborationService.init(io);

// 启动服务器
const server = httpServer.listen(config.port, () => {
  console.log('\n========================================');
  console.log(`🚀 CanvasAI Studio 后端服务已启动`);
  console.log(`📍 地址: http://localhost:${config.port}`);
  console.log(`🌍 环境: ${config.nodeEnv}`);
  console.log(`🔒 安全: helmet + rate-limit 已启用`);
  console.log(`🤝 协作: WebSocket 已启用`);
  console.log(`⏰ 启动时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('========================================\n');

  logProviderStatus();

  console.log('\n💡 提示: 按 Ctrl+C 优雅停止服务器\n');
});

// 端口占用错误处理
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n❌ 错误: 端口 ${config.port} 已被占用`);
    console.error('\n💡 解决方案:');
    console.error(`   1. 停止占用端口的程序`);
    console.error(`   2. 修改 .env 文件中的 PORT 配置`);

    if (process.platform === 'win32') {
      console.error(`   3. 使用命令查找进程: netstat -ano | findstr :${config.port}`);
      console.error(`   4. 使用命令结束进程: taskkill /PID <进程ID> /F`);
    } else {
      console.error(`   3. 使用命令查找进程: lsof -i :${config.port}`);
      console.error(`   4. 使用命令结束进程: kill -9 <进程ID>`);
    }

    process.exit(1);
  } else if (error.code === 'EACCES') {
    console.error(`\n❌ 错误: 没有权限监听端口 ${config.port}`);
    console.error('💡 提示: 端口 1-1024 需要管理员权限，请使用更大的端口号');
    process.exit(1);
  } else {
    console.error('\n❌ 服务器启动失败:', error);
    process.exit(1);
  }
});

// 优雅关闭处理
let isShuttingDown = false;

const gracefulShutdown = (signal: string) => {
  if (isShuttingDown) {
    console.log('⏳ 正在关闭中，请稍候...');
    return;
  }

  isShuttingDown = true;
  console.log(`\n🛑 收到 ${signal} 信号，开始优雅关闭...`);

  server.close((err) => {
    if (err) {
      console.error('❌ 关闭服务器时出错:', err);
      process.exit(1);
    }

    console.log('✅ 服务器已安全关闭');
    process.exit(0);
  });

  // 设置强制退出超时（10秒）
  setTimeout(() => {
    console.error('⚠️  强制退出（超时）');
    process.exit(1);
  }, 10000);
};

// 监听终止信号
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Windows 特定信号
if (process.platform === 'win32') {
  process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));
}

// 捕获未处理的错误
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason);
  gracefulShutdown('unhandledRejection');
});
