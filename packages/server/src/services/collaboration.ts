/**
 * 协作服务 - 管理实时协作房间和用户状态
 */

import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';

// 协作用户信息
export interface CollaboratorInfo {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selectedIds?: string[];
  lastActive: number;
}

// 房间信息
export interface RoomInfo {
  projectId: string;
  users: Map<string, CollaboratorInfo>;
  doc: Y.Doc;
  createdAt: number;
}

// 用户颜色池
const COLORS = [
  '#F87171', // red
  '#FB923C', // orange
  '#FBBF24', // amber
  '#A3E635', // lime
  '#34D399', // emerald
  '#22D3EE', // cyan
  '#60A5FA', // blue
  '#A78BFA', // violet
  '#F472B6', // pink
];

class CollaborationService {
  private rooms: Map<string, RoomInfo> = new Map();
  private userSockets: Map<string, Socket> = new Map();
  private colorIndex = 0;

  /**
   * 初始化 Socket.io 服务
   */
  init(io: Server) {

    io.on('connection', (socket) => {
      console.log(`[Collab] 用户连接: ${socket.id}`);

      // 加入房间
      socket.on('join-room', (data: { projectId: string; userId: string; userName: string }) => {
        this.handleJoinRoom(socket, data);
      });

      // 离开房间
      socket.on('leave-room', (data: { projectId: string }) => {
        this.handleLeaveRoom(socket, data.projectId);
      });

      // 光标移动
      socket.on('cursor-move', (data: { projectId: string; x: number; y: number }) => {
        this.handleCursorMove(socket, data);
      });

      // 选择变化
      socket.on('selection-change', (data: { projectId: string; selectedIds: string[] }) => {
        this.handleSelectionChange(socket, data);
      });

      // Yjs 同步更新
      socket.on('yjs-update', (data: { projectId: string; update: Uint8Array }) => {
        this.handleYjsUpdate(socket, data);
      });

      // 画布操作同步
      socket.on('canvas-operation', (data: { projectId: string; operation: unknown }) => {
        this.handleCanvasOperation(socket, data);
      });

      // 请求同步状态
      socket.on('sync-request', (data: { projectId: string }) => {
        this.handleSyncRequest(socket, data.projectId);
      });

      // 断开连接
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });

    console.log('[Collab] 协作服务已初始化');
  }

  /**
   * 获取下一个用户颜色
   */
  private getNextColor(): string {
    const color = COLORS[this.colorIndex % COLORS.length];
    this.colorIndex++;
    return color;
  }

  /**
   * 处理用户加入房间
   */
  private handleJoinRoom(
    socket: Socket,
    data: { projectId: string; userId: string; userName: string }
  ) {
    const { projectId, userId, userName } = data;

    // 获取或创建房间
    let room = this.rooms.get(projectId);
    if (!room) {
      room = {
        projectId,
        users: new Map(),
        doc: new Y.Doc(),
        createdAt: Date.now(),
      };
      this.rooms.set(projectId, room);
      console.log(`[Collab] 创建房间: ${projectId}`);
    }

    // 创建用户信息
    const userInfo: CollaboratorInfo = {
      id: userId,
      name: userName,
      color: this.getNextColor(),
      lastActive: Date.now(),
    };

    // 添加用户到房间
    room.users.set(socket.id, userInfo);
    this.userSockets.set(socket.id, socket);

    // 加入 Socket.io 房间
    socket.join(projectId);

    // 发送当前房间状态给新用户
    const users = Array.from(room.users.values());
    socket.emit('room-state', {
      projectId,
      users,
      yourColor: userInfo.color,
      yourId: userId,
    });

    // 发送 Yjs 文档状态
    const docState = Y.encodeStateAsUpdate(room.doc);
    socket.emit('yjs-state', { update: Array.from(docState) });

    // 通知其他用户
    socket.to(projectId).emit('user-joined', {
      user: userInfo,
      users,
    });

    console.log(`[Collab] 用户 ${userName} 加入房间 ${projectId}, 当前 ${room.users.size} 人`);
  }

