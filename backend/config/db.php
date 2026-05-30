<?php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');          // change if your MySQL has a password
define('DB_NAME', 'pts_db');

function getDB() {
    static $db = null;
    if ($db === null) {
        $db = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        if ($db->connect_error) die(json_encode(['error' => 'DB error: ' . $db->connect_error]));
        $db->set_charset('utf8mb4');
    }
    return $db;
}
