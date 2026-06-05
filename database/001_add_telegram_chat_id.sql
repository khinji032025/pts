-- Migration: add telegram_chat_id to users
ALTER TABLE users
  ADD COLUMN telegram_chat_id VARCHAR(64) NULL AFTER marker_role;

CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users(telegram_chat_id(32));
