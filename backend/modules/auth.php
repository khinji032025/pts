<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../middleware/auth.php';

cors();
startSession();

function ensureLoginLogsTable($db) {
    $db->query("CREATE TABLE IF NOT EXISTS login_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        username VARCHAR(50) NOT NULL,
        role ENUM('admin','department') NOT NULL,
        department_id INT NULL,
        department_name VARCHAR(100) NULL,
        login_method VARCHAR(20) NOT NULL DEFAULT 'password',
        login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_login_at (login_at),
        INDEX idx_department_id (department_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    )");
}

function logDepartmentLogin($db, $row, $method) {
    if (($row['role'] ?? '') !== 'department') return;

    ensureLoginLogsTable($db);
    $st = $db->prepare("INSERT INTO login_logs (user_id, username, role, department_id, department_name, login_method) VALUES (?, ?, ?, ?, ?, ?)");
    $uid = (int)$row['id'];
    $username = (string)$row['username'];
    $role = (string)$row['role'];
    $deptId = isset($row['department_id']) ? (int)$row['department_id'] : null;
    $deptName = (string)($row['dept_name'] ?? '');
    $loginMethod = (string)$method;
    $st->bind_param('ississ', $uid, $username, $role, $deptId, $deptName, $loginMethod);
    $st->execute();
}

$action = $_GET['action'] ?? '';

if ($action === 'login') {
    $b = body();
    $u = trim($b['username'] ?? '');
    $p = $b['password'] ?? '';
    if (!$u || !$p) err('Username and password required.');

    $db = getDB();
    $st = $db->prepare("SELECT u.*, d.name dept_name FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE u.username=?");
    $st->bind_param('s', $u);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();

    if (!$row || !password_verify($p, $row['password'])) err('Invalid username or password.', 401);

    $_SESSION['uid']         = $row['id'];
    $_SESSION['username']    = $row['username'];
    $_SESSION['role']        = $row['role'];
    $_SESSION['dept_id']     = $row['department_id'];
    $_SESSION['dept_name']   = $row['dept_name'];
    $_SESSION['marker_role'] = $row['marker_role'];

    logDepartmentLogin($db, $row, 'password');

    ok(['user' => ['id'=>$row['id'],'username'=>$row['username'],'role'=>$row['role'],'dept_id'=>$row['department_id'],'dept_name'=>$row['dept_name'],'marker_role'=>$row['marker_role']]]);
}

elseif ($action === 'logout') {
    session_destroy();
    ok(['message' => 'Logged out']);
}

elseif ($action === 'session') {
    if (empty($_SESSION['uid'])) ok(['auth' => false]);
    ok(['auth' => true, 'user' => ['id'=>$_SESSION['uid'],'username'=>$_SESSION['username'],'role'=>$_SESSION['role'],'dept_id'=>$_SESSION['dept_id'],'dept_name'=>$_SESSION['dept_name'],'marker_role'=>$_SESSION['marker_role']]]);
}

elseif ($action === 'change_password') {
    $s = requireLogin();
    $b = body();
    $cur = $b['current'] ?? '';
    $new = $b['new'] ?? '';
    if (!$cur || !$new) err('All fields required.');
    if (strlen($new) < 6) err('New password must be at least 6 characters.');

    $db = getDB();
    $st = $db->prepare("SELECT password FROM users WHERE id=?");
    $st->bind_param('i', $s['uid']);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();

    if (!password_verify($cur, $row['password'])) err('Current password incorrect.', 401);

    $hash = password_hash($new, PASSWORD_DEFAULT);
    $up = $db->prepare("UPDATE users SET password=? WHERE id=?");
    $up->bind_param('si', $hash, $s['uid']);
    $up->execute();
    ok(['message' => 'Password changed.']);
}

elseif ($action === 'qr_login') {
    $b = body();
    $dept = $b['dept_id'] ?? null;
    if (!$dept) err('Department id required.');

    $db = getDB();
    $st = $db->prepare("SELECT u.*, d.name dept_name FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE u.department_id=? AND u.role='department' LIMIT 1");
    $st->bind_param('i', $dept);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();
    if (!$row) err('Department user not found.', 404);

    // Log in as that department user
    $_SESSION['uid']         = $row['id'];
    $_SESSION['username']    = $row['username'];
    $_SESSION['role']        = $row['role'];
    $_SESSION['dept_id']     = $row['department_id'];
    $_SESSION['dept_name']   = $row['dept_name'];
    $_SESSION['marker_role'] = $row['marker_role'];

    logDepartmentLogin($db, $row, 'qr');

    ok(['user' => ['id'=>$row['id'],'username'=>$row['username'],'role'=>$row['role'],'dept_id'=>$row['department_id'],'dept_name'=>$row['dept_name'],'marker_role'=>$row['marker_role']]]);
}

elseif ($action === 'login_history') {
    requireAdmin();
    $db = getDB();
    ensureLoginLogsTable($db);
    $r = $db->query("SELECT id, user_id, username, department_id, department_name, login_method, login_at
                     FROM login_logs
                     WHERE role = 'department'
                     ORDER BY login_at DESC, id DESC
                     LIMIT 200");
    $logs = [];
    while ($row = $r->fetch_assoc()) $logs[] = $row;
    ok(['logs' => $logs]);
}

else err('Invalid action.', 404);
