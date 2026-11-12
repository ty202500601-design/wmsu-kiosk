<?php /* GET public active vendors | GET ?scope=all (admin) | GET ?me=1 | POST ?action=apply | PATCH ?id | DELETE ?id (admin) */
require __DIR__ . '/../includes/bootstrap.php';
$m = $_SERVER['REQUEST_METHOD']; $u = me();
if ($m === 'GET') {
  if (isset($_GET['me'])) { $u = need_role('vendor'); respond(q('SELECT id,name,owner_name,description,phone,status,is_open FROM vendors WHERE user_id=?', [$u['id']])->fetch()); }
  if (($_GET['scope'] ?? '') === 'all') { need_role('admin'); respond(q('SELECT v.*,u.email FROM vendors v JOIN users u ON u.id=v.user_id ORDER BY v.id DESC')->fetchAll()); }
  respond(q("SELECT id,name,description,is_open FROM vendors WHERE status='active' ORDER BY name")->fetchAll());
}
if ($m === 'POST' && ($_GET['action'] ?? '') === 'apply') {
  $b = body(); $em = email($b); $pw = password($b); $stall = str($b, 'stall_name', 2, 100); $owner = str($b, 'owner_name', 2, 100); $ph = phone($b);
  if (q('SELECT 1 FROM users WHERE email=?', [$em])->fetch()) fail('That email is already registered.', 409, ['email' => 'Already registered.']);
  $pdo = db(); $pdo->beginTransaction();
  try { q("INSERT INTO users(name,email,password_hash,role,status) VALUES(?,?,?,'vendor','pending')", [$owner, $em, password_hash($pw, PASSWORD_DEFAULT)]);
    q("INSERT INTO vendors(user_id,name,owner_name,phone,status) VALUES(?,?,?,?,'pending')", [$pdo->lastInsertId(), $stall, $owner, $ph]); $pdo->commit(); }
  catch (Throwable $e) { $pdo->rollBack(); throw $e; }
  respond(null, 201);
}
$u = need_role('vendor', 'admin'); $id = id();
if ($m === 'PATCH') { $b = body(); $set = []; $p = [];
  if ($u['role'] === 'vendor') { if ($id !== my_vendor_id($u)) fail('You can only edit your own profile.', 403);
    foreach (['name' => [2, 100], 'description' => [0, 255]] as $k => [$a, $z]) if (isset($b[$k])) { $set[] = "$k=?"; $p[] = str($b, $k, $a, $z, false) ?? ''; }
    if (isset($b['phone'])) { $set[] = 'phone=?'; $p[] = phone($b); } if (isset($b['is_open'])) { $set[] = 'is_open=?'; $p[] = $b['is_open'] ? 1 : 0; }
  } else {
    foreach (['name' => [2, 100], 'description' => [0, 255]] as $k => [$a, $z]) if (isset($b[$k])) { $set[] = "$k=?"; $p[] = str($b, $k, $a, $z, false) ?? ''; }
    if (isset($b['status'])) { $set[] = 'status=?'; $p[] = $st = one_of($b, 'status', ['pending', 'active', 'suspended', 'rejected']); }
  }
  if (!$set) fail('Nothing to update.', 422); $p[] = $id; q('UPDATE vendors SET ' . implode(',', $set) . ' WHERE id=?', $p);
  if (isset($st)) { if ($st === 'active') q("UPDATE users SET status='active' WHERE id=(SELECT user_id FROM vendors WHERE id=?)", [$id]); audit('vendor.status', "id=$id $st"); }
  respond(); }
if ($m === 'DELETE') { need_role('admin'); q('DELETE FROM users WHERE id=(SELECT user_id FROM vendors WHERE id=?)', [$id]); audit('vendor.delete', "id=$id"); respond(); }
fail('Method not allowed.', 405);
