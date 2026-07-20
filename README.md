# Customer Complaint Management System (CCMS)
### Orient Paper & Mill — Complaint Transaction & Workflow Portal

A full-stack enterprise portal for managing customer quality complaints across paper and chemical business units. The system features a dynamic role-based 11-stage workflow lifecycle, customer assignment routing, sample tracking, customer visit logging, CAPA documentation, settlement processing, and complete data visibility controls.

---

## Tech Stack & Architecture

### Backend
* **Runtime**: Node.js (v18+)
* **Framework**: Express.js
* **Database**: MySQL Server (via `mysql2/promise` pool)
* **Authentication**: JWT stored in HTTP-Only Cookies & Bearer Headers (`jsonwebtoken`, `cookie-parser`)
* **Security & Utility**: `bcryptjs` password hashing, `helmet` security headers, `express-rate-limit`, `joi` request validation, `multer` file upload processing

### Frontend
* **Framework**: React 19 (Vite SPA)
* **Styling**: Tailwind CSS & CSS custom-property design tokens (theme switching via `ThemeContext`)
* **Icons & Animation**: Lucide React, GSAP
* **HTTP Client**: Axios with credentials interceptors

---

## Core Features

| Feature | Description |
|---|---|
| **Multi-Role Authentication** | Separate login flows for Customers and Employees with role-based routing (Admin, KAM, TS, QC, Ops, Marketing, Finance, MD, Customer). |
| **Dynamic Workflow Engine** | Stage 1 to Stage 11 complaint lifecycle with automatic routing to designated department heads and executives based on Business Unit and Customer, driven by `resolveNextStage()` in `complaintController.js`. |
| **Scoped Data Access** | List and detail endpoints are filtered through a shared `getVisibilityFilter()` so a user only sees complaints relevant to their role/department/assignment. |
| **Invoice Line Item Defect Logging** | Direct integration with invoice master records to log defective quantities and computed defect values. |
| **Sample Tracking** | Track physical sample lifecycle (`Requested` → `Dispatched` → `Received` → `Under Testing` → `Verified`). |
| **Customer Visits & Remarks** | Schedule customer visits, track departure/return dates, and log multi-member visit remarks (`Visit_Members`). |
| **QC & CAPA Documentation** | Upload visual quality attachments and log Operations Corrective & Preventive Action (CAPA) analysis. |
| **Settlement & Credit Notes** | Track commercial settlements and issue/record SAP credit note tracking numbers upon closure. |

> **Known gap (from internal audit):** the *listing/viewing* endpoints above are correctly scoped, but the workflow **action** endpoints (`/ts-review`, `/qc-review`, `/capa`, `/approve`, `/finance`, `/action`) currently only check that the caller is logged in — not that they hold the correct role or are the assigned actor for that stage. Uploaded attachments under `/uploads` are also served without an auth check. Both are flagged as priority fixes.

---

## Project Structure

```
CCMS/
├── backend/                       ← Node.js / Express API
│   ├── config/                        ← Database pool setup and db_init script
│   ├── controllers/                   ← Auth and Complaint controllers
│   ├── middleware/                    ← Authentication & Authorization guards
│   ├── routes/                        ← Express route definitions
│   ├── uploads/                       ← Uploaded attachments directory
│   ├── utils/                         ← Response helper utilities
│   ├── server.js                      ← Express server entry point
│   ├── .env.example                   ← Environment configuration template
│   └── package.json
├── frontend/                      ← React Client Application
│   ├── src/                           ← React pages, components, hooks, utilities
│   ├── public/                        ← Static public assets
│   ├── package.json
│   └── vite.config.js
├── database/                      ← Database schema & migration scripts
│   ├── migrations/                    ← Versioned SQL migrations (001 to 010)
│   └── ccms.sql                       ← Base schema SQL definition
├── docs/                          ← Reference documentation and screenshots
│   ├── API.md
│   ├── ARCHITECTURE.md                ← currently describes an earlier Postgres/services-layer design, not what's implemented — pending rewrite
│   ├── DATABASE.md
│   ├── SECURITY.md                    ← same caveat as ARCHITECTURE.md
│   └── screenshots/
├── ccms_postman_collection.json   ← Postman collection for API testing
└── README.md                      ← Main project documentation
```

