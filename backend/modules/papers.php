<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../middleware/auth.php';

cors();

$action = $_GET['action'] ?? '';

// Ensure notifications table exists (used to track per-user read state)
$__tmp_db = getDB();
$__tmp_db->query("CREATE TABLE IF NOT EXISTS user_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    paper_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL
)");
$idx = $__tmp_db->query("SHOW INDEX FROM user_notifications WHERE Key_name='uq_user_paper'");
if ($idx && $idx->num_rows > 0) {
    $__tmp_db->query("ALTER TABLE user_notifications DROP INDEX uq_user_paper");
}

function currentStatus($db, $paper_id) {
    $st = $db->prepare("SELECT l.action, l.department_id, d.name dept, l.created_at last_scanned_at FROM status_logs l JOIN departments d ON d.id=l.department_id WHERE l.paper_id=? ORDER BY l.created_at DESC, l.id DESC LIMIT 1");
    $st->bind_param('i', $paper_id);
    $st->execute();
    return $st->get_result()->fetch_assoc();
}

function markerRoleIncludes($marker_role, $action) {
    $marker_role = strtoupper(trim((string)$marker_role));
    if ($marker_role === '') return false;
    $roles = array_filter(array_map('trim', explode(',', $marker_role)));
    return in_array($action, $roles, true);
}

