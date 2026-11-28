<?php /* GET public active vendors | GET ?scope=all (admin) | GET ?me=1 | POST (admin create) | POST/DELETE ?action=banner&id= | PATCH ?id | DELETE ?id (admin) */
require __DIR__ . '/../includes/bootstrap.php';
$m = $_SERVER['REQUEST_METHOD']; $u = me();
if ($m === 'GET') {
  if (isset($_GET['me'])) {
    $u = need_role('vendor');
    $v = q('SELECT id,name,owner_name,description,phone,gcash_number,gcash_name,gcash_qr,maya_number,maya_name,banner,status,is_open FROM vendors WHERE user_id=?', [$u['id']])->fetch();
    if (!$v) fail('Vendor record not found for this account.', 404);
    respond($v);
  }
  if (($_GET['scope'] ?? '') === 'all') { need_role('admin'); respond(q('SELECT v.*,u.email FROM vendors v JOIN users u ON u.id=v.user_id ORDER BY v.id DESC')->fetchAll()); }
  respond(q("SELECT id,name,description,is_open,gcash_number,gcash_name,gcash_qr,maya_number,maya_name,banner FROM vendors WHERE status='active' ORDER BY name")->fetchAll());
}
$act = $_GET['action'] ?? '';
if (in_array($act, ['banner', 'qr'], true)) {
  $u = need_role('vendor'); $id = id();
  if ($id !== my_vendor_id($u)) fail("You can only edit your own $act.", 403);
  $col = $act === 'qr' ? 'gcash_qr' : 'banner';
  $dir = $act === 'qr' ? 'qr' : 'banners';
  $v = q("SELECT id,$col FROM vendors WHERE id=?", [$id])->fetch();
  if (!$v) fail('Vendor not found.', 404);
  if ($m === 'POST') {
    $file = $_FILES[$act] ?? $_FILES['image'] ?? null;
    $name = save_resized_image($file, __DIR__ . "/../uploads/$dir", $act === 'qr' ? 600 : 1200);
    if (!empty($v[$col])) @unlink(__DIR__ . "/../uploads/$dir/" . basename($v[$col]));
    q("UPDATE vendors SET $col=? WHERE id=?", [$name, $id]);
    audit("vendor.$act", "id=$id");
    respond([$col => $name, $act => $name]);
  }
  if ($m === 'DELETE') {
    if (!empty($v[$col])) @unlink(__DIR__ . "/../uploads/$dir/" . basename($v[$col]));
    q("UPDATE vendors SET $col=NULL WHERE id=?", [$id]);
    audit("vendor.$act.delete", "id=$id");
    respond([$col => null]);
  }
  fail('Method not allowed.', 405);
}
if ($m === 'POST') {
  need_role('admin');
  $b = body();
  $em = email($b);
  $pw = password($b);
  $stall = str($b, 'stall_name', 2, 100);
  $owner = str($b, 'owner_name', 2, 100);
  $desc = str($b, 'description', 0, 255, false) ?? '';
  $ph = phone($b);
  $gnum = str($b, 'gcash_number', 0, 30, false) ?? '';
  $gname = str($b, 'gcash_name', 0, 100, false) ?? '';
  $mnum = str($b, 'maya_number', 0, 30, false) ?? '';
  $mname = str($b, 'maya_name', 0, 100, false) ?? '';
  if (q('SELECT 1 FROM users WHERE email=?', [$em])->fetch()) fail('That email is already registered.', 409, ['email' => 'Already registered.']);
  $pdo = db(); $pdo->beginTransaction();
  try {
    q("INSERT INTO users(name,email,password_hash,role,status) VALUES(?,?,?,'vendor','active')", [$owner, $em, password_hash($pw, PASSWORD_DEFAULT)]);
    $uid = (int)$pdo->lastInsertId();
    q("INSERT INTO vendors(user_id,name,owner_name,description,phone,gcash_number,gcash_name,maya_number,maya_name,status,is_open) VALUES(?,?,?,?,?,?,?,?,?,'active',1)",
      [$uid, $stall, $owner, $desc, $ph, $gnum, $gname, $mnum, $mname]);
    $vid = (int)$pdo->lastInsertId();
    audit('vendor.create', "id=$vid stall=$stall email=$em");
    $pdo->commit();
  } catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
  }
  respond(['id' => $vid, 'user_id' => $uid, 'name' => $stall, 'owner_name' => $owner, 'email' => $em, 'status' => 'active'], 201);
}
$u = need_role('vendor', 'admin'); $id = id();
if ($m === 'PATCH') { $b = body(); $set = []; $p = [];
  if ($u['role'] === 'vendor') { if ($id !== my_vendor_id($u)) fail('You can only edit your own profile.', 403);
    foreach (['name' => [2, 100], 'description' => [0, 255], 'gcash_number' => [0, 30], 'gcash_name' => [0, 100], 'maya_number' => [0, 30], 'maya_name' => [0, 100]] as $k => [$a, $z]) if (isset($b[$k])) { $set[] = "$k=?"; $p[] = str($b, $k, $a, $z, false) ?? ''; }
    if (isset($b['phone'])) { $set[] = 'phone=?'; $p[] = phone($b); } if (isset($b['is_open'])) { $set[] = 'is_open=?'; $p[] = $b['is_open'] ? 1 : 0; }
  } else {
    if (isset($b['status'])) { $set[] = 'status=?'; $p[] = $st = one_of($b, 'status', ['pending', 'active', 'suspended', 'rejected']); }
  }
  if (!$set) fail('Nothing to update.', 422); $p[] = $id; q('UPDATE vendors SET ' . implode(',', $set) . ' WHERE id=?', $p);
  if (isset($st)) { if ($st === 'active') q("UPDATE users SET status='active' WHERE id=(SELECT user_id FROM vendors WHERE id=?)", [$id]); audit('vendor.status', "id=$id $st"); }
  respond(); }
if ($m === 'DELETE') { need_role('admin'); $vr = q('SELECT banner,gcash_qr FROM vendors WHERE id=?', [$id])->fetch(); q('DELETE FROM users WHERE id=(SELECT user_id FROM vendors WHERE id=?)', [$id]); if (!empty($vr['banner'])) @unlink(__DIR__ . '/../uploads/banners/' . basename($vr['banner'])); if (!empty($vr['gcash_qr'])) @unlink(__DIR__ . '/../uploads/qr/' . basename($vr['gcash_qr'])); audit('vendor.delete', "id=$id"); respond(); }
fail('Method not allowed.', 405);
