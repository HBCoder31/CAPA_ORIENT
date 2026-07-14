const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/responseHelper');
const { pool } = require('../config/db');

/**
 * Protect route - verifies JWT token
 */
async function protect(req, res, next) {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return sendError(res, 'Authentication token missing. Please log in.', 401);
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'ccms_dev_jwt_secret_key_987654321');
    } catch (jwtErr) {
      return sendError(res, 'Invalid or expired authentication token. Please log in again.', 401);
    }

    // Find user in database to ensure they still exist and are active
    if (decoded.role === 'Customer') {
      const [customers] = await pool.execute(
        `SELECT Customer_ID, Customer_Name, Customer_Email, Customer_Portal_Access, Is_Active 
         FROM Customer_Master 
         WHERE Customer_ID = ?`,
        [decoded.id]
      );

      if (customers.length === 0 || !customers[0].Is_Active) {
        return sendError(res, 'Customer account no longer exists or is inactive.', 401);
      }

      const customer = customers[0];

      // Check portal access
      if (!customer.Customer_Portal_Access) {
        return sendError(res, 'Customer portal access is disabled for this account.', 403);
      }

      // Note: Global CUSTOMER_PORTAL_ENABLED only controls complaint submission, not API access

      req.user = {
        id: customer.Customer_ID,
        name: customer.Customer_Name,
        email: customer.Customer_Email,
        role: 'Customer',
        businessUnitId: null, // Scoped to customer portal
      };
    } else {
      // Employee lookup
      const [employees] = await pool.execute(
        `SELECT e.Employee_ID, e.Employee_Name, e.Official_Email, e.Is_Active, r.Role_Name, d.Department_ID, d.Business_Unit_ID 
         FROM Employee_Master e
         JOIN Role_Master r ON e.Role_ID = r.Role_ID
         JOIN Department_Master d ON e.Department_ID = d.Department_ID
         WHERE e.Employee_ID = ?`,
        [decoded.id]
      );

      if (employees.length === 0 || !employees[0].Is_Active) {
        return sendError(res, 'Employee account no longer exists or is inactive.', 401);
      }

      const emp = employees[0];
      req.user = {
        id: emp.Employee_ID,
        name: emp.Employee_Name,
        email: emp.Official_Email,
        role: emp.Role_Name,
        departmentId: emp.Department_ID,
        businessUnitId: emp.Business_Unit_ID,
      };
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Restrict routes to specific roles
 */
function restrictTo(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(
        res,
        `Role "${req.user ? req.user.role : 'Guest'}" is not authorized to access this resource.`,
        403
      );
    }
    next();
  };
}

module.exports = {
  protect,
  restrictTo,
};
