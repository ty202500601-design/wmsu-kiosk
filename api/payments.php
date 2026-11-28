<?php /* GET (vendor own / admin all) | PATCH ?order_id= {action:'confirm_cash'|'verify_gcash'|'reject_gcash', reason?:string} */
require __DIR__ . '/../includes/bootstrap.php';
$m = $_SERVER['REQUEST_METHOD'];

if ($m === 'GET') {
  $u = need_role('vendor', 'admin');
  $w = '1=1'; $p = [];
  if ($u['role'] === 'vendor') { $w = 'o.vendor_id=?'; $p[] = my_vendor_id($u); }
  if (!empty($_GET['status'])) { $w .= ' AND p.status=?'; $p[] = (string)$_GET['status']; }
  respond(q("SELECT p.id, o.id order_id, o.order_no, COALESCE(p.order_code, o.order_code) order_code, o.customer_name, o.vendor_id,
                    p.method, p.provider, p.amount, p.status, p.reference, p.proof_path, p.reject_reason, p.verified_at,
                    o.order_status, o.track_code, o.created_at
             FROM payments p JOIN orders o ON o.id=p.order_id
             WHERE $w ORDER BY p.id DESC LIMIT 300", $p)->fetchAll());
}

if ($m !== 'PATCH') fail('Method not allowed.', 405);
$b = body();
$act = one_of($b, 'action', ['confirm_cash', 'verify_gcash', 'reject_gcash']);
$u = need_role('vendor');
$ownVid = my_vendor_id($u);

$pdo = db();
$pdo->beginTransaction();
try {
  $o = q('SELECT * FROM orders WHERE id=? FOR UPDATE', [id('order_id')])->fetch();
  if (!$o || (int)$o['vendor_id'] !== $ownVid) { $pdo->rollBack(); fail('Order not found.', 404); }

  if ($act === 'confirm_cash') {
    if ($o['payment_method'] !== 'cash' || $o['payment_status'] !== 'Unpaid' || $o['order_status'] === 'Cancelled') {
      $pdo->rollBack();
      fail('Action "confirm_cash" is only allowed for unpaid Cash orders.', 409);
    }
    $tc = $o['track_code'] ?: generate_track_code();
    q("UPDATE orders SET payment_status='Paid',track_code=?,order_status=IF(order_status='Pending Payment','Confirmed',order_status) WHERE id=?", [$tc, $o['id']]);
    q("UPDATE payments SET status='Paid',verified_by=?,verified_at=NOW() WHERE order_id=?", [$u['id'], $o['id']]);
    audit('payment.confirm_cash', "{$o['order_no']} -> Paid track=$tc");
    $pdo->commit();
    respond(['payment_status' => 'Paid', 'track_code' => $tc]);
  }

  if ($act === 'verify_gcash') {
    if ($o['payment_method'] !== 'gcash' || !in_array($o['payment_status'], ['submitted', 'Pending Verification'], true) || $o['order_status'] === 'Cancelled') {
      $pdo->rollBack();
      fail('Only submitted pending GCash payments can be verified.', 409);
    }
    $tc = $o['track_code'] ?: generate_track_code();
    $nextOrderStatus = $o['order_status'] === 'Pending Payment' ? 'Confirmed' : $o['order_status'];
    q("UPDATE orders SET payment_status='Paid', track_code=?, order_status=? WHERE id=?", [$tc, $nextOrderStatus, $o['id']]);
    q("UPDATE payments SET status='Paid', reject_reason=NULL, verified_by=?, verified_at=NOW() WHERE order_id=?", [$u['id'], $o['id']]);
    audit('payment.verify_gcash', "{$o['order_no']} -> Paid track=$tc");
    $pdo->commit();
    respond(['payment_status' => 'Paid', 'track_code' => $tc, 'order_status' => $nextOrderStatus]);
  }

  if ($act === 'reject_gcash') {
    if ($o['payment_method'] !== 'gcash' || !in_array($o['payment_status'], ['submitted', 'Pending Verification'], true) || $o['order_status'] === 'Cancelled') {
      $pdo->rollBack();
      fail('Only submitted pending GCash payments can be rejected.', 409);
    }
    $reason = str($b, 'reason', 3, 200);
    q("UPDATE orders SET payment_status='Rejected', order_status='Cancelled', cancel_reason=? WHERE id=?", ["GCash payment rejected: $reason", $o['id']]);
    q("UPDATE payments SET status='Rejected', reject_reason=?, verified_by=?, verified_at=NOW() WHERE order_id=?", [$reason, $u['id'], $o['id']]);
    q('UPDATE foods f JOIN order_items oi ON oi.food_id=f.id SET f.stock_qty=f.stock_qty+oi.qty, f.is_available=1 WHERE oi.order_id=? AND f.stock_qty IS NOT NULL', [$o['id']]);
    audit('payment.reject_gcash', "{$o['order_no']} -> Rejected ($reason)");
    $pdo->commit();
    respond(['payment_status' => 'Rejected', 'order_status' => 'Cancelled', 'reason' => $reason]);
  }
} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  throw $e;
}
