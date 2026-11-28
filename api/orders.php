<?php /* GET (role-scoped list) | GET ?order_no=&code= (public tracking) | POST (kiosk order) | PATCH ?id (vendor status workflow) */
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/gcash.php';
const FLOW = ['Pending Payment' => ['Confirmed', 'Cancelled'], 'Confirmed' => ['Preparing', 'Cancelled'], 'Preparing' => ['Ready for Pickup'], 'Ready for Pickup' => ['Completed'], 'Completed' => [], 'Cancelled' => []];
$m = $_SERVER['REQUEST_METHOD'];

function expire_stale_gcash_orders(): void {
  $mins = max(5, (int)(cfg('gcash_expire_minutes') ?: 15));
  $stale = q("SELECT id FROM orders WHERE payment_method='gcash' AND payment_status IN ('Pending','Unpaid') AND order_status='Pending Payment' AND created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE) LIMIT 25", [$mins])->fetchAll();
  if (!$stale) return;
  $pdo = db();
  foreach ($stale as $row) {
    $pdo->beginTransaction();
    try {
      $o = q("SELECT id FROM orders WHERE id=? AND payment_status IN ('Pending','Unpaid') AND order_status='Pending Payment' FOR UPDATE", [$row['id']])->fetch();
      if ($o) {
        q("UPDATE orders SET order_status='Cancelled',payment_status='Failed',cancel_reason='GCash payment timed out (15 mins)' WHERE id=?", [$o['id']]);
        q("UPDATE payments SET status='Failed' WHERE order_id=?", [$o['id']]);
        q('UPDATE foods f JOIN order_items oi ON oi.food_id=f.id SET f.stock_qty=f.stock_qty+oi.qty, f.is_available=1 WHERE oi.order_id=? AND f.stock_qty IS NOT NULL', [$o['id']]);
      }
      $pdo->commit();
    } catch (Throwable) { if ($pdo->inTransaction()) $pdo->rollBack(); }
  }
}
expire_stale_gcash_orders();
function with_items(array $rows, bool $public = false): array { if (!$rows) return [];
  $ids = array_column($rows, 'id'); $ph = implode(',', array_fill(0, count($ids), '?'));
  $it = q("SELECT order_id,food_id,name,unit_price,qty,line_total FROM order_items WHERE order_id IN($ph)", $ids)->fetchAll(); $g = [];
  foreach ($it as $i) $g[$i['order_id']][] = $i;
  foreach ($rows as &$r) {
    $r['items'] = $g[$r['id']] ?? [];
    if (!is_track_released($r)) $r['track_code'] = null;
    if ($public) unset($r['user_id'], $r['checkout_token']);
  }
  return $rows;
}

