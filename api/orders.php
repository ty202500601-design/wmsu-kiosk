<?php /* GET (role-scoped list) | GET ?order_no=&code= (public tracking) | POST (guest or customer) | PATCH ?id (status workflow) */
require __DIR__ . '/../includes/bootstrap.php';
const FLOW = ['Pending Payment' => ['Confirmed', 'Cancelled'], 'Confirmed' => ['Preparing', 'Cancelled'], 'Preparing' => ['Ready for Pickup'], 'Ready for Pickup' => ['Completed'], 'Completed' => [], 'Cancelled' => []];
$m = $_SERVER['REQUEST_METHOD'];
function with_items(array $rows, bool $public = false): array { if (!$rows) return [];
  $ids = array_column($rows, 'id'); $ph = implode(',', array_fill(0, count($ids), '?'));
  $it = q("SELECT order_id,food_id,name,unit_price,qty,line_total FROM order_items WHERE order_id IN($ph)", $ids)->fetchAll(); $g = [];
  foreach ($it as $i) $g[$i['order_id']][] = $i;
  foreach ($rows as &$r) { $r['items'] = $g[$r['id']] ?? []; if ($public) unset($r['user_id'], $r['track_code']); } return $rows; }

if ($m === 'GET') {
  if (isset($_GET['order_no'])) { $o = q('SELECT o.*,v.name vendor_name FROM orders o JOIN vendors v ON v.id=o.vendor_id WHERE o.order_no=? AND o.track_code=?', [strtoupper(trim($_GET['order_no'])), strtoupper(trim($_GET['code'] ?? ''))])->fetch();
    if (!$o) fail('Order not found. Check the order number and tracking code.', 404); respond(with_items([$o], true)[0]); }
  $u = need_role('customer', 'vendor', 'admin'); $w = ['1=1']; $p = [];
  if ($u['role'] === 'vendor') { $w[] = 'o.vendor_id=?'; $p[] = my_vendor_id($u); } elseif ($u['role'] === 'customer') { $w[] = 'o.user_id=?'; $p[] = $u['id']; }
  if (isset($_GET['id'])) { $w[] = 'o.id=?'; $p[] = id(); }
  if (!empty($_GET['status'])) { $w[] = 'o.order_status=?'; $p[] = one_of($_GET, 'status', array_keys(FLOW)); }
  $rows = q('SELECT o.*,v.name vendor_name FROM orders o JOIN vendors v ON v.id=o.vendor_id WHERE ' . implode(' AND ', $w) . ' ORDER BY o.created_at DESC LIMIT 200', $p)->fetchAll();
  if (isset($_GET['id']) && !$rows) fail('Order not found.', 404); $rows = with_items($rows); respond(isset($_GET['id']) ? $rows[0] : $rows);
}
if ($m === 'POST') {
  $u = me(); if ($u && $u['role'] !== 'customer') fail('Only customers can place orders.', 403); $b = body();
  $vid = (int)($b['vendor_id'] ?? 0); $v = q("SELECT id,user_id,is_open FROM vendors WHERE id=? AND status='active'", [$vid])->fetch();
  if (!$v) fail('Vendor not found.', 404); if (!$v['is_open']) fail('This vendor is closed right now.', 409);
  $type = one_of($b, 'order_type', ['Dine-In', 'Take-Out']); $method = one_of($b, 'payment_method', methods_enabled());
  $name = $u ? $u['name'] : str($b, 'guest_name', 2, 60);
  $items = $b['items'] ?? null; if (!is_array($items) || !$items || count($items) > 30) fail('Your cart is empty or too large.', 422);
  $qty = []; foreach ($items as $i) { $fid = (int)($i['food_id'] ?? 0); $n = (int)($i['qty'] ?? 0); if ($fid < 1 || $n < 1 || $n > 20) fail('Invalid item or quantity.', 422); $qty[$fid] = min(20, ($qty[$fid] ?? 0) + $n); }
  $ph = implode(',', array_fill(0, count($qty), '?'));
  $foods = q("SELECT id,name,price FROM foods WHERE vendor_id=? AND is_available=1 AND id IN($ph)", [$vid, ...array_keys($qty)])->fetchAll();
  if (count($foods) !== count($qty)) fail('One or more items are unavailable or belong to a different vendor.', 409);
  $cents = 0; foreach ($foods as &$f) { $f['qty'] = $qty[$f['id']]; $f['line'] = (int)round($f['price'] * 100) * $f['qty']; $cents += $f['line']; } unset($f);
  $total = $cents / 100; $code = strtoupper(bin2hex(random_bytes(3))); $pdo = db(); $pdo->beginTransaction();
  try {
    q('INSERT INTO orders(order_no,track_code,vendor_id,user_id,customer_name,order_type,payment_method,subtotal,total) VALUES(?,?,?,?,?,?,?,?,?)', ['TMP' . bin2hex(random_bytes(8)), $code, $vid, $u['id'] ?? null, $name, $type, $method, $total, $total]);
    $oid = (int)$pdo->lastInsertId(); $no = 'WM' . date('ymd') . '-' . str_pad((string)$oid, 5, '0', STR_PAD_LEFT); q('UPDATE orders SET order_no=? WHERE id=?', [$no, $oid]);
    foreach ($foods as $f) q('INSERT INTO order_items(order_id,food_id,name,unit_price,qty,line_total) VALUES(?,?,?,?,?,?)', [$oid, $f['id'], $f['name'], $f['price'], $f['qty'], $f['line'] / 100]);
    q("INSERT INTO payments(order_id,method,amount,status) VALUES(?,?,?, 'Unpaid')", [$oid, $method, $total]);
    notify((int)$v['user_id'], $oid, "New order $no ($type) - ₱" . number_format($total, 2)); $pdo->commit();
  } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
  respond(['id' => $oid, 'order_no' => $no, 'track_code' => $code, 'total' => $total, 'order_status' => 'Pending Payment', 'payment_status' => 'Unpaid'], 201);
}
if ($m === 'PATCH') {
  $u = need_role('customer', 'vendor', 'admin'); $b = body(); $to = one_of($b, 'order_status', array_keys(FLOW)); $pdo = db(); $pdo->beginTransaction();
  try { $o = q('SELECT o.*,v.user_id vendor_user FROM orders o JOIN vendors v ON v.id=o.vendor_id WHERE o.id=? FOR UPDATE', [id()])->fetch();
    if (!$o || ($u['role'] === 'vendor' && (int)$o['vendor_id'] !== my_vendor_id($u)) || ($u['role'] === 'customer' && (int)$o['user_id'] !== $u['id'])) { $pdo->rollBack(); fail('Order not found.', 404); }
    if (!in_array($to, FLOW[$o['order_status']], true)) { $pdo->rollBack(); fail("An order that is \"{$o['order_status']}\" cannot move to \"$to\".", 409); }
    if ($u['role'] === 'customer' && !($to === 'Cancelled' && $o['order_status'] === 'Pending Payment' && $o['payment_status'] === 'Unpaid')) { $pdo->rollBack(); fail('You can only cancel an unpaid order that has not been confirmed.', 403); }
    if ($to === 'Cancelled' && $o['payment_status'] === 'Paid' && $u['role'] !== 'admin') { $pdo->rollBack(); fail('A paid order can only be cancelled by an admin, who handles the refund.', 403); }
    if ($to === 'Completed' && $o['payment_status'] !== 'Paid') { $pdo->rollBack(); fail('Confirm payment before completing this order.', 409); }
    $reason = $to === 'Cancelled' ? ($u['role'] === 'customer' ? 'Cancelled by customer' : str($b, 'cancel_reason', 3, 200)) : null;
    q('UPDATE orders SET order_status=?,cancel_reason=? WHERE id=?', [$to, $reason, $o['id']]);
    notify($o['user_id'] ? (int)$o['user_id'] : null, (int)$o['id'], "Order {$o['order_no']} is now: $to"); audit('order.status', "{$o['order_no']} {$o['order_status']} -> $to"); $pdo->commit();
  } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
  respond(['order_status' => $to]);
}
fail('Method not allowed.', 405);