function notifyUsers($db, $paper_id, $user_ids) {
    $user_ids = array_values(array_unique(array_filter($user_ids, 'intval')));
    if (!$user_ids) return;

    $ins = $db->prepare("INSERT INTO user_notifications (user_id, paper_id) VALUES (?, ?)");
    if ($ins) {
        foreach ($user_ids as $uid) {
            $uid_i = intval($uid);
            $ins->bind_param('ii', $uid_i, $paper_id);
            $ins->execute();
        }
        $ins->close();
    }

    // Build message text from current paper status
    $st = $db->prepare("SELECT ref_code, title FROM papers WHERE id=?");
    if (!$st) return;
    $st->bind_param('i', $paper_id);
    $st->execute();
    $prow = $st->get_result()->fetch_assoc();
    $st->close();
    $ref_code = $prow['ref_code'] ?? ($paper_id ? "#{$paper_id}" : 'unknown');
    $title = trim($prow['title'] ?? '');
    $escTitle = $title !== '' ? htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') : '';
    $status = currentStatus($db, $paper_id);
    $action = $status['action'] ?? 'updated';
    $dept = $status['dept'] ?? null;
    $textBase = "Paper {$ref_code}";
    if ($escTitle) $textBase .= " - {$escTitle}";
    $textBase .= " has a new notification: {$action}";
    if ($dept) $textBase .= " at " . htmlspecialchars($dept, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    // Send per-user Telegram messages (use user's telegram_chat_id if present)
    $idList = implode(',', array_map('intval', $user_ids));
    if ($idList === '') return;
    $res = $db->query("SELECT id, telegram_chat_id FROM users WHERE id IN ({$idList})");
    if (!$res) return;
    while ($u = $res->fetch_assoc()) {
        $chat = trim($u['telegram_chat_id'] ?? '');
        if (!$chat) continue;
        sendTelegramMessage($textBase, $chat);
    }
}

function getNotificationRecipients($db, $paper_id, $actor_uid, $actor_dept_id, $action) {
    $actor_uid = intval($actor_uid);
    $actor_dept_id = intval($actor_dept_id);
    $action = strtoupper(trim($action ?? ''));
    $recipients = [];

    $prev = $db->prepare("SELECT DISTINCT u.id, u.department_id, u.marker_role FROM status_logs sl JOIN users u ON u.id=sl.user_id WHERE sl.paper_id=? AND sl.user_id<>?");
    if ($prev) {
        $prev->bind_param('ii', $paper_id, $actor_uid);
        $prev->execute();
        $resPrev = $prev->get_result();
        while ($row = $resPrev->fetch_assoc()) {
            $uid = intval($row['id']);
            $dept_id = intval($row['department_id'] ?? 0);
            $marker_role = strtoupper(trim($row['marker_role'] ?? ''));
            if ($dept_id === $actor_dept_id) {
                if ($action === 'OUT' && $marker_role === 'IN') {
                    $recipients[] = $uid;
                }
            } else {
                $recipients[] = $uid;
            }
        }
        $prev->close();
    }

    $originDept = 0;
    $originCheck = $db->prepare("SELECT origin_department_id FROM papers WHERE id=?");
    if ($originCheck) {
        $originCheck->bind_param('i', $paper_id);
        $originCheck->execute();
        $originRow = $originCheck->get_result()->fetch_assoc();
        $originCheck->close();
        $originDept = intval($originRow['origin_department_id'] ?? 0);
    }

    $handledDepts = $db->prepare("SELECT DISTINCT department_id FROM status_logs WHERE paper_id=? AND department_id IS NOT NULL");
    if ($handledDepts) {
        $handledDepts->bind_param('i', $paper_id);
        $handledDepts->execute();
        $resDepts = $handledDepts->get_result();
        while ($d = $resDepts->fetch_assoc()) {
            $dept_id = intval($d['department_id'] ?? 0);
            if ($dept_id && $dept_id !== $actor_dept_id) {
                $deptUsers = $db->prepare("SELECT id FROM users WHERE department_id=?");
                if ($deptUsers) {
                    $deptUsers->bind_param('i', $dept_id);
                    $deptUsers->execute();
                    $resUsers = $deptUsers->get_result();
                    while ($userRow = $resUsers->fetch_assoc()) {
                        $recipients[] = intval($userRow['id']);
                    }
                    $deptUsers->close();
                }
            }
        }
        $handledDepts->close();
    }

    // Always notify users from the origin department (exclude actor later)
    if ($originDept) {
        $originUsers = $db->prepare("SELECT id FROM users WHERE department_id=?");
        if ($originUsers) {
            $originUsers->bind_param('i', $originDept);
            $originUsers->execute();
            $resOriginUsers = $originUsers->get_result();
            while ($u = $resOriginUsers->fetch_assoc()) {
                $recipients[] = intval($u['id']);
            }
            $originUsers->close();
        }
    }

    if ($actor_dept_id && $action === 'OUT') {
        $inUsers = $db->prepare("SELECT id FROM users WHERE department_id=? AND marker_role='IN'");
        if ($inUsers) {
            $inUsers->bind_param('i', $actor_dept_id);
            $inUsers->execute();
            $resInUsers = $inUsers->get_result();
            while ($u = $resInUsers->fetch_assoc()) {
                $recipients[] = intval($u['id']);
            }
            $inUsers->close();
        }
    }

    $recipients = array_values(array_unique(array_filter($recipients, 'intval')));
    $recipients = array_filter($recipients, function ($uid) use ($actor_uid) { return intval($uid) !== intval($actor_uid); });
    return array_values($recipients);
}

function departmentHasAccess($db, $paper_id, $dept_id) {
    if (!$dept_id) return false;
    $st = $db->prepare("SELECT 1 FROM papers WHERE id=? AND origin_department_id=? LIMIT 1");
    if (!$st) return false;
    $st->bind_param('ii', $paper_id, $dept_id);
    $st->execute();
    $hasOrigin = $st->get_result()->fetch_assoc();
    $st->close();
    if ($hasOrigin) return true;

    $st = $db->prepare("SELECT 1 FROM status_logs WHERE paper_id=? AND department_id=? LIMIT 1");
    if (!$st) return false;
    $st->bind_param('ii', $paper_id, $dept_id);
    $st->execute();
    $hasScan = $st->get_result()->fetch_assoc();
    $st->close();
    return (bool)$hasScan;
}

if ($action === 'list') {
    $s = requireLogin();
    $db = getDB();
    $where = []; $types = ''; $vals = [];

    $search = $_GET['search'] ?? '';
    $month  = $_GET['month']  ?? '';
    $day    = $_GET['day']    ?? '';
    $dept_id = intval($_GET['dept_id'] ?? 0);

    if ($s['role'] === 'department') {
        $dept_id = intval($s['dept_id'] ?? 0);
        $where[] = "(p.origin_department_id=? OR EXISTS (SELECT 1 FROM status_logs sl WHERE sl.paper_id=p.id AND sl.department_id=?))";
        $types .= 'ii';
        $vals[] = $dept_id;
        $vals[] = $dept_id;
    } elseif ($dept_id) {
        if ($s['role'] !== 'admin') {
            err('Forbidden.', 403);
        }
        $where[] = "p.origin_department_id=?";
        $types .= 'i';
        $vals[] = $dept_id;
    }

    if ($search) { $where[] = "(p.title LIKE ? OR p.ref_code LIKE ?)"; $types .= 'ss'; $like = "%$search%"; $vals[] = $like; $vals[] = $like; }
    if ($month)  { $where[] = "MONTH(p.created_at)=?"; $types .= 'i'; $vals[] = intval($month); }
    if ($day)    { $where[] = "DAY(p.created_at)=?";   $types .= 'i'; $vals[] = intval($day); }

    $sql = "SELECT p.id,p.ref_code,p.title,p.created_at,p.origin_department_id,d.name origin FROM papers p JOIN departments d ON d.id=p.origin_department_id" . ($where ? " WHERE ".implode(' AND ',$where) : "") . " ORDER BY p.created_at DESC";
    $st = $db->prepare($sql);
    if ($types) $st->bind_param($types, ...$vals);
    $st->execute();
    $res = $st->get_result();
    $papers = [];
    while ($r = $res->fetch_assoc()) {
        $s = currentStatus($db, $r['id']);
        $r['status_action'] = $s['action'] ?? null;
        $r['status_dept']   = $s['dept'] ?? null;
        $r['current_location'] = $s['dept'] ?? null;
        $r['last_scanned_at']  = $s['last_scanned_at'] ?? null;
        $papers[] = $r;
    }
    ok(['papers' => $papers]);
}

elseif ($action === 'public_view') {
    $ref = trim($_GET['ref'] ?? '');
    if (!$ref) err('Ref required.');

    $db = getDB();

    $st = $db->prepare("SELECT p.*,d.name origin FROM papers p JOIN departments d ON d.id=p.origin_department_id WHERE p.ref_code=?");
    $st->bind_param('s', $ref);
    $st->execute();
    $paper = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$paper) err('Paper not found.', 404);

    $st2 = $db->prepare("SELECT l.action, d.name dept, l.created_at last_scanned_at FROM status_logs l JOIN departments d ON d.id=l.department_id WHERE l.paper_id=? ORDER BY l.created_at DESC, l.id DESC LIMIT 1");
    $st2->bind_param('i', $paper['id']);
    $st2->execute();
    $s = $st2->get_result()->fetch_assoc();
    $st2->close();

    $paper['status_action'] = $s['action'] ?? null;
    $paper['status_dept']   = $s['dept']   ?? null;
    $paper['current_location'] = $s['dept'] ?? null;
    $paper['last_scanned_at']  = $s['last_scanned_at'] ?? null;

    $st3 = $db->prepare("SELECT l.*,d.name dept_name,u.username FROM status_logs l JOIN departments d ON d.id=l.department_id JOIN users u ON u.id=l.user_id WHERE l.paper_id=? ORDER BY l.created_at DESC, l.id DESC");
    $st3->bind_param('i', $paper['id']);
    $st3->execute();
    $res3 = $st3->get_result();
    $logs = [];
    while ($r = $res3->fetch_assoc()) $logs[] = $r;
    $st3->close();
    $paper['logs'] = $logs;

    $st4 = $db->prepare("SELECT pi.id, pi.paper_id, pi.image_path, pi.uploaded_by, pi.uploaded_at, u.username FROM paper_images pi LEFT JOIN users u ON u.id=pi.uploaded_by WHERE pi.paper_id=? ORDER BY pi.uploaded_at DESC");
    $st4->bind_param('i', $paper['id']);
    $st4->execute();
    $res4 = $st4->get_result();
    $images = [];
    while ($r = $res4->fetch_assoc()) $images[] = $r;
    $st4->close();
    $paper['images'] = $images;

    ok(['paper' => $paper]);
}

