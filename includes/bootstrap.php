<?php
declare(strict_types=1);
/* Shared kernel: config, JSON responses, PDO, sessions, CSRF, auth guards, validation, audit. */
$GLOBALS['cfg'] = require __DIR__ . '/../config/config.php';
date_default_timezone_set($GLOBALS['cfg']['timezone'] ?? 'Asia/Manila'); // keep PHP "today" in step with the database clock
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff'); header('Cache-Control: no-store');
if (cfg('allowed_origin')) { header('Access-Control-Allow-Origin: ' . cfg('allowed_origin')); header('Access-Control-Allow-Credentials: true');
  header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token'); header('Access-Control-Allow-Methods: GET,POST,PATCH,DELETE');
  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; } }

function cfg(string $k) { return $GLOBALS['cfg'][$k] ?? null; }
function respond($data = null, int $code = 200): never { http_response_code($code); echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE); exit; }
function fail(string $msg, int $code = 400, array $errors = []): never { http_response_code($code); echo json_encode(['success' => false, 'error' => $msg, 'errors' => (object)$errors], JSON_UNESCAPED_UNICODE); exit; }
set_exception_handler(function (Throwable $e) {
  error_log((string)$e);
  if ($e instanceof PDOException && $e->getCode() === '23000') fail('This record is linked to other data or already exists.', 409);
  fail(cfg('debug') ? $e->getMessage() : 'Server error. Please try again.', 500);
});
function db(): PDO { static $p; return $p ??= new PDO(sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', cfg('db_host'), cfg('db_name')), cfg('db_user'), cfg('db_pass'),
  [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false, PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone='" . date('P') . "'"]); }
function q(string $sql, array $p = []): PDOStatement { $s = db()->prepare($sql); $s->execute($p); return $s; }

/* ---- Session + CSRF ---- */
session_name('WMSUSESS'); ini_set('session.use_strict_mode', '1');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS'])]);
session_start();
if (isset($_SESSION['last']) && time() - $_SESSION['last'] > cfg('session_idle')) { $_SESSION = []; session_regenerate_id(true); }
$_SESSION['last'] = time();
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD', 'OPTIONS'], true) && !defined('SKIP_CSRF')
    && !hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) fail('Session expired or invalid security token. Reload the page and try again.', 419);

/* ---- Auth ---- */
function me(): ?array { return $_SESSION['user'] ?? null; }
function need_role(string ...$roles): array { $u = me(); if (!$u) fail('Please log in.', 401); if (!in_array($u['role'], $roles, true)) fail('You do not have permission to do that.', 403); return $u; }
function my_vendor_id(array $u): int { $r = q("SELECT id FROM vendors WHERE user_id=? AND status='active'", [$u['id']])->fetch(); if (!$r) fail('Your vendor account is not active.', 403); return (int)$r['id']; }

/* ---- Input ---- */
function body(): array { static $b; if ($b !== null) return $b; $raw = file_get_contents('php://input'); $b = $raw === '' ? [] : json_decode($raw, true); if (!is_array($b)) fail('Request body must be valid JSON.'); return $b; }
function str(array $b, string $k, int $min, int $max, bool $req = true): ?string { $v = trim((string)($b[$k] ?? '')); if ($v === '' && !$req) return null; $l = mb_strlen($v);
  if ($l < $min || $l > $max) fail("Invalid $k.", 422, [$k => "Must be $min to $max characters."]); return $v; }
function num(array $b, string $k, float $min, float $max): float { $v = $b[$k] ?? null; if (!is_numeric($v) || $v < $min || $v > $max) fail("Invalid $k.", 422, [$k => "Must be between $min and $max."]); return round((float)$v, 2); }
function one_of(array $b, string $k, array $opts): string { $v = $b[$k] ?? ''; if (!is_string($v) || !in_array($v, $opts, true)) fail("Invalid $k.", 422, [$k => 'Not an allowed value.']); return $v; }
function email(array $b): string { $e = strtolower(trim((string)($b['email'] ?? ''))); if (!filter_var($e, FILTER_VALIDATE_EMAIL) || strlen($e) > 150) fail('Enter a valid email.', 422, ['email' => 'Invalid email.']); return $e; }
function password(array $b): string { $p = (string)($b['password'] ?? ''); if (strlen($p) < 8 || strlen($p) > 72 || !preg_match('/[A-Za-z]/', $p) || !preg_match('/\d/', $p)) fail('Weak password.', 422, ['password' => '8-72 characters with letters and numbers.']); return $p; }
function phone(array $b): string { $p = trim((string)($b['phone'] ?? '')); if (!preg_match('/^[0-9 +]{7,20}$/', $p)) fail('Enter a valid phone number.', 422, ['phone' => 'Invalid phone.']); return $p; }
function id(string $k = 'id'): int { $i = filter_var($_GET[$k] ?? null, FILTER_VALIDATE_INT); if (!$i || $i < 1) fail("A valid $k is required.", 422); return $i; }
function audit(string $a, string $d = ''): void { q('INSERT INTO activity_logs(user_id,action,detail,ip) VALUES(?,?,?,?)', [me()['id'] ?? null, $a, mb_substr($d, 0, 255), $_SERVER['REMOTE_ADDR'] ?? '']); }
function notify(?int $uid, ?int $oid, string $m): void { if ($uid) q('INSERT INTO notifications(user_id,order_id,message) VALUES(?,?,?)', [$uid, $oid, $m]); }
function settings_all(): array { return array_column(q('SELECT k,v FROM settings')->fetchAll(), 'v', 'k'); }
function methods_enabled(): array { $s = settings_all(); return array_values(array_filter(['cash', 'gcash', 'maya'], fn($m) => ($s["pay_$m"] ?? '0') === '1')); }
function is_track_released(array $o): bool {
  if (empty($o['track_code'])) return false;
  if (($o['payment_method'] ?? '') === 'cash') return !in_array($o['order_status'] ?? '', ['Pending Payment', 'Cancelled'], true);
  return ($o['payment_status'] ?? '') === 'Paid';
}
function generate_track_code(): string {
  for ($i = 0; $i < 10; $i++) {
    $c = strtoupper(bin2hex(random_bytes(3)));
    if (!q('SELECT 1 FROM orders WHERE track_code=?', [$c])->fetch()) return $c;
  }
  return strtoupper(bin2hex(random_bytes(3)));
}
function save_resized_image(?array $file, string $destDir, int $maxW = 800): string {
  if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) fail('Choose an image to upload.', 422);
  if ($file['size'] > cfg('upload_max')) fail('Image must be 2 MB or smaller.', 422);
  $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
  $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
  $dim = @getimagesize($file['tmp_name']);
  if (!$ext || !$dim || $dim[0] < 40 || $dim[1] < 40) fail('Only valid JPG, PNG or WebP images (at least 40x40px) are allowed.', 422);
  if (function_exists('imagewebp') && function_exists('imagecreatefromstring')) {
    $src = @imagecreatefromstring((string)file_get_contents($file['tmp_name']));
    if ($src) {
      $w = imagesx($src); $h = imagesy($src);
      if ($w > $maxW) {
        $nw = $maxW; $nh = max(1, (int)round($h * ($maxW / $w)));
        $dst = imagecreatetruecolor($nw, $nh);
        imagealphablending($dst, false); imagesavealpha($dst, true);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
        imagedestroy($src); $src = $dst;
      } else {
        imagepalettetotruecolor($src); imagesavealpha($src, true);
      }
      $name = bin2hex(random_bytes(12)) . '.webp';
      if (@imagewebp($src, rtrim($destDir, '/\\') . '/' . $name, 82)) { imagedestroy($src); return $name; }
      imagedestroy($src);
    }
  }
  $name = bin2hex(random_bytes(12)) . ".$ext";
  if (!move_uploaded_file($file['tmp_name'], rtrim($destDir, '/\\') . '/' . $name)) fail('Could not save the image.', 500);
  return $name;
}
