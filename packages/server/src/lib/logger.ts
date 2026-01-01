/**
 * 统一日志服务
 * 使用 pino 提供结构化日志
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    env: process.env.NODE_ENV || 'development',
  },
});

// 创建子 logger 用于不同模块
export const createLogger = (module: string) => logger.child({ module });

// 常用模块 logger
export const authLogger = createLogger('auth');
export const chatLogger = createLogger('chat');
export const creditLogger = createLogger('credit');
export const aiLogger = createLogger('ai');
export const collabLogger = createLogger('collab');
export const adminLogger = createLogger('admin');

export default logger;
