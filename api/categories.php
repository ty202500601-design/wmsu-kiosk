<?php /* GET public (?vendor_id= -> global + that vendor's) | POST | PATCH ?id | DELETE ?id. Vendors manage only their own; admin manages all. */
require __DIR__ . '/../includes/bootstrap.php';
$m = $_SERVER['REQUEST_METHOD'];
if ($m === 'GET') { $vid = isset($_GET['vendor_id']) ? id('vendor_id') : null;
  respond_cached($vid ? q('SELECT id,vendor_id,name,icon FROM categories WHERE vendor_id IS NULL OR vendor_id=? ORDER BY name', [$vid])->fetchAll() : q('SELECT id,vendor_id,name,icon FROM categories ORDER BY name')->fetchAll(), 15, 60); }
$u = need_role('vendor', 'admin'); $own = $u['role'] === 'vendor' ? my_vendor_id($u) : null; $b = body();
if ($m === 'POST') { $vid = $own ?? (isset($b['vendor_id']) && $b['vendor_id'] !== null ? (int)$b['vendor_id'] : null); // admin: null = global
  q('INSERT INTO categories(vendor_id,name,icon) VALUES(?,?,?)', [$vid, str($b, 'name', 2, 60), str($b, 'icon', 0, 8, false) ?? '']); audit('category.create', $b['name']); respond(['id' => (int)db()->lastInsertId()], 201); }
$id = id(); $c = q('SELECT vendor_id FROM categories WHERE id=?', [$id])->fetch();
if (!$c || ($own !== null && (int)$c['vendor_id'] !== $own)) fail('Category not found.', 404); // hides other vendors' / global categories
if ($m === 'PATCH') { q('UPDATE categories SET name=?,icon=? WHERE id=?', [str($b, 'name', 2, 60), str($b, 'icon', 0, 8, false) ?? '', $id]); audit('category.update', "id=$id"); respond(); }
if ($m === 'DELETE') { q('DELETE FROM categories WHERE id=?', [$id]); audit('category.delete', "id=$id"); respond(); }
fail('Method not allowed.', 405);
