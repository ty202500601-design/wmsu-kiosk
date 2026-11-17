<?php /* Provider -> server callback. No session/CSRF; authenticated by HMAC-SHA256 of the raw body using PAY_WEBHOOK_SECRET.
   Adapt the field names below to your provider's payload. Nothing is marked Paid unless the signature AND amount match. */
define('SKIP_CSRF', true);
require __DIR__ . '/../includes/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Method not allowed.', 405);
if (cfg('webhook_secret') === '') fail('Payment webhook is not configured.', 503);
$raw = file_get_contents('php://input');
if (!hash_equals(hash_hmac('sha256', $raw, cfg('webhook_secret')), $_SERVER['HTTP_X_SIGNATURE'] ?? '')) fail('Bad signature.', 401);
$b = json_decode($raw, true) ?: []; $ref = (string)($b['reference'] ?? ''); $ok = ($b['status'] ?? '') === 'paid';
$pdo = db(); $pdo->beginTransaction();
$p = q("SELECT p.*,o.order_no FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.reference=? AND p.status='Pending Verification' FOR UPDATE", [$ref])->fetch();
if (!$p) { $pdo->rollBack(); fail('No matching pending payment.', 404); }
if ($ok && abs((float)$p['amount'] - (float)($b['amount'] ?? -1)) > 0.001) { $pdo->rollBack(); fail('Amount mismatch.', 422); }
$s = $ok ? 'Paid' : 'Failed'; q('UPDATE payments SET status=?,verified_at=NOW() WHERE id=?', [$s, $p['id']]); q('UPDATE orders SET payment_status=? WHERE id=?', [$s, $p['order_id']]);
if ($ok) q("UPDATE orders SET order_status='Confirmed' WHERE id=? AND order_status='Pending Payment'", [$p['order_id']]);
audit('payment.webhook', "{$p['order_no']} -> $s"); $pdo->commit(); respond();
