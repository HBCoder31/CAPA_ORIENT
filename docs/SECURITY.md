# Security Configuration & Gaps

This document details the encryption, authentication, input validation systems implemented in CCMS, and tracks known gaps.

---

## 🔒 Security Implementations

### 1. SQL Injection Mitigation
All database queries in the CCMS server utilize parameterized statements via the `mysql2/promise` execute pool:
```javascript
await connection.execute(
  'SELECT * FROM Complaint_Header WHERE Complaint_ID = ?',
  [id]
);
```
User inputs are treated strictly as parameters rather than executable SQL commands, neutralizing SQL Injection (SQLi) attacks.

### 2. Password Hashing
User passwords (in both `Login_Master` and `Employee_Master`) are encrypted using `bcryptjs` before storage:
* Salt Round Complexity: `10`
* Cryptographic algorithm: `Blowfish` block cipher.

### 3. Authentication & Sessions
* **JSON Web Token (JWT):** Generates JWT tokens upon successful login, signed with `JWT_SECRET`.
* **HTTP-Only Cookies:** Tokens are set in the response using the `httpOnly` cookie flag:
  ```javascript
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000
  });
  ```
  This prevents cross-site scripting (XSS) attacks from reading the session token via JavaScript (`document.cookie`).
* **Header Interceptors:** Frontend Axios config supports both Bearer tokens from localStorage and credentials transfer across CORS domains (`withCredentials: true`).

### 4. Input Validation
All login and activation endpoints validate structural integrity (email formatting, password length, required fields) using **Joi Validation Schemas** before hitting controller databases.

### 5. API Hardening
* **Helmet:** Configured on the Express app to secure HTTP headers (XSS filters, referrer policies, frameguard options).
* **Rate Limiting:** Mounted `express-rate-limit` arrays block DoS/brute-force attacks.
  * `globalLimiter`: Max 10,000 requests per 15 minutes.
  * `authLimiter`: Max 10,000 attempts per 15 minutes (demo mode configuration).

---

## ⚠️ Known Gaps & Vulnerabilities

The following security issues are currently identified in the codebase and scheduled for resolution in the next development cycle:

### 1. Workflow Assignee Verification Bypass
* **Issue:** Most workflow endpoints (such as `approveStage`) check if `req.user.role` belongs to the list of allowed roles for that stage (e.g. `Operations Head`). However, they do not assert that the complaint is explicitly assigned to this specific employee ID:
  ```javascript
  // Lacks assertion: header.Current_Assignee_ID === req.user.id
  ```
* **Impact:** Any employee with the correct role (e.g. any Operations Head) can approve or transition complaints that are not assigned to them.

### 2. CAPA Submission Role Bypass
* **Issue:** The CAPA endpoint `/api/complaints/:id/capa` lacks route-level role restriction middleware:
  ```javascript
  // Lacks restrictTo('Operations Engineer') in complaintRoutes.js
  router.post('/:id/capa', submitCapa);
  ```
* **Impact:** Any authenticated user (including Customers, TS Engineers, or KAMs) can submit CAPA details and force the complaint to transition into `Ops Head Approval`.

### 3. Public static serving of files
* **Issue:** Claim attachments and QC reply files are served directly as static Express assets:
  ```javascript
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
  ```
* **Impact:** Anyone who guesses or obtains the URL link of an upload file can view it publicly without being authenticated. Files should be routed through a secure download controller checking the JWT token.
