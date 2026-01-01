/**
 * Auth Types
 * Types for authentication and user management
 */

export interface User {
  id: string;
  phone?: string;
  nickname: string;
  avatar_url?: string;
  membership_type: string;
  daily_quota: number;
  is_admin?: boolean;
}

export interface JWTPayload {
  userId: string;
  phone?: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    nickname: string;
    avatar: string;
    membership_type: string;
    isAdmin: boolean;
  };
}
