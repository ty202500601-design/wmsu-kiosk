<?php /* Local XAMPP GCash simulator callback -> triggers verified Paid / Failed state identically to gateway webhook. */
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/gcash.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed.', 405);

$b = body();
$ono = strtoupper(trim((string)($b['order_no'] ?? '')));
$tok = strtoupper(trim((string)($b['token'] ?? '')));
$cid = trim((string)($b['checkout_id'] ?? ''));
$outcome = one_of($b, 'outcome', ['paid', 'failed']);
if ($ono === '' || $cid === '') fail('Missing checkout session parameters.', 422);
if ($tok === '' && !empty($_SESSION['checkout_tokens'][$ono])) $tok = $_SESSION['checkout_tokens'][$ono];

$pdo = db();
$pdo->beginTransaction();
try {
  $row = q("SELECT o.id, o.order_no, o.payment_status, o.order_status, p.checkout_id, p.provider
            FROM orders o JOIN payments p ON p.order_id=o.id
            WHERE o.order_no=? AND o.checkout_token=? AND p.checkout_id=? FOR UPDATE", [$ono, $tok, $cid])->fetch();
  if (!$row) { $pdo->rollBack(); fail('Checkout session not found or expired.', 404); }
  if ($row['provider'] !== 'gcash_sandbox') { $pdo->rollBack(); fail('This session is managed by an external gateway.', 403); }
  if ($row['order_status'] === 'Cancelled') { $pdo->rollBack(); fail('This order was already cancelled.', 409); }
  if ($row['payment_status'] === 'Paid') {
    $pdo->commit();
    respond(['payment_status' => 'Paid']);
  }
  if ($outcome === 'paid') {
    $ref = 'GC' . date('ymd') . strtoupper(bin2hex(random_bytes(4)));
    $res = finalize_gcash_paid((int)$row['id'], $ref);
    $pdo->commit();
    respond(['payment_status' => 'Paid', 'track_code' => $res['track_code'], 'order_status' => $res['order_status'], 'reference' => $ref]);
  } else {
    q("UPDATE orders SET payment_status='Failed' WHERE id=?", [$row['id']]);
    q("UPDATE payments SET status='Failed' WHERE order_id=?", [$row['id']]);
    audit('payment.gcash_failed', $row['order_no']);
    $pdo->commit();
    respond(['payment_status' => 'Failed']);
  }
} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  throw $e;
}
