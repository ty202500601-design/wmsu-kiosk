<?php /* GET public active vendors | GET ?scope=all (admin) | GET ?me=1 | POST (admin create) | POST/DELETE ?action=banner|qr&id= | PATCH ?id | DELETE ?id (admin) */
require __DIR__ . '/../includes/bootstrap.php';
$m = $_SERVER['REQUEST_METHOD']; $u = me();

if ($m === 'GET') {
  if (isset($_GET['me'])) {
    $u = need_role('vendor');
    $v = q('SELECT * FROM vendors WHERE user_id=?', [$u['id']])->fetch();
    if (!$v) fail('Vendor record not found for this account.', 404);
    $v['gcash_available'] = vendor_gcash_ready($v) ? 1 : 0;
    unset($v['paymongo_secret_enc'], $v['paymongo_webhook_secret']);
    respond($v);
  }
  if (($_GET['scope'] ?? '') === 'all') {
    need_role('admin');
    $rows = q('SELECT v.*,u.email FROM vendors v JOIN users u ON u.id=v.user_id ORDER BY v.id DESC')->fetchAll();
    foreach ($rows as &$r) $r['gcash_available'] = vendor_gcash_ready($r) ? 1 : 0;
    respond($rows);
  }
  /* Public customer endpoint: NEVER expose any vendor phone or GCash mobile numbers */
  $rows = q("SELECT * FROM vendors WHERE status='active' ORDER BY is_open DESC, name ASC")->fetchAll();
  foreach ($rows as &$r) {
    $avail = vendor_gcash_ready($r);
    $r['gcash_available'] = $avail ? 1 : 0;
    $r['has_gcash'] = $r['gcash_available'];
    $r['gcash_enabled'] = $avail ? 1 : 0;
    $r['gcash_qr_path'] = $avail ? ltrim(str_replace('\\', '/', trim((string)$r['gcash_qr_path'])), '/') : null;
    $r['gcash_account_name'] = $avail ? trim((string)($r['gcash_account_name'] ?? '')) : null;
    unset($r['user_id'], $r['phone'], $r['gcash_number'], $r['gcash_name'], $r['gcash_qr'], $r['maya_number'], $r['maya_name'], $r['paymongo_secret_enc'], $r['paymongo_webhook_secret']);
  }
  respond_cached($rows, 10, 60);
}

$act = $_GET['action'] ?? '';
if (in_array($act, ['banner', 'qr'], true)) {
  $u = need_role('vendor'); $id = id();
  if ($id !== my_vendor_id($u)) fail("You can only edit your own $act.", 403);
  $col = $act === 'qr' ? 'gcash_qr_path' : 'banner';
  $dir = $act === 'qr' ? 'qr' : 'banners';
  $v = q("SELECT id,banner,gcash_qr_path FROM vendors WHERE id=?", [$id])->fetch();
  if (!$v) fail('Vendor not found.', 404);
  if ($m === 'POST') {
    $file = $_FILES[$act] ?? $_FILES['image'] ?? null;
    $name = save_uploaded_image($file, __DIR__ . "/../uploads/$dir", $act === 'banner' ? 1200 : 900);
    $stored = $act === 'qr' ? "uploads/qr/$name" : $name;
    if (!empty($v[$col]) && basename((string)$v[$col]) !== 'aga.png') {
      @unlink(__DIR__ . "/../uploads/$dir/" . basename((string)$v[$col]));
    }
    q("UPDATE vendors SET $col=? WHERE id=?", [$stored, $id]);
    audit("vendor.$act", "id=$id");
    respond([$col => $stored, $act => $stored]);
  }
  if ($m === 'DELETE') {
    if (!empty($v[$col]) && basename((string)$v[$col]) !== 'aga.png') {
      @unlink(__DIR__ . "/../uploads/$dir/" . basename((string)$v[$col]));
    }
    q("UPDATE vendors SET $col=NULL" . ($act === 'qr' ? ',gcash_enabled=0' : '') . " WHERE id=?", [$id]);
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
if ($m === 'PATCH') {
  $b = body(); $set = []; $p = [];
  if ($u['role'] === 'vendor') {
    if ($id !== my_vendor_id($u)) fail('You can only edit your own profile.', 403);
    foreach (['name' => [2, 100], 'description' => [2, 255], 'gcash_account_name' => [0, 100]] as $k => [$a, $z]) {
      if (isset($b[$k])) { $set[] = "$k=?"; $p[] = str($b, $k, $a, $z, $a > 0) ?? ''; }
    }
    if (isset($b['phone'])) { $set[] = 'phone=?'; $p[] = phone($b); }
    if (isset($b['is_open'])) { $set[] = 'is_open=?'; $p[] = $b['is_open'] ? 1 : 0; }
    if (isset($b['gcash_enabled'])) { $set[] = 'gcash_enabled=?'; $p[] = $b['gcash_enabled'] ? 1 : 0; }
  } else {
    if (isset($b['status'])) { $set[] = 'status=?'; $p[] = $st = one_of($b, 'status', ['pending', 'active', 'suspended', 'rejected']); }
  }
  if (!$set) fail('Nothing to update.', 422);
  $p[] = $id;
  q('UPDATE vendors SET ' . implode(',', $set) . ' WHERE id=?', $p);
  if (isset($st)) { if ($st === 'active') q("UPDATE users SET status='active' WHERE id=(SELECT user_id FROM vendors WHERE id=?)", [$id]); audit('vendor.status', "id=$id $st"); }
  respond();
}
if ($m === 'DELETE') {
  need_role('admin');
  $vr = q('SELECT banner,gcash_qr_path FROM vendors WHERE id=?', [$id])->fetch();
  q('DELETE FROM users WHERE id=(SELECT user_id FROM vendors WHERE id=?)', [$id]);
  if (!empty($vr['banner'])) @unlink(__DIR__ . '/../uploads/banners/' . basename($vr['banner']));
  if (!empty($vr['gcash_qr_path']) && basename($vr['gcash_qr_path']) !== 'aga.png') @unlink(__DIR__ . '/../uploads/qr/' . basename($vr['gcash_qr_path']));
  audit('vendor.delete', "id=$id");
  respond();
}
fail('Method not allowed.', 405);
