<?php /* GET (vendor own / admin all) | PATCH ?order_id= {action}. Payment status is NEVER set from the customer's choice of method. */
require __DIR__ . '/../includes/bootstrap.php';
$m = $_SERVER['REQUEST_METHOD'];
if ($m === 'GET') { $u = need_role('vendor', 'admin'); $w = '1=1'; $p = []; if ($u['role'] === 'vendor') { $w = 'o.vendor_id=?'; $p[] = my_vendor_id($u); }
  respond(q("SELECT p.id,o.id order_id,o.order_no,o.vendor_id,p.method,p.amount,p.status,p.reference,p.verified_at,o.order_status FROM payments p JOIN orders o ON o.id=p.order_id WHERE $w ORDER BY p.id DESC LIMIT 300", $p)->fetchAll()); }
if ($m !== 'PATCH') fail('Method not allowed.', 405);
$b = body(); $act = one_of($b, 'action', ['submit_reference', 'confirm_cash', 'verify', 'fail', 'refund']);
function set_pay(array $o, string $s, ?int $by): void { q('UPDATE orders SET payment_status=? WHERE id=?', [$s, $o['id']]);
  q('UPDATE payments SET status=?,verified_by=?,verified_at=IF(?="Paid" OR ?="Refunded",NOW(),verified_at) WHERE order_id=?', [$s, $by, $s, $s, $o['id']]); }
$pdo = db(); $pdo->beginTransaction();
try {
  if ($act === 'submit_reference') { // customer (guest or logged in) proves ownership with order_no + tracking code, then submits the e-wallet reference
    $o = q('SELECT * FROM orders WHERE order_no=? AND track_code=? FOR UPDATE', [strtoupper(trim((string)($b['order_no'] ?? ''))), strtoupper(trim((string)($b['code'] ?? '')))])->fetch();
    if (!$o) { $pdo->rollBack(); fail('Order not found.', 404); }
    if ($o['payment_method'] === 'cash' || !in_array($o['payment_status'], ['Unpaid', 'Failed'], true) || $o['order_status'] === 'Cancelled') { $pdo->rollBack(); fail('A payment reference cannot be submitted for this order.', 409); }
    $ref = str($b, 'reference', 4, 60); if (!preg_match('/^[A-Za-z0-9\-]+$/', $ref)) { $pdo->rollBack(); fail('Reference may only contain letters, numbers and dashes.', 422, ['reference' => 'Invalid format.']); }
    q('UPDATE payments SET reference=? WHERE order_id=?', [$ref, $o['id']]); set_pay($o, 'Pending Verification', null); $pdo->commit(); respond(['payment_status' => 'Pending Verification']);
  }
  $u = need_role('vendor', 'admin'); $o = q('SELECT * FROM orders WHERE id=? FOR UPDATE', [id('order_id')])->fetch();
  if (!$o || ($u['role'] === 'vendor' && (int)$o['vendor_id'] !== my_vendor_id($u))) { $pdo->rollBack(); fail('Order not found.', 404); }
  $ps = $o['payment_status']; $cash = $o['payment_method'] === 'cash'; $new = null;
  if ($act === 'confirm_cash' && $cash && $ps === 'Unpaid' && $o['order_status'] !== 'Cancelled') $new = 'Paid';
  elseif ($act === 'verify' && !$cash && $ps === 'Pending Verification') $new = 'Paid';   // manual check against the provider's dashboard; prefer the webhook
  elseif ($act === 'fail' && !$cash && in_array($ps, ['Unpaid', 'Pending Verification'], true)) $new = 'Failed';
  elseif ($act === 'refund' && $u['role'] === 'admin' && $ps === 'Paid') { $new = 'Refunded'; q("UPDATE orders SET order_status='Cancelled',cancel_reason='Refunded' WHERE id=?", [$o['id']]); }
  if (!$new) { $pdo->rollBack(); fail("Action \"$act\" is not allowed for a $ps " . $o['payment_method'] . ' payment.', 409); }
  set_pay($o, $new, $u['id']); notify($o['user_id'] ? (int)$o['user_id'] : null, (int)$o['id'], "Payment for {$o['order_no']}: $new");
  audit("payment.$act", "{$o['order_no']} -> $new"); $pdo->commit(); respond(['payment_status' => $new]);
} catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
