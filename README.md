# Customer Complaint Management System (CCMS)

Welcome to the **Customer Complaint Management System (CCMS)**. This platform is a full-featured, enterprise-grade application designed to log, track, investigate, and resolve commercial and quality complaints for industrial paper divisions. It integrates seamlessly with workflow controls, Service Level Agreement (SLA) timers, custom visit scheduling, sample tracking, Corrective and Preventive Action (CAPA) logs, and automated commercial credit note generation.

---

## 📂 Project Structure

```
ccms/
├── backend/                  # Node.js + Express + MySQL API
│   ├── config/               # Database pool and initializations
│   ├── controllers/          # Request handlers and business logic
│   ├── middleware/           # Auth validation, error handling, rate limiters
│   ├── routes/               # API endpoints mappings
│   ├── utils/                # Helper response formats
│   ├── uploads/              # Storage for customer and QC attachments
│   ├── server.js             # API entrypoint
│   └── package.json          # Backend dependencies
│
├── frontend/                 # React + Vite + Vanilla CSS SPA
│   ├── src/
│   │   ├── components/       # Common UI wrappers (Layout, Button, Input)
│   │   ├── pages/            # View pages (Login, Dashboard, ComplaintDetail, ComplaintForm)
│   │   ├── utils/            # Axios API instances
│   │   └── App.jsx           # Main routing entry
│   └── package.json          # Frontend dependencies
│
├── database/                 # Database schemas and workflow migrations
│   └── migrations/           # SQL migration files (001 to 010)
│
└── docs/                     # Detailed developer guides & documentation
    ├── ARCHITECTURE.md       # Workflow lifecycle stages and division mapping
    ├── DATABASE.md           # MySQL relational schema & lookup descriptions
    ├── API.md                # Backend REST API endpoint references
    └── SECURITY.md           # Encryption, validation, and known vulnerabilities
```

---

## 🛠️ Technology Stack

### Backend
* **Runtime & Framework:** Node.js, Express
* **Database Driver:** `mysql2/promise` (supporting transactional async operations)
* **Authentication:** JSON Web Token (`jsonwebtoken`), HTTP-only Cookies, `cookie-parser`
* **Security & Hardening:** `helmet` (header hardening), `express-rate-limit` (anti-DoS / brute-force protection)
* **Validations:** `joi` schema validation
* **File Uploads:** `multer` multipart handler
* **Password Encryption:** `bcryptjs`

### Frontend
* **Build tool & Framework:** React (Vite-powered SPA)
* **Styling:** Custom CSS Custom Properties (Vanilla CSS Variables) supporting smooth animations, dark-mode toggle, card layouts, and responsive grids.
* **Icons:** `lucide-react`
* **HTTP Client:** `axios` (with global interceptors for token headers and session timeout redirects)
* **Routing:** `react-router-dom`

---

## 🚀 Setup & Execution

### Prerequisites
* **Node.js** (v18+)
* **MySQL Server** (v8.0+) configured with a running instance.

### 1. Database Initialization
1. Create a database named `ccms` in your MySQL server:
   ```sql
   CREATE DATABASE ccms;
   ```
2. Navigate to the `backend/` directory, create a `.env` file from the environment variables template, and configure your credentials:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=ccms
   JWT_SECRET=ccms_dev_jwt_secret_key_987654321
   JWT_EXPIRES_IN=8h
   NODE_ENV=development
   ```
3. Run the database initializer to build the schemas and seed all default roles, lookups, and mock data:
   ```bash
   cd backend
   npm run init-db
   ```

### 2. Start the Backend API Server
Start the Express server on port `5000` (defaults to dev nodemon reloading):
```bash
npm run dev
```

### 3. Start the Frontend client
1. Navigate to the `frontend/` directory:
   ```bash
   cd ../frontend
   npm install
   ```
2. Run the Vite development server (starts on `http://localhost:5174` or `5173` depending on port usage):
   ```bash
   npm run dev
   ```

---

## 🧪 Testing the Application
The backend includes automated integration test suites validating lifecycle progression:

1. **Complete Lifecycle Integration Test:**
   Tests the entire progression of a standard claim (Intake ➔ TS ➔ QC ➔ Ops CAPA ➔ Marketing ➔ Finance Credit Note ➔ Sign-off/Close):
   ```bash
   cd backend
   node test_complete_lifecycle.js
   ```
2. **TS Overhaul & Clarification Flow Test:**
   Tests scheduled visits, offline KAM clarification loops, SLA pausing/resuming, and department escalations:
   ```bash
   node c:\Users\dishi\.gemini\antigravity-ide\brain\2cdea825-fb49-469d-b86a-e27cbef395e9\scratch\test_ts_overhaul_workflow.js
   ```

---

## 📖 In-Depth Guides

To learn more about specific areas of the codebase, consult the following files:
* **Workflow & Lifecycles:** Refer to [docs/ARCHITECTURE.md](file:///c:/Users/dishi/Downloads/ccms/docs/ARCHITECTURE.md)
* **Relational Schema Specs:** Refer to [docs/DATABASE.md](file:///c:/Users/dishi/Downloads/ccms/docs/DATABASE.md)
* **REST API Endpoints:** Refer to [docs/API.md](file:///c:/Users/dishi/Downloads/ccms/docs/API.md)
* **Vulnerabilities & Fixes:** Refer to [docs/SECURITY.md](file:///c:/Users/dishi/Downloads/ccms/docs/SECURITY.md)
