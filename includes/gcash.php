<?php
declare(strict_types=1);
/* GCash Checkout session factory (PayMongo Checkout Sessions when configured, or local XAMPP GCash simulator). */

function app_base_url(): string {
  $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
  $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
  $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/wmsu/api/orders.php', 2)), '/');
  return "$proto://$host$dir";
}

function create_gcash_checkout(string $orderNo, string $token, string $vendorName, float $total, array $items): array {
  $base = app_base_url();
  $secret = trim((string)(cfg('paymongo_secret') ?? ''));
  if ($secret !== '' && function_exists('curl_init') && $total >= 20.0) {
    $lineItems = array_map(fn($it) => [
      'name' => (string)$it['name'],
      'quantity' => (int)$it['qty'],
      'amount' => (int)round(((float)$it['price']) * 100),
      'currency' => 'PHP',
    ], $items);
    $payload = [
      'data' => [
        'attributes' => [
          'send_email_receipt' => false,
          'show_description' => true,
          'show_line_items' => true,
          'description' => "WMSU Canteen - $vendorName ($orderNo)",
          'payment_method_types' => ['gcash'],
          'line_items' => $lineItems,
          'metadata' => ['order_no' => $orderNo, 'checkout_token' => $token],
          'success_url' => "$base/customer/confirmation.html?no=" . rawurlencode($orderNo) . "&token=" . rawurlencode($token),
          'cancel_url' => "$base/customer/confirmation.html?no=" . rawurlencode($orderNo) . "&token=" . rawurlencode($token),
        ]
      ]
    ];
    $ch = curl_init('https://api.paymongo.com/v1/checkout_sessions');
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST => true,
      CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json', 'Authorization: Basic ' . base64_encode($secret . ':')],
      CURLOPT_POSTFIELDS => json_encode($payload),
      CURLOPT_TIMEOUT => 12,
    ]);
    $res = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($res && $code >= 200 && $code < 300) {
      $j = json_decode((string)$res, true);
      $cid = $j['data']['id'] ?? null;
      $url = $j['data']['attributes']['checkout_url'] ?? null;
      if ($cid && $url) return ['provider' => 'paymongo', 'checkout_id' => (string)$cid, 'checkout_url' => (string)$url];
    }
  }
  $cid = 'gc_sim_' . bin2hex(random_bytes(10));
  $url = "gcash-pay.html?no=" . rawurlencode($orderNo) . "&token=" . rawurlencode($token) . "&cid=" . rawurlencode($cid);
  return ['provider' => 'gcash_sandbox', 'checkout_id' => $cid, 'checkout_url' => $url];
}

function finalize_gcash_paid(int $orderId, string $reference): array {
  $pdo = db();
  $inTx = $pdo->inTransaction();
  if (!$inTx) $pdo->beginTransaction();
  try {
    $o = q('SELECT o.*, v.user_id vendor_user FROM orders o JOIN vendors v ON v.id=o.vendor_id WHERE o.id=? FOR UPDATE', [$orderId])->fetch();
    if (!$o) throw new RuntimeException('Order not found.');
    $tc = !empty($o['track_code']) ? (string)$o['track_code'] : generate_track_code();
    $nextStatus = $o['order_status'] === 'Pending Payment' ? 'Confirmed' : $o['order_status'];
    q("UPDATE orders SET payment_status='Paid', track_code=?, order_status=? WHERE id=?", [$tc, $nextStatus, $orderId]);
    q("UPDATE payments SET status='Paid', reference=?, verified_at=NOW() WHERE order_id=?", [$reference, $orderId]);
    notify((int)$o['vendor_user'], $orderId, "GCash paid for {$o['order_no']} (Track: $tc)");
    audit('payment.gcash_paid', "{$o['order_no']} ref=$reference track=$tc");
    if (!$inTx) $pdo->commit();
    return ['track_code' => $tc, 'order_status' => $nextStatus, 'reference' => $reference];
  } catch (Throwable $e) {
    if (!$inTx && $pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }
}