elseif ($action === 'view') {
    $s = requireLogin();
    $id = intval($_GET['id'] ?? 0);
    $db = getDB();

    $st = $db->prepare("SELECT p.*,d.name origin FROM papers p JOIN departments d ON d.id=p.origin_department_id WHERE p.id=?");
    $st->bind_param('i', $id);
    $st->execute();
    $paper = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$paper) err('Not found.', 404);

    if ($s['role'] === 'department') {
        $deptId = intval($s['dept_id'] ?? 0);
        if (!departmentHasAccess($db, $id, $deptId)) {
            err('Forbidden.', 403);
        }
    }

    // current status
    $st2 = $db->prepare("SELECT l.action, d.name dept, l.created_at last_scanned_at FROM status_logs l JOIN departments d ON d.id=l.department_id WHERE l.paper_id=? ORDER BY l.created_at DESC, l.id DESC LIMIT 1");
    $st2->bind_param('i', $id);
    $st2->execute();
    $s = $st2->get_result()->fetch_assoc();
    $st2->close();

    $paper['status_action'] = $s['action'] ?? null;
    $paper['status_dept']   = $s['dept']   ?? null;
    $paper['current_location'] = $s['dept'] ?? null;
    $paper['last_scanned_at']  = $s['last_scanned_at'] ?? null;

    // logs
    $st3 = $db->prepare("SELECT l.*,d.name dept_name,u.username FROM status_logs l JOIN departments d ON d.id=l.department_id JOIN users u ON u.id=l.user_id WHERE l.paper_id=? ORDER BY l.created_at DESC, l.id DESC");
    $st3->bind_param('i', $id);
    $st3->execute();
    $res = $st3->get_result();
    $logs = [];
    while ($r = $res->fetch_assoc()) $logs[] = $r;
    $st3->close();
    $paper['logs'] = $logs;

    // images
    $st4 = $db->prepare("SELECT pi.id, pi.paper_id, pi.image_path, pi.uploaded_by, pi.uploaded_at, u.username FROM paper_images pi LEFT JOIN users u ON u.id=pi.uploaded_by WHERE pi.paper_id=? ORDER BY pi.uploaded_at DESC");
    $st4->bind_param('i', $id);
    $st4->execute();
    $res4 = $st4->get_result();
    $images = [];
    while ($r = $res4->fetch_assoc()) $images[] = $r;
    $st4->close();
    $paper['images'] = $images;

    ok(['paper' => $paper]);
}
elseif ($action === 'create') {
    $s = requireLogin();
    $b = body();
    $title   = trim($b['title'] ?? '');
    $dept_id = intval($b['dept_id'] ?? $s['dept_id'] ?? 0);
    if (!$title) err('Title required.');
    if (!$dept_id) err('Department required.');

    $db = getDB();
    
    // Get department abbreviation
    $deptStmt = $db->prepare("SELECT abbreviation FROM departments WHERE id=?");
    if (!$deptStmt) err('Database error: ' . $db->error);
    $deptStmt->bind_param('i', $dept_id);
    $deptStmt->execute();
    $deptResult = $deptStmt->get_result()->fetch_assoc();
    $deptStmt->close();
    
    if (!$deptResult) err('Department not found.', 404);
    $abbrev = $deptResult['abbreviation'];
    
    // Get current counter for this department
    $counterStmt = $db->prepare("SELECT next_ref FROM dept_ref_counter WHERE department_id=?");
    if (!$counterStmt) err('Database error: ' . $db->error);
    $counterStmt->bind_param('i', $dept_id);
    $counterStmt->execute();
    $counterResult = $counterStmt->get_result()->fetch_assoc();
    $counterStmt->close();
    
    // If counter doesn't exist, initialize it
    if (!$counterResult) {
        $insertCounterStmt = $db->prepare("INSERT INTO dept_ref_counter (department_id, next_ref) VALUES (?, 101)");
        if (!$insertCounterStmt) err('Database error: ' . $db->error);
        $insertCounterStmt->bind_param('i', $dept_id);
        $insertCounterStmt->execute();
        $insertCounterStmt->close();
        $nextRef = 101;
    } else {
        $nextRef = intval($counterResult['next_ref']);
    }
    
    // Generate formatted ref code (e.g., HR101, MTO102)
    $ref = $abbrev . $nextRef;

    // Insert the paper with string ref_code
    $st = $db->prepare("INSERT INTO papers (ref_code,title,origin_department_id,created_by) VALUES (?,?,?,?)");
    if (!$st) err('Database prepare error: ' . $db->error);
    
    $st->bind_param('ssii', $ref, $title, $dept_id, $s['uid']);
    if (!$st->execute()) err('Failed to create paper: ' . $st->error);
    
    $paperId = $db->insert_id;
    $st->close();
    
    // Increment counter for next paper
    $updateStmt = $db->prepare("UPDATE dept_ref_counter SET next_ref=next_ref+1 WHERE department_id=?");
    if (!$updateStmt) err('Database error: ' . $db->error);
    $updateStmt->bind_param('i', $dept_id);
    $updateStmt->execute();
    $updateStmt->close();
    
    ok(['id' => $paperId, 'ref_code' => $ref]);
}

