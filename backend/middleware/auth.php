<?php
function startSession() {
    if (session_status() === PHP_SESSION_NONE) session_start();
}

function requireLogin() {
    startSession();
    if (empty($_SESSION['uid'])) err('Not logged in', 401);
    return $_SESSION;
}

function requireAdmin() {
    $s = requireLogin();
    if ($s['role'] !== 'admin') err('Admin only', 403);
    return $s;
}
