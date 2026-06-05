-- Migration: set telegram_chat_id for Mayorin user
-- Run: mysql -u <user> -p pts_db < 002_set_mayor_telegram.sql

UPDATE users
SET telegram_chat_id = '6616833243'
WHERE username = 'Mayorin' OR (id = 22);
