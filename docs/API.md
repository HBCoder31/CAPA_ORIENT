# REST API Specifications & Reference

All endpoints are hosted at `/api` relative to the server port (default: `http://localhost:5000/api`).

---

## 🔑 Authentication Endpoints (`/api/auth`)

### 1. User Login
Authenticates both customer accounts and internal employees. Sets an HTTP-only JWT cookie.
* **Route:** `POST /api/auth/login`
* **Headers:** `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "email": "finance.head@orientpaper.com",
    "password": "password123",
    "isCustomer": false
  }
  ```
* **Success Response (200):**
  ```json
  {
    "success": true,
    "message": "Login successful.",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsIn...",
      "user": {
        "id": 100022,
        "name": "Finance Head",
        "email": "finance.head@orientpaper.com",
        "role": "Finance Head",
        "isKam": false
      }
    }
  }
  ```

### 2. Generate Customer Invite
Generates an activation token link for a disabled customer. Mapped to KAM / Admin only.
* **Route:** `POST /api/auth/invite`
* **Request Body:**
  ```json
  {
    "customerId": "CUST100003"
  }
  ```
* **Success Response (200):**
  ```json
  {
    "success": true,
    "message": "Invite token generated.",
    "data": {
      "token": "act_884210...",
      "activationUrl": "http://localhost:5173/activate-portal?token=act_884210..."
    }
  }
  ```

### 3. Customer Portal Toggle Control
Allows Administrator to toggle global customer registration access.
* **Route:** `PUT /api/auth/config/customer-portal`
* **Request Body:**
  ```json
  {
    "enabled": true
  }
  ```

---

## 📋 Complaints Endpoints (`/api/complaints`)

*All routes below require the header `Authorization: Bearer <token>`.*

### 1. Log New Complaint
Customer submits a list of defective line items.
* **Route:** `POST /api/complaints`
* **Request Body:**
  ```json
  {
    "title": "Moisture defects on paper rolls",
    "description": "Paper rolls showing moisture warping.",
    "priorityId": 32,
    "lineItems": [
      {
        "invoiceNo": "INV900010",
        "lineItem": 2,
        "defectiveQty": 2.5,
        "categoryId": 38,
        "defectNatureId": 46,
        "customerRemarks": "Roll edge damaged.",
        "attachments": [
          {
            "content": "data:image/png;base64,iVBORw0KG...",
            "fileName": "photo.png",
            "fileType": "image/png"
          }
        ]
      }
    ]
  }
  ```

### 2. Retrieve Complaints List
Fetches complaints dynamically filtered by active user permissions (SLA status, division visibility, and department assignments).
* **Route:** `GET /api/complaints`

### 3. Retrieve Complaint Details
Returns the complete record, including line items, attachments, workflow logs, and CAPA/settlement details.
* **Route:** `GET /api/complaints/:id`

### 4. Technical Service Review Form
TS Engineer submits visit scheduling, direct forwarding, or visit completions.
* **Route:** `POST /api/complaints/:id/ts-review`
* **Request Body (Visit Request):**
  ```json
  {
    "actionType": "request-visit",
    "remarks": "dryer inspection needed"
  }
  ```
* **Request Body (Visit Confirmation - TS Head only):**
  ```json
  {
    "actionType": "visit-schedule",
    "visitDate": "2026-07-26 10:00:00",
    "departureDate": "2026-07-26 08:00:00",
    "returnDate": "2026-07-27 18:00:00",
    "visitMembers": [100003],
    "remarks": "dryer 3 check"
  }
  ```

### 5. Submit Visit Remarks
Visit member registers their field observations.
* **Route:** `POST /api/complaints/:id/visit-remarks`
* **Request Body:**
  ```json
  {
    "remarks": "Steam valve pressure checked, verified moisture variation."
  }
  ```

### 6. QC Review Form
QC Engineer requests/receives sample and forwards analysis findings.
* **Route:** `POST /api/complaints/:id/qc-review`
* **Request Body (Sample Request):**
  ```json
  {
    "actionType": "sample-request",
    "remarks": "1 meter roll sample needed."
  }
  ```

### 7. CAPA Submission Form
Operations Engineer submits the Corrective and Preventive action logs.
* **Route:** `POST /api/complaints/:id/capa`
* **Request Body:**
  ```json
  {
    "rootCause": "Improper sizing profile calibrator alignment.",
    "correctiveAction": "Calibrated profile sensor array.",
    "preventiveAction": "Add calibration checks to monthly PM."
  }
  ```

### 8. Workflow Stage Approval
Processes approvals for the current workflow stage (KAM, QC Head, Ops Head, Marketing PM, Marketing Head, MD, and Finance Head).
* **Route:** `POST /api/complaints/:id/approve`
* **Request Body:**
  ```json
  {
    "stage": "marketing-head",
    "settlementAmount": 136000,
    "remarks": "Approved and signed off."
  }
  ```

### 9. Timeline Actions (Rejections, Review, Clarifications)
Executes backwards transitions or offline seek-clarification loops.
* **Route:** `POST /api/complaints/:id/action`
* **Request Body:**
  ```json
  {
    "action": "clarify",
    "remarks": "Need clarification on customer roll weight."
  }
  ```
