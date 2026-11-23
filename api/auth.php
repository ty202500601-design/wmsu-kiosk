<?php /* GET: current staff user | POST ?action=login|logout (vendor & admin only) */
require __DIR__ . '/../includes/bootstrap.php';
$m = $_SERVER['REQUEST_METHOD']; $act = $_GET['action'] ?? '';
if ($m === 'GET') respond(['user' => me()]);
if ($m !== 'POST') fail('Method not allowed.', 405);
if ($act === 'logout') { audit('logout'); $_SESSION = []; session_regenerate_id(true); $_SESSION['csrf'] = bin2hex(random_bytes(32)); respond(['csrf' => $_SESSION['csrf']]); }
$b = body();
if ($act === 'login') {
  $lock = $_SESSION['lock'] ?? ['n' => 0, 't' => 0];
  if ($lock['n'] >= 5 && time() - $lock['t'] < 60) fail('Too many attempts. Wait a minute and try again.', 429);
  $em = email($b);
  $expectedRole = isset($b['role']) && $b['role'] !== '' ? one_of($b, 'role', ['vendor', 'admin']) : null;
  $u = q('SELECT * FROM users WHERE email=?', [$em])->fetch();
  $ok = password_verify((string)($b['password'] ?? ''), $u['password_hash'] ?? '$2y$10$abcdefghijklmnopqrstuuYVYKz5zKz5zKz5zKz5zKz5zKz5zKz5e'); // constant-ish time for unknown emails
  if (!$u || !$ok) { $_SESSION['lock'] = ['n' => $lock['n'] + 1, 't' => time()]; fail('Wrong email or password.', 401); }
  if (!in_array($u['role'], ['vendor', 'admin'], true)) fail('Only vendor and admin accounts can sign in.', 403);
  if ($expectedRole && $u['role'] !== $expectedRole) {
    fail("This account cannot sign in on the $expectedRole portal. Please use the {$u['role']} login page.", 403);
  }
  if ($u['status'] === 'pending') fail('Your account is waiting for admin approval.', 403);
  if ($u['status'] === 'banned') fail('This account is disabled. Contact the canteen administrator.' . (!empty($u['ban_reason']) ? ' Reason: ' . $u['ban_reason'] : ''), 403);
  if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) q('UPDATE users SET password_hash=? WHERE id=?', [password_hash($b['password'], PASSWORD_DEFAULT), $u['id']]);
  session_regenerate_id(true); $_SESSION['csrf'] = bin2hex(random_bytes(32)); unset($_SESSION['lock']);
  $_SESSION['user'] = ['id' => (int)$u['id'], 'name' => $u['name'], 'email' => $u['email'], 'role' => $u['role']];
  audit('login'); respond(['user' => $_SESSION['user'], 'csrf' => $_SESSION['csrf']]);
}
fail('Unknown action.', 404);
