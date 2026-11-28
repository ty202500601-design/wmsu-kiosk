<?php /* GET public (vendor_id, category_id, q) | GET ?id | POST | PATCH ?id | DELETE ?id | POST ?action=image&id= (multipart) */
require __DIR__ . '/../includes/bootstrap.php';
$m = $_SERVER['REQUEST_METHOD']; $u = me(); $isV = $u && $u['role'] === 'vendor'; $isA = $u && $u['role'] === 'admin';
$sel = "SELECT f.*, v.name AS vendor_name, v.is_open AS vendor_open,
  (SELECT COALESCE(SUM(oi.qty),0) FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.food_id=f.id AND o.order_status<>'Cancelled') AS order_count
  FROM foods f JOIN vendors v ON v.id=f.vendor_id ";
if ($m === 'GET') { $w = ["v.status='active'"]; $p = [];
  if (isset($_GET['id'])) { $w[] = 'f.id=?'; $p[] = id(); }
  if (isset($_GET['vendor_id'])) { $w[] = 'f.vendor_id=?'; $p[] = id('vendor_id'); }
  if (isset($_GET['category_id'])) { $w[] = 'f.category_id=?'; $p[] = id('category_id'); }
  if (!empty($_GET['available'])) { $w[] = 'f.is_available=1'; }
  if (($s = trim((string)($_GET['q'] ?? ''))) !== '') { $w[] = 'f.name LIKE ?'; $p[] = '%' . addcslashes(mb_substr($s, 0, 60), '%_\\') . '%'; }
  if ($isV && isset($_GET['manage'])) { $w = ['f.vendor_id=?']; $p = [my_vendor_id($u)]; }
  elseif ($isA && isset($_GET['manage'])) { $w = ['1=1']; $p = []; }
  $rows = q($sel . 'WHERE ' . implode(' AND ', $w) . ' ORDER BY f.is_available DESC, f.name ASC', $p)->fetchAll();
  if (isset($_GET['id']) && !$rows) fail('Food item not found.', 404);
  $out = isset($_GET['id']) ? $rows[0] : $rows;
  if (!isset($_GET['manage'])) respond_cached($out, 10, 60);
  respond($out); }

$u = need_role('vendor'); $own = my_vendor_id($u);
function owned(int $id, ?int $own): array { $f = q('SELECT * FROM foods WHERE id=?', [$id])->fetch(); if (!$f || ($own !== null && (int)$f['vendor_id'] !== $own)) fail('Food item not found.', 404); return $f; }
function cat_ok(?int $cid, int $vid): ?int { if (!$cid) return null; if (!q('SELECT 1 FROM categories WHERE id=? AND (vendor_id IS NULL OR vendor_id=?)', [$cid, $vid])->fetch()) fail('Invalid category.', 422, ['category_id' => 'Not available for this vendor.']); return $cid; }

if ($m === 'POST' && ($_GET['action'] ?? '') === 'image') {
  $f = owned(id(), $own);
  archive_old_upload($f['image_path'] ?? null);
  if (($f['thumb_path'] ?? null) && ($f['thumb_path'] !== ($f['image_path'] ?? null))) archive_old_upload($f['thumb_path']);
  archive_old_upload($f['image'] ?? null, 'foods');
  $pair = save_menu_photo_pair($_FILES['image'] ?? null, (int)$f['vendor_id'], (int)$f['id'], (string)$f['name']);
  q('UPDATE foods SET image_path=?, thumb_path=?, avg_color=?, lqip=?, image=NULL WHERE id=?', [$pair['image_path'], $pair['thumb_path'], $pair['avg_color'] ?? null, $pair['lqip'] ?? null, $f['id']]);
  audit('food.image', "id={$f['id']} {$pair['image_path']}");
  respond($pair);
}

$b = body();
function stock_ok($v): ?int { if ($v === null || $v === '') return null; if (!is_numeric($v) || (int)$v < 0 || (int)$v > 99999) fail('Stock must be 0 to 99999 (or blank for unlimited).', 422); return (int)$v; }
if ($m === 'POST') { $vid = $own ?? (int)($b['vendor_id'] ?? 0); if (!q("SELECT 1 FROM vendors WHERE id=? AND status='active'", [$vid])->fetch()) fail('Choose a valid vendor.', 422);
  $stk = array_key_exists('stock_qty', $b) ? stock_ok($b['stock_qty']) : null;
  $avail = ($stk === 0) ? 0 : (empty($b['is_available']) ? 0 : 1);
  q('INSERT INTO foods(vendor_id,category_id,name,description,price,stock_qty,is_available) VALUES(?,?,?,?,?,?,?)', [$vid, cat_ok(isset($b['category_id']) ? (int)$b['category_id'] : null, $vid), str($b, 'name', 2, 100), str($b, 'description', 0, 255, false) ?? '', num($b, 'price', 0.01, 100000), $stk, $avail]);
  audit('food.create', $b['name']); respond(['id' => (int)db()->lastInsertId()], 201); }

$f = owned(id(), $own);
if ($m === 'PATCH') { $set = []; $p = [];
  if (isset($b['name'])) { $set[] = 'name=?'; $p[] = str($b, 'name', 2, 100); } if (isset($b['description'])) { $set[] = 'description=?'; $p[] = str($b, 'description', 0, 255, false) ?? ''; }
  if (isset($b['price'])) { $set[] = 'price=?'; $p[] = num($b, 'price', 0.01, 100000); }
  if (array_key_exists('stock_qty', $b)) { $stk = stock_ok($b['stock_qty']); $set[] = 'stock_qty=?'; $p[] = $stk; if ($stk === 0) { $set[] = 'is_available=0'; } }
  if (isset($b['is_available'])) { $set[] = 'is_available=?'; $p[] = $b['is_available'] ? 1 : 0; }
  if (array_key_exists('category_id', $b)) { $set[] = 'category_id=?'; $p[] = cat_ok($b['category_id'] ? (int)$b['category_id'] : null, (int)$f['vendor_id']); }
  if (!$set) fail('Nothing to update.', 422); $p[] = $f['id']; q('UPDATE foods SET ' . implode(',', $set) . ' WHERE id=?', $p); audit('food.update', 'id=' . $f['id']); respond(); }
if ($m === 'DELETE') {
  q('DELETE FROM foods WHERE id=?', [$f['id']]);
  archive_old_upload($f['image_path'] ?? null);
  if (($f['thumb_path'] ?? null) && ($f['thumb_path'] !== ($f['image_path'] ?? null))) archive_old_upload($f['thumb_path']);
  archive_old_upload($f['image'] ?? null, 'foods');
  audit('food.delete', 'id=' . $f['id']);
  respond();
}
fail('Method not allowed.', 405);
