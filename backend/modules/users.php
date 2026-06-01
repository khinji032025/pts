<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../middleware/auth.php';

cors();

$action = $_GET['action'] ?? '';

if ($action === 'list') {
    $db = getDB();
    $s = requireLogin();

    if ($s['role'] === 'admin') {
        $res = $db->query("SELECT u.id,u.username,u.role,u.department_id,u.marker_role,d.name dept_name,u.created_at FROM users u LEFT JOIN departments d ON d.id=u.department_id ORDER BY u.role DESC, u.username");
    } elseif ($s['role'] === 'department') {
        $dept_id = intval($s['dept_id'] ?? 0);
        if (!$dept_id) err('Department not assigned.', 403);
        $st = $db->prepare("SELECT u.id,u.username,u.role,u.department_id,u.marker_role,d.name dept_name,u.created_at FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE u.role='department' AND u.department_id=? ORDER BY u.username");
        $st->bind_param('i', $dept_id);
        $st->execute();
        $res = $st->get_result();
    } else {
        err('Forbidden.', 403);
    }

    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    ok(['users' => $rows]);
}

elseif ($action === 'create') {
    $s = requireLogin();
    $b = body();
    $username = trim($b['username'] ?? '');
    $password = $b['password'] ?? '';
    $role     = $b['role'] ?? 'department';
    $dept_id  = $b['dept_id'] ? intval($b['dept_id']) : null;
    $marker_role = $b['marker_role'] ?? null;

    if (!$username || !$password) err('Username and password required.');
    if (strlen($password) < 6) err('Password must be at least 6 characters.');

    if ($marker_role && !in_array($marker_role, ['IN', 'OUT'])) err('Invalid marker role.');

    if ($s['role'] === 'department') {
        if (!$s['dept_id']) err('Department not assigned.', 403);
        $role = 'department';
        $dept_id = intval($s['dept_id']);
    }

    if ($role === 'department' && !$dept_id) err('Department required.');
    if ($s['role'] !== 'admin' && $role !== 'department') err('Forbidden.', 403);

    $db = getDB();
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $st = $db->prepare("INSERT INTO users (username,password,role,department_id,marker_role) VALUES (?,?,?,?,?)");
    $st->bind_param('sssis', $username, $hash, $role, $dept_id, $marker_role);
    if (!$st->execute()) err('Username already taken.');
    $userId = $db->insert_id;
    ok(['id' => $userId]);
}

elseif ($action === 'update') {
    $s = requireLogin();
    $id = intval($_GET['id'] ?? 0);
    $b = body();
    $username = trim($b['username'] ?? '');
    $role     = $b['role'] ?? '';
    $dept_id  = $b['dept_id'] ? intval($b['dept_id']) : null;
    $password = $b['password'] ?? '';
    $marker_role = $b['marker_role'] ?? null;

    if ($marker_role && !in_array($marker_role, ['IN', 'OUT'])) err('Invalid marker role.');

    $db = getDB();
    if ($s['role'] === 'department') {
        $ownDept = intval($s['dept_id'] ?? 0);
        if (!$ownDept) err('Department not assigned.', 403);
        $check = $db->prepare("SELECT role, department_id FROM users WHERE id=?");
        $check->bind_param('i', $id);
        $check->execute();
        $target = $check->get_result()->fetch_assoc();
        if (!$target) err('User not found.', 404);
        if ($target['role'] !== 'department' || intval($target['department_id']) !== $ownDept) err('Forbidden.', 403);
        $role = 'department';
        $dept_id = $ownDept;
    }

    $st = $db->prepare("UPDATE users SET username=?, role=?, department_id=?, marker_role=? WHERE id=?");
    $st->bind_param('ssssi', $username, $role, $dept_id, $marker_role, $id);
    $st->execute();

    if ($password && strlen($password) >= 6) {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $p = $db->prepare("UPDATE users SET password=? WHERE id=?");
        $p->bind_param('si', $hash, $id);
        $p->execute();
    }

    ok();
}

elseif ($action === 'delete') {
    $s = requireLogin();
    $id = intval($_GET['id'] ?? 0);
    if ($id === intval($s['uid'])) err('Cannot delete yourself.');
    $db = getDB();
    if ($s['role'] === 'department') {
        $ownDept = intval($s['dept_id'] ?? 0);
        if (!$ownDept) err('Department not assigned.', 403);
        $check = $db->prepare("SELECT role, department_id FROM users WHERE id=?");
        $check->bind_param('i', $id);
        $check->execute();
        $target = $check->get_result()->fetch_assoc();
        if (!$target) err('User not found.', 404);
        if ($target['role'] !== 'department' || intval($target['department_id']) !== $ownDept) err('Forbidden.', 403);
    } else {
        requireAdmin();
    }
    $st = $db->prepare("DELETE FROM users WHERE id=?");
    $st->bind_param('i', $id);
    $st->execute();
    ok();
}

else err('Invalid action.', 404);
