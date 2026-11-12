<?php /* Admin only. GET | POST | PATCH ?id | DELETE ?id */
require __DIR__ . '/../includes/bootstrap.php';
$admin = need_role('admin'); $m = $_SERVER['REQUEST_METHOD'];
if ($m === 'GET') respond(q('SELECT id,name,email,role,status,created_at FROM users ORDER BY id DESC')->fetchAll());
if ($m === 'POST') { $b = body(); $em = email($b);
  if (q('SELECT 1 FROM users WHERE email=?', [$em])->fetch()) fail('Email already registered.', 409, ['email' => 'Already registered.']);
  q('INSERT INTO users(name,email,password_hash,role,status) VALUES(?,?,?,?,?)', [str($b, 'name', 2, 100), $em, password_hash(password($b), PASSWORD_DEFAULT), one_of($b, 'role', ['customer', 'admin']), 'active']);
  audit('user.create', $em); respond(['id' => (int)db()->lastInsertId()], 201); }
$id = id();
if ($m === 'PATCH') { $b = body(); $set = []; $p = [];
  if (isset($b['name'])) { $set[] = 'name=?'; $p[] = str($b, 'name', 2, 100); }
  if (isset($b['status'])) { if ($id === $admin['id']) fail('You cannot change your own status.', 409); $set[] = 'status=?'; $p[] = one_of($b, 'status', ['active', 'banned']); }
  if (isset($b['password'])) { $set[] = 'password_hash=?'; $p[] = password_hash(password($b), PASSWORD_DEFAULT); }
  if (!$set) fail('Nothing to update.', 422);
  $p[] = $id; if (!q('UPDATE users SET ' . implode(',', $set) . ' WHERE id=?', $p)->rowCount() && !q('SELECT 1 FROM users WHERE id=?', [$id])->fetch()) fail('User not found.', 404);
  audit('user.update', "id=$id"); respond(); }
if ($m === 'DELETE') { if ($id === $admin['id']) fail('You cannot delete your own account.', 409);
  if (!q('DELETE FROM users WHERE id=?', [$id])->rowCount()) fail('User not found.', 404); audit('user.delete', "id=$id"); respond(); }
fail('Method not allowed.', 405);