if ($m === 'GET') {
  if (isset($_GET['order_no'])) {
    $now = time();
    $_SESSION['lookup_miss'] = array_values(array_filter($_SESSION['lookup_miss'] ?? [], fn($t) => $now - $t < 60));
    if (count($_SESSION['lookup_miss']) >= 12) fail('Too many failed lookup attempts. Please wait a minute.', 429);
    $ono = strtoupper(trim((string)$_GET['order_no']));
    $key = strtoupper(trim((string)($_GET['token'] ?? $_GET['code'] ?? '')));
    if ($key === 'NULL' || $key === 'UNDEFINED') $key = '';
    if ($key === '' && !empty($_SESSION['checkout_tokens'][$ono])) $key = $_SESSION['checkout_tokens'][$ono];
    if ($ono === '' || $key === '') fail('Order number and tracking/access code are required.', 422);
    $target = q('SELECT o.*,v.name vendor_name,v.gcash_number,v.gcash_name,p.reference payment_ref,p.checkout_id,p.checkout_url,p.provider FROM orders o JOIN vendors v ON v.id=o.vendor_id LEFT JOIN payments p ON p.order_id=o.id WHERE o.order_no=? AND ((o.track_code IS NOT NULL AND o.track_code=?) OR (o.checkout_token IS NOT NULL AND o.checkout_token=?))', [$ono, $key, $key])->fetch();
    if (!$target) { $_SESSION['lookup_miss'][] = $now; fail('Order not found. Check the order number and tracking code.', 404); }
    if (!empty($target['checkout_token'])) {
      $all = q('SELECT o.*,v.name vendor_name,v.gcash_number,v.gcash_name,p.reference payment_ref,p.checkout_id,p.checkout_url,p.provider FROM orders o JOIN vendors v ON v.id=o.vendor_id LEFT JOIN payments p ON p.order_id=o.id WHERE o.checkout_token=? ORDER BY o.id ASC', [$target['checkout_token']])->fetchAll();
    } else {
      $all = q('SELECT o.*,v.name vendor_name,v.gcash_number,v.gcash_name,p.reference payment_ref,p.checkout_id,p.checkout_url,p.provider FROM orders o JOIN vendors v ON v.id=o.vendor_id LEFT JOIN payments p ON p.order_id=o.id WHERE o.track_code=? ORDER BY o.id ASC', [$target['track_code']])->fetchAll();
    }
    foreach ($all as &$r) {
      if (in_array($r['order_status'], ['Pending Payment', 'Confirmed', 'Preparing'], true)) {
        $ahead = (int)q("SELECT COUNT(*) FROM orders WHERE vendor_id=? AND order_status IN ('Confirmed','Preparing') AND id<?", [$r['vendor_id'], $r['id']])->fetchColumn();
        $r['queue_ahead'] = $ahead;
        $r['est_minutes'] = 5 + ($ahead * 4);
      }
    }
    respond(with_items($all, true));
  }
  $u = need_role('vendor', 'admin'); $w = ['1=1']; $p = [];
  if ($u['role'] === 'vendor') { $w[] = 'o.vendor_id=?'; $p[] = my_vendor_id($u); }
  if (isset($_GET['id'])) { $w[] = 'o.id=?'; $p[] = id(); }
  if (!empty($_GET['status'])) { $w[] = 'o.order_status=?'; $p[] = one_of($_GET, 'status', array_keys(FLOW)); }
  $rows = q('SELECT o.*,v.name vendor_name,p.reference payment_ref,p.checkout_id,p.checkout_url,p.provider FROM orders o JOIN vendors v ON v.id=o.vendor_id LEFT JOIN payments p ON p.order_id=o.id WHERE ' . implode(' AND ', $w) . ' ORDER BY o.created_at DESC LIMIT 200', $p)->fetchAll();
  if (isset($_GET['id']) && !$rows) fail('Order not found.', 404); $rows = with_items($rows); respond(isset($_GET['id']) ? $rows[0] : $rows);
}
if ($m === 'POST') {
  $now = time();
  $_SESSION['order_burst'] = array_values(array_filter($_SESSION['order_burst'] ?? [], fn($t) => $now - $t < 60));
  if (count($_SESSION['order_burst']) >= 5) fail('Too many orders placed in a short time. Please wait a minute before ordering again.', 429);
  $b = body();
  $type = one_of($b, 'order_type', ['Dine-In', 'Take-Out']); $method = one_of($b, 'payment_method', methods_enabled());
  $name = str($b, 'guest_name', 2, 60);
  $items = $b['items'] ?? null; if (!is_array($items) || !$items || count($items) > 30) fail('Your cart is empty or too large.', 422);
  $qty = []; foreach ($items as $i) { $fid = (int)($i['food_id'] ?? 0); $n = (int)($i['qty'] ?? 0); if ($fid < 1 || $n < 1 || $n > 20) fail('Invalid item or quantity.', 422); $qty[$fid] = min(20, ($qty[$fid] ?? 0) + $n); }
  $ph = implode(',', array_fill(0, count($qty), '?'));
  $foods = q("SELECT f.id, f.vendor_id, f.name, f.price, v.user_id vendor_user, v.name vendor_name, v.is_open, v.status vendor_status, v.gcash_number FROM foods f JOIN vendors v ON v.id=f.vendor_id WHERE f.is_available=1 AND f.id IN($ph)", array_keys($qty))->fetchAll();
  if (count($foods) !== count($qty)) fail('One or more items are unavailable or not found.', 409);
  foreach ($foods as $f) {
    if (!$f['is_open'] || $f['vendor_status'] !== 'active') {
      fail("Stall \"{$f['vendor_name']}\" is closed right now.", 409);
    }
    if ($method === 'gcash' && trim((string)$f['gcash_number']) === '') {
      fail("GCash is unavailable for \"{$f['vendor_name']}\" because they have not registered a GCash account.", 409);
    }
  }
  $by_vendor = [];
  foreach ($foods as $f) {
    $f['qty'] = $qty[$f['id']];
    $f['line'] = (int)round($f['price'] * 100) * $f['qty'];
    $by_vendor[$f['vendor_id']]['vendor'] = $f;
    $by_vendor[$f['vendor_id']]['items'][] = $f;
  }
  $token = strtoupper(bin2hex(random_bytes(8)));
  $pdo = db(); $pdo->beginTransaction();
  $created = [];
  try {
    foreach ($by_vendor as $vid => $grp) {
      $cents = array_sum(array_column($grp['items'], 'line'));
      $vtotal = $cents / 100;
      $initPayStatus = $method === 'gcash' ? 'Pending' : 'Unpaid';
      q('INSERT INTO orders(order_no,track_code,checkout_token,vendor_id,user_id,customer_name,order_type,payment_method,payment_status,subtotal,total) VALUES(?,NULL,?,?,NULL,?,?,?,?,?,?)',
        ['TMP' . bin2hex(random_bytes(8)), $token, $vid, $name, $type, $method, $initPayStatus, $vtotal, $vtotal]);
      $oid = (int)$pdo->lastInsertId();
      $no = 'WM' . date('ymd') . '-' . str_pad((string)$oid, 5, '0', STR_PAD_LEFT);
      q('UPDATE orders SET order_no=? WHERE id=?', [$no, $oid]);
      foreach ($grp['items'] as $it) {
        $frow = q('SELECT stock_qty,is_available FROM foods WHERE id=? FOR UPDATE', [$it['id']])->fetch();
        if (!$frow || !$frow['is_available']) { $pdo->rollBack(); fail("\"{$it['name']}\" just sold out.", 409); }
        if ($frow['stock_qty'] !== null) {
          if ((int)$frow['stock_qty'] < $it['qty']) { $pdo->rollBack(); fail("Only {$frow['stock_qty']} serving(s) left for \"{$it['name']}\".", 409); }
          $rem = (int)$frow['stock_qty'] - $it['qty'];
          q('UPDATE foods SET stock_qty=?,is_available=IF(?=0,0,is_available) WHERE id=?', [$rem, $rem, $it['id']]);
        }
        q('INSERT INTO order_items(order_id,food_id,name,unit_price,qty,line_total) VALUES(?,?,?,?,?,?)',
          [$oid, $it['id'], $it['name'], $it['price'], $it['qty'], $it['line'] / 100]);
      }
      $gw = $method === 'gcash' ? create_gcash_checkout($no, $token, $grp['vendor']['vendor_name'], $vtotal, $grp['items']) : ['provider' => 'cash', 'checkout_id' => null, 'checkout_url' => null];
      q('INSERT INTO payments(order_id,method,provider,checkout_id,checkout_url,amount,status) VALUES(?,?,?,?,?,?,?)',
        [$oid, $method, $gw['provider'], $gw['checkout_id'], $gw['checkout_url'], $vtotal, $initPayStatus]);
      notify((int)$grp['vendor']['vendor_user'], $oid, "New order $no ($type) - ₱" . number_format($vtotal, 2));
      $_SESSION['checkout_tokens'][$no] = $token;
      $created[] = ['id' => $oid, 'order_no' => $no, 'vendor_id' => $vid, 'vendor_name' => $grp['vendor']['vendor_name'], 'total' => $vtotal, 'checkout_id' => $gw['checkout_id'], 'checkout_url' => $gw['checkout_url']];
    }
    $pdo->commit();
    $_SESSION['order_burst'][] = $now;
  } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
  $grand_total = array_sum(array_column($created, 'total'));
  respond(['id' => $created[0]['id'], 'order_no' => $created[0]['order_no'], 'orders' => $created, 'track_code' => null, 'checkout_token' => $token, 'total' => $grand_total, 'order_status' => 'Pending Payment', 'payment_status' => $method === 'gcash' ? 'Pending' : 'Unpaid'], 201);
}
if ($m === 'PATCH') {
  $u = need_role('vendor'); $b = body(); $to = one_of($b, 'order_status', array_keys(FLOW)); $pdo = db(); $pdo->beginTransaction();
  try { $o = q('SELECT o.*,v.user_id vendor_user FROM orders o JOIN vendors v ON v.id=o.vendor_id WHERE o.id=? FOR UPDATE', [id()])->fetch();
    if (!$o || (int)$o['vendor_id'] !== my_vendor_id($u)) { $pdo->rollBack(); fail('Order not found.', 404); }
    if (!in_array($to, FLOW[$o['order_status']], true)) { $pdo->rollBack(); fail("An order that is \"{$o['order_status']}\" cannot move to \"$to\".", 409); }
    if ($to === 'Cancelled' && $o['payment_status'] === 'Paid') {
      q("UPDATE orders SET payment_status='Refunded' WHERE id=?", [$o['id']]);
      q("UPDATE payments SET status='Refunded',verified_by=?,verified_at=NOW() WHERE order_id=?", [$u['id'], $o['id']]);
    }
    if ($o['payment_method'] !== 'cash' && $to !== 'Cancelled' && $o['payment_status'] !== 'Paid') { $pdo->rollBack(); fail('Confirm payment before accepting or preparing an e-wallet order.', 409); }
    if ($to === 'Completed' && $o['payment_status'] !== 'Paid') { $pdo->rollBack(); fail('Confirm payment before completing this order.', 409); }
    $reason = $to === 'Cancelled' ? str($b, 'cancel_reason', 3, 200) : null;
    $tc = $o['track_code'];
    if ($o['payment_method'] === 'cash' && $to !== 'Cancelled' && empty($tc)) {
      $tc = generate_track_code();
      q('UPDATE orders SET order_status=?,cancel_reason=?,track_code=? WHERE id=?', [$to, $reason, $tc, $o['id']]);
    } else {
      q('UPDATE orders SET order_status=?,cancel_reason=? WHERE id=?', [$to, $reason, $o['id']]);
    }
    if ($to === 'Cancelled') {
      q('UPDATE foods f JOIN order_items oi ON oi.food_id=f.id SET f.stock_qty=f.stock_qty+oi.qty, f.is_available=1 WHERE oi.order_id=? AND f.stock_qty IS NOT NULL', [$o['id']]);
    }
    notify($o['user_id'] ? (int)$o['user_id'] : null, (int)$o['id'], "Order {$o['order_no']} is now: $to"); audit('order.status', "{$o['order_no']} {$o['order_status']} -> $to"); $pdo->commit();
  } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
  respond(['order_status' => $to]);
}
fail('Method not allowed.', 405);
