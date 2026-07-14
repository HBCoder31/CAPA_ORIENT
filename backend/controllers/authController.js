const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { pool } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// Joi validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please enter a valid email address.',
    'any.required': 'Email is required.',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required.',
  }),
});

const inviteSchema = Joi.object({
  customerId: Joi.string().required().messages({
    'any.required': 'Customer ID is required.',
  }),
});

const activateSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Activation token is required.',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters long.',
    'any.required': 'Password is required.',
  }),
});

const registerCheckSchema = Joi.object({
  customerId: Joi.string().required().messages({
    'any.required': 'Customer ID is required.',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please enter a valid email address.',
    'any.required': 'Email is required.',
  }),
});

const selfRegisterSchema = Joi.object({
  customerId: Joi.string().required().messages({
    'any.required': 'Customer ID is required.',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please enter a valid email address.',
    'any.required': 'Email is required.',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters long.',
    'any.required': 'Password is required.',
  }),
});

/**
 * Handle user login (Employee and Customer)
 */
async function login(req, res, next) {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return sendError(res, error.details[0].message, 400);
    }

    const { email, password } = value;

    // 1. Search in centralized Login_Master table
    const [logins] = await pool.execute(
      `SELECT Login_ID, Email, Password_Hash, Login_Type_ID, Employee_ID, Customer_ID, Is_Active
       FROM Login_Master
       WHERE Email = ? AND Is_Active = TRUE`,
      [email]
    );

    if (logins.length === 0) {
      // Check if they are an unactivated customer (portal access enabled but password not set)
      const [unactivatedCust] = await pool.execute(
        `SELECT Customer_ID, Customer_Portal_Access FROM Customer_Master WHERE Customer_Email = ? AND Is_Active = TRUE`,
        [email]
      );

      if (unactivatedCust.length > 0 && unactivatedCust[0].Customer_Portal_Access) {
        return sendError(
          res,
          'Your portal access is enabled, but your password is not set. Please activate your account first.',
          400
        );
      }

      return sendError(res, 'Invalid email or password.', 401);
    }

    const loginRecord = logins[0];

    const isMatch = await bcrypt.compare(password, loginRecord.Password_Hash);
    if (!isMatch) {
      return sendError(res, 'Invalid email or password.', 401);
    }

    // 2. Fetch user profile depending on Login_Type_ID (2 = Employee, 4 = Admin)
    if (loginRecord.Login_Type_ID === 2 || loginRecord.Login_Type_ID === 4) {
      const [employees] = await pool.execute(
        `SELECT e.Employee_ID, e.Employee_Name, e.Official_Email, r.Role_Name 
         FROM Employee_Master e
         JOIN Role_Master r ON e.Role_ID = r.Role_ID
         WHERE e.Employee_ID = ? AND e.Is_Active = TRUE`,
        [loginRecord.Employee_ID]
      );

      if (employees.length === 0) {
        return sendError(res, 'Employee profile not found or inactive.', 403);
      }

      const emp = employees[0];

      // Generate JWT
      const token = jwt.sign(
        { id: emp.Employee_ID, email: emp.Official_Email, role: emp.Role_Name },
        process.env.JWT_SECRET || 'ccms_dev_jwt_secret_key_987654321',
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
      );

      // Save Last_Login timestamp on Login_Master
      await pool.execute(
        'UPDATE Login_Master SET Last_Login = NOW() WHERE Login_ID = ?',
        [loginRecord.Login_ID]
      );

      // Maintain legacy Last_Login timestamp on Employee_Master
      await pool.execute(
        'UPDATE Employee_Master SET Last_Login = NOW() WHERE Employee_ID = ?',
        [emp.Employee_ID]
      );

      return sendSuccess(
        res,
        {
          token,
          user: {
            id: emp.Employee_ID,
            name: emp.Employee_Name,
            email: emp.Official_Email,
            role: emp.Role_Name,
          },
        },
        'Login successful.'
      );
    } else if (loginRecord.Login_Type_ID === 1) {
      // Customer
      const [customers] = await pool.execute(
        `SELECT Customer_ID, Customer_Name, Customer_Email, Customer_Portal_Access 
         FROM Customer_Master 
         WHERE Customer_ID = ? AND Is_Active = TRUE`,
        [loginRecord.Customer_ID]
      );

      if (customers.length === 0) {
        return sendError(res, 'Customer profile not found or inactive.', 403);
      }

      const cust = customers[0];

      // Check Customer portal access flag
      if (!cust.Customer_Portal_Access) {
        return sendError(res, 'Customer portal access is disabled for your account. Please contact your KAM.', 403);
      }

      // Generate JWT
      const token = jwt.sign(
        { id: cust.Customer_ID, email: cust.Customer_Email, role: 'Customer' },
        process.env.JWT_SECRET || 'ccms_dev_jwt_secret_key_987654321',
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
      );

      // Save Last_Login timestamp on Login_Master
      await pool.execute(
        'UPDATE Login_Master SET Last_Login = NOW() WHERE Login_ID = ?',
        [loginRecord.Login_ID]
      );

      return sendSuccess(
        res,
        {
          token,
          user: {
            id: cust.Customer_ID,
            name: cust.Customer_Name,
            email: cust.Customer_Email,
            role: 'Customer',
          },
        },
        'Customer login successful.'
      );
    } else {
      return sendError(res, 'Unknown login classification type.', 400);
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Generate an activation link/token for a Customer (KAM or Admin only)
 */
async function generateCustomerInvite(req, res, next) {
  try {
    const { error, value } = inviteSchema.validate(req.body);
    if (error) {
      return sendError(res, error.details[0].message, 400);
    }

    const { customerId } = value;

    // Verify customer exists, is active, and has Customer_Portal_Access enabled
    const [customers] = await pool.execute(
      `SELECT Customer_ID, Customer_Name, Customer_Email, Customer_Portal_Access 
       FROM Customer_Master 
       WHERE Customer_ID = ? AND Is_Active = TRUE`,
      [customerId]
    );

    if (customers.length === 0) {
      return sendError(res, 'Customer not found or is inactive.', 404);
    }

    const customer = customers[0];

    if (!customer.Customer_Portal_Access) {
      return sendError(
        res,
        'Cannot generate invite. Customer Portal Access is disabled for this customer. Enable it first.',
        400
      );
    }

    if (!customer.Customer_Email) {
      return sendError(res, 'Cannot generate invite. Customer has no email address configured.', 400);
    }

    // Generate JWT specific to activation
    const token = jwt.sign(
      { customerId: customer.Customer_ID, purpose: 'activate' },
      process.env.JWT_SECRET || 'ccms_dev_jwt_secret_key_987654321',
      { expiresIn: '24h' }
    );

    return sendSuccess(
      res,
      {
        customerId: customer.Customer_ID,
        customerName: customer.Customer_Name,
        customerEmail: customer.Customer_Email,
        activationToken: token,
        activationUrl: `http://localhost:5173/activate-portal?token=${token}`,
      },
      'Customer invite token generated successfully. Valid for 24 hours.'
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Activate customer account - sets password on first access
 */
async function activateCustomer(req, res, next) {
  try {
    const { error, value } = activateSchema.validate(req.body);
    if (error) {
      return sendError(res, error.details[0].message, 400);
    }

    const { token, password } = value;

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'ccms_dev_jwt_secret_key_987654321');
    } catch (tokenErr) {
      return sendError(res, 'Invalid or expired activation token. Please request a new invite link.', 400);
    }

    if (decoded.purpose !== 'activate' || !decoded.customerId) {
      return sendError(res, 'Invalid activation token.', 400);
    }

    // Check if customer exists and has portal access enabled
    const [customers] = await pool.execute(
      `SELECT Customer_ID, Customer_Portal_Access, Is_Active 
       FROM Customer_Master 
       WHERE Customer_ID = ?`,
      [decoded.customerId]
    );

    if (customers.length === 0 || !customers[0].Is_Active) {
      return sendError(res, 'Customer account not found or is inactive.', 400);
    }

    const customer = customers[0];
    if (!customer.Customer_Portal_Access) {
      return sendError(res, 'Customer Portal Access has been revoked. Contact your KAM.', 403);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Save Password_Hash to centralized Login_Master table
    const [existing] = await pool.execute(
      'SELECT Login_ID FROM Login_Master WHERE Customer_ID = ?',
      [customer.Customer_ID]
    );

    if (existing.length > 0) {
      await pool.execute(
        'UPDATE Login_Master SET Password_Hash = ?, Is_Active = 1 WHERE Customer_ID = ?',
        [hash, customer.Customer_ID]
      );
    } else {
      // Get the customer's email
      const [emailRes] = await pool.execute(
        'SELECT Customer_Email FROM Customer_Master WHERE Customer_ID = ?',
        [customer.Customer_ID]
      );
      const emailVal = emailRes[0]?.Customer_Email;
      
      await pool.execute(
        'INSERT INTO Login_Master (Email, Password_Hash, Login_Type_ID, Customer_ID, Is_Active) VALUES (?, ?, 1, ?, 1)',
        [emailVal, hash, customer.Customer_ID]
      );
    }

    return sendSuccess(res, null, 'Account activated successfully. You can now log in.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get customer portal enable config
 */
async function getCustomerPortalConfig(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT Configuration_Value FROM System_Configuration WHERE Configuration_Key = 'CUSTOMER_PORTAL_ENABLED'`
    );
    const enabled = rows.length > 0 && rows[0].Configuration_Value === 'TRUE';
    return sendSuccess(res, { enabled }, 'Customer portal configuration retrieved.');
  } catch (err) {
    next(err);
  }
}

/**
 * Update customer portal enable config
 */
async function updateCustomerPortalConfig(req, res, next) {
  try {
    const { enabled } = req.body;
    if (enabled === undefined) {
      return sendError(res, 'enabled boolean value is required.', 400);
    }

    const configValue = enabled ? 'TRUE' : 'FALSE';
    await pool.execute(
      `UPDATE System_Configuration SET Configuration_Value = ? WHERE Configuration_Key = 'CUSTOMER_PORTAL_ENABLED'`,
      [configValue]
    );

    return sendSuccess(res, { enabled }, 'Customer portal configuration updated successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Step 1: Check Customer Identity for Self-Registration
 */
async function checkRegistrationIdentity(req, res, next) {
  try {
    const { error, value } = registerCheckSchema.validate(req.body);
    if (error) {
      return sendError(res, error.details[0].message, 400);
    }

    const { customerId, email } = value;

    // Verify customer exists in Customer_Master with this ID and Email
    const [customers] = await pool.execute(
      `SELECT Customer_ID, Customer_Name, Customer_Email, Is_Active 
       FROM Customer_Master 
       WHERE Customer_ID = ? AND Customer_Email = ?`,
      [customerId, email]
    );

    if (customers.length === 0) {
      return sendError(
        res,
        'No matching customer profile found with this Customer ID and Email. Please check your credentials or contact your KAM.',
        404
      );
    }

    const customer = customers[0];
    if (!customer.Is_Active) {
      return sendError(res, 'Customer account is currently marked inactive.', 403);
    }

    // Check if they already have login credentials in Login_Master
    const [existingLogins] = await pool.execute(
      'SELECT Login_ID FROM Login_Master WHERE Customer_ID = ? OR Email = ?',
      [customerId, email]
    );

    const alreadyRegistered = existingLogins.length > 0;

    return sendSuccess(
      res,
      {
        customerId: customer.Customer_ID,
        customerName: customer.Customer_Name,
        customerEmail: customer.Customer_Email,
        alreadyRegistered
      },
      alreadyRegistered
        ? 'Account is already registered. You can reset your password by proceeding.'
        : 'Customer identity verified successfully. You can proceed to password creation.'
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Step 2: Complete Self-Registration by setting password
 */
async function selfRegisterCustomer(req, res, next) {
  try {
    const { error, value } = selfRegisterSchema.validate(req.body);
    if (error) {
      return sendError(res, error.details[0].message, 400);
    }

    const { customerId, email, password } = value;

    // Verify profile again
    const [customers] = await pool.execute(
      `SELECT Customer_ID, Customer_Name, Customer_Email, Is_Active 
       FROM Customer_Master 
       WHERE Customer_ID = ? AND Customer_Email = ?`,
      [customerId, email]
    );

    if (customers.length === 0) {
      return sendError(res, 'No matching customer profile found.', 404);
    }

    const customer = customers[0];
    if (!customer.Is_Active) {
      return sendError(res, 'Customer account is marked inactive.', 403);
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Check duplicate logins - if exists, we reset/update their password!
    const [existingLogins] = await pool.execute(
      'SELECT Login_ID FROM Login_Master WHERE Customer_ID = ? OR Email = ?',
      [customerId, email]
    );

    if (existingLogins.length > 0) {
      // Reset password
      await pool.execute(
        'UPDATE Login_Master SET Password_Hash = ?, Is_Active = 1 WHERE Login_ID = ?',
        [hash, existingLogins[0].Login_ID]
      );
    } else {
      // Write new login credentials
      await pool.execute(
        `INSERT INTO Login_Master (Email, Password_Hash, Login_Type_ID, Customer_ID, Is_Active)
         VALUES (?, ?, 1, ?, 1)`,
        [email, hash, customerId]
      );
    }

    // Auto-enable Customer Portal access flag on self-registration
    await pool.execute(
      `UPDATE Customer_Master 
       SET Customer_Portal_Access = TRUE, Is_Active = TRUE 
       WHERE Customer_ID = ?`,
      [customerId]
    );

    return sendSuccess(
      res, 
      null, 
      existingLogins.length > 0
        ? 'Your password has been reset successfully. You can now log in.'
        : 'Your account has been registered and activated. You can now log in.'
    );
  } catch (err) {
    next(err);
  }
}

async function getActiveKams(req, res, next) {
  try {
    const [kams] = await pool.execute(`
      SELECT k.KAM_ID, e.Employee_ID, e.Employee_Name 
      FROM KAM_Master k
      JOIN Employee_Master e ON k.Employee_ID = e.Employee_ID
      WHERE k.Is_Active = TRUE AND e.Is_Active = TRUE
      ORDER BY e.Employee_Name
    `);
    return sendSuccess(res, kams, 'Active KAMs retrieved successfully.');
  } catch (err) {
    next(err);
  }
}

async function reassignCustomerKam(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { customerId, kamId } = req.body;
    if (!customerId || !kamId) {
      await connection.rollback();
      return sendError(res, 'Customer ID and KAM ID are required.', 400);
    }

    // Verify KAM exists
    const [kams] = await connection.execute(
      'SELECT KAM_ID FROM KAM_Master WHERE KAM_ID = ? AND Is_Active = TRUE',
      [kamId]
    );
    if (kams.length === 0) {
      await connection.rollback();
      return sendError(res, 'KAM ID not found or is inactive.', 404);
    }

    // 1. Update Customer_Master
    await connection.execute(
      'UPDATE Customer_Master SET KAM_ID = ? WHERE Customer_ID = ?',
      [kamId, customerId]
    );

    // 2. Update Customer_KAM_Segment_Assignment
    await connection.execute(
      'UPDATE Customer_KAM_Segment_Assignment SET KAM_ID = ? WHERE Customer_ID = ? AND Is_Active = TRUE',
      [kamId, customerId]
    );

    // 3. Resolve KAM Employee_ID to propagate to open active complaints
    const [kamDetails] = await connection.execute(
      'SELECT Employee_ID FROM KAM_Master WHERE KAM_ID = ?',
      [kamId]
    );
    if (kamDetails.length > 0) {
      const newKamEmployeeId = kamDetails[0].Employee_ID;
      // Update any pending active complaints in status 17 (Submitted / Pending KAM Verification)
      await connection.execute(
        `UPDATE Complaint_Header 
         SET KAM_ID = ?, Current_Assignee_ID = ? 
         WHERE Customer_ID = ? AND Complaint_Status_ID = 17`,
        [kamId, newKamEmployeeId, customerId]
      );
    }

    await connection.commit();
    return sendSuccess(res, null, 'Customer KAM assignment updated successfully.');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

async function getWorkflowSlaConfig(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT Workflow_ID, Business_Unit_ID, Stage_Number, Stage_Name, SLA_Days 
       FROM Workflow_Configuration 
       ORDER BY Business_Unit_ID, Stage_Number`
    );
    return sendSuccess(res, rows, 'Workflow SLA configurations retrieved successfully.');
  } catch (err) {
    next(err);
  }
}

async function updateWorkflowSlaConfig(req, res, next) {
  try {
    const { workflowId, slaDays } = req.body;
    if (workflowId === undefined || slaDays === undefined) {
      return sendError(res, 'Workflow ID and SLA Days are required.', 400);
    }

    await pool.execute(
      'UPDATE Workflow_Configuration SET SLA_Days = ? WHERE Workflow_ID = ?',
      [parseInt(slaDays, 10), parseInt(workflowId, 10)]
    );

    return sendSuccess(res, null, 'Workflow SLA timing updated successfully.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  generateCustomerInvite,
  activateCustomer,
  getCustomerPortalConfig,
  updateCustomerPortalConfig,
  checkRegistrationIdentity,
  selfRegisterCustomer,
  getActiveKams,
  reassignCustomerKam,
  getWorkflowSlaConfig,
  updateWorkflowSlaConfig,
  getMdApprovalLimit,
  updateMdApprovalLimit,
  getProfileDetails,
  changePassword
};

async function getProfileDetails(req, res, next) {
  try {
    const isCustomer = req.user.role === 'Customer';
    if (isCustomer) {
      const [rows] = await pool.execute(
        `SELECT c.Customer_ID, c.Customer_Name, c.Customer_Email, c.City, c.State, c.SAP_Customer_Code,
                e.Employee_Name as KAM_Name, e.Official_Email as KAM_Email, e.Mobile_Number as KAM_Phone
         FROM Customer_Master c
         LEFT JOIN KAM_Master k ON c.KAM_ID = k.KAM_ID
         LEFT JOIN Employee_Master e ON k.Employee_ID = e.Employee_ID
         WHERE c.Customer_ID = ?`,
        [req.user.id]
      );
      if (rows.length === 0) {
        return sendError(res, 'Customer profile not found.', 404);
      }
      return sendSuccess(res, rows[0], 'Customer profile retrieved successfully.');
    } else {
      const [rows] = await pool.execute(
        `SELECT e.Employee_ID, e.Employee_Code, e.Employee_Name, e.Official_Email, e.Mobile_Number,
                d.Department_Name, r.Role_Name, mgr.Employee_Name as Manager_Name
         FROM Employee_Master e
         LEFT JOIN Department_Master d ON e.Department_ID = d.Department_ID
         LEFT JOIN Role_Master r ON e.Role_ID = r.Role_ID
         LEFT JOIN Employee_Master mgr ON e.Reporting_Manager_ID = mgr.Employee_ID
         WHERE e.Employee_ID = ?`,
        [req.user.id]
      );
      if (rows.length === 0) {
        return sendError(res, 'Employee profile not found.', 404);
      }
      return sendSuccess(res, rows[0], 'Employee profile retrieved successfully.');
    }
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return sendError(res, 'Current password and new password are required.', 400);
    }

    const isCustomer = req.user.role === 'Customer';
    let query = '';
    let params = [];
    if (isCustomer) {
      query = 'SELECT Login_ID, Password_Hash FROM Login_Master WHERE Customer_ID = ? AND Is_Active = TRUE';
      params = [req.user.id];
    } else {
      query = 'SELECT Login_ID, Password_Hash FROM Login_Master WHERE Email = ? AND Is_Active = TRUE';
      params = [req.user.email];
    }

    const [logins] = await pool.execute(query, params);
    if (logins.length === 0) {
      return sendError(res, 'Login record not found.', 404);
    }

    const login = logins[0];

    const isMatch = await bcrypt.compare(currentPassword, login.Password_Hash);
    if (!isMatch) {
      return sendError(res, 'Incorrect current password.', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    await pool.execute(
      'UPDATE Login_Master SET Password_Hash = ? WHERE Login_ID = ?',
      [hash, login.Login_ID]
    );

    return sendSuccess(res, null, 'Password updated successfully.');
  } catch (err) {
    next(err);
  }
}

async function getMdApprovalLimit(req, res, next) {
  try {
    const [rows] = await pool.execute(
      "SELECT Configuration_Value FROM System_Configuration WHERE Configuration_Key = 'MD_APPROVAL_LIMIT'"
    );
    const limit = rows.length > 0 ? parseFloat(rows[0].Configuration_Value) : 100000;
    return sendSuccess(res, { limit }, 'MD approval limit retrieved successfully.');
  } catch (err) {
    next(err);
  }
}

async function updateMdApprovalLimit(req, res, next) {
  try {
    const { limit } = req.body;
    if (limit === undefined) {
      return sendError(res, 'Limit value is required.', 400);
    }

    await pool.execute(
      "UPDATE System_Configuration SET Configuration_Value = ? WHERE Configuration_Key = 'MD_APPROVAL_LIMIT'",
      [limit.toString()]
    );

    return sendSuccess(res, null, 'MD approval limit updated successfully.');
  } catch (err) {
    next(err);
  }
}
