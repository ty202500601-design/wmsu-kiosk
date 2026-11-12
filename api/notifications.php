<?php /* GET own notifications | PATCH ?id (mark one read) or no id (mark all read). Guests track orders via orders.php?order_no=&code= */
require __DIR__ . '/../includes/bootstrap.php';
$u = need_role('customer', 'vendor', 'admin');
if ($_SERVER['REQUEST_METHOD'] === 'GET') respond(['unread' => (int)q('SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0', [$u['id']])->fetchColumn(),
  'items' => q('SELECT id,order_id,message,is_read,created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50', [$u['id']])->fetchAll()]);
if ($_SERVER['REQUEST_METHOD'] === 'PATCH') { isset($_GET['id']) ? q('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [id(), $u['id']]) : q('UPDATE notifications SET is_read=1 WHERE user_id=?', [$u['id']]); respond(); }
fail('Method not allowed.', 405);