elseif ($action === 'delete') {
    // Allow admins to delete any paper. Departments can delete if the paper originated from their department.
    $s = requireLogin();
    $id = intval($_GET['id'] ?? 0);
    if (!$id) err('Paper ID required.');
    $db = getDB();

    // fetch paper to check origin
    $ch = $db->prepare("SELECT origin_department_id FROM papers WHERE id=?");
    $ch->bind_param('i', $id);
    $ch->execute();
    $prow = $ch->get_result()->fetch_assoc();
    $ch->close();
    if (!$prow) err('Paper not found.', 404);

    $isAdmin = ($s['role'] === 'admin');
    $userDeptId = intval($s['dept_id'] ?? 0);
    $originDeptId = intval($prow['origin_department_id'] ?? 0);

    if (!$isAdmin) {
        if ($s['role'] !== 'department' || $userDeptId !== $originDeptId) {
            err('Forbidden.', 403);
        }
    }

    $st = $db->prepare("DELETE FROM papers WHERE id=?");
    $st->bind_param('i', $id);
    $st->execute();
    // log admin activity only if admin
    if ($isAdmin) logAdminActivity($db, $s, 'Delete Paper', 'paper', $id, "Deleted paper id {$id}");
    ok();
}

elseif ($action === 'mark') {
    $s = requireLogin();
    $b = body();
    $paper_id = intval($b['paper_id'] ?? 0);
    $act      = $b['action'] ?? '';
    $dept_id  = intval($b['dept_id'] ?? $s['dept_id'] ?? 0);
    $person   = trim($b['person'] ?? '');
    $note     = $b['note'] ?? 'manual';

    if (!in_array($act, ['IN','OUT','DONE'])) err('Invalid action.');

    $db = getDB();
    $paperRow = $db->prepare("SELECT origin_department_id FROM papers WHERE id=?");
    $paperRow->bind_param('i', $paper_id);
    $paperRow->execute();
    $paper = $paperRow->get_result()->fetch_assoc();
    $paperRow->close();
    if (!$paper) err('Paper not found.', 404);

    $originDept = intval($paper['origin_department_id'] ?? 0);
    $actorDept = intval($s['dept_id'] ?? 0);
    $isAdmin = $s['role'] === 'admin';

    if (!$dept_id) {
        $dept_id = $originDept;
    }

    $current = currentStatus($db, $paper_id);
    $currentAction = $current['action'] ?? null;
    $currentDeptId = intval($current['department_id'] ?? 0);

    if (!$isAdmin) {
        if ($currentAction === 'DONE') {
            err('This paper is already marked DONE.', 400);
        }

        if ($act === 'IN') {
            // For new papers (no status yet), any department can mark IN (marker role check below will validate)
            // For papers already marked IN, only the current holder can mark IN again (which is a duplicate check)
            if ($currentAction === 'IN' && $actorDept !== $currentDeptId) err('Forbidden.', 403);
        } elseif ($act === 'OUT') {
            if ($currentAction !== 'IN' || $actorDept !== $currentDeptId) err('Forbidden.', 403);
        } elseif ($act === 'DONE') {
            if (!in_array($currentAction, ['IN', 'OUT']) || $actorDept !== $currentDeptId) err('Forbidden.', 403);
        }
    }

    // Check marker role restriction (only for non-admin department users)
    if (!$isAdmin && $s['role'] === 'department') {
        $userRow = $db->prepare("SELECT marker_role FROM users WHERE id=?");
        $userRow->bind_param('i', $s['uid']);
        $userRow->execute();
        $userMarkerRole = $userRow->get_result()->fetch_assoc();
        $userRow->close();
        
        if (empty($userMarkerRole['marker_role'])) {
            err('You are not assigned a marker role. Please contact your administrator.', 403);
        }

        $markerRole = $userMarkerRole['marker_role'];
        if (!markerRoleIncludes($markerRole, $act)) {
            err("You are assigned to mark papers as '{$markerRole}', but you are trying to mark as '{$act}'", 403);
        }
    }

    if ($act === 'IN') {
        if ($currentAction === 'IN') err('Duplicate IN. This paper is already marked IN.');
        if ($currentAction === 'DONE') err('This paper is already marked DONE.');
    } elseif ($act === 'OUT') {
        if (!$currentAction) err('Please mark IN first before marking OUT.');
        if ($currentAction === 'OUT') err('Duplicate OUT. This paper is already marked OUT.');
        if ($currentAction === 'DONE') err('This paper is already marked DONE.');
    } elseif ($act === 'DONE') {
        if (!$currentAction) err('Please mark IN first before marking DONE.');
        if ($currentAction === 'DONE') err('Duplicate DONE. This paper is already marked DONE.');
        if (!in_array($currentAction, ['IN', 'OUT'])) err('You can only mark DONE from IN or OUT status.');
    }

    if ($person === '') {
        $person = $s['username'];
    }
    $st = $db->prepare("INSERT INTO status_logs (paper_id,action,department_id,user_id,person,note) VALUES (?,?,?,?,?,?)");
    $st->bind_param('isiiss', $paper_id, $act, $dept_id, $s['uid'], $person, $note);
    $st->execute();
    // Insert fresh notification entries for origin dept users and previous markers
    try {
        $actor_uid = intval($s['uid']);
        $actor_dept_id = intval($s['dept_id'] ?? 0);
        $notifyIds = getNotificationRecipients($db, $paper_id, $actor_uid, $actor_dept_id, $act);
        if (!empty($notifyIds)) notifyUsers($db, $paper_id, $notifyIds);
    } catch (Exception $e) {
        // ignore notification insert failures
    }
    ok();
}

