-- Migration: Remove customer login/accounts (kiosk-only customer flow)
USE wmsu_canteen;
DELETE FROM users WHERE role = 'customer';
ALTER TABLE users MODIFY COLUMN role ENUM('vendor','admin') NOT NULL;
