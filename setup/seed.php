<?php /* CLI only: C:\xampp\php\php.exe setup\seed.php  -> inserts TEST accounts, vendors, menu items and sample orders. Safe to re-run. DO NOT use on production. */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$cfg = require __DIR__ . '/../config/config.php';
$pdo = new PDO(sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $cfg['db_host'], $cfg['db_name']), $cfg['db_user'], $cfg['db_pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
function one(PDO $p, string $sql, array $a = []) { $s = $p->prepare($sql); $s->execute($a); return $s->fetch(); }
function run(PDO $p, string $sql, array $a = []): void { $p->prepare($sql)->execute($a); }

function user(PDO $p, string $name, string $email, string $pw, string $role, string $status = 'active'): int {
  if ($r = one($p, 'SELECT id FROM users WHERE email=?', [$email])) return (int)$r['id'];
  run($p, 'INSERT INTO users(name,email,password_hash,role,status) VALUES(?,?,?,?,?)', [$name, $email, password_hash($pw, PASSWORD_DEFAULT), $role, $status]); return (int)$p->lastInsertId();
}
function vendor(PDO $p, int $uid, string $name, string $owner, string $desc, string $phone, string $status, int $open = 1): int {
  if ($r = one($p, 'SELECT id FROM vendors WHERE user_id=?', [$uid])) return (int)$r['id'];
  run($p, 'INSERT INTO vendors(user_id,name,owner_name,description,phone,status,is_open) VALUES(?,?,?,?,?,?,?)', [$uid, $name, $owner, $desc, $phone, $status, $open]); return (int)$p->lastInsertId();
}
function cat(PDO $p, string $name, string $icon): int {
  if ($r = one($p, 'SELECT id FROM categories WHERE vendor_id IS NULL AND name=?', [$name])) return (int)$r['id'];
  run($p, 'INSERT INTO categories(vendor_id,name,icon) VALUES(NULL,?,?)', [$name, $icon]); return (int)$p->lastInsertId();
}
function food(PDO $p, int $vid, ?int $cid, string $name, string $desc, float $price, int $avail = 1): int {
  if ($r = one($p, 'SELECT id FROM foods WHERE vendor_id=? AND name=?', [$vid, $name])) return (int)$r['id'];
  run($p, 'INSERT INTO foods(vendor_id,category_id,name,description,price,is_available) VALUES(?,?,?,?,?,?)', [$vid, $cid, $name, $desc, $price, $avail]); return (int)$p->lastInsertId();
}
function order(PDO $p, int $vid, string $cust, string $type, string $ostatus, string $method, string $pstatus, array $items, ?string $ref = null): void {
  $total = array_sum(array_map(fn($i) => $i[1] * $i[2], $items)); $code = strtoupper(bin2hex(random_bytes(3)));
  run($p, 'INSERT INTO orders(order_no,track_code,vendor_id,customer_name,order_type,order_status,payment_method,payment_status,subtotal,total) VALUES(?,?,?,?,?,?,?,?,?,?)',
    ['TMP' . bin2hex(random_bytes(8)), $code, $vid, $cust, $type, $ostatus, $method, $pstatus, $total, $total]);
  $oid = (int)$p->lastInsertId(); run($p, 'UPDATE orders SET order_no=? WHERE id=?', ['WM' . date('ymd') . '-' . str_pad((string)$oid, 5, '0', STR_PAD_LEFT), $oid]);
  foreach ($items as [$fid, $price, $qty, $name]) run($p, 'INSERT INTO order_items(order_id,food_id,name,unit_price,qty,line_total) VALUES(?,?,?,?,?,?)', [$oid, $fid, $name, $price, $qty, $price * $qty]);
  run($p, 'INSERT INTO payments(order_id,method,amount,status,reference) VALUES(?,?,?,?,?)', [$oid, $method, $total, $pstatus, $ref]);
}

$rice = cat($pdo, 'Rice Meals', '🍚'); $burg = cat($pdo, 'Burgers & Sandwiches', '🍔'); $snack = cat($pdo, 'Snacks', '🍟'); $drink = cat($pdo, 'Drinks', '🥤'); $dess = cat($pdo, 'Desserts', '🍨');

user($pdo, 'WMSU Administrator', 'admin@wmsu.edu.ph', 'Admin1234', 'admin');
user($pdo, 'Juan Dela Cruz', 'juan@wmsu.edu.ph', 'Student123', 'customer');
user($pdo, 'Maria Santos', 'maria@wmsu.edu.ph', 'Student123', 'customer');
user($pdo, 'Prof. Lopez', 'lopez@wmsu.edu.ph', 'Faculty123', 'customer');

$v1 = vendor($pdo, user($pdo, 'Nena Reyes', 'nena@wmsu.edu.ph', 'Vendor123', 'vendor'), "Aling Nena's Kitchen", 'Nena Reyes', 'Filipino rice meals and silog', '09170000001', 'active');
$v2 = vendor($pdo, user($pdo, 'Carlo Mendoza', 'burger@wmsu.edu.ph', 'Vendor123', 'vendor'), 'Burger Hub', 'Carlo Mendoza', 'Burgers, fries and drinks', '09170000002', 'active');
$v3 = vendor($pdo, user($pdo, 'Ana Lim', 'sweet@wmsu.edu.ph', 'Vendor123', 'vendor'), 'Sweet Corner', 'Ana Lim', 'Snacks, halo-halo and desserts', '09170000003', 'active', 0);
vendor($pdo, user($pdo, 'Rico Valdez', 'pizza@wmsu.edu.ph', 'Vendor123', 'vendor', 'pending'), 'Pizza Corner', 'Rico Valdez', 'Pizza by the slice', '09181112222', 'pending');

$tap = food($pdo, $v1, $rice, 'Tapsilog', 'Beef tapa, garlic rice and egg.', 85); $ado = food($pdo, $v1, $rice, 'Chicken Adobo', 'Classic adobo with steamed rice.', 75);
$sin = food($pdo, $v1, $rice, 'Pork Sinigang', 'Sour tamarind soup with pork.', 90); $tea = food($pdo, $v1, $drink, 'Iced Tea', 'Refreshing house iced tea.', 25);
$chz = food($pdo, $v2, $burg, 'Cheeseburger', 'Beef patty with melted cheese.', 65); food($pdo, $v2, $burg, 'Double Burger', 'Two patties, extra juicy.', 95);
$fry = food($pdo, $v2, $snack, 'French Fries', 'Crispy golden fries.', 45); food($pdo, $v2, $drink, 'Soda', 'Chilled soft drink.', 30);
food($pdo, $v3, $dess, 'Halo-Halo', 'Shaved ice with sweet toppings.', 60); food($pdo, $v3, $snack, 'Banana Cue', 'Caramelized fried banana.', 20); food($pdo, $v3, $dess, 'Leche Flan', 'Creamy caramel custard.', 40, 0);

if (!one($pdo, 'SELECT 1 FROM orders LIMIT 1')) {
  order($pdo, $v1, 'Juan D.', 'Dine-In', 'Pending Payment', 'cash', 'Unpaid', [[$tap, 85, 2, 'Tapsilog']]);
  order($pdo, $v1, 'Maria S.', 'Take-Out', 'Preparing', 'gcash', 'Paid', [[$ado, 75, 1, 'Chicken Adobo'], [$tea, 25, 1, 'Iced Tea']], 'GC-20260001');
  order($pdo, $v1, 'Ana R.', 'Dine-In', 'Completed', 'cash', 'Paid', [[$sin, 90, 1, 'Pork Sinigang']]);
  order($pdo, $v2, 'Pedro L.', 'Dine-In', 'Ready for Pickup', 'cash', 'Paid', [[$chz, 65, 2, 'Cheeseburger'], [$fry, 45, 1, 'French Fries']]);
  echo "Sample orders added.\n";
}
echo "Seed complete.\n\nTEST LOGINS\n  Admin   admin@wmsu.edu.ph   / Admin1234\n  Vendor  nena@wmsu.edu.ph    / Vendor123   (Aling Nena's Kitchen)\n  Vendor  burger@wmsu.edu.ph  / Vendor123   (Burger Hub)\n  Vendor  sweet@wmsu.edu.ph   / Vendor123   (Sweet Corner, closed)\n  Pending vendor application: pizza@wmsu.edu.ph / Vendor123 (approve it in Admin > Applications)\n  Customers (juan@, maria@, lopez@wmsu.edu.ph) / Student123 or Faculty123\n";