elseif ($action === 'edit_log') {
    $s = requireLogin();
    $id = intval($_GET['id'] ?? 0);
    $b = body();
    $note = $b['note'] ?? '';
    $db = getDB();
    $check = $db->prepare("SELECT paper_id, id, department_id, user_id, action, person FROM status_logs WHERE id=?");
    $check->bind_param('i', $id);
    $check->execute();
    $row = $check->get_result()->fetch_assoc();
    $check->close();
    if (!$row) err('Status log not found.', 404);

    if ($s['role'] !== 'admin') {
        if (intval($row['user_id']) !== intval($s['uid'])) {
            err('Forbidden.', 403);
        }
        $latestCheck = $db->prepare("SELECT id FROM status_logs WHERE paper_id=? ORDER BY created_at DESC, id DESC LIMIT 1");
        $latestCheck->bind_param('i', $row['paper_id']);
        $latestCheck->execute();
        $latestRow = $latestCheck->get_result()->fetch_assoc();
        $latestCheck->close();
        if (!$latestRow || intval($latestRow['id']) !== intval($id)) {
            err('Forbidden.', 403);
        }
    }

    if ($s['role'] === 'admin') {
        $act = $b['action'] ?? $row['action'];
        $person = trim($b['person'] ?? $row['person'] ?? '');
    } else {
        $act = $row['action'];
        $person = $row['person'];
    }

    $st = $db->prepare("UPDATE status_logs SET action=?,person=?,note=? WHERE id=?");
    $st->bind_param('sssi', $act, $person, $note, $id);
    $st->execute();

    if ($s['role'] === 'admin') {
        logAdminActivity($db, $s, 'Edit Paper Log', 'status_log', $id, "Updated status log id {$id} to {$act}");
    }
    ok();
}

