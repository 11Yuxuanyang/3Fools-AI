/**
 * Supabase 客户端
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[Supabase] 警告: 缺少 Supabase 环境变量，数据库功能不可用');
}

// 使用 service_role key，拥有完整数据库访问权限
export const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

/**
 * 检查 Supabase 是否可用
 */
export function isSupabaseAvailable(): boolean {
  return supabase !== null;
}
