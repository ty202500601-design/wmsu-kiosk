<?php /* GET public (vendor_id, category_id, q) | GET ?id | POST | PATCH ?id | DELETE ?id | POST ?action=image&id= (multipart) */
require __DIR__ . '/../includes/bootstrap.php';
$m = $_SERVER['REQUEST_METHOD']; $u = me(); $isV = $u && $u['role'] === 'vendor'; $isA = $u && $u['role'] === 'admin';
$sel = 'SELECT f.id,f.vendor_id,f.category_id,f.name,f.description,f.price,f.image,f.is_available FROM foods f JOIN vendors v ON v.id=f.vendor_id ';
if ($m === 'GET') { $w = ["v.status='active'"]; $p = [];
  if (isset($_GET['id'])) { $w[] = 'f.id=?'; $p[] = id(); }
  if (isset($_GET['vendor_id'])) { $w[] = 'f.vendor_id=?'; $p[] = id('vendor_id'); }
  if (isset($_GET['category_id'])) { $w[] = 'f.category_id=?'; $p[] = id('category_id'); }
  if (($s = trim((string)($_GET['q'] ?? ''))) !== '') { $w[] = 'f.name LIKE ?'; $p[] = '%' . addcslashes(mb_substr($s, 0, 60), '%_\\') . '%'; }
  if ($isV && isset($_GET['manage'])) { $w = ['f.vendor_id=?']; $p = [my_vendor_id($u)]; }          // vendor sees own items incl. unavailable
  elseif ($isA && isset($_GET['manage'])) { $w = ['1=1']; $p = []; }
  else $w[] = 'f.is_available=1';
  $rows = q($sel . 'WHERE ' . implode(' AND ', $w) . ' ORDER BY f.name', $p)->fetchAll();
  if (isset($_GET['id']) && !$rows) fail('Food item not found.', 404); respond(isset($_GET['id']) ? $rows[0] : $rows); }
$u = need_role('vendor', 'admin'); $own = $u['role'] === 'vendor' ? my_vendor_id($u) : null;
function owned(int $id, ?int $own): array { $f = q('SELECT * FROM foods WHERE id=?', [$id])->fetch(); if (!$f || ($own !== null && (int)$f['vendor_id'] !== $own)) fail('Food item not found.', 404); return $f; }
function cat_ok(?int $cid, int $vid): ?int { if (!$cid) return null; if (!q('SELECT 1 FROM categories WHERE id=? AND (vendor_id IS NULL OR vendor_id=?)', [$cid, $vid])->fetch()) fail('Invalid category.', 422, ['category_id' => 'Not available for this vendor.']); return $cid; }
if ($m === 'POST' && ($_GET['action'] ?? '') === 'image') { $f = owned(id(), $own); $file = $_FILES['image'] ?? null;
  if (!$file || $file['error'] !== UPLOAD_ERR_OK) fail('Choose an image to upload.', 422);
  if ($file['size'] > cfg('upload_max')) fail('Image must be 2 MB or smaller.', 422);
  $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']); $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
  if (!$ext || !getimagesize($file['tmp_name'])) fail('Only JPG, PNG or WebP images are allowed.', 422);
  $name = bin2hex(random_bytes(12)) . ".$ext"; if (!move_uploaded_file($file['tmp_name'], __DIR__ . '/../uploads/foods/' . $name)) fail('Could not save the image.', 500);
  if ($f['image']) @unlink(__DIR__ . '/../uploads/foods/' . basename($f['image']));
  q('UPDATE foods SET image=? WHERE id=?', [$name, $f['id']]); respond(['image' => $name]); }
$b = body();
if ($m === 'POST') { $vid = $own ?? (int)($b['vendor_id'] ?? 0); if (!q("SELECT 1 FROM vendors WHERE id=? AND status='active'", [$vid])->fetch()) fail('Choose a valid vendor.', 422);
  q('INSERT INTO foods(vendor_id,category_id,name,description,price,is_available) VALUES(?,?,?,?,?,?)', [$vid, cat_ok(isset($b['category_id']) ? (int)$b['category_id'] : null, $vid), str($b, 'name', 2, 100), str($b, 'description', 0, 255, false) ?? '', num($b, 'price', 0.01, 100000), empty($b['is_available']) ? 0 : 1]);
  audit('food.create', $b['name']); respond(['id' => (int)db()->lastInsertId()], 201); }
$f = owned(id(), $own);
if ($m === 'PATCH') { $set = []; $p = [];
  if (isset($b['name'])) { $set[] = 'name=?'; $p[] = str($b, 'name', 2, 100); } if (isset($b['description'])) { $set[] = 'description=?'; $p[] = str($b, 'description', 0, 255, false) ?? ''; }
  if (isset($b['price'])) { $set[] = 'price=?'; $p[] = num($b, 'price', 0.01, 100000); } if (isset($b['is_available'])) { $set[] = 'is_available=?'; $p[] = $b['is_available'] ? 1 : 0; }
  if (array_key_exists('category_id', $b)) { $set[] = 'category_id=?'; $p[] = cat_ok($b['category_id'] ? (int)$b['category_id'] : null, (int)$f['vendor_id']); }
  if (!$set) fail('Nothing to update.', 422); $p[] = $f['id']; q('UPDATE foods SET ' . implode(',', $set) . ' WHERE id=?', $p); audit('food.update', 'id=' . $f['id']); respond(); }
if ($m === 'DELETE') { q('DELETE FROM foods WHERE id=?', [$f['id']]); if ($f['image']) @unlink(__DIR__ . '/../uploads/foods/' . basename($f['image'])); audit('food.delete', 'id=' . $f['id']); respond(); }
fail('Method not allowed.', 405);