elseif ($action === 'undo_mark') {
    $s = requireLogin();
    $paper_id = intval($_GET['paper_id'] ?? 0);
    if (!$paper_id) err('Paper ID required.');

    $b = body();
    $undoReason = trim($b['note'] ?? '');

    $db = getDB();
    $current = currentStatus($db, $paper_id);
    $currentAction = $current['action'] ?? null;
    $currentDeptId = intval($current['department_id'] ?? 0);
    $isAdmin = $s['role'] === 'admin';

    // Only allow undo if current status is DONE
    if ($currentAction !== 'DONE') {
        err('Can only undo DONE status.', 400);
    }

    // Only admin or the department that marked DONE can undo
    if (!$isAdmin) {
        $actorDept = intval($s['dept_id'] ?? 0);
        if ($actorDept !== $currentDeptId) {
            err('Forbidden.', 403);
        }
    }

    // Revert DONE back to the previous non-DONE status (e.g., OUT) by inserting a new log
    // Get the latest log (should be DONE)
    $st = $db->prepare("SELECT id,department_id,action,created_at FROM status_logs WHERE paper_id=? ORDER BY created_at DESC, id DESC LIMIT 1");
    $st->bind_param('i', $paper_id);
    $st->execute();
    $last = $st->get_result()->fetch_assoc();
    $st->close();
    if (!$last || ($last['action'] ?? '') !== 'DONE') err('Latest log is not DONE.', 400);

    // Find the most recent previous non-DONE action
    $st2 = $db->prepare("SELECT action, department_id FROM status_logs WHERE paper_id=? AND action!='DONE' ORDER BY created_at DESC, id DESC LIMIT 1");
    $st2->bind_param('i', $paper_id);
    $st2->execute();
    $prev = $st2->get_result()->fetch_assoc();
    $st2->close();

    if ($prev && !empty($prev['action'])) {
        $action_val = $prev['action'];
        $dept_id = intval($prev['department_id'] ?? $currentDeptId);
    } else {
        // Fallback to IN if no previous non-DONE entry exists
        $action_val = 'IN';
        $dept_id = $currentDeptId;
    }

    $person = $s['username'];
    $note = 'undo: reverted from DONE to ' . $action_val;
    if ($undoReason) {
        $note .= ' | reason: ' . $undoReason;
    }

    $ins = $db->prepare("INSERT INTO status_logs (paper_id,action,department_id,user_id,person,note) VALUES (?,?,?,?,?,?)");
    $ins->bind_param('isiiss', $paper_id, $action_val, $dept_id, $s['uid'], $person, $note);
    $ins->execute();
    // Notify origin and previous markers about this undo action
    try {
        $actor_uid = intval($s['uid']);
        $actor_dept_id = intval($s['dept_id'] ?? 0);
        $notifyIds = getNotificationRecipients($db, $paper_id, $actor_uid, $actor_dept_id, $action_val);
        if (!empty($notifyIds)) notifyUsers($db, $paper_id, $notifyIds);
    } catch (Exception $e) {}
    if ($s['role'] === 'admin') {
        $details = "Reverted DONE to {$action_val}";
        if ($undoReason) {
            $details .= " (reason: {$undoReason})";
        }
        logAdminActivity($db, $s, 'Undo Paper Status', 'paper', $paper_id, $details);
    }
    ok(['message' => "Status reverted to $action_val"]);
}

elseif ($action === 'return') {
    $s = requireLogin();
    $b = body();
    $paper_id = intval($b['paper_id'] ?? 0);
    $dept_id = intval($b['dept_id'] ?? $s['dept_id'] ?? 0);
    $returnReason = trim($b['note'] ?? '');

    if (!$paper_id) err('Paper ID required.');
    if (!$returnReason) err('Reason for return is required.');

    $db = getDB();
    $isAdmin = $s['role'] === 'admin';

    // Get current paper status
    $paperRow = $db->prepare("SELECT origin_department_id FROM papers WHERE id=?");
    $paperRow->bind_param('i', $paper_id);
    $paperRow->execute();
    $paper = $paperRow->get_result()->fetch_assoc();
    $paperRow->close();
    if (!$paper) err('Paper not found.', 404);

    $originDept = intval($paper['origin_department_id'] ?? 0);
    $actorDept = intval($s['dept_id'] ?? 0);

    // Get current status
    $current = currentStatus($db, $paper_id);
    $currentAction = $current['action'] ?? null;
    $currentDeptId = intval($current['department_id'] ?? 0);

    // Validate: document must be in IN or OUT status
    if (!in_array($currentAction, ['IN', 'OUT'])) {
        err('Document can only be returned from IN or OUT status.', 400);
    }

    // For non-admin users: must have IN marker role and must be the department currently holding the document
    if (!$isAdmin) {
        // Check marker role
        $userRow = $db->prepare("SELECT marker_role FROM users WHERE id=?");
        $userRow->bind_param('i', $s['uid']);
        $userRow->execute();
        $userMarkerRole = $userRow->get_result()->fetch_assoc();
        $userRow->close();

        if (empty($userMarkerRole['marker_role']) || !markerRoleIncludes($userMarkerRole['marker_role'], 'IN')) {
            err('Only users with IN marker role can return documents.', 403);
        }

        // Check that user's department is currently holding the document
        if ($actorDept !== $currentDeptId) {
            err('Forbidden. Your department is not currently holding this document.', 403);
        }
    }

    // Create RETURNED status log entry with the reason in the note.
    // Returned documents are sent back to the origin department.
    $person = $s['username'];
    $returnAction = 'RETURNED';
    $note = $returnReason;
    $returnDeptId = $originDept;

    $ins = $db->prepare("INSERT INTO status_logs (paper_id,action,department_id,user_id,person,note) VALUES (?,?,?,?,?,?)");
    $ins->bind_param('isiiss', $paper_id, $returnAction, $returnDeptId, $s['uid'], $person, $note);
    if (!$ins->execute()) {
        err('Failed to record return action.');
    }

    // Notify relevant users about the return
    try {
        $actor_uid = intval($s['uid']);
        $actor_dept_id = intval($s['dept_id'] ?? 0);
        $notifyIds = getNotificationRecipients($db, $paper_id, $actor_uid, $actor_dept_id, 'RETURNED');
        if (!empty($notifyIds)) notifyUsers($db, $paper_id, $notifyIds);
    } catch (Exception $e) {}

    if ($isAdmin) {
        logAdminActivity($db, $s, 'Return Paper', 'paper', $paper_id, "Returned document: {$returnReason}");
    }

    ok(['message' => 'Document returned successfully']);
}

