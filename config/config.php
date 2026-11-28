<?php
// Copy values for your XAMPP setup. In production, move secrets to environment variables.
return [
  'db_host' => getenv('DB_HOST') ?: '127.0.0.1',
  'db_name' => getenv('DB_NAME') ?: 'wmsu_canteen',
  'db_user' => getenv('DB_USER') ?: 'root',
  'db_pass' => getenv('DB_PASS') ?: '',
  'timezone' => 'Asia/Manila',          // PHP and MySQL sessions both use this
  'debug'   => false,                 // true shows exception messages in JSON (dev only)
  'session_idle' => 1800,             // seconds of inactivity before the session is dropped
  'webhook_secret' => getenv('PAY_WEBHOOK_SECRET') ?: 'wmsu_local_gcash_webhook_secret',
  'paymongo_secret' => getenv('PAYMONGO_SECRET_KEY') ?: '',
  'paymongo_webhook_secret' => getenv('PAYMONGO_WEBHOOK_SECRET') ?: '',
  'allowed_origin' => '',             // set only if the frontend is on another origin, e.g. http://localhost:3000
  'upload_max' => 2 * 1024 * 1024,
];
