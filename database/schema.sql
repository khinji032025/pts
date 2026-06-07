CREATE DATABASE IF NOT EXISTS pts_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pts_db;

CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    abbreviation VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','department','pending') NOT NULL DEFAULT 'pending',
    department_id INT NULL,
    marker_role SET('IN','OUT') DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS papers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ref_code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    origin_department_id INT NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (origin_department_id) REFERENCES departments(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS status_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paper_id INT NOT NULL,
    action ENUM('IN','OUT','DONE') NOT NULL,
    department_id INT NOT NULL,
    user_id INT NOT NULL,
    person VARCHAR(100),
    note VARCHAR(255) DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS login_logs (
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
);

CREATE TABLE IF NOT EXISTS paper_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paper_id INT NOT NULL,
    image_path VARCHAR(500) NOT NULL,
    uploaded_by INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS dept_ref_counter (
    department_id INT PRIMARY KEY,
    next_ref INT NOT NULL DEFAULT 101,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);

-- Departments with abbreviations
INSERT INTO departments (name, abbreviation) VALUES
('Mayor''s Office', 'MO'),
('MTO', 'MTO'),
('HR', 'HR'),
('LYDO', 'LYDO'),
('Budget Office', 'BO'),
('Army', 'ARM');

-- Initialize department reference counters
INSERT INTO dept_ref_counter (department_id, next_ref) VALUES
(1, 101), (2, 101), (3, 101), (4, 101), (5, 101), (6, 101);

-- Admin users password = admin123
INSERT INTO users (username, password, role) VALUES
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('superadmin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- password = password
INSERT INTO users (username, password, role, department_id) VALUES
('mayor', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'department', 1),
('mto',   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'department', 2),
('hr',    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'department', 3);
