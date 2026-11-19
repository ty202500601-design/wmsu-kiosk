-- Safe, additive migration. Run once against wmsu_canteen (re-running reports "Duplicate" errors that can be ignored).
USE wmsu_canteen;
-- Media / state columns used by the UI (skip if already present)
-- ALTER TABLE vendors ADD COLUMN gcash_qr VARCHAR(120) NULL DEFAULT NULL AFTER gcash_name;
-- ALTER TABLE vendors ADD COLUMN banner VARCHAR(120) NULL DEFAULT NULL AFTER maya_name;
-- ALTER TABLE foods ADD COLUMN stock_qty INT NULL DEFAULT NULL AFTER image;
-- ALTER TABLE users ADD COLUMN ban_reason VARCHAR(255) NULL, ADD COLUMN banned_at DATETIME NULL;

-- Indexes backing the tracking, dashboards, and moderation lists
ALTER TABLE orders ADD INDEX idx_orders_track (track_code);
ALTER TABLE orders ADD INDEX idx_orders_created (created_at);
ALTER TABLE orders ADD INDEX idx_orders_vendor_pay (vendor_id, payment_status);
ALTER TABLE users ADD INDEX idx_users_role_status (role, status);
ALTER TABLE foods ADD INDEX idx_foods_avail (is_available);
-- Integrity: stock can never go negative
ALTER TABLE foods ADD CONSTRAINT chk_foods_stock CHECK (stock_qty IS NULL OR stock_qty >= 0);
