import { config } from '../config.js';
import { AIProvider } from './base.js';
import { CustomProvider } from './custom.js';
import { DoubaoProvider } from './doubao.js';
import { isValidApiKey, logConfigSafely } from '../utils/secrets.js';

/**
 * 提供商工厂注册表
 */
const providers: Record<string, () => AIProvider> = {
  custom: () => new CustomProvider(),
  doubao: () => new DoubaoProvider(),
  // 以下提供商将在获取 API 密钥后实现
  // openai: () => new OpenAIProvider(),
  // qwen: () => new QwenProvider(),
};

/**
 * 提供商实例缓存
 */
const providerInstances: Record<string, AIProvider> = {};

/**
 * 检查提供商配置是否有效
 */
function isProviderConfigured(name: string): boolean {
  const providerConfig = config.providers[name as keyof typeof config.providers];
  if (!providerConfig) return false;
  return isValidApiKey(providerConfig.apiKey);
}

/**
 * 获取所有已配置的提供商列表
 * 只返回有效配置的提供商名称
 */
export function getAvailableProviders(): string[] {
  const available: string[] = [];

  for (const name of Object.keys(config.providers)) {
    if (isProviderConfigured(name) && providers[name]) {
      available.push(name);
    }
  }

  return available;
}

/**
 * 获取指定名称的提供商实例
 * @param name 提供商名称，不指定则使用默认提供商
 */
export function getProvider(name?: string): AIProvider {
  const providerName = name || config.defaultImageProvider;

  // 检查提供商是否存在
  if (!providers[providerName]) {
    const available = Object.keys(providers);
    throw new Error(`未知的 AI 提供商: ${providerName}。可用: ${available.join(', ')}`);
  }

  // 检查提供商是否已配置
  if (!isProviderConfigured(providerName)) {
    throw new Error(`提供商 ${providerName} 未配置有效的 API 密钥`);
  }

  // 使用缓存的实例
  if (!providerInstances[providerName]) {
    providerInstances[providerName] = providers[providerName]();
    console.log(`[Image] 已加载提供商: ${providerName}`);
  }

  return providerInstances[providerName];
}

/**
 * 注册新的提供商
 */
export function registerProvider(name: string, factory: () => AIProvider): void {
  providers[name] = factory;
}

/**
 * 重置提供商缓存（主要用于测试）
 */
export function resetProviders(): void {
  for (const key of Object.keys(providerInstances)) {
    delete providerInstances[key];
  }
}

/**
 * 启动时打印配置信息（安全脱敏）
 */
export function logProviderStatus(): void {
  logConfigSafely(config.providers);
}

// 导出基础类型
export * from './base.js';
