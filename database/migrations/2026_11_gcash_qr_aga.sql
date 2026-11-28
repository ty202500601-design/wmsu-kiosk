USE wmsu_canteen;

-- 1. Backward-compatible GCash QR columns on vendors
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS gcash_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER gcash_qr,
  ADD COLUMN IF NOT EXISTS gcash_qr_path VARCHAR(255) NULL DEFAULT NULL AFTER gcash_enabled,
  ADD COLUMN IF NOT EXISTS gcash_account_name VARCHAR(100) NULL DEFAULT NULL AFTER gcash_qr_path;

-- Keep all other vendors disabled, enable GCash QR ONLY for Aga's Campus Bite (id = 1)
UPDATE vendors
SET gcash_enabled = 0;

UPDATE vendors
SET name = 'Aga''s Campus Bite',
    description = 'Grilled hotdogs, silog rice bowls, and quick campus snacks cooked fresh to order.',
    gcash_enabled = 1,
    gcash_qr_path = 'uploads/qr/aga.png',
    gcash_account_name = 'XA****A KA*E G.'
WHERE id = 1 OR LOWER(name) IN ('aga', 'aga''s campus bite', 'aga''s campus bites');

-- 2. Backward-compatible order_code, proof_path, reject_reason, and 'submitted' / 'Rejected' statuses
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_code VARCHAR(24) NULL DEFAULT NULL AFTER track_code,
  MODIFY COLUMN payment_status ENUM('Unpaid','Pending','Pending Verification','submitted','Paid','Failed','Rejected','Refunded') NOT NULL DEFAULT 'Unpaid';

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS order_code VARCHAR(24) NULL DEFAULT NULL AFTER method,
  ADD COLUMN IF NOT EXISTS proof_path VARCHAR(255) NULL DEFAULT NULL AFTER reference,
  ADD COLUMN IF NOT EXISTS reject_reason VARCHAR(200) NULL DEFAULT NULL AFTER proof_path,
  MODIFY COLUMN status ENUM('Unpaid','Pending','Pending Verification','submitted','Paid','Failed','Rejected','Refunded') NOT NULL DEFAULT 'Unpaid';
