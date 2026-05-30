<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/helpers.php';
require_once __DIR__ . '/../middleware/auth.php';

cors();

$action = $_GET['action'] ?? '';

function currentStatus($db, $paper_id) {
    $st = $db->prepare("SELECT l.action, d.name dept, l.created_at last_scanned_at FROM status_logs l JOIN departments d ON d.id=l.department_id WHERE l.paper_id=? ORDER BY l.created_at DESC LIMIT 1");
    $st->bind_param('i', $paper_id);
    $st->execute();
    return $st->get_result()->fetch_assoc();
}

if ($action === 'list') {
    $s = requireLogin();
    $db = getDB();
    $where = []; $types = ''; $vals = [];

    $search = $_GET['search'] ?? '';
    $month  = $_GET['month']  ?? '';
    $day    = $_GET['day']    ?? '';
    $dept_id = intval($_GET['dept_id'] ?? 0);

    if ($dept_id) {
        if ($s['role'] !== 'department' || intval($s['dept_id']) !== $dept_id) {
            err('Forbidden.', 403);
        }
        $where[] = "p.origin_department_id=?";
        $types .= 'i';
        $vals[] = $dept_id;
    }

    if ($search) { $where[] = "(p.title LIKE ? OR p.ref_code LIKE ?)"; $types .= 'ss'; $like = "%$search%"; $vals[] = $like; $vals[] = $like; }
    if ($month)  { $where[] = "MONTH(p.created_at)=?"; $types .= 'i'; $vals[] = intval($month); }
    if ($day)    { $where[] = "DAY(p.created_at)=?";   $types .= 'i'; $vals[] = intval($day); }

    $sql = "SELECT p.id,p.ref_code,p.title,p.created_at,d.name origin FROM papers p JOIN departments d ON d.id=p.origin_department_id" . ($where ? " WHERE ".implode(' AND ',$where) : "") . " ORDER BY p.created_at DESC";
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
    $ref = intval($_GET['ref'] ?? 0);
    if (!$ref) err('Ref required.');

    $db = getDB();

    $st = $db->prepare("SELECT p.*,d.name origin FROM papers p JOIN departments d ON d.id=p.origin_department_id WHERE p.ref_code=?");
    $st->bind_param('i', $ref);
    $st->execute();
    $paper = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$paper) err('Paper not found.', 404);

    $st2 = $db->prepare("SELECT l.action, d.name dept FROM status_logs l JOIN departments d ON d.id=l.department_id WHERE l.paper_id=? ORDER BY l.created_at DESC LIMIT 1");
    $st2->bind_param('i', $paper['id']);
    $st2->execute();
    $s = $st2->get_result()->fetch_assoc();
    $st2->close();

    $paper['status_action'] = $s['action'] ?? null;
    $paper['status_dept']   = $s['dept']   ?? null;
    $paper['current_location'] = $s['dept'] ?? null;
    $paper['last_scanned_at']  = $s['last_scanned_at'] ?? null;

    $st3 = $db->prepare("SELECT l.*,d.name dept_name,u.username FROM status_logs l JOIN departments d ON d.id=l.department_id JOIN users u ON u.id=l.user_id WHERE l.paper_id=? ORDER BY l.created_at DESC");
    $st3->bind_param('i', $paper['id']);
    $st3->execute();
    $res3 = $st3->get_result();
    $logs = [];
    while ($r = $res3->fetch_assoc()) $logs[] = $r;
    $st3->close();
    $paper['logs'] = $logs;

    $st4 = $db->prepare("SELECT * FROM paper_images WHERE paper_id=? ORDER BY uploaded_at DESC");
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
    requireLogin();
    $id = intval($_GET['id'] ?? 0);
    $db = getDB();

    $st = $db->prepare("SELECT p.*,d.name origin FROM papers p JOIN departments d ON d.id=p.origin_department_id WHERE p.id=?");
    $st->bind_param('i', $id);
    $st->execute();
    $paper = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$paper) err('Not found.', 404);

    // current status
    $st2 = $db->prepare("SELECT l.action, d.name dept FROM status_logs l JOIN departments d ON d.id=l.department_id WHERE l.paper_id=? ORDER BY l.created_at DESC LIMIT 1");
    $st2->bind_param('i', $id);
    $st2->execute();
    $s = $st2->get_result()->fetch_assoc();
    $st2->close();

    $paper['status_action'] = $s['action'] ?? null;
    $paper['status_dept']   = $s['dept']   ?? null;
    $paper['current_location'] = $s['dept'] ?? null;
    $paper['last_scanned_at']  = $s['last_scanned_at'] ?? null;

    // logs
    $st3 = $db->prepare("SELECT l.*,d.name dept_name,u.username FROM status_logs l JOIN departments d ON d.id=l.department_id JOIN users u ON u.id=l.user_id WHERE l.paper_id=? ORDER BY l.created_at DESC");
    $st3->bind_param('i', $id);
    $st3->execute();
    $res = $st3->get_result();
    $logs = [];
    while ($r = $res->fetch_assoc()) $logs[] = $r;
    $st3->close();
    $paper['logs'] = $logs;

    // images
    $st4 = $db->prepare("SELECT * FROM paper_images WHERE paper_id=? ORDER BY uploaded_at DESC");
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
    $db->query("UPDATE ref_counter SET last_ref=last_ref+1");
    $ref = $db->query("SELECT last_ref FROM ref_counter LIMIT 1")->fetch_assoc()['last_ref'];

    $st = $db->prepare("INSERT INTO papers (ref_code,title,origin_department_id,created_by) VALUES (?,?,?,?)");
    $st->bind_param('isii', $ref, $title, $dept_id, $s['uid']);
    $st->execute();
    ok(['id' => $db->insert_id, 'ref_code' => $ref]);
}

