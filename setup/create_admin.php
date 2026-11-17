<?php /* CLI only: php setup/create_admin.php  -> creates the first admin with a password YOU type (no default credentials). */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$GLOBALS['cfg'] = require __DIR__ . '/../config/config.php';
$pdo = new PDO(sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $GLOBALS['cfg']['db_host'], $GLOBALS['cfg']['db_name']), $GLOBALS['cfg']['db_user'], $GLOBALS['cfg']['db_pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$name = trim(readline('Admin name: ')); $email = strtolower(trim(readline('Admin email: '))); $pw = readline('Password (min 8, letters+numbers): ');
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($pw) < 8 || !preg_match('/[A-Za-z]/', $pw) || !preg_match('/\d/', $pw) || $name === '') exit("Invalid input.\n");
$pdo->prepare("INSERT INTO users(name,email,password_hash,role,status) VALUES(?,?,?,'admin','active')")->execute([$name, $email, password_hash($pw, PASSWORD_DEFAULT)]); echo "Admin created.\n";