/**
 * 项目管理路由 - 云端存储
 */

import { Router, Request, Response, NextFunction } from 'express';
import { supabase, isSupabaseAvailable } from '../lib/supabase.js';
import { verifyToken } from '../services/authService.js';

export const projectsRouter = Router();

// 扩展 Request 类型
interface AuthenticatedRequest extends Request {
  userId?: string;
}

/**
 * 认证中间件
 */
async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
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

  req.userId = payload.userId;
  next();
}

// 所有路由需要认证
projectsRouter.use(authMiddleware);

/**
 * GET /api/projects
 * 获取用户所有项目
 */
projectsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  if (!isSupabaseAvailable() || !supabase) {
    return res.status(503).json({
      success: false,
      error: '数据库服务不可用',
    });
  }

  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, name, thumbnail, created_at, updated_at')
      .eq('user_id', req.userId)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      data: { projects: projects || [] },
    });
  } catch (error) {
    console.error('[Projects] 获取项目列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取项目列表失败',
    });
  }
});

/**
 * GET /api/projects/:id
 * 获取单个项目详情
 */
projectsRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (!isSupabaseAvailable() || !supabase) {
    return res.status(503).json({
      success: false,
      error: '数据库服务不可用',
    });
  }

  try {
    const { id } = req.params;

    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId)
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
  } catch (error) {
    console.error('[Projects] 获取项目详情失败:', error);
    res.status(500).json({
      success: false,
      error: '获取项目详情失败',
    });
  }
});

/**
 * POST /api/projects
 * 创建新项目
 */
projectsRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  if (!isSupabaseAvailable() || !supabase) {
    return res.status(503).json({
      success: false,
      error: '数据库服务不可用',
    });
  }

  try {
    const { name, items, viewport, thumbnail } = req.body;

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: req.userId,
        name: name || '未命名项目',
        items: items || [],
        viewport: viewport || { scale: 1, pan: { x: 0, y: 0 } },
        thumbnail: thumbnail || null,
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
  } catch (error) {
    console.error('[Projects] 创建项目失败:', error);
    res.status(500).json({
      success: false,
      error: '创建项目失败',
    });
  }
});

/**
 * PUT /api/projects/:id
 * 更新项目
 */
projectsRouter.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (!isSupabaseAvailable() || !supabase) {
    return res.status(503).json({
      success: false,
      error: '数据库服务不可用',
    });
  }

  try {
    const { id } = req.params;
    const { name, items, viewport, thumbnail } = req.body;

    // 验证项目归属
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.userId)
      .eq('is_deleted', false)
      .single();

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '项目不存在',
      });
    }

    // 准备更新数据
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (items !== undefined) updateData.items = items;
    if (viewport !== undefined) updateData.viewport = viewport;
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail;

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
  } catch (error) {
    console.error('[Projects] 更新项目失败:', error);
    res.status(500).json({
      success: false,
      error: '更新项目失败',
    });
  }
});

/**
 * DELETE /api/projects/:id
 * 删除项目（软删除）
 */
projectsRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (!isSupabaseAvailable() || !supabase) {
    return res.status(503).json({
      success: false,
      error: '数据库服务不可用',
    });
  }

  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('projects')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('user_id', req.userId);

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      message: '项目已删除',
    });
  } catch (error) {
    console.error('[Projects] 删除项目失败:', error);
    res.status(500).json({
      success: false,
      error: '删除项目失败',
    });
  }
});

/**
 * POST /api/projects/:id/duplicate
 * 复制项目
 */
projectsRouter.post('/:id/duplicate', async (req: AuthenticatedRequest, res: Response) => {
  if (!isSupabaseAvailable() || !supabase) {
    return res.status(503).json({
      success: false,
      error: '数据库服务不可用',
    });
  }

  try {
    const { id } = req.params;

    // 获取原项目
    const { data: original } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId)
      .eq('is_deleted', false)
      .single();

    if (!original) {
      return res.status(404).json({
        success: false,
        error: '项目不存在',
      });
    }

    // 创建副本
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: req.userId,
        name: `${original.name} (副本)`,
        items: original.items,
        viewport: original.viewport,
        thumbnail: original.thumbnail,
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
  } catch (error) {
    console.error('[Projects] 复制项目失败:', error);
    res.status(500).json({
      success: false,
      error: '复制项目失败',
    });
  }
});
