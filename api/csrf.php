<?php /* GET -> {csrf}. The frontend sends it back as the X-CSRF-Token header on every POST/PATCH/DELETE. */
require __DIR__ . '/../includes/bootstrap.php';
respond(['csrf' => $_SESSION['csrf'], 'user' => me()]);
