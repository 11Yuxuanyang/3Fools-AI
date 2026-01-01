/**
 * 火山引擎 TOS 对象存储服务
 * 用于存储上传的图片，替代不稳定的第三方图床
 */

import { TosClient, ACLType } from '@volcengine/tos-sdk';
import { randomUUID } from 'crypto';

// TOS 配置
const TOS_CONFIG = {
  accessKeyId: process.env.TOS_ACCESS_KEY || '',
  accessKeySecret: process.env.TOS_SECRET_KEY || '',
  endpoint: process.env.TOS_ENDPOINT || 'tos-cn-beijing.volces.com',
  region: process.env.TOS_REGION || 'cn-beijing',
  bucket: process.env.TOS_BUCKET || 'canvasai-studio',
};

// TOS 客户端实例（延迟初始化）
let tosClient: TosClient | null = null;
let bucketChecked = false;

/**
 * 获取 TOS 客户端实例
 */
function getClient(): TosClient {
  if (!tosClient) {
    if (!TOS_CONFIG.accessKeyId || !TOS_CONFIG.accessKeySecret) {
      throw new Error('TOS 配置不完整，请检查 TOS_ACCESS_KEY 和 TOS_SECRET_KEY 环境变量');
    }

    tosClient = new TosClient({
      accessKeyId: TOS_CONFIG.accessKeyId,
      accessKeySecret: TOS_CONFIG.accessKeySecret,
      endpoint: TOS_CONFIG.endpoint,
      region: TOS_CONFIG.region,
    });
  }
  return tosClient;
}

/**
 * 检查并创建 Bucket（如果不存在）
 */
async function ensureBucketExists(): Promise<void> {
  if (bucketChecked) return;

  const client = getClient();
  const bucketName = TOS_CONFIG.bucket;

  try {
    // 检查 Bucket 是否存在
    await client.headBucket(bucketName);
    console.log(`[TOS] Bucket "${bucketName}" 已存在`);
    bucketChecked = true;
  } catch (error: any) {
    if (error.statusCode === 404) {
      // Bucket 不存在，创建它
      console.log(`[TOS] Bucket "${bucketName}" 不存在，正在创建...`);
      try {
        await client.createBucket({
          bucket: bucketName,
          // 设置为公共读，以便图片可以通过 URL 访问
          acl: ACLType.ACLPublicRead,
        });
        console.log(`[TOS] Bucket "${bucketName}" 创建成功`);
        bucketChecked = true;
      } catch (createError: any) {
        console.error('[TOS] 创建 Bucket 失败:', createError.message);
        throw new Error(`创建 TOS Bucket 失败: ${createError.message}`);
      }
    } else {
      console.error('[TOS] 检查 Bucket 失败:', error.message);
      throw error;
    }
  }
}

/**
 * 从 base64 数据中提取 MIME 类型和纯 base64 内容
 */
function parseBase64Image(base64Data: string): { mimeType: string; extension: string; data: Buffer } {
  const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);

  if (matches) {
    const extension = matches[1];
    const mimeType = `image/${extension}`;
    const data = Buffer.from(matches[2], 'base64');
    return { mimeType, extension, data };
  }

  // 没有 data URL 前缀，假设是纯 base64
  const data = Buffer.from(base64Data, 'base64');
  return { mimeType: 'image/png', extension: 'png', data };
}

/**
 * 上传图片到 TOS
 * @param base64Data base64 编码的图片数据（可带或不带 data URL 前缀）
 * @returns 图片的公网访问 URL
 */
export async function uploadToTOS(base64Data: string): Promise<string> {
  // 如果已经是 URL，直接返回
  if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
    console.log('[TOS] 图片已是 URL 格式，跳过上传');
    return base64Data;
  }

  console.log('[TOS] 开始上传图片...');

  // 确保 Bucket 存在
  await ensureBucketExists();

  const client = getClient();
  const { mimeType, extension, data } = parseBase64Image(base64Data);

  // 生成唯一的文件名
  const timestamp = Date.now();
  const uuid = randomUUID().slice(0, 8);
  const key = `images/${timestamp}-${uuid}.${extension}`;

  try {
    // 上传文件（设置公共读权限，确保豆包 API 能访问）
    await client.putObject({
      bucket: TOS_CONFIG.bucket,
      key,
      body: data,
      contentType: mimeType,
      acl: ACLType.ACLPublicRead,
    });

    // 构建公网访问 URL
    const url = `https://${TOS_CONFIG.bucket}.${TOS_CONFIG.endpoint}/${key}`;
    console.log(`[TOS] 上传成功: ${url}`);

    return url;
  } catch (error: any) {
    console.error('[TOS] 上传失败:', error.message);
    throw new Error(`TOS 上传失败: ${error.message}`);
  }
}

/**
 * 批量上传图片到 TOS
 */
export async function uploadImagesToTOS(base64Images: string[]): Promise<string[]> {
  console.log(`[TOS] 批量上传 ${base64Images.length} 张图片...`);

  const results = await Promise.all(
    base64Images.map(async (img, index) => {
      try {
        const url = await uploadToTOS(img);
        console.log(`[TOS] 第 ${index + 1} 张上传成功`);
        return url;
      } catch (error) {
        console.error(`[TOS] 第 ${index + 1} 张上传失败:`, error);
        throw error;
      }
    })
  );

  return results;
}

/**
 * 从 URL 下载图片并直接上传到 TOS（不转 base64，更快）
 * @param imageUrl 源图片 URL
 * @returns TOS 上的永久访问 URL
 */
export async function uploadFromUrl(imageUrl: string): Promise<string> {
  console.log('[TOS] 从 URL 下载并上传图片...');

  // 确保 Bucket 存在
  await ensureBucketExists();

  const client = getClient();

  // 下载图片
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`下载图片失败: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const extension = contentType.split('/')[1] || 'jpg';

  // 生成唯一的文件名
  const timestamp = Date.now();
  const uuid = randomUUID().slice(0, 8);
  const key = `generated/${timestamp}-${uuid}.${extension}`;

  try {
    // 上传到 TOS
    await client.putObject({
      bucket: TOS_CONFIG.bucket,
      key,
      body: buffer,
      contentType,
      acl: ACLType.ACLPublicRead,
    });

    // 构建公网访问 URL
    const url = `https://${TOS_CONFIG.bucket}.${TOS_CONFIG.endpoint}/${key}`;
    console.log(`[TOS] 转存成功: ${url}`);

    return url;
  } catch (error: any) {
    console.error('[TOS] 转存失败:', error.message);
    throw new Error(`TOS 转存失败: ${error.message}`);
  }
}

/**
 * 检查 TOS 配置是否完整
 */
export function isTOSConfigured(): boolean {
  return !!(TOS_CONFIG.accessKeyId && TOS_CONFIG.accessKeySecret);
}

/**
 * 获取 TOS 配置信息（用于调试，不包含敏感信息）
 */
export function getTOSConfigInfo(): Record<string, string> {
  return {
    endpoint: TOS_CONFIG.endpoint,
    region: TOS_CONFIG.region,
    bucket: TOS_CONFIG.bucket,
    configured: isTOSConfigured() ? 'yes' : 'no',
  };
}
