<?php /* GET public settings | PATCH (admin) */
require __DIR__ . '/../includes/bootstrap.php';
$allowed = ['canteen_name', 'open_time', 'close_time', 'pay_cash', 'pay_gcash'];
if ($_SERVER['REQUEST_METHOD'] === 'GET') respond(settings_all());
if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') fail('Method not allowed.', 405);
need_role('admin'); $b = body();
foreach ($b as $k => $v) {
  if (!in_array($k, $allowed, true)) fail("Unknown setting $k.", 422);
  if (str_starts_with($k, 'pay_')) $v = $v ? '1' : '0';
  elseif (str_ends_with($k, '_time')) { if (!preg_match('/^\d{2}:\d{2}$/', (string)$v)) fail("Invalid $k.", 422); }
  else $v = str([$k => $v], $k, 2, 100);
  q('INSERT INTO settings(k,v) VALUES(?,?) ON DUPLICATE KEY UPDATE v=VALUES(v)', [$k, (string)$v]);
}
audit('settings.update', implode(',', array_keys($b))); respond(settings_all());