  /**
   * 处理用户离开房间
   */
  private handleLeaveRoom(socket: Socket, projectId: string) {
    const room = this.rooms.get(projectId);
    if (!room) return;

    const userInfo = room.users.get(socket.id);
    if (!userInfo) return;

    // 移除用户
    room.users.delete(socket.id);
    this.userSockets.delete(socket.id);
    socket.leave(projectId);

    // 通知其他用户
    const users = Array.from(room.users.values());
    socket.to(projectId).emit('user-left', {
      userId: userInfo.id,
      users,
    });

    console.log(`[Collab] 用户 ${userInfo.name} 离开房间 ${projectId}, 剩余 ${room.users.size} 人`);

    // 清理空房间
    if (room.users.size === 0) {
      this.rooms.delete(projectId);
      console.log(`[Collab] 房间 ${projectId} 已清理`);
    }
  }

  /**
   * 处理光标移动
   */
  private handleCursorMove(
    socket: Socket,
    data: { projectId: string; x: number; y: number }
  ) {
    const room = this.rooms.get(data.projectId);
    if (!room) return;

    const userInfo = room.users.get(socket.id);
    if (!userInfo) return;

    // 更新用户光标
    userInfo.cursor = { x: data.x, y: data.y };
    userInfo.lastActive = Date.now();

    // 广播给其他用户
    socket.to(data.projectId).emit('cursor-update', {
      oderId: userInfo.id,
      cursor: userInfo.cursor,
      color: userInfo.color,
      name: userInfo.name,
    });
  }

  /**
   * 处理选择变化
   */
  private handleSelectionChange(
    socket: Socket,
    data: { projectId: string; selectedIds: string[] }
  ) {
    const room = this.rooms.get(data.projectId);
    if (!room) return;

    const userInfo = room.users.get(socket.id);
    if (!userInfo) return;

    // 更新用户选择
    userInfo.selectedIds = data.selectedIds;
    userInfo.lastActive = Date.now();

    // 广播给其他用户
    socket.to(data.projectId).emit('selection-update', {
      userId: userInfo.id,
      selectedIds: data.selectedIds,
      color: userInfo.color,
    });
  }

  /**
   * 处理 Yjs 更新
   */
  private handleYjsUpdate(
    socket: Socket,
    data: { projectId: string; update: Uint8Array }
  ) {
    const room = this.rooms.get(data.projectId);
    if (!room) return;

    // 应用更新到文档
    const update = new Uint8Array(data.update);
    Y.applyUpdate(room.doc, update);

    // 广播给其他用户
    socket.to(data.projectId).emit('yjs-update', {
      update: Array.from(update),
    });
  }

  /**
   * 处理画布操作同步
   */
  private handleCanvasOperation(
    socket: Socket,
    data: { projectId: string; operation: unknown }
  ) {
    const room = this.rooms.get(data.projectId);
    if (!room) return;

    const userInfo = room.users.get(socket.id);
    if (!userInfo) return;

    // 广播给其他用户
    socket.to(data.projectId).emit('canvas-operation', {
      operation: data.operation,
      fromUserId: userInfo.id,
    });
  }

  /**
   * 处理同步请求
   */
  private handleSyncRequest(socket: Socket, projectId: string) {
    const room = this.rooms.get(projectId);
    if (!room) return;

    // 发送完整文档状态
    const docState = Y.encodeStateAsUpdate(room.doc);
    socket.emit('yjs-state', { update: Array.from(docState) });
  }

  /**
   * 处理断开连接
   */
  private handleDisconnect(socket: Socket) {
    // 查找并离开所有房间
    for (const [projectId, room] of this.rooms.entries()) {
      if (room.users.has(socket.id)) {
        this.handleLeaveRoom(socket, projectId);
      }
    }
    console.log(`[Collab] 用户断开连接: ${socket.id}`);
  }

  /**
   * 获取房间信息
   */
  getRoomInfo(projectId: string): RoomInfo | undefined {
    return this.rooms.get(projectId);
  }

  /**
   * 获取房间用户列表
   */
  getRoomUsers(projectId: string): CollaboratorInfo[] {
    const room = this.rooms.get(projectId);
    if (!room) return [];
    return Array.from(room.users.values());
  }
}

export const collaborationService = new CollaborationService();