---

## Quick Start Guide

### Prerequisites
* **Node.js** v18 or newer
* **MySQL Server** (v8.0+ or MariaDB) running locally (default port `3306`)

---

### Step 1: Configure Backend Environment

1. Navigate to the `backend/` directory.
2. Create a `.env` file based on `.env.example`:

```env
PORT=5000
NODE_ENV=development

# MySQL Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=ccms

# Authentication & CORS
JWT_SECRET=ccms_jwt_secret_key_12345
JWT_EXPIRES_IN=8h
CLIENT_URL=http://localhost:5173

# Uploads
UPLOAD_PATH=uploads/
```

---

### Step 2: Initialize Database & Run Backend (Terminal 1)

```bash
cd backend

# Install node dependencies
npm install

# Initialize database schema and seed default employee accounts
npm run init-db

# Start the Express API server with nodemon
npm run dev
```
The backend API server will start at `http://localhost:5000`.

---

### Step 3: Run Frontend Application (Terminal 2)

```bash
cd frontend

# Install node dependencies
npm install

# Start the React Vite development server
npm run dev
```
The frontend portal will open at `http://localhost:5173`.

---

## Default Test Logins

`npm run init-db` seeds **employee** accounts with the password **`password123`**:

| User Type | Email | Password | Role / Description |
|---|---|---|---|
| **Administrator** | `admin@orientpaper.com` | `password123` | Administrator (Full System Access) |
| **KAM** | `kam.paper@orientpaper.com` | `password123` | Key Account Manager |
| **TS Executive** | `ts.paper@orientpaper.com` | `password123` | Technical Services Executive |
| **TS Head** | `tshead.paper@orientpaper.com` | `password123` | Technical Services Head |
| **QC Executive** | `qc.paper@orientpaper.com` | `password123` | Quality Control Executive |
| **QC Head** | `qchead.paper@orientpaper.com` | `password123` | Quality Control Head |
| **Ops Executive** | `ops.paper@orientpaper.com` | `password123` | Operations Executive |
| **Ops Head** | `opshead.paper@orientpaper.com` | `password123` | Operations Head |
| **Marketing Executive** | `mktg.paper@orientpaper.com` | `password123` | Marketing Executive |
| **Marketing Head** | `mktghead.paper@orientpaper.com` | `password123` | Marketing Head |
| **Finance Executive** | `fin.paper@orientpaper.com` | `password123` | Finance Executive |
| **Finance Head** | `finhead.paper@orientpaper.com` | `password123` | Finance Head |

**Customer accounts are not auto-seeded with a password** — `paper.procurement@itc.in` exists in `Customer_Master` but has no `Login_Master` row until activated. For a working customer demo login, run the one-off seed script:

```bash
node backend/add_hb_customer.js
```
which creates `hb@itc.in` / `hb123`. (There's also `add_yb_custom_kam.js` → `yb@itc.in` / `yb123`.) Otherwise, use the in-app invite/activation flow from an Admin or KAM account.

---

## Database Schemas & Entities

MySQL, **30 tables** total — 24 in the base schema (`database/ccms.sql`), 6 added by migrations 003–008.

* **Master Data**: `Customer_Master`, `Employee_Master`, `Role_Master`, `Department_Master`, `Business_Unit_Master`, `Product_Master`, `Invoice_Master`, `Login_Master`, `Login_Type_Master`, `Lookup_Master`, `KAM_Master`.
* **Workflow & Transactions**: `Complaint_Header`, `Complaint_Line_Item`, `Complaint_Workflow_Log`, `Customer_Executive_Assignment`, `Customer_KAM_Segment_Assignment`.
* **Sub-Systems**: `Sample_Tracking`, `Visit_Details`, `Visit_Members`, `QC_Attachment_Response`, `CAPA_Analysis`, `Settlement_Details`, `Credit_Note`.
* **Other**: `Workflow_Configuration`, `System_Configuration`, `Attachment_Master`, `Notification_Log`.

> `Approval_Matrix` is defined in the schema but not queried anywhere in the current codebase — dead table, flagged for either wiring up or removing.
