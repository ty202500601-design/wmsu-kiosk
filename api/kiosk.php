<?php
/* Combined public kiosk bootstrap endpoint: returns active vendors, categories, foods, and canteen settings in ONE ETag-cached roundtrip */
require __DIR__ . '/../includes/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('Method not allowed.', 405);

$vendors = q("SELECT * FROM vendors WHERE status='active' ORDER BY is_open DESC, name ASC")->fetchAll();
foreach ($vendors as &$v) {
  $avail = vendor_gcash_ready($v);
  $v['gcash_available'] = $avail ? 1 : 0;
  $v['has_gcash'] = $v['gcash_available'];
  $v['gcash_enabled'] = $avail ? 1 : 0;
  $v['gcash_qr_path'] = $avail ? ltrim(str_replace('\\', '/', trim((string)$v['gcash_qr_path'])), '/') : null;
  $v['gcash_account_name'] = $avail ? trim((string)($v['gcash_account_name'] ?? '')) : null;
  unset(
    $v['user_id'], $v['phone'], $v['gcash_number'], $v['gcash_name'],
    $v['gcash_qr'], $v['maya_number'], $v['maya_name'],
    $v['paymongo_secret_enc'], $v['paymongo_webhook_secret']
  );
}
unset($v);

$categories = q('SELECT id,vendor_id,name,icon FROM categories ORDER BY name')->fetchAll();

$foods = q("SELECT f.*, v.name AS vendor_name, v.is_open AS vendor_open,
  (SELECT COALESCE(SUM(oi.qty),0) FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.food_id=f.id AND o.order_status<>'Cancelled') AS order_count
  FROM foods f
  JOIN vendors v ON v.id=f.vendor_id
  WHERE v.status='active'
  ORDER BY f.is_available DESC, f.name ASC")->fetchAll();

$settings = settings_all();

respond_cached([
  'vendors' => $vendors,
  'categories' => $categories,
  'foods' => $foods,
  'settings' => $settings,
], 10, 60);