elseif ($action === 'upload_image') {
    $s = requireLogin();
    $paper_id = intval($_POST['paper_id'] ?? 0);
    if (!$paper_id || empty($_FILES['image'])) err('Missing data.');

    $db = getDB();
    // verify paper exists and get origin department
    $ch = $db->prepare("SELECT origin_department_id FROM papers WHERE id=?");
    $ch->bind_param('i', $paper_id);
    $ch->execute();
    $prow = $ch->get_result()->fetch_assoc();
    $ch->close();
    if (!$prow) err('Paper not found.', 404);
    $origin_dept = intval($prow['origin_department_id'] ?? 0);

    // allow admin, origin department, any department when paper has no status yet,
    // or any user who previously marked this paper IN/OUT.
    if ($s['role'] !== 'admin') {
        $ownDept = intval($s['dept_id'] ?? 0);
        $uid = intval($s['uid']);
        $allowed = false;

        if ($ownDept && $origin_dept === $ownDept) {
            $allowed = true;
        }

        $current = currentStatus($db, $paper_id);
        if (!$current['action']) {
            $allowed = true;
        }

        if (!$allowed) {
            $logCheck = $db->prepare("SELECT 1 FROM status_logs WHERE paper_id=? AND user_id=? AND action IN ('IN','OUT') LIMIT 1");
            $logCheck->bind_param('ii', $paper_id, $uid);
            $logCheck->execute();
            $hasMark = $logCheck->get_result()->fetch_assoc();
            $logCheck->close();
            if ($hasMark) {
                $allowed = true;
            }
        }

        if (!$allowed) {
            err('Forbidden.', 403);
        }
    }

    $dir = __DIR__ . '/../../uploads/documents/';
    if (!is_dir($dir)) mkdir($dir, 0777, true);

    $ext = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['jpg','jpeg','png','gif','webp'])) err('Invalid file type.');

    $fname = $paper_id . '_' . time() . '.' . $ext;
    move_uploaded_file($_FILES['image']['tmp_name'], $dir . $fname);

    $path = 'uploads/documents/' . $fname;
    $st = $db->prepare("INSERT INTO paper_images (paper_id,image_path,uploaded_by) VALUES (?,?,?)");
    $st->bind_param('isi', $paper_id, $path, $s['uid']);
    $st->execute();
    ok(['path' => $path]);
}

elseif ($action === 'delete_image') {
    $s = requireLogin();
    $id = intval($_GET['id'] ?? 0);
    if (!$id) err('Image id required.');

    $db = getDB();
    $st = $db->prepare("SELECT pi.image_path, pi.paper_id, p.origin_department_id FROM paper_images pi JOIN papers p ON p.id=pi.paper_id WHERE pi.id=?");
    $st->bind_param('i', $id);
    $st->execute();
    $img = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$img) err('Image not found.', 404);

    if ($s['role'] !== 'admin') {
        $ownDept = intval($s['dept_id'] ?? 0);
        $allowed = false;

        if ($ownDept && intval($img['origin_department_id']) === $ownDept) {
            $allowed = true;
        }

        if (!$allowed) {
            $logCheck = $db->prepare("SELECT 1 FROM status_logs WHERE paper_id=? AND user_id=? AND action IN ('IN','OUT') LIMIT 1");
            $logCheck->bind_param('ii', $img['paper_id'], $s['uid']);
            $logCheck->execute();
            $hasMark = $logCheck->get_result()->fetch_assoc();
            $logCheck->close();
            if ($hasMark) {
                $allowed = true;
            }
        }

        if (!$allowed) {
            err('Forbidden.', 403);
        }
    }

    $filePath = __DIR__ . '/../../' . ltrim($img['image_path'], '/');
    if (is_file($filePath)) @unlink($filePath);

    $del = $db->prepare("DELETE FROM paper_images WHERE id=?");
    $del->bind_param('i', $id);
    $del->execute();
    ok();
}

