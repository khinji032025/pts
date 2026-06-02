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
    // return recent notification events for papers relevant to the user
    if ($s['role'] !== 'department') {
        err('Only department users can access notifications.', 403);
    }

    // Query each notification entry separately (one per action) with latest action info
    // For each notification entry, compute the paper's action and department as of the notification time
    // This prevents older notifications from showing the current/latest action (which would make past IN appear as OUT)
    $st = $db->prepare("SELECT un.id as notif_id, p.id, p.ref_code, p.title, p.created_at as paper_created, un.created_at, un.read_at,
        d.name origin,
        (SELECT l.action FROM status_logs l WHERE l.paper_id=p.id AND l.created_at <= un.created_at ORDER BY l.created_at DESC, l.id DESC LIMIT 1) latest_action,
        (SELECT d2.name FROM status_logs l2 JOIN departments d2 ON d2.id=l2.department_id WHERE l2.paper_id=p.id AND l2.created_at <= un.created_at ORDER BY l2.created_at DESC, l2.id DESC LIMIT 1) latest_dept
        FROM user_notifications un
        JOIN papers p ON p.id=un.paper_id
        JOIN departments d ON d.id=p.origin_department_id
        WHERE un.user_id=? AND (p.origin_department_id=? OR EXISTS (SELECT 1 FROM status_logs sl WHERE sl.paper_id=p.id AND sl.user_id=?))
        ORDER BY un.created_at DESC
        LIMIT 100");
    $st->bind_param('iii', $uid, $dept_id, $uid);
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
    $notif_id = intval($b['notif_id'] ?? 0);
    if (!$notif_id) err('notif_id required.');

    // Mark this specific notification as read
    $upd = $db->prepare("UPDATE user_notifications SET read_at=NOW() WHERE id=? AND user_id=?");
    $upd->bind_param('ii', $notif_id, $uid);
    $upd->execute();
    if ($upd->affected_rows === 0) err('Notification not found or forbidden.', 404);
    ok();
}

elseif ($action === 'mark_all_read') {
    // Mark all unread notifications as read for this user.
    if ($s['role'] !== 'department') err('Only department users can perform this.', 403);

    $upd = $db->prepare("UPDATE user_notifications un JOIN papers p ON p.id=un.paper_id SET un.read_at=NOW() WHERE un.user_id=? AND (p.origin_department_id=? OR EXISTS (SELECT 1 FROM status_logs sl WHERE sl.paper_id=p.id AND sl.user_id=?)) AND un.read_at IS NULL");
    $upd->bind_param('iii', $uid, $dept_id, $uid);
    $upd->execute();
    ok();
}

elseif ($action === 'clear_history') {
    // Delete all notification entries for the user
    if ($s['role'] !== 'department') err('Only department users can perform this.', 403);

    $del = $db->prepare("DELETE un FROM user_notifications un JOIN papers p ON p.id=un.paper_id WHERE un.user_id=? AND (p.origin_department_id=? OR EXISTS (SELECT 1 FROM status_logs sl WHERE sl.paper_id=p.id AND sl.user_id=?))");
    $del->bind_param('iii', $uid, $dept_id, $uid);
    $del->execute();
    ok();
}

else err('Invalid action.', 404);

?>
