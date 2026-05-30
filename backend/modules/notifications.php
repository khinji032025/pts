<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../middleware/auth.php';

cors();

$action = $_GET['action'] ?? '';

$s = requireLogin();
$uid = intval($s['uid']);
$dept_id = intval($s['dept_id'] ?? 0);

$db = getDB();

// ensure table exists
$db->query("CREATE TABLE IF NOT EXISTS user_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  paper_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  UNIQUE KEY uq_user_paper (user_id, paper_id)
)");

if ($action === 'list') {
    // return recent papers for the user's department with read flag
    if ($s['role'] !== 'department') {
        err('Only department users can access notifications.', 403);
    }

    $st = $db->prepare("SELECT p.id,p.ref_code,p.title,p.created_at,d.name origin,un.read_at
        FROM papers p
        JOIN departments d ON d.id=p.origin_department_id
        LEFT JOIN user_notifications un ON un.paper_id=p.id AND un.user_id=?
        WHERE p.origin_department_id=?
        ORDER BY p.created_at DESC
        LIMIT 50");
    $st->bind_param('ii', $uid, $dept_id);
    $st->execute();
    $res = $st->get_result();
    $items = [];
    $unread = 0;
    while ($r = $res->fetch_assoc()) {
        $r['is_read'] = $r['read_at'] ? true : false;
        if (!$r['is_read']) $unread++;
        $items[] = $r;
    }
    ok(['notifications' => $items, 'unread' => $unread]);
}

elseif ($action === 'mark_read') {
    $b = body();
    $paper_id = intval($b['paper_id'] ?? 0);
    if (!$paper_id) err('paper_id required.');

    // Only mark notifications for papers that belong to the user's department
    $ch = $db->prepare("SELECT origin_department_id FROM papers WHERE id=?");
    $ch->bind_param('i', $paper_id);
    $ch->execute();
    $row = $ch->get_result()->fetch_assoc();
    $ch->close();
    if (!$row) err('Paper not found.', 404);
    if (intval($row['origin_department_id']) !== $dept_id) err('Forbidden.', 403);

    $ins = $db->prepare("INSERT INTO user_notifications (user_id,paper_id,read_at) VALUES (?,?,NOW()) ON DUPLICATE KEY UPDATE read_at=VALUES(read_at)");
    $ins->bind_param('ii', $uid, $paper_id);
    $ins->execute();
    ok();
}

elseif ($action === 'mark_all_read') {
    // Mark all current department papers as read for this user.
    if ($s['role'] !== 'department') err('Only department users can perform this.', 403);

    // 1) update existing rows
    $upd = $db->prepare("UPDATE user_notifications un JOIN papers p ON p.id=un.paper_id SET un.read_at=NOW() WHERE un.user_id=? AND p.origin_department_id=? AND un.read_at IS NULL");
    $upd->bind_param('ii', $uid, $dept_id);
    $upd->execute();

    // 2) insert missing rows
    $ins = $db->prepare("INSERT INTO user_notifications (user_id,paper_id,read_at)
        SELECT ?, p.id, NOW() FROM papers p
        LEFT JOIN user_notifications un ON un.paper_id=p.id AND un.user_id=?
        WHERE p.origin_department_id=? AND un.id IS NULL");
    $ins->bind_param('iii', $uid, $uid, $dept_id);
    $ins->execute();

    ok();
}

else err('Invalid action.', 404);

?>
