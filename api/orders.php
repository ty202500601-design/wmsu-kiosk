<?php /* GET (role-scoped list) | GET ?order_no=&code= (public tracking) | POST (per-stall Cash / GCash QR order) | PATCH ?id (vendor status workflow) */
require __DIR__ . '/../includes/bootstrap.php';
const FLOW = ['Pending Payment' => ['Confirmed', 'Cancelled'], 'Confirmed' => ['Preparing', 'Cancelled'], 'Preparing' => ['Ready for Pickup'], 'Ready for Pickup' => ['Completed'], 'Completed' => [], 'Cancelled' => []];
$m = $_SERVER['REQUEST_METHOD'];

function with_items(array $rows, bool $public = false): array {
  if (!$rows) return [];
  $ids = array_column($rows, 'id');
  $ph = implode(',', array_fill(0, count($ids), '?'));
  $it = q("SELECT oi.order_id, oi.food_id, oi.name, oi.unit_price, oi.qty, oi.line_total,
                  f.image_path, f.thumb_path, f.avg_color, f.lqip, f.image
           FROM order_items oi
           LEFT JOIN foods f ON f.id = oi.food_id
           WHERE oi.order_id IN($ph)", $ids)->fetchAll();
  $g = [];
  foreach ($it as $i) $g[$i['order_id']][] = $i;
  foreach ($rows as &$r) {
    $r['items'] = $g[$r['id']] ?? [];
    if (!is_track_released($r)) $r['track_code'] = null;
    if ($public) unset($r['user_id'], $r['checkout_token'], $r['proof_path']);
  }
  return $rows;
}

if ($m === 'GET') {
  if (isset($_GET['order_no'])) {
    $ono = strtoupper(trim((string)$_GET['order_no']));
    $key = strtoupper(trim((string)($_GET['token'] ?? $_GET['code'] ?? '')));
    if ($key === 'NULL' || $key === 'UNDEFINED') $key = '';
    if ($key === '' && !empty($_SESSION['checkout_tokens'][$ono])) $key = $_SESSION['checkout_tokens'][$ono];
    if ($ono === '' || $key === '') fail('Order number and tracking/access code are required.', 422);

    $pubSel = 'SELECT o.*, v.name vendor_name, v.gcash_account_name, p.reference payment_ref, p.reject_reason, COALESCE(p.order_code, o.order_code) order_code, p.provider
               FROM orders o JOIN vendors v ON v.id=o.vendor_id LEFT JOIN payments p ON p.order_id=o.id';
    $target = q("$pubSel WHERE o.order_no=? AND ((o.track_code IS NOT NULL AND o.track_code=?) OR (o.checkout_token IS NOT NULL AND o.checkout_token=?))", [$ono, $key, $key])->fetch();
    if (!$target) fail('Order not found. Check the order number and tracking code.', 404);

    if (!empty($target['checkout_token'])) {
      $all = q("$pubSel WHERE o.checkout_token=? ORDER BY o.id ASC", [$target['checkout_token']])->fetchAll();
    } else {
      $all = q("$pubSel WHERE o.track_code=? ORDER BY o.id ASC", [$target['track_code']])->fetchAll();
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

  $u = need_role('vendor', 'admin');
  $w = ['1=1']; $p = [];
  if ($u['role'] === 'vendor') { $w[] = 'o.vendor_id=?'; $p[] = my_vendor_id($u); }
  if (isset($_GET['id'])) { $w[] = 'o.id=?'; $p[] = id(); }
  if (!empty($_GET['status'])) { $w[] = 'o.order_status=?'; $p[] = one_of($_GET, 'status', array_keys(FLOW)); }
  $rows = q('SELECT o.*, v.name vendor_name, p.reference payment_ref, p.proof_path, p.reject_reason, COALESCE(p.order_code, o.order_code) order_code, p.verified_at, p.provider
             FROM orders o JOIN vendors v ON v.id=o.vendor_id LEFT JOIN payments p ON p.order_id=o.id
             WHERE ' . implode(' AND ', $w) . ' ORDER BY o.created_at DESC LIMIT 200', $p)->fetchAll();
  if (isset($_GET['id']) && !$rows) fail('Order not found.', 404);
  $rows = with_items($rows);
  respond(isset($_GET['id']) ? $rows[0] : $rows);
}

if ($m === 'POST') {
  $ct = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
  if (str_starts_with($ct, 'multipart/form-data')) {
    $rawPayload = (string)($_POST['payload'] ?? '');
    $b = $rawPayload === '' ? [] : json_decode($rawPayload, true);
    if (!is_array($b)) fail('Invalid order payload.', 400);
  } else {
    $b = body();
  }

  $enabled = methods_enabled();
  $type = one_of($b, 'order_type', ['Dine-In', 'Take-Out']);
  $name = str($b, 'guest_name', 2, 60);
  $items = $b['items'] ?? null;
  if (!is_array($items) || !$items || count($items) > 30) fail('Your cart is empty or too large.', 422);

  $qty = [];
  foreach ($items as $i) {
    $fid = (int)($i['food_id'] ?? 0);
    $n = (int)($i['qty'] ?? 0);
    if ($fid < 1 || $n < 1 || $n > 20) fail('Invalid item or quantity.', 422);
    $qty[$fid] = min(20, ($qty[$fid] ?? 0) + $n);
  }

  $ph = implode(',', array_fill(0, count($qty), '?'));
  $foods = q("SELECT f.id, f.vendor_id, f.name, f.price,
                     v.user_id vendor_user, v.name vendor_name, v.is_open, v.status vendor_status,
                     v.gcash_enabled, v.gcash_qr_path, v.gcash_account_name
              FROM foods f JOIN vendors v ON v.id=f.vendor_id
              WHERE f.is_available=1 AND f.id IN($ph)", array_keys($qty))->fetchAll();
  if (count($foods) !== count($qty)) fail('One or more items in your cart are unavailable or sold out.', 409);

  $by_vendor = [];
  foreach ($foods as $f) {
    if (!$f['is_open'] || $f['vendor_status'] !== 'active') {
      fail("Stall \"{$f['vendor_name']}\" is closed right now.", 409);
    }
    $f['qty'] = $qty[$f['id']];
    $f['line'] = (int)round($f['price'] * 100) * $f['qty'];
    $by_vendor[$f['vendor_id']]['vendor'] = $f;
    $by_vendor[$f['vendor_id']]['items'][] = $f;
  }

  $stallPayments = is_array($b['stall_payments'] ?? null) ? $b['stall_payments'] : [];
  $fallbackMethod = isset($b['payment_method']) && is_string($b['payment_method']) ? $b['payment_method'] : 'cash';

  /* Pre-validate per-stall payment choices & reference numbers before DB writes */
  $plan = [];
  $seenRefs = [];
  foreach ($by_vendor as $vid => $grp) {
    $vRow = $grp['vendor'];
    $vName = $vRow['vendor_name'];
    $sp = is_array($stallPayments[(string)$vid] ?? null) ? $stallPayments[(string)$vid] : (is_array($stallPayments[$vid] ?? null) ? $stallPayments[$vid] : []);
    $vMethod = (string)($sp['method'] ?? $fallbackMethod);
    if (!in_array($vMethod, $enabled, true)) {
      fail("Payment method \"$vMethod\" is currently disabled.", 422);
    }
    if ($vMethod === 'gcash') {
      if (!vendor_gcash_ready($vRow)) {
        fail("GCash isn't available for \"$vName\" — please pay at the counter.", 409);
      }
      $ref = preg_replace('/\s+/', '', (string)($sp['reference'] ?? ''));
      if (!preg_match('/^\d{13}$/', $ref)) {
        fail("Enter a valid 13-digit GCash Reference No. for \"$vName\".", 422, ["ref_$vid" => 'Reference No. must be exactly 13 digits.']);
      }
      if (isset($seenRefs[$ref])) {
        fail("Duplicate GCash Reference No. ($ref) cannot be used twice.", 409, ["ref_$vid" => 'Duplicate reference number.']);
      }
      $seenRefs[$ref] = true;
      $ocode = strtoupper(trim((string)($sp['order_code'] ?? '')));
      if (!preg_match('/^[A-Z0-9-]{4,24}$/', $ocode)) {
        $ocode = 'AGA-' . strtoupper(bin2hex(random_bytes(3)));
      }
      $plan[$vid] = ['method' => 'gcash', 'ref' => $ref, 'order_code' => $ocode];
    } else {
      $plan[$vid] = ['method' => 'cash', 'ref' => null, 'order_code' => null];
    }
  }

  $token = strtoupper(bin2hex(random_bytes(8)));
  $pdo = db();
  $pdo->beginTransaction();
  $created = [];
  $savedProofs = [];
  try {
    foreach ($by_vendor as $vid => $grp) {
      $pInfo = $plan[$vid];
      $vMethod = $pInfo['method'];
      $ref = $pInfo['ref'];
      $ocode = $pInfo['order_code'];

      /* Reject duplicate reference numbers atomically inside transaction */
      if ($vMethod === 'gcash' && $ref !== null) {
        $dup = q('SELECT id FROM payments WHERE reference=? LIMIT 1 FOR UPDATE', [$ref])->fetch();
        if ($dup) {
          throw new RuntimeException("DUPLICATE_REF:$ref");
        }
      }

      /* Optional screenshot upload for GCash stalls (image only, max 5 MB) */
      $proofPath = null;
      if ($vMethod === 'gcash') {
        $fKey = "proof_$vid";
        if (!empty($_FILES[$fKey]) && ($_FILES[$fKey]['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
          $savedName = save_uploaded_image($_FILES[$fKey], __DIR__ . '/../uploads/proofs', 1400, 5 * 1024 * 1024);
          $proofPath = "uploads/proofs/$savedName";
          $savedProofs[] = __DIR__ . '/../uploads/proofs/' . $savedName;
        }
      }

      /* Server-side total recalculation strictly from DB prices */
      $cents = array_sum(array_column($grp['items'], 'line'));
      $vtotal = $cents / 100;
      $initPayStatus = $vMethod === 'gcash' ? 'submitted' : 'Unpaid';

      q('INSERT INTO orders(order_no,track_code,order_code,checkout_token,vendor_id,user_id,customer_name,order_type,payment_method,payment_status,subtotal,total) VALUES(?,NULL,?,?,?,NULL,?,?,?,?,?,?)',
        ['TMP' . bin2hex(random_bytes(8)), $ocode, $token, $vid, $name, $type, $vMethod, $initPayStatus, $vtotal, $vtotal]);
      $oid = (int)$pdo->lastInsertId();
      $no = 'WM' . date('ymd') . '-' . str_pad((string)$oid, 5, '0', STR_PAD_LEFT);
      if ($vMethod === 'gcash' && !$ocode) $ocode = $no;
      q('UPDATE orders SET order_no=?, order_code=COALESCE(order_code, ?) WHERE id=?', [$no, $ocode, $oid]);

      foreach ($grp['items'] as $it) {
        $frow = q('SELECT stock_qty,is_available FROM foods WHERE id=? FOR UPDATE', [$it['id']])->fetch();
        if (!$frow || !$frow['is_available']) {
          $pdo->rollBack();
          foreach ($savedProofs as $spFile) @unlink($spFile);
          fail("\"{$it['name']}\" just sold out.", 409);
        }
        if ($frow['stock_qty'] !== null) {
          if ((int)$frow['stock_qty'] < $it['qty']) {
            $pdo->rollBack();
            foreach ($savedProofs as $spFile) @unlink($spFile);
            fail("Only {$frow['stock_qty']} serving(s) left for \"{$it['name']}\".", 409);
          }
          $rem = (int)$frow['stock_qty'] - $it['qty'];
          q('UPDATE foods SET stock_qty=?,is_available=IF(?=0,0,is_available) WHERE id=?', [$rem, $rem, $it['id']]);
        }
        q('INSERT INTO order_items(order_id,food_id,name,unit_price,qty,line_total) VALUES(?,?,?,?,?,?)',
          [$oid, $it['id'], $it['name'], $it['price'], $it['qty'], $it['line'] / 100]);
      }

      $provider = $vMethod === 'gcash' ? 'gcash_qr' : 'cash';
      q('INSERT INTO payments(order_id,method,order_code,provider,amount,status,reference,proof_path) VALUES(?,?,?,?,?,?,?,?)',
        [$oid, $vMethod, $ocode, $provider, $vtotal, $initPayStatus, $ref, $proofPath]);

      $noteMsg = $vMethod === 'gcash'
        ? "GCash QR submitted for $no (Code: $ocode, Ref: $ref) - ₱" . number_format($vtotal, 2)
        : "New cash order $no ($type) - ₱" . number_format($vtotal, 2);
      notify((int)$grp['vendor']['vendor_user'], $oid, $noteMsg);
      $_SESSION['checkout_tokens'][$no] = $token;
      $created[] = [
        'id' => $oid,
        'order_no' => $no,
        'order_code' => $ocode,
        'vendor_id' => $vid,
        'vendor_name' => $grp['vendor']['vendor_name'],
        'payment_method' => $vMethod,
        'payment_status' => $initPayStatus,
        'total' => $vtotal
      ];
    }
    $pdo->commit();
  } catch (RuntimeException $re) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    foreach ($savedProofs as $spFile) @unlink($spFile);
    if (str_starts_with($re->getMessage(), 'DUPLICATE_REF:')) {
      $dupRef = substr($re->getMessage(), 14);
      fail("GCash Reference No. $dupRef has already been submitted or used. Please check your GCash receipt and enter a unique 13-digit reference number.", 409, ['reference' => 'Duplicate reference number.']);
    }
    throw $re;
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    foreach ($savedProofs as $spFile) @unlink($spFile);
    throw $e;
  }

  $grand_total = array_sum(array_column($created, 'total'));
  respond([
    'id' => $created[0]['id'],
    'order_no' => $created[0]['order_no'],
    'orders' => $created,
    'track_code' => null,
    'checkout_token' => $token,
    'total' => $grand_total,
    'order_status' => 'Pending Payment'
  ], 201);
}

if ($m === 'PATCH') {
  $u = need_role('vendor'); $b = body(); $to = one_of($b, 'order_status', array_keys(FLOW));
  $pdo = db(); $pdo->beginTransaction();
  try {
    $o = q('SELECT o.*,v.user_id vendor_user FROM orders o JOIN vendors v ON v.id=o.vendor_id WHERE o.id=? FOR UPDATE', [id()])->fetch();
    if (!$o || (int)$o['vendor_id'] !== my_vendor_id($u)) { $pdo->rollBack(); fail('Order not found.', 404); }
    if (!in_array($to, FLOW[$o['order_status']], true)) { $pdo->rollBack(); fail("An order that is \"{$o['order_status']}\" cannot move to \"$to\".", 409); }
    if ($to === 'Cancelled' && $o['payment_status'] === 'Paid') { $pdo->rollBack(); fail('A verified paid order cannot be cancelled here.', 403); }
    if ($o['payment_method'] !== 'cash' && $to !== 'Cancelled' && $o['payment_status'] !== 'Paid') {
      $pdo->rollBack();
      fail('Verify the submitted GCash payment first before preparing this order.', 409);
    }
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
      if ($o['payment_method'] === 'gcash' && $o['payment_status'] === 'submitted') {
        q("UPDATE orders SET payment_status='Rejected' WHERE id=?", [$o['id']]);
        q("UPDATE payments SET status='Rejected', reject_reason=?, verified_by=?, verified_at=NOW() WHERE order_id=?", [$reason, $u['id'], $o['id']]);
      }
      q('UPDATE foods f JOIN order_items oi ON oi.food_id=f.id SET f.stock_qty=f.stock_qty+oi.qty, f.is_available=1 WHERE oi.order_id=? AND f.stock_qty IS NOT NULL', [$o['id']]);
    }
    notify($o['user_id'] ? (int)$o['user_id'] : null, (int)$o['id'], "Order {$o['order_no']} is now: $to");
    audit('order.status', "{$o['order_no']} {$o['order_status']} -> $to");
    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }
  respond(['order_status' => $to]);
}
fail('Method not allowed.', 405);