elseif ($action === 'delete') {
    requireAdmin();
    $id = intval($_GET['id'] ?? 0);
    $db = getDB();
    $st = $db->prepare("DELETE FROM papers WHERE id=?");
    $st->bind_param('i', $id);
    $st->execute();
    ok();
}

elseif ($action === 'mark') {
    $s = requireLogin();
    $b = body();
    $paper_id = intval($b['paper_id'] ?? 0);
    $act      = $b['action'] ?? '';
    $dept_id  = intval($b['dept_id'] ?? $s['dept_id'] ?? 0);
    $note     = $b['note'] ?? 'manual';

    if (!in_array($act, ['IN','OUT','DONE'])) err('Invalid action.');

    $db = getDB();
    if (!$dept_id) {
        $own = $db->prepare("SELECT origin_department_id FROM papers WHERE id=?");
        $own->bind_param('i', $paper_id);
        $own->execute();
        $row = $own->get_result()->fetch_assoc();
        $dept_id = intval($row['origin_department_id'] ?? 0);
        $own->close();
    }

    $current = currentStatus($db, $paper_id);
    $currentAction = $current['action'] ?? null;

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
    }

    $person = $s['username'];
    $st = $db->prepare("INSERT INTO status_logs (paper_id,action,department_id,user_id,person,note) VALUES (?,?,?,?,?,?)");
    $st->bind_param('isiiss', $paper_id, $act, $dept_id, $s['uid'], $person, $note);
    $st->execute();
    ok();
}

