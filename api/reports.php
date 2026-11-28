<?php /* GET ?type=sales|dashboard|activity &from=YYYY-MM-DD &to=YYYY-MM-DD [&vendor_id= admin only]. Sales = paid, non-cancelled orders. */
require __DIR__ . '/../includes/bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('Method not allowed.', 405);
$u = need_role('vendor', 'admin'); $type = $_GET['type'] ?? 'sales';
$d = fn($k, $def) => preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET[$k] ?? '') ? $_GET[$k] : $def; $from = $d('from', date('Y-m-01')); $to = $d('to', date('Y-m-d'));
$w = "o.created_at>=? AND o.created_at<DATE_ADD(?,INTERVAL 1 DAY)"; $p = [$from, $to]; $vid = null;
if ($u['role'] === 'vendor') $vid = my_vendor_id($u); elseif (isset($_GET['vendor_id'])) $vid = id('vendor_id'); if ($vid) { $w .= ' AND o.vendor_id=?'; $p[] = $vid; }
$paid = "o.payment_status='Paid' AND o.order_status<>'Cancelled'";
if ($type === 'activity') { need_role('admin'); respond(q('SELECT a.id,a.action,a.detail,a.ip,a.created_at,u.name user_name FROM activity_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200')->fetchAll()); }
if ($type === 'dashboard') { $r = ['orders_by_status' => array_column(q("SELECT order_status s,COUNT(*) c FROM orders o WHERE $w GROUP BY order_status", $p)->fetchAll(), 'c', 's'),
    'total_sales' => (float)q("SELECT COALESCE(SUM(total),0) FROM orders o WHERE $w AND $paid", $p)->fetchColumn(),
    'recent_orders' => q("SELECT o.id,o.order_no,o.customer_name,o.total,o.order_status,o.payment_status,o.created_at FROM orders o WHERE $w ORDER BY o.id DESC LIMIT 8", $p)->fetchAll()];
  if ($u['role'] === 'admin') { $r['total_users'] = (int)q('SELECT COUNT(*) FROM users')->fetchColumn(); $r['total_vendors'] = (int)q("SELECT COUNT(*) FROM vendors WHERE status='active'")->fetchColumn(); }
  respond($r); }
$r = ['from' => $from, 'to' => $to, 'totals' => q("SELECT COUNT(*) orders,COALESCE(SUM(total),0) sales FROM orders o WHERE $w AND $paid", $p)->fetch(),
  'by_day' => q("SELECT DATE(o.created_at) day,COUNT(*) orders,SUM(total) sales FROM orders o WHERE $w AND $paid GROUP BY day ORDER BY day", $p)->fetchAll(),
  'top_items' => q("SELECT i.name,SUM(i.qty) qty,SUM(i.line_total) sales FROM order_items i JOIN orders o ON o.id=i.order_id WHERE $w AND $paid GROUP BY i.name ORDER BY sales DESC LIMIT 10", $p)->fetchAll()];
if ($u['role'] === 'admin') { $r['by_vendor'] = q("SELECT v.name,SUM(o.total) sales FROM orders o JOIN vendors v ON v.id=o.vendor_id WHERE $w AND $paid GROUP BY v.id ORDER BY sales DESC", $p)->fetchAll();
  $r['by_method'] = q("SELECT o.payment_method method,SUM(o.total) sales FROM orders o WHERE $w AND $paid GROUP BY o.payment_method", $p)->fetchAll(); }
respond($r);
