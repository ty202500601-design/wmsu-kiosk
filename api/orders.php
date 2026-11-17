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
  if (isset($_GET['order_no'])) {
    $target = q('SELECT o.*,v.name vendor_name,v.gcash_number,v.gcash_name,v.maya_number,v.maya_name,p.reference payment_ref FROM orders o JOIN vendors v ON v.id=o.vendor_id LEFT JOIN payments p ON p.order_id=o.id WHERE o.order_no=? AND o.track_code=?', [strtoupper(trim($_GET['order_no'])), strtoupper(trim($_GET['code'] ?? ''))])->fetch();
    if (!$target) fail('Order not found. Check the order number and tracking code.', 404);
    $all = q('SELECT o.*,v.name vendor_name,v.gcash_number,v.gcash_name,v.maya_number,v.maya_name,p.reference payment_ref FROM orders o JOIN vendors v ON v.id=o.vendor_id LEFT JOIN payments p ON p.order_id=o.id WHERE o.track_code=? ORDER BY o.id ASC', [$target['track_code']])->fetchAll();
    respond(with_items($all, true));
  }
  $u = need_role('customer', 'vendor', 'admin'); $w = ['1=1']; $p = [];
  if ($u['role'] === 'vendor') { $w[] = 'o.vendor_id=?'; $p[] = my_vendor_id($u); } elseif ($u['role'] === 'customer') { $w[] = 'o.user_id=?'; $p[] = $u['id']; }
  if (isset($_GET['id'])) { $w[] = 'o.id=?'; $p[] = id(); }
  if (!empty($_GET['status'])) { $w[] = 'o.order_status=?'; $p[] = one_of($_GET, 'status', array_keys(FLOW)); }
  $rows = q('SELECT o.*,v.name vendor_name,p.reference payment_ref FROM orders o JOIN vendors v ON v.id=o.vendor_id LEFT JOIN payments p ON p.order_id=o.id WHERE ' . implode(' AND ', $w) . ' ORDER BY o.created_at DESC LIMIT 200', $p)->fetchAll();
  if (isset($_GET['id']) && !$rows) fail('Order not found.', 404); $rows = with_items($rows); respond(isset($_GET['id']) ? $rows[0] : $rows);
}
if ($m === 'POST') {
  $u = me(); $b = body();
  $type = one_of($b, 'order_type', ['Dine-In', 'Take-Out']); $method = one_of($b, 'payment_method', methods_enabled());
  $name = !empty($b['guest_name']) ? str($b, 'guest_name', 2, 60) : ($u ? $u['name'] : 'Guest');
  $items = $b['items'] ?? null; if (!is_array($items) || !$items || count($items) > 30) fail('Your cart is empty or too large.', 422);
  $qty = []; foreach ($items as $i) { $fid = (int)($i['food_id'] ?? 0); $n = (int)($i['qty'] ?? 0); if ($fid < 1 || $n < 1 || $n > 20) fail('Invalid item or quantity.', 422); $qty[$fid] = min(20, ($qty[$fid] ?? 0) + $n); }
  $ph = implode(',', array_fill(0, count($qty), '?'));
  $foods = q("SELECT f.id, f.vendor_id, f.name, f.price, v.user_id vendor_user, v.name vendor_name, v.is_open, v.status vendor_status FROM foods f JOIN vendors v ON v.id=f.vendor_id WHERE f.is_available=1 AND f.id IN($ph)", array_keys($qty))->fetchAll();
  if (count($foods) !== count($qty)) fail('One or more items are unavailable or not found.', 409);
  foreach ($foods as $f) {
    if (!$f['is_open'] || $f['vendor_status'] !== 'active') {
      fail("Stall \"{$f['vendor_name']}\" is closed right now.", 409);
    }
  }
  $by_vendor = [];
  foreach ($foods as $f) {
    $f['qty'] = $qty[$f['id']];
    $f['line'] = (int)round($f['price'] * 100) * $f['qty'];
    $by_vendor[$f['vendor_id']]['vendor'] = $f;
    $by_vendor[$f['vendor_id']]['items'][] = $f;
  }
  $code = strtoupper(bin2hex(random_bytes(3)));
  $pdo = db(); $pdo->beginTransaction();
  $created = [];
  try {
    foreach ($by_vendor as $vid => $grp) {
      $cents = array_sum(array_column($grp['items'], 'line'));
      $vtotal = $cents / 100;
      q('INSERT INTO orders(order_no,track_code,vendor_id,user_id,customer_name,order_type,payment_method,subtotal,total) VALUES(?,?,?,?,?,?,?,?,?)',
        ['TMP' . bin2hex(random_bytes(8)), $code, $vid, $u['id'] ?? null, $name, $type, $method, $vtotal, $vtotal]);
      $oid = (int)$pdo->lastInsertId();
      $no = 'WM' . date('ymd') . '-' . str_pad((string)$oid, 5, '0', STR_PAD_LEFT);
      q('UPDATE orders SET order_no=? WHERE id=?', [$no, $oid]);
      foreach ($grp['items'] as $it) {
        q('INSERT INTO order_items(order_id,food_id,name,unit_price,qty,line_total) VALUES(?,?,?,?,?,?)',
          [$oid, $it['id'], $it['name'], $it['price'], $it['qty'], $it['line'] / 100]);
      }
      q("INSERT INTO payments(order_id,method,amount,status) VALUES(?,?,?, 'Unpaid')", [$oid, $method, $vtotal]);
      notify((int)$grp['vendor']['vendor_user'], $oid, "New order $no ($type) - ₱" . number_format($vtotal, 2));
      $created[] = ['id' => $oid, 'order_no' => $no, 'vendor_id' => $vid, 'vendor_name' => $grp['vendor']['vendor_name'], 'total' => $vtotal];
    }
    $pdo->commit();
  } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
  $grand_total = array_sum(array_column($created, 'total'));
  respond(['id' => $created[0]['id'], 'order_no' => $created[0]['order_no'], 'orders' => $created, 'track_code' => $code, 'total' => $grand_total, 'order_status' => 'Pending Payment', 'payment_status' => 'Unpaid'], 201);
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
