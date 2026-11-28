<?php /* GET (vendor own / admin all) | PATCH ?order_id= {action:'confirm_cash'} (vendor cash only; GCash is verified via webhook). */
require __DIR__ . '/../includes/bootstrap.php';
$m = $_SERVER['REQUEST_METHOD'];
if ($m === 'GET') {
  $u = need_role('vendor', 'admin'); $w = '1=1'; $p = [];
  if ($u['role'] === 'vendor') { $w = 'o.vendor_id=?'; $p[] = my_vendor_id($u); }
  respond(q("SELECT p.id,o.id order_id,o.order_no,o.vendor_id,p.method,p.provider,p.checkout_id,p.amount,p.status,p.reference,p.verified_at,o.order_status FROM payments p JOIN orders o ON o.id=p.order_id WHERE $w ORDER BY p.id DESC LIMIT 300", $p)->fetchAll());
}
if ($m !== 'PATCH') fail('Method not allowed.', 405);
$b = body(); $act = one_of($b, 'action', ['confirm_cash']);
$u = need_role('vendor');
$pdo = db(); $pdo->beginTransaction();
try {
  $o = q('SELECT * FROM orders WHERE id=? FOR UPDATE', [id('order_id')])->fetch();
  if (!$o || (int)$o['vendor_id'] !== my_vendor_id($u)) { $pdo->rollBack(); fail('Order not found.', 404); }
  if ($o['payment_method'] !== 'cash' || $o['payment_status'] !== 'Unpaid' || $o['order_status'] === 'Cancelled') {
    $pdo->rollBack(); fail('Action "confirm_cash" is only allowed for unpaid Cash orders.', 409);
  }
  $tc = $o['track_code'] ?: generate_track_code();
  q("UPDATE orders SET payment_status='Paid',track_code=?,order_status=IF(order_status='Pending Payment','Confirmed',order_status) WHERE id=?", [$tc, $o['id']]);
  q("UPDATE payments SET status='Paid',verified_by=?,verified_at=NOW() WHERE order_id=?", [$u['id'], $o['id']]);
  audit('payment.confirm_cash', "{$o['order_no']} -> Paid track=$tc");
  $pdo->commit();
  respond(['payment_status' => 'Paid', 'track_code' => $tc]);
} catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
