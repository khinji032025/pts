<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../middleware/auth.php';

cors();

$action = $_GET['action'] ?? '';

function currentStatusSummary($db, $paper_id) {
    $st = $db->prepare("SELECT l.action, d.name dept FROM status_logs l JOIN departments d ON d.id=l.department_id WHERE l.paper_id=? ORDER BY l.created_at DESC, l.id DESC LIMIT 1");
    if (!$st) return ['action' => null, 'dept' => null];
    $st->bind_param('i', $paper_id);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();
    $st->close();
    return ['action' => $row['action'] ?? null, 'dept' => $row['dept'] ?? null];
}

if ($action === 'list') {
    requireLogin();
    $db = getDB();
    $res = $db->query("SELECT d.*, COUNT(u.id) user_count FROM departments d LEFT JOIN users u ON u.department_id=d.id GROUP BY d.id ORDER BY d.name");
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    ok(['departments' => $rows]);
}

elseif ($action === 'papers') {
    requireLogin();
    $dept_id = intval($_GET['dept_id'] ?? 0);
    if (!$dept_id) err('Department id required.');

    $db = getDB();
    $st = $db->prepare("SELECT id, name FROM departments WHERE id=? LIMIT 1");
    $st->bind_param('i', $dept_id);
    $st->execute();
    $department = $st->get_result()->fetch_assoc();
    $st->close();
    if (!$department) err('Department not found.', 404);

    $sql = "SELECT p.id,p.ref_code,p.title FROM papers p WHERE p.origin_department_id=? OR EXISTS (SELECT 1 FROM status_logs sl WHERE sl.paper_id=p.id AND sl.department_id=?) ORDER BY p.created_at DESC";
    $st = $db->prepare($sql);
    $st->bind_param('ii', $dept_id, $dept_id);
    $st->execute();
    $res = $st->get_result();

    $papers = [];
    while ($row = $res->fetch_assoc()) {
        $status = currentStatusSummary($db, intval($row['id']));
        $papers[] = [
            'id' => intval($row['id']),
            'ref_code' => $row['ref_code'],
            'title' => $row['title'],
            'status_action' => $status['action'],
            'status_dept' => $status['dept'],
        ];
    }
    $st->close();

    ok([
        'department' => $department,
        'papers' => $papers,
    ]);
}

elseif ($action === 'create') {
    $s = requireAdmin();
    $b = body();
    $name = trim($b['name'] ?? '');
    $abbrev = trim($b['abbreviation'] ?? '');
    if (!$name) err('Name required.');
    if (!$abbrev) err('Abbreviation required.');
    
    $db = getDB();
    $st = $db->prepare("INSERT INTO departments (name, abbreviation) VALUES (?, ?)");
    $st->bind_param('ss', $name, $abbrev);
    if (!$st->execute()) err('Department already exists or invalid abbreviation.');
    $deptId = $db->insert_id;
    
    // Initialize counter for new department
    $counterStmt = $db->prepare("INSERT INTO dept_ref_counter (department_id, next_ref) VALUES (?, 101)");
    $counterStmt->bind_param('i', $deptId);
    $counterStmt->execute();
    $counterStmt->close();
    
    ok(['id' => $deptId, 'name' => $name, 'abbreviation' => $abbrev]);
}

elseif ($action === 'delete') {
    $s = requireAdmin();
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
