<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../middleware/auth.php';

cors();

$action = $_GET['action'] ?? '';

function normalizeMarkerRole($marker_role) {
    if ($marker_role === null || $marker_role === '') return null;
    if (!is_array($marker_role)) {
        $marker_role = explode(',', (string)$marker_role);
    }
    $marker_role = array_values(array_filter(array_map(function($role) {
        return trim(strtoupper((string)$role));
    }, $marker_role)));
    if (empty($marker_role)) return null;
    $valid = ['IN', 'OUT'];
    foreach ($marker_role as $role) {
        if (!in_array($role, $valid, true)) return false;
    }
    return implode(',', array_unique($marker_role));
}

if ($action === 'list') {
    $db = getDB();
    $s = requireLogin();

    if ($s['role'] === 'admin') {
        $res = $db->query("SELECT u.id,u.username,u.role,u.department_id,u.marker_role,u.telegram_chat_id,d.name dept_name,u.created_at FROM users u LEFT JOIN departments d ON d.id=u.department_id ORDER BY u.role DESC, u.username");
    } elseif ($s['role'] === 'department') {
        $dept_id = intval($s['dept_id'] ?? 0);
        if (!$dept_id) err('Department not assigned.', 403);
        $st = $db->prepare("SELECT u.id,u.username,u.role,u.department_id,u.marker_role,u.telegram_chat_id,d.name dept_name,u.created_at FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE u.role='department' AND u.department_id=? ORDER BY u.username");
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
    $marker_role = normalizeMarkerRole($b['marker_role'] ?? null);

    if ($marker_role === false) err('Invalid marker role.');
    if (!$username || !$password) err('Username and password required.');
    if (strlen($password) < 6) err('Password must be at least 6 characters.');

    if ($s['role'] === 'department') {
        if (!$s['dept_id']) err('Department not assigned.', 403);
        $role = 'department';
        $dept_id = intval($s['dept_id']);
    }

    if ($role === 'department' && !$dept_id) err('Department required.');
    if ($s['role'] !== 'admin' && $role !== 'department') err('Forbidden.', 403);

    $db = getDB();
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $telegram_chat_id = trim($b['telegram_chat_id'] ?? '');
    $st = $db->prepare("INSERT INTO users (username,password,role,department_id,marker_role,telegram_chat_id) VALUES (?,?,?,?,?,?)");
    $st->bind_param('sssiss', $username, $hash, $role, $dept_id, $marker_role, $telegram_chat_id);
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
    $marker_role = normalizeMarkerRole($b['marker_role'] ?? null);
    $telegram_chat_id = trim($b['telegram_chat_id'] ?? '');

    if ($marker_role === false) err('Invalid marker role.');

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

    $st = $db->prepare("UPDATE users SET username=?, role=?, department_id=?, marker_role=?, telegram_chat_id=? WHERE id=?");
    $st->bind_param('ssissi', $username, $role, $dept_id, $marker_role, $telegram_chat_id, $id);
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
    if (!$id) {
        $body = body();
        $id = intval($body['id'] ?? 0);
    }
    if (!$id) err('User id required.', 400);
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
    // Check for dependent records that would prevent deletion (foreign key constraints)
    $deps = [];
    $checks = [
        ['papers', 'created_by', 'papers_created'],
        ['status_logs', 'user_id', 'status_logs'],
        ['paper_images', 'uploaded_by', 'paper_images'],
        ['login_logs', 'user_id', 'login_logs'],
        ['user_notifications', 'user_id', 'user_notifications']
    ];
    foreach ($checks as $c) {
        list($table, $col, $key) = $c;
        $q = $db->prepare("SELECT COUNT(*) as c FROM {$table} WHERE {$col}=?");
        $q->bind_param('i', $id);
        $q->execute();
        $r = $q->get_result()->fetch_assoc();
        if ($r && intval($r['c']) > 0) {
            $deps[$key] = intval($r['c']);
        }
    }
    if (!empty($deps)) {
        // If force flag is provided and caller is admin, attempt to reassign dependent records to admin user (id=1)
        $b = body();
        $force = !empty($b['force']);
        if ($force) {
            // Only admin may use force delete
            if ($s['role'] !== 'admin') err('Force delete requires admin privileges.', 403);
            // Determine fallback admin id (prefer user with username 'admin', else id=1)
            $admRes = $db->query("SELECT id FROM users WHERE username='admin' LIMIT 1");
            $adminRow = $admRes ? $admRes->fetch_assoc() : null;
            $fallbackId = $adminRow ? intval($adminRow['id']) : 1;
            // Reassign dependent records to fallback admin id
            $db->query("UPDATE papers SET created_by={$fallbackId} WHERE created_by={$id}");
            $db->query("UPDATE status_logs SET user_id={$fallbackId} WHERE user_id={$id}");
            $db->query("UPDATE paper_images SET uploaded_by={$fallbackId} WHERE uploaded_by={$id}");
            $db->query("UPDATE user_notifications SET user_id={$fallbackId} WHERE user_id={$id}");
            // Note: login_logs and admin_activity_logs have ON DELETE CASCADE and will be handled accordingly
        } else {
            $parts = [];
            foreach ($deps as $k => $v) $parts[] = "{$v} {$k}";
            err('Cannot delete user: dependent records exist (' . implode(', ', $parts) . ').');
        }
    }

    $st = $db->prepare("DELETE FROM users WHERE id=?");
    $st->bind_param('i', $id);
    if (!$st->execute()) {
        err('Delete failed: ' . $db->error, 500);
    }
    ok();
}

else err('Invalid action.', 404);
