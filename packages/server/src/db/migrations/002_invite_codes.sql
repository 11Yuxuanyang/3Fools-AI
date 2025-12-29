-- 邀请码系统
-- 用户可以使用邀请码获得额外积分

-- 邀请码表
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,           -- 邀请码（如 SANSA2024）
  bonus_credits INT NOT NULL DEFAULT 50,      -- 奖励积分数
  max_uses INT DEFAULT NULL,                  -- 最大使用次数（NULL = 无限）
  used_count INT NOT NULL DEFAULT 0,          -- 已使用次数
  expires_at TIMESTAMPTZ DEFAULT NULL,        -- 过期时间（NULL = 永不过期）
  is_active BOOLEAN NOT NULL DEFAULT true,    -- 是否启用
  description VARCHAR(255),                   -- 描述（内部备注）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 邀请码使用记录表
CREATE TABLE IF NOT EXISTS invite_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_id UUID NOT NULL REFERENCES invite_codes(id),
  user_id UUID NOT NULL REFERENCES users(id),
  credits_granted INT NOT NULL,               -- 实际获得的积分
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(invite_code_id, user_id)             -- 每个用户每个邀请码只能用一次
);
CREATE INDEX IF NOT EXISTS idx_invite_code_uses_user ON invite_code_uses(user_id);

-- 创建一个默认邀请码
INSERT INTO invite_codes (code, bonus_credits, description)
VALUES ('SANSA2024', 50, '三傻官方邀请码')
ON CONFLICT (code) DO NOTHING;

-- 更新触发器
DROP TRIGGER IF EXISTS update_invite_codes_updated_at ON invite_codes;
CREATE TRIGGER update_invite_codes_updated_at
  BEFORE UPDATE ON invite_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
