<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../middleware/auth.php';

cors();

$action = $_GET['action'] ?? '';

if ($action === 'list') {
    requireLogin();
    $db = getDB();
    $res = $db->query("SELECT d.*, COUNT(u.id) user_count FROM departments d LEFT JOIN users u ON u.department_id=d.id GROUP BY d.id ORDER BY d.name");
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    ok(['departments' => $rows]);
}

elseif ($action === 'create') {
    requireAdmin();
    $b = body();
    $name = trim($b['name'] ?? '');
    if (!$name) err('Name required.');
    $db = getDB();
    $st = $db->prepare("INSERT INTO departments (name) VALUES (?)");
    $st->bind_param('s', $name);
    if (!$st->execute()) err('Department already exists.');
    ok(['id' => $db->insert_id, 'name' => $name]);
}

elseif ($action === 'delete') {
    requireAdmin();
    $id = intval($_GET['id'] ?? 0);
    $db = getDB();
    $ch = $db->prepare("SELECT COUNT(*) c FROM users WHERE department_id=?");
    $ch->bind_param('i', $id);
    $ch->execute();
    if ($ch->get_result()->fetch_assoc()['c'] > 0) err('Cannot delete: department has users.');
    $st = $db->prepare("DELETE FROM departments WHERE id=?");
    $st->bind_param('i', $id);
    $st->execute();
    ok();
}

else err('Invalid action.', 404);
