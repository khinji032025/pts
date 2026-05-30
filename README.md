# Paper Tracking System (PTS)

## Folder Structure
```
pts/
├── backend/
│   ├── config/
│   │   ├── db.php          ← Edit DB credentials here
│   │   └── helpers.php
│   ├── middleware/
│   │   └── auth.php
│   └── modules/
│       ├── auth.php        ← Login / logout / session
│       ├── departments.php
│       ├── users.php
│       └── papers.php
├── frontend/
│   ├── public/index.html
│   └── src/
│       ├── index.jsx
│       ├── App.jsx
│       ├── context/AuthContext.jsx
│       ├── utils/api.jsx
│       ├── styles/global.css
│       ├── pages/
│       │   ├── LoginPage.jsx / .css
│       │   ├── AdminDashboard.jsx
│       │   ├── DeptDashboard.jsx
│       │   ├── PaperView.jsx
│       │   └── admin/
│       │       ├── AdminDepartments.jsx
│       │       ├── AdminUsers.jsx
│       │       └── AdminPapers.jsx
│       └── components/
│           ├── Navbar.jsx
│           ├── PapersTable.jsx
│           ├── StatusBadge.jsx
│           ├── QRCode.jsx
│           ├── Barcode.jsx
│           ├── ScanModal.jsx
│           └── ChangePasswordModal.jsx
├── database/schema.sql
├── uploads/documents/
└── .htaccess
```

## Setup (follow in order)

### 1. Copy to XAMPP
Put this `pts` folder in:
```
C:\xampp\htdocs\pts\
```

### 2. Import Database
- Open http://localhost/phpmyadmin
- Click "Import" → choose `database/schema.sql` → Go

### 3. Check DB credentials
Open `backend/config/db.php` and confirm:
```php
define('DB_USER', 'root');
define('DB_PASS', '');   // blank for default XAMPP
define('DB_NAME', 'pts_db');
```

### 4. Install and run React
```bash
cd C:\xampp\htdocs\pts\frontend
npm install
npm start
```

### 5. Open in browser
```
http://localhost:3000
```

## Default Logins
| Username   | Password  | Role       |
|------------|-----------|------------|
| admin      | password  | Admin      |
| superadmin | password  | Admin      |
| mayor      | password  | Department |
| mto        | password  | Department |
| hr         | password  | Department |

## Notes
- The React proxy in package.json routes `/pts/backend/*` to XAMPP port 80
  so session cookies work correctly — do NOT change the proxy setting
- After `npm run build`, copy build contents into `pts/` root for production
- Uploads save to `pts/uploads/documents/`
