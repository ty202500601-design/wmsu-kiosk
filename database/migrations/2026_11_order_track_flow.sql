-- Migration: Defer tracking number generation until payment confirmation (or cash order acceptance)
USE wmsu_canteen;
ALTER TABLE orders MODIFY COLUMN track_code CHAR(6) NULL DEFAULT NULL;
ALTER TABLE orders ADD COLUMN checkout_token CHAR(16) NULL DEFAULT NULL AFTER track_code;
ALTER TABLE orders ADD INDEX idx_orders_token (checkout_token);
UPDATE orders SET checkout_token = UPPER(SUBSTRING(MD5(CONCAT(id, order_no, created_at)), 1, 16)) WHERE checkout_token IS NULL;