elseif ($action === 'scan') {
    $s = requireLogin();
    $ref = trim($_GET['ref'] ?? '');
    $auto = intval($_GET['auto'] ?? 0) === 1;
    $didAutoMark = false;
    if (!$ref) err('Ref required.');

    $db = getDB();

    $st = $db->prepare("SELECT p.*,d.name origin FROM papers p JOIN departments d ON d.id=p.origin_department_id WHERE p.ref_code=?");
    $st->bind_param('s', $ref);
    $st->execute();
    $paper = $st->get_result()->fetch_assoc();
    if (!$paper) err('Paper not found.', 404);

    if ($auto) {
        $latest = $db->prepare("SELECT l.action, l.department_id, d.name dept, l.user_id, l.note, l.created_at FROM status_logs l JOIN departments d ON d.id=l.department_id WHERE l.paper_id=? ORDER BY l.created_at DESC, l.id DESC LIMIT 1");
        $latest->bind_param('i', $paper['id']);
        $latest->execute();
        $last = $latest->get_result()->fetch_assoc();
        $latest->close();

        $currentAction = $last['action'] ?? null;
        $currentDeptName = $last['dept'] ?? null;
        $originDeptName = $paper['origin'] ?? null;
        $originDeptId = intval($paper['origin_department_id'] ?? 0);
        $actorDeptId = intval($s['dept_id'] ?? 0);
        $actorDeptName = $s['dept_name'] ?? null;
        $isAdmin = $s['role'] === 'admin';

        if ($currentAction === 'DONE') {
            err('This paper is already marked DONE.', 400);
        }

        if (!$isAdmin) {
            // For new papers (no status yet), any department can scan (marker role check below will validate).
            if ($currentAction === 'IN' && $actorDeptName !== $currentDeptName) {
                err('Forbidden.', 403);
            }

            if ($currentAction === 'OUT') {
                if ($actorDeptId === $originDeptId) {
                    err('Forbidden.', 403);
                }
            }

            if ($currentAction === 'RETURNED' && $actorDeptName !== $currentDeptName) {
                err('Forbidden.', 403);
            }
        }

        if ($currentAction === 'IN') {
            $nextAction = 'OUT';
        } elseif ($currentAction === 'RETURNED') {
            $nextAction = 'IN';
        } else {
            $nextAction = 'IN';
        }

        // Check marker role restriction for non-admin department users (for auto-scan)
        if (!$isAdmin && $s['role'] === 'department') {
            $userRow = $db->prepare("SELECT marker_role FROM users WHERE id=?");
            $userRow->bind_param('i', $s['uid']);
            $userRow->execute();
            $userMarkerRole = $userRow->get_result()->fetch_assoc();
            $userRow->close();
            
            if (empty($userMarkerRole['marker_role'])) {
                err('You are not assigned a marker role. Please contact your administrator.', 403);
            }

            $markerRole = $userMarkerRole['marker_role'];
            if (!markerRoleIncludes($markerRole, $nextAction)) {
                err("You are assigned to mark papers as '{$markerRole}', but scanning this paper would mark it as '{$nextAction}'", 403);
            }
        }
        
        $dept_id = intval($s['dept_id'] ?? 0);
        if (!$dept_id) {
            $dept_id = intval($paper['origin_department_id'] ?? 0);
        }

        $person = $s['username'];
        $note = 'qr-auto-scan';
        $prevNote = trim($last['note'] ?? '');
        if ($prevNote !== '' && $prevNote !== 'qr-auto-scan' && $prevNote !== 'manual') {
            $note = $prevNote;
        }

        if ($nextAction) {
            // Atomic dedupe: block duplicate auto-scan insert from same user within 3 seconds.
            $ins = $db->prepare("INSERT INTO status_logs (paper_id,action,department_id,user_id,person,note) SELECT ?,?,?,?,?,? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM status_logs WHERE paper_id=? AND user_id=? AND note='qr-auto-scan' AND TIMESTAMPDIFF(SECOND, created_at, NOW()) <= 3)");
            $uid = intval($s['uid']);
            $paperId = intval($paper['id']);
            $ins->bind_param('isiissii', $paperId, $nextAction, $dept_id, $uid, $person, $note, $paperId, $uid);
            $ins->execute();
            $didAutoMark = $ins->affected_rows > 0;
            $ins->close();
            if ($didAutoMark) {
                try {
                    $actor_uid = intval($uid);
                    $actor_dept_id = intval($actorDeptId);
                    $notifyIds = getNotificationRecipients($db, $paperId, $actor_uid, $actor_dept_id, $nextAction);
                    if (!empty($notifyIds)) notifyUsers($db, $paperId, $notifyIds);
                } catch (Exception $e) {}
            }
        } else {
            $didAutoMark = false;
        }
    }

    $s = currentStatus($db, $paper['id']);
    $paper['status_action'] = $s['action'] ?? null;
    $paper['status_dept']   = $s['dept'] ?? null;
    $paper['current_location'] = $s['dept'] ?? null;
    $paper['last_scanned_at']  = $s['last_scanned_at'] ?? null;

    $st2 = $db->prepare("SELECT l.*,d.name dept_name,u.username FROM status_logs l JOIN departments d ON d.id=l.department_id JOIN users u ON u.id=l.user_id WHERE l.paper_id=? ORDER BY l.created_at DESC, l.id DESC");
    $st2->bind_param('i', $paper['id']);
    $st2->execute();
    $res2 = $st2->get_result();
    $logs = [];
    while ($r = $res2->fetch_assoc()) $logs[] = $r;
    $st2->close();
    $paper['logs'] = $logs;

    $st3 = $db->prepare("SELECT pi.id, pi.paper_id, pi.image_path, pi.uploaded_by, pi.uploaded_at, u.username FROM paper_images pi LEFT JOIN users u ON u.id=pi.uploaded_by WHERE pi.paper_id=? ORDER BY pi.uploaded_at DESC");
    $st3->bind_param('i', $paper['id']);
    $st3->execute();
    $res3 = $st3->get_result();
    $images = [];
    while ($r = $res3->fetch_assoc()) $images[] = $r;
    $st3->close();
    $paper['images'] = $images;

    ok(['paper' => $paper, 'auto_marked' => $didAutoMark]);
}

else err('Invalid action.', 404);