elseif ($action === 'edit_log') {
    requireAdmin();
    $id = intval($_GET['id'] ?? 0);
    $b = body();
    $act  = $b['action'] ?? '';
    $note = $b['note'] ?? '';
    $db = getDB();
    $st = $db->prepare("UPDATE status_logs SET action=?,note=? WHERE id=?");
    $st->bind_param('ssi', $act, $note, $id);
    $st->execute();
    ok();
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

    // allow only admin or the origin department to upload images for this paper
    if ($s['role'] !== 'admin') {
        $ownDept = intval($s['dept_id'] ?? 0);
        if (!$ownDept || $origin_dept !== $ownDept) {
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
    $st = $db->prepare("SELECT pi.image_path, p.origin_department_id FROM paper_images pi JOIN papers p ON p.id=pi.paper_id WHERE pi.id=?");
    $st->bind_param('i', $id);
    $st->execute();
    $img = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$img) err('Image not found.', 404);

    if ($s['role'] !== 'admin') {
        $ownDept = intval($s['dept_id'] ?? 0);
        if (!$ownDept || intval($img['origin_department_id']) !== $ownDept) {
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
    $ref = intval($_GET['ref'] ?? 0);
    $auto = intval($_GET['auto'] ?? 0) === 1;
    $didAutoMark = false;
    if (!$ref) err('Ref required.');

    $db = getDB();

    $st = $db->prepare("SELECT p.*,d.name origin FROM papers p JOIN departments d ON d.id=p.origin_department_id WHERE p.ref_code=?");
    $st->bind_param('i', $ref);
    $st->execute();
    $paper = $st->get_result()->fetch_assoc();
    if (!$paper) err('Paper not found.', 404);

    if ($auto) {
        $latest = $db->prepare("SELECT action, user_id, note, created_at FROM status_logs WHERE paper_id=? ORDER BY created_at DESC, id DESC LIMIT 1");
        $latest->bind_param('i', $paper['id']);
        $latest->execute();
        $last = $latest->get_result()->fetch_assoc();
        $latest->close();

        $currentAction = $last['action'] ?? null;

        // Auto toggle flow for scanner:
        // no status -> IN, IN -> OUT, OUT -> IN
        if ($currentAction === 'DONE') {
            err('This paper is already marked DONE.', 400);
        }

        $nextAction = ($currentAction === 'IN') ? 'OUT' : 'IN';
        $dept_id = intval($s['dept_id'] ?? 0);
        if (!$dept_id) {
            $dept_id = intval($paper['origin_department_id'] ?? 0);
        }

        $person = $s['username'];
        $note = 'qr-auto-scan';

        // Atomic dedupe: block duplicate auto-scan insert from same user within 3 seconds.
        $ins = $db->prepare("INSERT INTO status_logs (paper_id,action,department_id,user_id,person,note) SELECT ?,?,?,?,?,? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM status_logs WHERE paper_id=? AND user_id=? AND note='qr-auto-scan' AND TIMESTAMPDIFF(SECOND, created_at, NOW()) <= 3)");
        $uid = intval($s['uid']);
        $paperId = intval($paper['id']);
        $ins->bind_param('isiissii', $paperId, $nextAction, $dept_id, $uid, $person, $note, $paperId, $uid);
        $ins->execute();
        $didAutoMark = $ins->affected_rows > 0;
        $ins->close();
    }

    $s = currentStatus($db, $paper['id']);
    $paper['status_action'] = $s['action'] ?? null;
    $paper['status_dept']   = $s['dept'] ?? null;
    $paper['current_location'] = $s['dept'] ?? null;
    $paper['last_scanned_at']  = $s['last_scanned_at'] ?? null;

    $st2 = $db->prepare("SELECT l.*,d.name dept_name,u.username FROM status_logs l JOIN departments d ON d.id=l.department_id JOIN users u ON u.id=l.user_id WHERE l.paper_id=? ORDER BY l.created_at DESC");
    $st2->bind_param('i', $paper['id']);
    $st2->execute();
    $res2 = $st2->get_result();
    $logs = [];
    while ($r = $res2->fetch_assoc()) $logs[] = $r;
    $st2->close();
    $paper['logs'] = $logs;

    $st3 = $db->prepare("SELECT * FROM paper_images WHERE paper_id=? ORDER BY uploaded_at DESC");
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
