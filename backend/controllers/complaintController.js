const { pool } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/responseHelper');

/**
 * Resolves the next workflow stage dynamically from Workflow_Configuration
 */
async function getAssignedEmployeeForDept(connection, customerId, deptId, roleId, buId) {
  // If it's an executive role, look up assignment first
  const executiveRoles = [5, 7, 9, 11, 12];
  if (executiveRoles.includes(roleId)) {
    const [assignment] = await connection.execute(
      `SELECT Employee_ID FROM Customer_Executive_Assignment 
       WHERE Customer_ID = ? AND Department_ID = ? AND Business_Unit_ID = ? AND Is_Active = TRUE`,
      [customerId, deptId, buId]
    );
    if (assignment.length > 0) {
      // Verify active
      const [emp] = await connection.execute(
        `SELECT Employee_ID FROM Employee_Master WHERE Employee_ID = ? AND Is_Active = TRUE`,
        [assignment[0].Employee_ID]
      );
      if (emp.length > 0) {
        return emp[0].Employee_ID;
      }
    }
  }

  // Fallback to default employee query
  const [employees] = await connection.execute(
    `SELECT Employee_ID FROM Employee_Master 
     WHERE Role_ID = ? AND Department_ID = ? AND Is_Active = TRUE 
     LIMIT 1`,
    [roleId, deptId]
  );
  if (employees.length > 0) {
    return employees[0].Employee_ID;
  }

  // Final fallback
  const [roleEmployees] = await connection.execute(
    `SELECT Employee_ID FROM Employee_Master WHERE Role_ID = ? AND Is_Active = TRUE LIMIT 1`,
    [roleId]
  );
  return roleEmployees.length > 0 ? roleEmployees[0].Employee_ID : 100002;
}

function getVisibilityFilter(user) {
  let sql = '';
  const params = [];

  if (user.role === 'Administrator') {
    sql = '1=1';
  } else if (user.role === 'Customer') {
    sql = 'c.Customer_ID = ? AND c.Complaint_Date >= DATE_SUB(NOW(), INTERVAL 90 DAY)';
    params.push(user.id);
  } else if (user.role === 'KAM') {
    sql = '(c.Current_Assignee_ID = ? OR c.KAM_ID = (SELECT KAM_ID FROM KAM_Master WHERE Employee_ID = ?)) AND (c.Complaint_Status_ID != 28 OR c.Closure_Date >= DATE_SUB(NOW(), INTERVAL 7 DAY))';
    params.push(user.id, user.id);
  } else if (user.role === 'TS Head') {
    sql = 'c.Current_Department_ID = ? AND c.Complaint_Status_ID IN (18, 19)';
    params.push(user.departmentId);
  } else if (user.role === 'TS Engineer') {
    sql = '(c.Current_Assignee_ID = ? AND c.Complaint_Status_ID IN (18, 19)) OR (c.Complaint_Status_ID = 19 AND EXISTS (SELECT 1 FROM Visit_Members vm WHERE vm.Complaint_ID = c.Complaint_ID AND vm.Employee_ID = ?))';
    params.push(user.id, user.id);
  } else if (user.role === 'QC Engineer') {
    sql = 'c.Current_Assignee_ID = ? AND c.Complaint_Status_ID IN (20, 21)';
    params.push(user.id);
  } else if (user.role === 'QC Head') {
    sql = 'c.Current_Department_ID = ? AND c.Complaint_Status_ID = 84';
    params.push(user.departmentId);
  } else if (user.role === 'Operations Engineer') {
    sql = 'c.Current_Assignee_ID = ? AND c.Complaint_Status_ID = 22';
    params.push(user.id);
  } else if (user.role === 'Operations Head') {
    sql = 'c.Current_Department_ID = ? AND c.Complaint_Status_ID = 23';
    params.push(user.departmentId);
  } else if (user.role === 'Marketing Executive') {
    sql = 'c.Current_Assignee_ID = ? AND c.Complaint_Status_ID = 24';
    params.push(user.id);
  } else if (user.role === 'Marketing Head') {
    sql = 'c.Current_Department_ID = ? AND c.Complaint_Status_ID = 25';
    params.push(user.departmentId);
  } else if (user.role === 'Managing Director') {
    sql = 'c.Complaint_Status_ID = 26';
  } else if (user.role === 'Finance Executive') {
    sql = 'c.Current_Assignee_ID = ? AND c.Complaint_Status_ID = 27';
    params.push(user.id);
  } else if (user.role === 'Finance Head') {
    sql = 'c.Current_Department_ID = ? AND c.Complaint_Status_ID = 83';
    params.push(user.departmentId);
  } else {
    // Any other employee role: show complaints where they are a visit member (status Visit Scheduled)
    sql = 'c.Complaint_Status_ID = 19 AND EXISTS (SELECT 1 FROM Visit_Members vm WHERE vm.Complaint_ID = c.Complaint_ID AND vm.Employee_ID = ?)';
    params.push(user.id);
  }

  return { sql, params };
}

async function getAssigneeName(connection, employeeId) {
  if (!employeeId) return 'Unassigned';
  const [rows] = await connection.execute(
    'SELECT Employee_Name FROM Employee_Master WHERE Employee_ID = ?',
    [employeeId]
  );
  return rows.length > 0 ? rows[0].Employee_Name : 'Unassigned';
}

async function getAssigneeNameWithDesignation(connection, employeeId) {
  if (!employeeId) return 'Unassigned';
  const [rows] = await connection.execute(
    `SELECT e.Employee_Name, r.Role_Name 
     FROM Employee_Master e
     JOIN Role_Master r ON e.Role_ID = r.Role_ID
     WHERE e.Employee_ID = ?`,
    [employeeId]
  );
  if (rows.length === 0) return 'Unassigned';
  const { Employee_Name, Role_Name } = rows[0];
  if (Employee_Name.includes(`(${Role_Name})`) || Employee_Name.includes(Role_Name)) {
    return Employee_Name;
  }
  return `${Employee_Name} (${Role_Name})`;
}

/**
 * Resolves the next workflow stage dynamically from Workflow_Configuration
 */
async function resolveNextStage(connection, currentStageNumber, businessUnitId, customerId) {
  const [stages] = await connection.execute(
    `SELECT Stage_Number, Stage_Name, Department_ID, Default_Role_ID 
     FROM Workflow_Configuration 
     WHERE Business_Unit_ID = ? AND Stage_Number > ? AND Is_Active = TRUE 
     ORDER BY Stage_Number ASC 
     LIMIT 1`,
    [businessUnitId, currentStageNumber]
  );

  if (stages.length === 0) {
    return null; // Final closed state
  }

  const nextStage = stages[0];
  let nextStatusId = null;
  let nextAssigneeId = null;

  const statusMapping = {
    1: 17, // KAM
    2: 18, // TS
    3: 21, // QC
    4: 84, // QC Head
    5: 22, // CAPA
    6: 23, // Ops Head
    7: 24, // PM
    8: 25, // Marketing Head
    9: 26, // MD
    10: 27, // Finance Executive (Stage 10)
    11: 83  // Finance Head Approval (Stage 11)
  };

  nextStatusId = statusMapping[nextStage.Stage_Number] || 17;
  const roleId = nextStage.Default_Role_ID;
  const deptId = nextStage.Department_ID;

  if (roleId === 3) {
    const [segmentKam] = await connection.execute(
      `SELECT ksa.KAM_ID, k.Employee_ID 
       FROM Customer_KAM_Segment_Assignment ksa
       JOIN KAM_Master k ON ksa.KAM_ID = k.KAM_ID
       WHERE ksa.Customer_ID = ? AND ksa.Business_Unit_ID = ? AND ksa.Is_Active = TRUE`,
      [customerId, businessUnitId]
    );
    if (segmentKam.length > 0) {
      nextAssigneeId = segmentKam[0].Employee_ID;
    } else {
      const [cust] = await connection.execute(
        `SELECT k.Employee_ID FROM Customer_Master c LEFT JOIN KAM_Master k ON c.KAM_ID = k.KAM_ID WHERE c.Customer_ID = ?`,
        [customerId]
      );
      if (cust.length > 0 && cust[0].Employee_ID) {
        nextAssigneeId = cust[0].Employee_ID;
      } else {
        const [fallbackKam] = await connection.execute(
          'SELECT Employee_ID FROM KAM_Master WHERE Is_Active = TRUE LIMIT 1'
        );
        nextAssigneeId = fallbackKam.length > 0 ? fallbackKam[0].Employee_ID : 100020;
      }
    }
  } else {
    const executiveRoles = [5, 7, 9, 11, 12];
    if (executiveRoles.includes(roleId)) {
      // 1. Check if there is an active Customer_Executive_Assignment
      const [assignment] = await connection.execute(
        `SELECT Employee_ID FROM Customer_Executive_Assignment 
         WHERE Customer_ID = ? AND Department_ID = ? AND Business_Unit_ID = ? AND Is_Active = TRUE`,
        [customerId, deptId, businessUnitId]
      );

      let assignedEmpId = null;
      if (assignment.length > 0) {
        // Verify active employee in same role and department
        const [empCheck] = await connection.execute(
          `SELECT Employee_ID FROM Employee_Master 
           WHERE Employee_ID = ? AND Role_ID = ? AND Department_ID = ? AND Is_Active = TRUE`,
          [assignment[0].Employee_ID, roleId, deptId]
        );
        if (empCheck.length > 0) {
          assignedEmpId = empCheck[0].Employee_ID;
        }
      }

      if (assignedEmpId) {
        nextAssigneeId = assignedEmpId;
      } else {
        // 2. Fetch all active employees for this role and department
        const [activeEmps] = await connection.execute(
          `SELECT Employee_ID FROM Employee_Master 
           WHERE Role_ID = ? AND Department_ID = ? AND Is_Active = TRUE 
           ORDER BY Employee_ID ASC`,
          [roleId, deptId]
        );

        if (activeEmps.length > 0) {
          // 3. Round-robin assignment
          const counterKey = `ASSIGN_CTR_D${deptId}_R${roleId}`;
          const [counterRow] = await connection.execute(
            `SELECT Configuration_Value FROM System_Configuration WHERE Configuration_Key = ?`,
            [counterKey]
          );

          let currentVal = 0;
          if (counterRow.length > 0) {
            currentVal = parseInt(counterRow[0].Configuration_Value, 10) || 0;
          }

          const nextIndex = currentVal % activeEmps.length;
          nextAssigneeId = activeEmps[nextIndex].Employee_ID;

          const newVal = (currentVal + 1) % activeEmps.length;

          // Update counter in DB
          await connection.execute(
            `INSERT INTO System_Configuration (Configuration_Key, Configuration_Value, Data_Type, Remarks) 
             VALUES (?, ?, 'Integer', 'Round-robin assignment counter') 
             ON DUPLICATE KEY UPDATE Configuration_Value = ?`,
            [counterKey, String(newVal), String(newVal)]
          );

          // 4. Save Customer_Executive_Assignment
          await connection.execute(
            `INSERT INTO Customer_Executive_Assignment (Customer_ID, Department_ID, Employee_ID, Business_Unit_ID, Is_Active)
             VALUES (?, ?, ?, ?, TRUE)
             ON DUPLICATE KEY UPDATE Employee_ID = ?, Is_Active = TRUE, Updated_On = NOW()`,
            [customerId, deptId, nextAssigneeId, businessUnitId, nextAssigneeId]
          );
        } else {
          // Fallback if no active employees in dept
          const [roleEmployees] = await connection.execute(
            `SELECT Employee_ID FROM Employee_Master WHERE Role_ID = ? AND Is_Active = TRUE LIMIT 1`,
            [roleId]
          );
          nextAssigneeId = roleEmployees.length > 0 ? roleEmployees[0].Employee_ID : 100002;
        }
      }
    } else {
      // Head roles or MD
      const [employees] = await connection.execute(
        `SELECT Employee_ID FROM Employee_Master 
         WHERE Role_ID = ? AND Department_ID = ? AND Is_Active = TRUE 
         LIMIT 1`,
        [roleId, deptId]
      );

      if (employees.length > 0) {
        nextAssigneeId = employees[0].Employee_ID;
      } else {
        const [roleEmployees] = await connection.execute(
          `SELECT Employee_ID FROM Employee_Master WHERE Role_ID = ? AND Is_Active = TRUE LIMIT 1`,
          [roleId]
        );
        nextAssigneeId = roleEmployees.length > 0 ? roleEmployees[0].Employee_ID : 100002;
      }
    }
  }

  return {
    stageNumber: nextStage.Stage_Number,
    stageName: nextStage.Stage_Name,
    departmentId: deptId,
    statusId: nextStatusId,
    assigneeId: nextAssigneeId
  };
}

/**
 * Get active customers (for Employees to search)
 */
async function getCustomers(req, res, next) {
  try {
    // Only employees can view customers
    if (req.user.role === 'Customer') {
      return sendError(res, 'Access denied. Customers cannot search other customers.', 403);
    }

    let query = `
      SELECT c.Customer_ID, c.Customer_Name, c.City, c.State, c.KAM_ID, e.Employee_Name as KAM_Name 
      FROM Customer_Master c
      LEFT JOIN KAM_Master k ON c.KAM_ID = k.KAM_ID
      LEFT JOIN Employee_Master e ON k.Employee_ID = e.Employee_ID
      WHERE c.Is_Active = TRUE
    `;
    const params = [];

    // Scope KAM role: only show customers assigned to this KAM
    if (req.user.role === 'KAM') {
      query += ` AND k.Employee_ID = ?`;
      params.push(req.user.id);
    }

    query += ` ORDER BY c.Customer_Name`;

    const [rows] = await pool.execute(query, params);
    return sendSuccess(res, rows, 'Customers retrieved successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get active employees (for dropdown select in CAPA)
 */
async function getEmployees(req, res, next) {
  try {
    if (req.user.role === 'Customer') {
      return sendError(res, 'Access denied.', 403);
    }
    const [rows] = await pool.execute(
      `SELECT em.Employee_ID, em.Employee_Name, em.Official_Email,
              r.Role_Name, d.Department_Name
       FROM Employee_Master em
       LEFT JOIN Role_Master r ON em.Role_ID = r.Role_ID
       LEFT JOIN Department_Master d ON em.Department_ID = d.Department_ID
       WHERE em.Is_Active = TRUE
       ORDER BY em.Employee_Name`
    );
    return sendSuccess(res, rows, 'Employees retrieved successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get invoices for the logged-in customer or selected customer
 */
async function getInvoices(req, res, next) {
  try {
    let customerId = req.user.id;

    // If employee, they must provide customerId query param
    if (req.user.role !== 'Customer') {
      customerId = req.query.customerId;
      if (!customerId) {
        return sendError(res, 'Customer ID is required as a query parameter.', 400);
      }
    }

    const isRestricted = req.user.role === 'Customer' || req.user.role === 'KAM';
    let query = `
      SELECT DISTINCT Invoice_No, Invoice_Date, Division 
      FROM Invoice_Master 
      WHERE Customer_ID = ?
    `;
    const params = [customerId];

    if (isRestricted) {
      query += ` AND Invoice_Date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)`;
    }

    query += ` ORDER BY Invoice_Date DESC`;

    const [rows] = await pool.execute(query, params);
    return sendSuccess(res, rows, 'Invoices retrieved successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get detailed line items for a specific invoice
 */
async function getInvoiceDetails(req, res, next) {
  try {
    const { invoiceNo } = req.params;

    // Validate ownership and 90-day restriction if customer or KAM
    const isRestricted = req.user.role === 'Customer' || req.user.role === 'KAM';
    if (isRestricted) {
      let validationQuery = `
        SELECT im.Customer_ID, im.Invoice_Date 
        FROM Invoice_Master im 
        WHERE im.Invoice_No = ? 
      `;
      const validationParams = [invoiceNo];

      if (req.user.role === 'Customer') {
        validationQuery += ` AND im.Customer_ID = ?`;
        validationParams.push(req.user.id);
      } else {
        // KAM: verify customer is assigned to this KAM
        validationQuery += ` AND EXISTS (
          SELECT 1 FROM Customer_Master c
          LEFT JOIN Customer_KAM_Segment_Assignment ksa ON c.Customer_ID = ksa.Customer_ID AND ksa.Is_Active = TRUE
          LEFT JOIN KAM_Master k ON (c.KAM_ID = k.KAM_ID OR ksa.KAM_ID = k.KAM_ID)
          WHERE c.Customer_ID = im.Customer_ID AND k.Employee_ID = ?
        )`;
        validationParams.push(req.user.id);
      }

      validationQuery += ` AND im.Invoice_Date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) LIMIT 1`;

      const [checkRows] = await pool.execute(validationQuery, validationParams);
      if (checkRows.length === 0) {
        return sendError(res, 'Access denied or invoice is older than 90 days.', 403);
      }
    }

    const [rows] = await pool.execute(
      `SELECT im.Line_Item, im.Product_Code, pm.Product_Name, pm.Product_Category, 
              im.Quantity as Invoice_Qty, im.Unit_Price as Price, im.Unit_Of_Measure 
       FROM Invoice_Master im 
       JOIN Product_Master pm ON im.Product_Code = pm.Product_Code 
       WHERE im.Invoice_No = ?`,
      [invoiceNo]
    );

    return sendSuccess(res, rows, 'Invoice line items retrieved successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get lookup options for intake form
 */
async function getLookups(req, res, next) {
  try {
    const [categories] = await pool.execute(
      "SELECT Lookup_ID, Lookup_Value FROM Lookup_Master WHERE Lookup_Type = 'Complaint_Category' AND Is_Active = TRUE"
    );
    const [natures] = await pool.execute(
      "SELECT Lookup_ID, Lookup_Value FROM Lookup_Master WHERE Lookup_Type = 'Defect_Nature' AND Is_Active = TRUE"
    );
    const [priorities] = await pool.execute(
      "SELECT Lookup_ID, Lookup_Value FROM Lookup_Master WHERE Lookup_Type = 'Priority' AND Is_Active = TRUE"
    );

    return sendSuccess(res, { categories, natures, priorities }, 'Lookups retrieved successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Create a new complaint (Stage 1 Intake)
 */
async function createComplaint(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Block customer complaint creation if the global toggle is off
    if (req.user.role === 'Customer') {
      const [globalConfig] = await connection.execute(
        `SELECT Configuration_Value FROM System_Configuration WHERE Configuration_Key = 'CUSTOMER_PORTAL_ENABLED'`
      );
      if (globalConfig.length > 0 && globalConfig[0].Configuration_Value !== 'TRUE') {
        await connection.rollback();
        connection.release();
        return sendError(res, 'Complaint submission is currently disabled by the administrator. Please contact your KAM to lodge complaints on your behalf.', 403);
      }
    }

    let customerId = req.user.id;
    let sourceId = 35; // Customer Portal Lookup_ID

    // 1. Resolve customer and channel if employee logs it
    if (req.user.role !== 'Customer') {
      customerId = req.body.customerId;
      sourceId = req.user.role === 'KAM' ? 36 : 37; // KAM or Sales Lookup_ID
      if (!customerId) {
        await connection.rollback();
        return sendError(res, 'Customer ID is required when logging on behalf of a customer.', 400);
      }
    }

    const { title, description, priorityId, lineItems, attachments } = req.body;

    if (!priorityId || !lineItems || lineItems.length === 0) {
      await connection.rollback();
      return sendError(res, 'Missing required complaint priority or line items.', 400);
    }

    // Verify each item has a title and description, either globally or per-item
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      const itemTitle = item.title || title;
      const itemDesc = item.description || description || item.customerRemarks;
      if (!itemTitle || !itemDesc) {
        await connection.rollback();
        return sendError(res, `Missing title or description for line item at position ${i + 1}.`, 400);
      }
    }

    // Load maximum attachment limits from configuration
    let maxImageCount = 5;
    let maxImageSizeMb = 20;
    const [configs] = await connection.execute(
      `SELECT Configuration_Key, Configuration_Value FROM System_Configuration WHERE Configuration_Key IN ('MAX_IMAGE_COUNT', 'MAX_ATTACHMENT_SIZE_MB')`
    );
    configs.forEach(c => {
      if (c.Configuration_Key === 'MAX_IMAGE_COUNT') {
        maxImageCount = parseInt(c.Configuration_Value, 10);
      } else if (c.Configuration_Key === 'MAX_ATTACHMENT_SIZE_MB') {
        maxImageSizeMb = parseInt(c.Configuration_Value, 10);
      }
    });

    const validateAttachment = (att, label) => {
      let fileSizeMb = 0;
      if (att.content) {
        const stringLength = att.content.length - (att.content.indexOf(',') + 1);
        const sizeInBytes = (stringLength * 3) / 4;
        fileSizeMb = sizeInBytes / (1024 * 1024);
      } else if (att.fileSize) {
        fileSizeMb = att.fileSize / (1024 * 1024);
      }

      if (fileSizeMb > maxImageSizeMb) {
        throw new Error(`Attachment size limit exceeded. Maximum allowed: ${maxImageSizeMb} MB per file. (File: "${att.fileName}" on ${label})`);
      }
    };

    // Validate global attachments if provided
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      if (attachments.length > maxImageCount) {
        await connection.rollback();
        return sendError(res, `Attachment upload limit exceeded. Maximum allowed: ${maxImageCount} files.`, 400);
      }
      try {
        attachments.forEach(att => validateAttachment(att, 'global uploads'));
      } catch (err) {
        await connection.rollback();
        return sendError(res, err.message, 400);
      }
    }

    // Validate per-item attachments if provided
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      if (item.attachments && Array.isArray(item.attachments) && item.attachments.length > 0) {
        if (item.attachments.length > maxImageCount) {
          await connection.rollback();
          return sendError(res, `Attachment upload limit exceeded for line item ${i + 1}. Maximum allowed: ${maxImageCount} files.`, 400);
        }
        try {
          item.attachments.forEach(att => validateAttachment(att, `line item ${i + 1}`));
        } catch (err) {
          await connection.rollback();
          return sendError(res, err.message, 400);
        }
      }
    }

    // 2. Fetch customer master and KAM mapping
    const [customers] = await connection.execute(
      `SELECT c.Customer_ID, c.Customer_Name, c.KAM_ID, k.Employee_ID, e.Employee_Name as KAM_Name
       FROM Customer_Master c
       LEFT JOIN KAM_Master k ON c.KAM_ID = k.KAM_ID
       LEFT JOIN Employee_Master e ON k.Employee_ID = e.Employee_ID
       WHERE c.Customer_ID = ? AND c.Is_Active = TRUE`,
      [customerId]
    );

    if (customers.length === 0) {
      await connection.rollback();
      return sendError(res, 'Customer not found or is inactive.', 404);
    }

    const customer = customers[0];
    let kamId = customer.KAM_ID;
    let assignedKamEmployeeId = customer.Employee_ID;

    // 4. Calculate SLA Due Date based on priority
    let resolvedPriorityId = priorityId;
    if (req.user.role === 'Customer') {
      resolvedPriorityId = 32; // Force to Medium
    }

    let slaHours = 336; // Default Low = 14 days
    if (parseInt(resolvedPriorityId) === 34) slaHours = 24; // Critical
    else if (parseInt(resolvedPriorityId) === 33) slaHours = 72; // High
    else if (parseInt(resolvedPriorityId) === 32) slaHours = 168; // Medium

    const createdAt = new Date();
    const slaDueDate = new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000);
    const currentYear = new Date().getFullYear();

    // 5. Generate sequential base complaint number
    const [maxResult] = await connection.execute('SELECT MAX(Complaint_ID) as maxId FROM Complaint_Header');
    const baseId = (maxResult[0].maxId || 0) + 1;

    const createdComplaints = [];

    // Loop through each line item to create a separate Complaint
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];

      // Resolve BU from this invoice item division
      const [invoiceInfo] = await connection.execute(
        'SELECT Division, Unit_Price FROM Invoice_Master WHERE Invoice_No = ? AND Line_Item = ? LIMIT 1',
        [item.invoiceNo, item.lineItem]
      );

      if (invoiceInfo.length === 0) {
        await connection.rollback();
        return sendError(res, `Invoice ${item.invoiceNo} line item ${item.lineItem} not found.`, 404);
      }

      const isChemical = invoiceInfo[0].Division.toLowerCase().includes('chemical');
      const businessUnitId = isChemical ? 2 : 1;

      // Resolve segment-specific KAM assignment
      let itemKamId = kamId;
      let itemAssignedKamEmployeeId = assignedKamEmployeeId;
      const [segmentKam] = await connection.execute(
        `SELECT ksa.KAM_ID, k.Employee_ID 
         FROM Customer_KAM_Segment_Assignment ksa
         JOIN KAM_Master k ON ksa.KAM_ID = k.KAM_ID
         WHERE ksa.Customer_ID = ? AND ksa.Business_Unit_ID = ? AND ksa.Is_Active = TRUE`,
        [customerId, businessUnitId]
      );

      if (segmentKam.length > 0) {
        itemKamId = segmentKam[0].KAM_ID;
        itemAssignedKamEmployeeId = segmentKam[0].Employee_ID;
      }

      // Generate complaint number (append index suffix if multiple items)
      const complaintNumber = lineItems.length > 1
        ? `CMP${currentYear}${String(baseId).padStart(4, '0')}/${i + 1}`
        : `CMP${currentYear}${String(baseId).padStart(4, '0')}`;

      // Resolve initial owner, assignee, and department
      let currentDeptId;
      let initialStatusId;
      let initialAssigneeId;
      let workflowConfigId;
      let logRemarks = '';

      if (req.user.role === 'KAM') {
        const nextStage = await resolveNextStage(connection, 1, businessUnitId, customerId);
        if (!nextStage) {
          await connection.rollback();
          return sendError(res, 'Failed to resolve next workflow stage.', 500);
        }
        currentDeptId = nextStage.departmentId;
        initialStatusId = nextStage.statusId;
        initialAssigneeId = nextStage.assigneeId;

        const [wfRows] = await connection.execute(
          'SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID = ? AND Stage_Number = 2',
          [businessUnitId]
        );
        workflowConfigId = wfRows.length > 0 ? wfRows[0].Workflow_ID : (businessUnitId === 1 ? 2 : 13);
        const resolvedName = await getAssigneeNameWithDesignation(connection, initialAssigneeId);
        logRemarks = `Complaint logged by KAM. Directed to Technical Services (Assigned to: ${resolvedName}). (Item ${i + 1} of ${lineItems.length})`;
      } else {
        currentDeptId = businessUnitId === 1 ? 6 : 12; // KAM Verification Department
        initialStatusId = 17; // Submitted / KAM Verification Pending
        initialAssigneeId = itemAssignedKamEmployeeId;

        const [wfRows] = await connection.execute(
          'SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID = ? AND Stage_Number = 1',
          [businessUnitId]
        );
        workflowConfigId = wfRows.length > 0 ? wfRows[0].Workflow_ID : (businessUnitId === 1 ? 1 : 12);
        const resolvedName = await getAssigneeNameWithDesignation(connection, initialAssigneeId);
        logRemarks = `Complaint logged. Directed to KAM for verification (Assigned to: ${resolvedName}). (Item ${i + 1} of ${lineItems.length})`;
      }

      // Create separate Complaint Header
      const itemTitle = item.title || (lineItems.length > 1 ? `${title} (Item ${i + 1}/${lineItems.length})` : title);
      const itemDescription = item.description || description || item.customerRemarks || 'Product defect reported.';

      const [headerResult] = await connection.execute(
        `INSERT INTO Complaint_Header (
          Complaint_Number, Customer_ID, KAM_ID, Business_Unit_ID, Complaint_Source_ID,
          Complaint_Date, SLA_Due_Date, SLA_Breached, Complaint_Title, Complaint_Description,
          Priority_ID, Complaint_Status_ID, Current_Department_ID, Current_Assignee_ID,
          Created_By, Created_On, Is_Active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          complaintNumber,
          customerId,
          itemKamId,
          businessUnitId,
          sourceId,
          createdAt,
          slaDueDate,
          itemTitle,
          itemDescription,
          resolvedPriorityId,
          initialStatusId,
          currentDeptId,
          initialAssigneeId,
          req.user.role === 'Customer' ? null : req.user.id,
          createdAt
        ]
      );

      const complaintId = headerResult.insertId;

      // Calculate Defective price and amount
      const price = invoiceInfo.length > 0 ? parseFloat(invoiceInfo[0].Unit_Price) : 0;
      const defectiveQty = parseFloat(item.defectiveQty);
      const complaintValue = price * defectiveQty;

      // Insert Line Item record under this Complaint Header
      await connection.execute(
        `INSERT INTO Complaint_Line_Item (
          Complaint_ID, Invoice_No, Line_Item, Defective_Quantity, 
          Complaint_Category_ID, Defect_Nature_ID, Complaint_Value, Customer_Remarks, Created_On
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          complaintId,
          item.invoiceNo,
          item.lineItem,
          defectiveQty,
          item.categoryId,
          item.defectNatureId,
          complaintValue,
          item.customerRemarks || itemDescription,
          createdAt
        ]
      );

      // Update Total Value
      await connection.execute(
        'UPDATE Complaint_Header SET Total_Complaint_Value = ? WHERE Complaint_ID = ?',
        [complaintValue, complaintId]
      );

      // Save Attachments
      const actorEmployeeId = req.user.role === 'Customer' ? itemAssignedKamEmployeeId : req.user.id;
      const itemAttachments = item.attachments && item.attachments.length > 0 ? item.attachments : attachments;
      if (itemAttachments && Array.isArray(itemAttachments) && itemAttachments.length > 0) {
        const fs = require('fs');
        const path = require('path');
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        for (const att of itemAttachments) {
          if (att.content) {
            const uniqueFileName = `${Date.now()}_${att.fileName.replace(/\s+/g, '_')}`;
            const filePath = path.join(uploadsDir, uniqueFileName);
            const relativePath = `uploads/${uniqueFileName}`;

            const base64Data = att.content.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(filePath, buffer);

            const fileSizeKb = buffer.length / 1024;
            await connection.execute(
              `INSERT INTO attachment_master (
                Complaint_ID, Uploaded_By, File_Name, File_Path, File_Type, File_Size_KB, Created_By
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                complaintId,
                actorEmployeeId,
                att.fileName,
                relativePath,
                att.fileType || 'image/jpeg',
                fileSizeKb,
                actorEmployeeId
              ]
            );
          }
        }
      }

      // Log timeline event
      await connection.execute(
        `INSERT INTO Complaint_Workflow_Log (
          Complaint_ID, Workflow_ID, Action_By, Action_Date, Action_Type_ID, 
          Previous_Department_ID, Current_Department_ID, Remarks, Created_On
        ) VALUES (?, ?, ?, ?, 74, ?, ?, ?, ?)`,
        [
          complaintId,
          workflowConfigId,
          actorEmployeeId,
          createdAt,
          currentDeptId,
          currentDeptId,
          logRemarks,
          createdAt
        ]
      );

      createdComplaints.push({ complaintId, complaintNumber });
    }

    // Resolve assigned KAM name
    let assignedKamName = 'Unassigned';
    if (assignedKamEmployeeId) {
      const [kamEmpRows] = await connection.execute(
        'SELECT Employee_Name FROM Employee_Master WHERE Employee_ID = ?',
        [assignedKamEmployeeId]
      );
      if (kamEmpRows.length > 0) {
        assignedKamName = kamEmpRows[0].Employee_Name;
      }
    }

    // Resolve initial assignee name for the success message
    let initialAssigneeName = 'Unassigned';
    if (req.user.role === 'KAM') {
      const [lastHeader] = await connection.execute(
        'SELECT Current_Assignee_ID FROM Complaint_Header WHERE Complaint_ID = ?',
        [createdComplaints[0].complaintId]
      );
      if (lastHeader.length > 0 && lastHeader[0].Current_Assignee_ID) {
        initialAssigneeName = await getAssigneeName(connection, lastHeader[0].Current_Assignee_ID);
      }
    } else {
      initialAssigneeName = assignedKamName;
    }

    await connection.commit();
    
    const initialQueueName = req.user.role === 'KAM' ? 'Technical Services (TS) Review' : 'Submitted (Pending KAM Review)';

    return sendSuccess(res, { 
      complaintId: createdComplaints[0].complaintId,
      complaintNumber: createdComplaints[0].complaintNumber,
      assignedKamName,
      initialAssigneeName,
      initialQueue: initialQueueName,
      createdComplaints
    }, `${createdComplaints.length} complaint(s) logged successfully. Assigned to: ${initialAssigneeName} (${initialQueueName}).`, 210);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * Get complaints list (scoped by Role)
 */
async function getComplaints(req, res, next) {
  try {
    let query = `
      SELECT c.Complaint_ID, c.Complaint_Number, c.Customer_ID, cust.Customer_Name, 
             c.Complaint_Title, c.Complaint_Date, c.SLA_Due_Date, c.SLA_Breached, c.Is_Escalated,
             c.Total_Complaint_Value, l_status.Lookup_Value as Status, l_priority.Lookup_Value as Severity,
             e.Employee_Name as Assignee, c.Current_Department_ID, dept.Department_Name, r.Role_Name as Designation
      FROM Complaint_Header c
      JOIN Customer_Master cust ON c.Customer_ID = cust.Customer_ID
      JOIN Lookup_Master l_status ON c.Complaint_Status_ID = l_status.Lookup_ID
      JOIN Lookup_Master l_priority ON c.Priority_ID = l_priority.Lookup_ID
      LEFT JOIN Employee_Master e ON c.Current_Assignee_ID = e.Employee_ID
      LEFT JOIN Role_Master r ON e.Role_ID = r.Role_ID
      LEFT JOIN Department_Master dept ON c.Current_Department_ID = dept.Department_ID
      WHERE c.Is_Active = TRUE
    `;
    const params = [];

    // Role-based scoping
    const filter = getVisibilityFilter(req.user);
    query += ` AND (${filter.sql})`;
    params.push(...filter.params);

    query += ' ORDER BY c.Complaint_Date DESC';

    const [rows] = await pool.execute(query, params);

    // Calculate dynamic "At Risk" flag client-side or add to return dataset
    const processedRows = rows.map(row => {
      const isPastSla = new Date() > new Date(row.SLA_Due_Date);
      const isClosedOrResolved = ['Closed', 'Resolved'].includes(row.Status);
      
      // At Risk: status is not resolved/closed, and SLA is within 24 hours
      const timeRemainingMs = new Date(row.SLA_Due_Date).getTime() - new Date().getTime();
      const isWithin24Hrs = timeRemainingMs > 0 && timeRemainingMs <= 24 * 60 * 60 * 1000;
      const isAtRisk = !isClosedOrResolved && isWithin24Hrs;

      return {
        ...row,
        Is_At_Risk: isAtRisk ? 1 : 0,
        Is_Overdue: (isPastSla && !isClosedOrResolved) ? 1 : 0,
      };
    });

    return sendSuccess(res, processedRows, 'Complaints retrieved successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get detailed complaint details (including line items and timeline logs)
 */
async function getComplaintDetails(req, res, next) {
  try {
    const { id } = req.params;

    // 1. Fetch header details
    const filter = getVisibilityFilter(req.user);
    const [headers] = await pool.execute(
      `SELECT c.*, cust.Customer_Name, cust.Customer_Email, cust.Customer_Phone,
              l_status.Lookup_Value as Status, l_priority.Lookup_Value as Severity,
              bu.Business_Unit_Name, d.Department_Name, e.Employee_Name as Assignee,
              r.Role_Name as Designation,
              k_emp.Employee_Name as KAM_Name
       FROM Complaint_Header c
       JOIN Customer_Master cust ON c.Customer_ID = cust.Customer_ID
       JOIN Lookup_Master l_status ON c.Complaint_Status_ID = l_status.Lookup_ID
       JOIN Lookup_Master l_priority ON c.Priority_ID = l_priority.Lookup_ID
       JOIN Business_Unit_Master bu ON c.Business_Unit_ID = bu.Business_Unit_ID
       LEFT JOIN Department_Master d ON c.Current_Department_ID = d.Department_ID
       LEFT JOIN Employee_Master e ON c.Current_Assignee_ID = e.Employee_ID
       LEFT JOIN Role_Master r ON e.Role_ID = r.Role_ID
       LEFT JOIN KAM_Master k ON c.KAM_ID = k.KAM_ID
       LEFT JOIN Employee_Master k_emp ON k.Employee_ID = k_emp.Employee_ID
       WHERE c.Complaint_ID = ? AND c.Is_Active = TRUE AND (${filter.sql})`,
      [id, ...filter.params]
    );

    if (headers.length === 0) {
      return sendError(res, 'Complaint not found.', 404);
    }

    const complaint = headers[0];

    // 2. Fetch line items
    const [lineItems] = await pool.execute(
      `SELECT cli.*, im.Product_Code, pm.Product_Name, pm.Product_Category,
              l_cat.Lookup_Value as Category, l_nature.Lookup_Value as Defect_Nature
       FROM Complaint_Line_Item cli
       JOIN Invoice_Master im ON cli.Invoice_No = im.Invoice_No AND cli.Line_Item = im.Line_Item
       JOIN Product_Master pm ON im.Product_Code = pm.Product_Code
       JOIN Lookup_Master l_cat ON cli.Complaint_Category_ID = l_cat.Lookup_ID
       JOIN Lookup_Master l_nature ON cli.Defect_Nature_ID = l_nature.Lookup_ID
       WHERE cli.Complaint_ID = ?`,
      [id]
    );

    // 3. Fetch workflow/audit logs
    const [logs] = await pool.execute(
      `SELECT wl.*, e.Employee_Name, e.Official_Email, r.Role_Name,
              l_act.Lookup_Value as Action_Value, d_prev.Department_Name as Prev_Dept,
              d_curr.Department_Name as Curr_Dept, d_emp.Department_Name as Employee_Dept
       FROM Complaint_Workflow_Log wl
       JOIN Employee_Master e ON wl.Action_By = e.Employee_ID
       JOIN Role_Master r ON e.Role_ID = r.Role_ID
       LEFT JOIN Department_Master d_emp ON e.Department_ID = d_emp.Department_ID
       LEFT JOIN Lookup_Master l_act ON wl.Action_Type_ID = l_act.Lookup_ID
       LEFT JOIN Department_Master d_prev ON wl.Previous_Department_ID = d_prev.Department_ID
       LEFT JOIN Department_Master d_curr ON wl.Current_Department_ID = d_curr.Department_ID
       WHERE wl.Complaint_ID = ?
       ORDER BY wl.Created_On ASC`,
      [id]
    );

    // Calc dynamic flags
    const isPastSla = new Date() > new Date(complaint.SLA_Due_Date);
    const isClosedOrResolved = ['Closed', 'Resolved'].includes(complaint.Status);
    const timeRemainingMs = new Date(complaint.SLA_Due_Date).getTime() - new Date().getTime();
    const isWithin24Hrs = timeRemainingMs > 0 && timeRemainingMs <= 24 * 60 * 60 * 1000;

    complaint.Is_At_Risk = (!isClosedOrResolved && isWithin24Hrs) ? 1 : 0;
    complaint.Is_Overdue = (isPastSla && !isClosedOrResolved) ? 1 : 0;

    // Fetch associated Settlement and Credit Note details
    const [settlements] = await pool.execute('SELECT * FROM Settlement_Details WHERE Complaint_ID = ?', [id]);
    const [creditNotes] = await pool.execute('SELECT * FROM Credit_Note WHERE Complaint_ID = ?', [id]);

    // Fetch attachments with their QC responses
    const [attachments] = await pool.execute(
      `SELECT am.Attachment_ID, am.File_Name, am.File_Path, am.File_Type, am.File_Size_KB, am.Upload_Date, am.Remarks,
              qr.QC_Remarks, qr.Reply_File_Path
       FROM Attachment_Master am
       LEFT JOIN QC_Attachment_Response qr ON am.Attachment_ID = qr.Attachment_ID
       WHERE am.Complaint_ID = ?`,
      [id]
    );

    // 7-day overdue check for sample tracking
    let showSampleEscalationToHead = false;
    if (complaint.SLA_Paused && complaint.SLA_Paused_At) {
      const pausedTimeMs = new Date().getTime() - new Date(complaint.SLA_Paused_At).getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (pausedTimeMs >= sevenDaysMs && ['Administrator', 'QC Head'].includes(req.user.role)) {
        showSampleEscalationToHead = true;
      }
    }

    return sendSuccess(
      res, 
      { 
        complaint, 
        lineItems, 
        logs,
        settlement: settlements[0] || null,
        creditNote: creditNotes[0] || null,
        attachments: attachments,
        showSampleEscalationToHead
      }, 
      'Complaint details retrieved successfully.'
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Get dashboard stats filtered by role scope
 */
async function getDashboardStats(req, res, next) {
  try {
    let whereClause = 'c.Is_Active = TRUE';
    const params = [];

    const filter = getVisibilityFilter(req.user);
    whereClause += ` AND (${filter.sql})`;
    params.push(...filter.params);

    // 1. Status Breakdown
    const [statusRows] = await pool.execute(
      `SELECT l.Lookup_Value as status, COUNT(*) as count 
       FROM Complaint_Header c 
       JOIN Lookup_Master l ON c.Complaint_Status_ID = l.Lookup_ID 
       WHERE ${whereClause} 
       GROUP BY c.Complaint_Status_ID`,
      params
    );

    // 2. SLA compliance stats
    // We check how many are not overdue. 
    // Compliant = Closed and closed_at <= SLA_Due_Date, OR Open and current_time <= SLA_Due_Date
    const [slaRows] = await pool.execute(
      `SELECT COUNT(*) as total,
              SUM(CASE 
                WHEN (c.Closure_Date IS NOT NULL AND c.Closure_Date <= c.SLA_Due_Date) 
                     OR (c.Closure_Date IS NULL AND NOW() <= c.SLA_Due_Date) THEN 1 
                ELSE 0 
              END) as compliant
       FROM Complaint_Header c
       WHERE ${whereClause}`,
      params
    );

    const total = slaRows[0]?.total || 0;
    const compliant = slaRows[0]?.compliant || 0;
    const slaCompliancePct = total > 0 ? Math.round((compliant / total) * 100) : 100;

    // 3. Category Breakdown
    const [categoryRows] = await pool.execute(
      `SELECT l.Lookup_Value as category, COUNT(DISTINCT cli.Complaint_ID) as count
       FROM Complaint_Line_Item cli
       JOIN Lookup_Master l ON cli.Complaint_Category_ID = l.Lookup_ID
       JOIN Complaint_Header c ON cli.Complaint_ID = c.Complaint_ID
       WHERE ${whereClause}
       GROUP BY cli.Complaint_Category_ID`,
      params
    );

    // 4. Plant/BU breakdown
    const [plantRows] = await pool.execute(
      `SELECT bu.Business_Unit_Name as plant, COUNT(*) as count
       FROM Complaint_Header c
       JOIN Business_Unit_Master bu ON c.Business_Unit_ID = bu.Business_Unit_ID
       WHERE ${whereClause}
       GROUP BY c.Business_Unit_ID`,
      params
    );

    // 5. Avg Resolution Time (for closed complaints, in days)
    const [avgResRows] = await pool.execute(
      `SELECT AVG(TIMESTAMPDIFF(HOUR, c.Complaint_Date, c.Closure_Date)) / 24 as avgDays
       FROM Complaint_Header c
       WHERE ${whereClause} AND c.Closure_Date IS NOT NULL`,
      params
    );

    const avgResolutionTimeDays = avgResRows[0]?.avgDays ? parseFloat(avgResRows[0].avgDays).toFixed(1) : 'N/A';

    // 6. Repeat-complaint customers (3+ complaints in last 90 days)
    // Only return for Admin/KAM
    let repeatCustomers = [];
    if (req.user.role !== 'Customer') {
      const [repRows] = await pool.execute(
        `SELECT c.Customer_ID, cust.Customer_Name, COUNT(*) as count 
         FROM Complaint_Header c 
         JOIN Customer_Master cust ON c.Customer_ID = cust.Customer_ID 
         WHERE c.Created_On >= DATE_SUB(NOW(), INTERVAL 90 DAY) AND c.Is_Active = TRUE
         GROUP BY c.Customer_ID 
         HAVING count >= 3`
      );
      repeatCustomers = repRows;
    }

    return sendSuccess(
      res,
      {
        statusBreakdown: statusRows,
        slaCompliancePct,
        categoryBreakdown: categoryRows,
        plantBreakdown: plantRows,
        avgResolutionTimeDays,
        repeatCustomers,
        totalComplaints: total
      },
      'Dashboard stats loaded.'
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Submit TS Review Action
 */
async function submitTsReview(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { 
      actionType, observation,
      visitRequired, recommendedAction, canCloseComplaint, remarks,
      // visit-schedule payload
      visitMembers,    // array of Employee_IDs (1-3)
      departureDate,   // shared departure datetime for all members
      returnDate,      // shared return datetime for all members
      // visit-complete payload
      findings, feedback, followUpRequired
    } = req.body;

    // 1. Fetch current claim header details
    const [headers] = await connection.execute(
      'SELECT Customer_ID, Business_Unit_ID, Current_Department_ID, Complaint_Status_ID, SLA_Paused, SLA_Pause_Reason FROM Complaint_Header WHERE Complaint_ID = ?',
      [id]
    );
    if (headers.length === 0) {
      await connection.rollback();
      return sendError(res, 'Complaint not found.', 404);
    }
    const header = headers[0];
    const buId = header.Business_Unit_ID;

    // Block progression if SLA is paused (except scheduling/updating the visit itself)
    if (header.SLA_Paused && actionType !== 'visit-schedule') {
      await connection.rollback();
      return sendError(res, `Action denied. SLA is paused (Reason: ${header.SLA_Pause_Reason || 'Pending task'}). Please complete visit remarks or register sample receipt before proceeding.`, 400);
    }

    // 2. Save or update Technical_Service_Details (no Clarification/Sample columns)
    const [existing] = await connection.execute('SELECT TS_Details_ID FROM Technical_Service_Details WHERE Complaint_ID = ?', [id]);
    if (existing.length > 0) {
      await connection.execute(
        `UPDATE Technical_Service_Details 
         SET Assigned_Engineer_ID = ?, Investigation_Date = NOW(), Technical_Observation = ?, 
             Visit_Required = ?, Recommended_Action = ?, Can_Close_Complaint = ?, 
             Remarks = ?, Updated_On = NOW(), Updated_By = ?
         WHERE Complaint_ID = ?`,
        [req.user.id, observation || '', visitRequired ? 1 : 0, recommendedAction || '', canCloseComplaint ? 1 : 0, remarks || '', req.user.id, id]
      );
    } else {
      await connection.execute(
        `INSERT INTO Technical_Service_Details (
           Complaint_ID, Assigned_Engineer_ID, Investigation_Date, Technical_Observation, 
           Visit_Required, Recommended_Action, Can_Close_Complaint, Remarks, Created_On, Created_By
         ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, NOW(), ?)`,
        [id, req.user.id, observation || '', visitRequired ? 1 : 0, recommendedAction || '', canCloseComplaint ? 1 : 0, remarks || '', req.user.id]
      );
    }

    // 3. Process action type state updates
    let nextStatusId = header.Complaint_Status_ID;
    let nextDeptId = header.Current_Department_ID;
    let nextAssigneeId = req.user.id;
    let actionTypeLookupId = 76; // Default 'Forwarded'
    let logRemarks = '';

    if (actionType === 'visit-schedule') {
      // Authorization: only TS Head or Admin may schedule
      if (!['TS Head', 'Administrator'].includes(req.user.role)) {
        await connection.rollback();
        return sendError(res, 'Only TS Head or Administrator can schedule a visit.', 403);
      }

      // Validate members
      const members = Array.isArray(visitMembers) ? visitMembers.filter(Boolean) : [];
      if (members.length < 1 || members.length > 3) {
        await connection.rollback();
        return sendError(res, 'Please select between 1 and 3 visit members.', 400);
      }
      if (!departureDate || !returnDate) {
        await connection.rollback();
        return sendError(res, 'Departure date and return date are required.', 400);
      }

      // Guard: 24-hour edit window — check if a visit was already scheduled more than 24h ago
      const [existingVisit] = await connection.execute(
        'SELECT Scheduled_At FROM Visit_Details WHERE Complaint_ID = ? AND Visit_Status_ID = 51 ORDER BY Scheduled_At DESC LIMIT 1',
        [id]
      );
      if (existingVisit.length > 0 && existingVisit[0].Scheduled_At) {
        const scheduledAt = new Date(existingVisit[0].Scheduled_At);
        const hoursSinceScheduled = (Date.now() - scheduledAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceScheduled > 24) {
          await connection.rollback();
          return sendError(res, 'The 24-hour edit window has passed. This visit schedule can no longer be modified.', 403);
        }
      }

      actionTypeLookupId = 75; // Assigned
      nextStatusId = 19;       // Visit Scheduled

      // Lookup KAM Employee_ID from the customer's KAM assignment
      const [kamLookup] = await connection.execute(
        `SELECT k.Employee_ID FROM Customer_Master c
         JOIN KAM_Master k ON c.KAM_ID = k.KAM_ID
         WHERE c.Customer_ID = ?`,
        [header.Customer_ID]
      );
      // KAM becomes the current assignee for coordination; department stays TS
      nextAssigneeId = kamLookup.length > 0 ? kamLookup[0].Employee_ID : req.user.id;
      logRemarks = `TS Head scheduled customer visit. Departure: ${departureDate}, Return: ${returnDate}. Members: ${members.length}. Assigned to KAM for coordination. Remarks: ${remarks || ''}`;

      // Replace Visit_Members for this complaint
      await connection.execute('DELETE FROM Visit_Members WHERE Complaint_ID = ?', [id]);
      for (const empId of members) {
        await connection.execute(
          'INSERT INTO Visit_Members (Complaint_ID, Employee_ID, Created_By) VALUES (?, ?, ?)',
          [id, empId, req.user.id]
        );
      }

      // Upsert Visit_Details with shared dates
      const [existingVD] = await connection.execute(
        'SELECT Visit_ID FROM Visit_Details WHERE Complaint_ID = ? AND Visit_Status_ID = 51',
        [id]
      );
      if (existingVD.length > 0) {
        await connection.execute(
          `UPDATE Visit_Details
           SET Visit_Date = ?, Departure_Date = ?, Return_Date = ?, Scheduled_At = NOW(),
               Remarks = ?, Updated_On = NOW(), Updated_By = ?
           WHERE Complaint_ID = ? AND Visit_Status_ID = 51`,
          [departureDate, departureDate, returnDate, remarks || '', req.user.id, id]
        );
      } else {
        await connection.execute(
          `INSERT INTO Visit_Details (
             Complaint_ID, Engineer_ID, Visit_Date, Departure_Date, Return_Date,
             Scheduled_At, Visit_Status_ID, Remarks, Created_On, Created_By
           ) VALUES (?, ?, ?, ?, ?, NOW(), 51, ?, NOW(), ?)`,
          [id, req.user.id, departureDate, departureDate, returnDate, remarks || '', req.user.id]
        );
      }

      // Pause SLA during scheduled visit
      await connection.execute(
        `UPDATE Complaint_Header 
         SET SLA_Paused = TRUE, SLA_Pause_Reason = 'Customer Visit Scheduled', SLA_Paused_At = NOW()
         WHERE Complaint_ID = ?`,
        [id]
      );

    } else if (actionType === 'forward') {
      actionTypeLookupId = 76; // Forwarded
      const next = await resolveNextStage(connection, 2, buId, header.Customer_ID);
      nextStatusId = next.statusId;
      nextDeptId = next.departmentId;
      nextAssigneeId = next.assigneeId;
      logRemarks = `Technical Service completed review. Forwarding to QC. Remarks: ${remarks || ''}`;

    } else if (actionType === 'close') {
      // TS Head / Admin can close the complaint directly
      if (!['TS Head', 'Administrator'].includes(req.user.role)) {
        await connection.rollback();
        return sendError(res, 'Only TS Head or Administrator can close a complaint from this stage.', 403);
      }
      actionTypeLookupId = 77; // Completed/Approved
      nextStatusId = 28;       // Closed
      nextDeptId = header.Current_Department_ID;
      nextAssigneeId = req.user.id;
      logRemarks = `Complaint closed by TS Head after visit review. Remarks: ${remarks || ''}`;
      await connection.execute(
        'UPDATE Complaint_Header SET Closure_Date = NOW() WHERE Complaint_ID = ?',
        [id]
      );
      // Mark visit as completed
      await connection.execute(
        `UPDATE Visit_Details SET Visit_Status_ID = 52, Updated_On = NOW(), Updated_By = ?
         WHERE Complaint_ID = ? AND Visit_Status_ID = 51`,
        [req.user.id, id]
      );

    } else {
      // Default: save state, stay in TS
      logRemarks = `TS review updated. Remarks: ${remarks || ''}`;
    }

    // Resolve next assignee name
    const resolvedName = await getAssigneeNameWithDesignation(connection, nextAssigneeId);
    if (nextAssigneeId && nextAssigneeId !== req.user.id) {
      logRemarks += ` (Assigned to: ${resolvedName})`;
    }

    // 4. Update Header status
    await connection.execute(
      'UPDATE Complaint_Header SET Complaint_Status_ID = ?, Current_Department_ID = ?, Current_Assignee_ID = ? WHERE Complaint_ID = ?',
      [nextStatusId, nextDeptId, nextAssigneeId, id]
    );

    // 5. Log workflow event
    const workflowConfigId = buId === 1 ? 1 : 8;
    await connection.execute(
      `INSERT INTO Complaint_Workflow_Log (
         Complaint_ID, Workflow_ID, Action_By, Action_Date, Action_Type_ID, 
         Previous_Department_ID, Current_Department_ID, Remarks, Created_On
       ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, NOW())`,
      [id, workflowConfigId, req.user.id, actionTypeLookupId, header.Current_Department_ID, nextDeptId, logRemarks]
    );

    await connection.commit();
    let successMsg = 'TS review updated successfully.';
    if (nextAssigneeId && nextAssigneeId !== req.user.id) {
      successMsg = `TS review action recorded. Assigned to: ${resolvedName}.`;
    }
    return sendSuccess(res, { nextAssigneeName: resolvedName }, successMsg);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * Get TS Review, Visit Details, and Visit Members for a claim
 */
async function getTsReviewDetails(req, res, next) {
  try {
    const { id } = req.params;
    const [tsRows] = await pool.execute('SELECT * FROM Technical_Service_Details WHERE Complaint_ID = ?', [id]);
    const [visitRows] = await pool.execute(
      `SELECT vd.*, 
              TIME_TO_SEC(TIMEDIFF(NOW(), vd.Scheduled_At)) / 3600 AS Hours_Since_Scheduled
       FROM Visit_Details vd
       WHERE vd.Complaint_ID = ? 
       ORDER BY vd.Visit_Date DESC`,
      [id]
    );
    // Fetch visit members with employee details + their submitted remarks
    const [memberRows] = await pool.execute(
      `SELECT vm.Visit_Member_ID, vm.Employee_ID, vm.Complaint_ID,
              vm.Remarks, vm.Submitted_At,
              em.Employee_Name, r.Role_Name, d.Department_Name
       FROM Visit_Members vm
       JOIN Employee_Master em ON vm.Employee_ID = em.Employee_ID
       LEFT JOIN Role_Master r ON em.Role_ID = r.Role_ID
       LEFT JOIN Department_Master d ON em.Department_ID = d.Department_ID
       WHERE vm.Complaint_ID = ?`,
      [id]
    );
    return sendSuccess(res, {
      tsDetails: tsRows[0] || null,
      visits: visitRows,
      visitMembers: memberRows
    }, 'TS Review details loaded.');
  } catch (err) {
    next(err);
  }
}

/**
 * Submit visit member field remarks (called by an assigned visit member employee)
 */
async function submitVisitMemberRemarks(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { remarks } = req.body;

    if (!remarks || !remarks.trim()) {
      await connection.rollback();
      return sendError(res, 'Remarks are required.', 400);
    }

    // Verify the logged-in user is actually a visit member for this complaint
    const [memberCheck] = await connection.execute(
      'SELECT Visit_Member_ID FROM Visit_Members WHERE Complaint_ID = ? AND Employee_ID = ?',
      [id, req.user.id]
    );
    if (memberCheck.length === 0) {
      await connection.rollback();
      return sendError(res, 'You are not assigned as a visit member for this complaint.', 403);
    }

    // Verify complaint is still in Visit Scheduled status (19)
    const [headerCheck] = await connection.execute(
      'SELECT Complaint_Status_ID, Current_Department_ID, Business_Unit_ID, Customer_ID, SLA_Due_Date, SLA_Paused_At FROM Complaint_Header WHERE Complaint_ID = ?',
      [id]
    );
    if (headerCheck.length === 0 || headerCheck[0].Complaint_Status_ID !== 19) {
      await connection.rollback();
      return sendError(res, 'Remarks can only be submitted while the visit is scheduled.', 400);
    }
    const header = headerCheck[0];

    // Save this member's remarks
    await connection.execute(
      'UPDATE Visit_Members SET Remarks = ?, Submitted_At = NOW() WHERE Complaint_ID = ? AND Employee_ID = ?',
      [remarks.trim(), id, req.user.id]
    );

    // Check if ALL members have now submitted
    const [pendingMembers] = await connection.execute(
      'SELECT COUNT(*) as pending FROM Visit_Members WHERE Complaint_ID = ? AND Submitted_At IS NULL',
      [id]
    );
    const allSubmitted = pendingMembers[0].pending === 0;

    let statusMsg = 'Visit remarks submitted. Waiting for other members to submit their remarks.';

    if (allSubmitted) {
      // All members submitted — return complaint to TS Head
      const buId = header.Business_Unit_ID;
      // Find the TS Head for this department
      const tsDeptId = header.Current_Department_ID; // stays in TS dept
      const tsHeadRoleId = 4; // TS Head role ID (Role_ID = 4 in Role_Master)
      const [tsHead] = await connection.execute(
        `SELECT Employee_ID FROM Employee_Master
         WHERE Role_ID = ? AND Department_ID = ? AND Is_Active = TRUE LIMIT 1`,
        [tsHeadRoleId, tsDeptId]
      );
      const tsHeadId = tsHead.length > 0 ? tsHead[0].Employee_ID : req.user.id;

      // Mark visit as completed
      await connection.execute(
        `UPDATE Visit_Details SET Visit_Status_ID = 52, Updated_On = NOW(), Updated_By = ?
         WHERE Complaint_ID = ? AND Visit_Status_ID = 51`,
        [req.user.id, id]
      );

      // Return complaint to TS Head
      await connection.execute(
        'UPDATE Complaint_Header SET Complaint_Status_ID = 18, Current_Assignee_ID = ? WHERE Complaint_ID = ?',
        [tsHeadId, id]
      );

      // Resume SLA: calculate paused duration and extend SLA_Due_Date
      let newSlaDueDate = new Date(header.SLA_Due_Date);
      if (header.SLA_Paused_At) {
        const pausedTimeMs = Date.now() - new Date(header.SLA_Paused_At).getTime();
        newSlaDueDate = new Date(newSlaDueDate.getTime() + pausedTimeMs);
      } else {
        newSlaDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      }

      await connection.execute(
        `UPDATE Complaint_Header 
         SET SLA_Paused = FALSE, SLA_Pause_Reason = NULL, SLA_Paused_At = NULL, SLA_Due_Date = ?
         WHERE Complaint_ID = ?`,
        [newSlaDueDate, id]
      );

      // Log the transition
      const workflowConfigId = buId === 1 ? 1 : 8;
      await connection.execute(
        `INSERT INTO Complaint_Workflow_Log (
           Complaint_ID, Workflow_ID, Action_By, Action_Date, Action_Type_ID,
           Previous_Department_ID, Current_Department_ID, Remarks, Created_On
         ) VALUES (?, ?, ?, NOW(), 77, ?, ?, ?, NOW())`,
        [id, workflowConfigId, req.user.id, tsDeptId, tsDeptId,
         `All visit members submitted field remarks. Complaint returned to TS Head for closure decision.`]
      );

      statusMsg = 'All visit members have submitted remarks. Complaint returned to TS for closure.';
    } else {
      // Log partial submission
      const workflowConfigId = header.Business_Unit_ID === 1 ? 1 : 8;
      await connection.execute(
        `INSERT INTO Complaint_Workflow_Log (
           Complaint_ID, Workflow_ID, Action_By, Action_Date, Action_Type_ID,
           Previous_Department_ID, Current_Department_ID, Remarks, Created_On
         ) VALUES (?, ?, ?, NOW(), 76, ?, ?, ?, NOW())`,
        [id, workflowConfigId, req.user.id, header.Current_Department_ID, header.Current_Department_ID,
         `Visit member ${req.user.name || req.user.id} submitted field remarks. Awaiting remaining members.`]
      );
    }

    await connection.commit();
    return sendSuccess(res, { allSubmitted }, statusMsg);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * Submit QC Review Action
 */
async function submitQcReview(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { 
      actionType, sampleVerified, observation, recommendation, remarks,
      sampleContactEmployeeId,
      sampleRequestDate, sampleDispatchedDate, sampleReceivedDate, courierDetails, sampleCondition,
      imageResponses
    } = req.body;

    // 1. Fetch current claim header details
    const [headers] = await connection.execute(
      'SELECT Customer_ID, Business_Unit_ID, Current_Department_ID, Complaint_Status_ID, SLA_Paused, SLA_Pause_Reason FROM Complaint_Header WHERE Complaint_ID = ?',
      [id]
    );
    if (headers.length === 0) {
      await connection.rollback();
      return sendError(res, 'Complaint not found.', 404);
    }
    const header = headers[0];
    const buId = header.Business_Unit_ID;

    // Block progression if SLA is paused and the action is not meant to request or receive samples
    if (header.SLA_Paused) {
      const allowedActions = ['sample-receive', 'confirm-sample-received', 'sample-request'];
      if (!allowedActions.includes(actionType)) {
        await connection.rollback();
        return sendError(res, `Action denied. SLA is paused (Reason: ${header.SLA_Pause_Reason || 'Pending task'}). Please register sample receipt before proceeding.`, 400);
      }
    }

    // 2. Save or update Quality_Control_Details
    let qcDetailsId;
    const [existing] = await connection.execute('SELECT QC_Details_ID FROM Quality_Control_Details WHERE Complaint_ID = ?', [id]);
    if (existing.length > 0) {
      qcDetailsId = existing[0].QC_Details_ID;
      await connection.execute(
        `UPDATE Quality_Control_Details 
         SET QC_Engineer_ID = ?, Inspection_Date = NOW(), Sample_Verified = ?, 
             QC_Observation = ?, QC_Recommendation = ?, Remarks = ?, Updated_On = NOW(), Updated_By = ?
         WHERE Complaint_ID = ?`,
        [req.user.id, sampleVerified ? 1 : 0, observation || '', recommendation || '', remarks || '', req.user.id, id]
      );
    } else {
      const [insertResult] = await connection.execute(
        `INSERT INTO Quality_Control_Details (
           Complaint_ID, QC_Engineer_ID, Inspection_Date, Sample_Verified, 
           QC_Observation, QC_Recommendation, Remarks, Created_On, Created_By
         ) VALUES (?, ?, NOW(), ?, ?, ?, ?, NOW(), ?)`,
        [id, req.user.id, sampleVerified ? 1 : 0, observation || '', recommendation || '', remarks || '', req.user.id]
      );
      qcDetailsId = insertResult.insertId;
    }

    // Process imageResponses if provided
    if (imageResponses && Array.isArray(imageResponses) && imageResponses.length > 0) {
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(__dirname, '..', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      for (const resp of imageResponses) {
        let replyPath = null;
        if (resp.replyImage && resp.replyImage.content) {
          const uniqueFileName = `reply_${Date.now()}_${resp.replyImage.fileName.replace(/\s+/g, '_')}`;
          const filePath = path.join(uploadsDir, uniqueFileName);
          replyPath = `uploads/${uniqueFileName}`;

          const base64Data = resp.replyImage.content.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(filePath, buffer);
        }

        // Insert or update response
        const [existingResp] = await connection.execute(
          'SELECT QC_Response_ID FROM QC_Attachment_Response WHERE QC_Details_ID = ? AND Attachment_ID = ?',
          [qcDetailsId, resp.attachmentId]
        );
        if (existingResp.length > 0) {
          await connection.execute(
            `UPDATE QC_Attachment_Response 
             SET QC_Remarks = ?, Reply_File_Path = COALESCE(?, Reply_File_Path)
             WHERE QC_Response_ID = ?`,
            [resp.qcRemarks || '', replyPath, existingResp[0].QC_Response_ID]
          );
        } else {
          await connection.execute(
            `INSERT INTO QC_Attachment_Response (QC_Details_ID, Attachment_ID, QC_Remarks, Reply_File_Path)
             VALUES (?, ?, ?, ?)`,
            [qcDetailsId, resp.attachmentId, resp.qcRemarks || '', replyPath]
          );
        }
      }
    }

    // 3. Process action type state updates
    let nextStatusId = header.Complaint_Status_ID;
    let nextDeptId = header.Current_Department_ID;
    let nextAssigneeId = req.user.id;
    let actionTypeLookupId = 76; // Forwarded
    let logRemarks = '';
    let updateSlaQuery = '';
    let updateSlaParams = [];

    if (actionType === 'sample-request') {
      actionTypeLookupId = 79; // Clarification / Sample Request
      nextStatusId = 20; // Waiting Sample
      logRemarks = `QC requested physical sample. Remarks: ${remarks || ''}`;

      // Insert Sample_Tracking with responsible contact employee
      await connection.execute(
        `INSERT INTO Sample_Tracking (
           Complaint_ID, Sample_Request_Date, Contact_Employee_ID, Sample_Status_ID, Courier_Details, Remarks, Created_On, Created_By
         ) VALUES (?, ?, ?, 54, ?, ?, NOW(), ?)`,
        [id, sampleRequestDate || new Date(), sampleContactEmployeeId || null, courierDetails || '', remarks || '', req.user.id]
      );

      // Pause SLA
      updateSlaQuery = `UPDATE Complaint_Header 
                        SET SLA_Paused = TRUE, SLA_Pause_Reason = 'Waiting for Customer Sample', SLA_Paused_At = NOW()
                        WHERE Complaint_ID = ?`;
      updateSlaParams = [id];
    } else if (actionType === 'sample-receive') {
      actionTypeLookupId = 77; // Approved/Received
      nextStatusId = 21; // Under QC Review
      logRemarks = `QC received customer sample. Condition: ${sampleCondition || 'Good'}`;

      // Update Sample_Tracking
      await connection.execute(
        `UPDATE Sample_Tracking 
         SET Sample_Dispatched_Date = ?, Sample_Received_Date = ?, Sample_Status_ID = 56, 
             Received_By = ?, Sample_Condition = ?, Remarks = ?, Updated_On = NOW(), Updated_By = ?
         WHERE Complaint_ID = ? AND Sample_Status_ID = 54`,
        [sampleDispatchedDate || null, sampleReceivedDate || new Date(), req.user.id, sampleCondition || '', remarks || '', req.user.id, id]
      );

      // Reset SLA to exactly 3 days from now
      const newSlaDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      updateSlaQuery = `UPDATE Complaint_Header 
                        SET SLA_Paused = FALSE, SLA_Pause_Reason = NULL, SLA_Paused_At = NULL, SLA_Due_Date = ?
                        WHERE Complaint_ID = ?`;
      updateSlaParams = [newSlaDueDate, id];
    } else if (actionType === 'confirm-sample-received') {
      const isAuthorized = ['Administrator', 'QC Head'].includes(req.user.role);
      if (!isAuthorized) {
        await connection.rollback();
        return sendError(res, 'Only Department Head or Admin can confirm overdue samples.', 403);
      }

      actionTypeLookupId = 77; // Approved/Received
      nextStatusId = 21; // Under QC Review
      logRemarks = `QC Head confirmed sample received on ${sampleReceivedDate || new Date()}. Condition: ${sampleCondition || 'Good'}`;

      // Update Sample_Tracking
      await connection.execute(
        `UPDATE Sample_Tracking 
         SET Sample_Dispatched_Date = ?, Sample_Received_Date = ?, Sample_Status_ID = 56, 
             Received_By = ?, Sample_Condition = ?, Remarks = ?, Updated_On = NOW(), Updated_By = ?
         WHERE Complaint_ID = ? AND Sample_Status_ID = 54`,
        [sampleDispatchedDate || null, sampleReceivedDate || new Date(), req.user.id, sampleCondition || '', remarks || '', req.user.id, id]
      );

      // Reset SLA to exactly 3 days from specified sampleReceivedDate
      const rcvDate = new Date(sampleReceivedDate || Date.now());
      const newSlaDueDate = new Date(rcvDate.getTime() + 3 * 24 * 60 * 60 * 1000);

      updateSlaQuery = `UPDATE Complaint_Header 
                        SET SLA_Paused = FALSE, SLA_Pause_Reason = NULL, SLA_Paused_At = NULL, SLA_Due_Date = ?
                        WHERE Complaint_ID = ?`;
      updateSlaParams = [newSlaDueDate, id];
    } else if (actionType === 'forward') {
      actionTypeLookupId = 76; // Forwarded
      const next = await resolveNextStage(connection, 3, buId, header.Customer_ID);
      nextStatusId = next.statusId;
      nextDeptId = next.departmentId;
      nextAssigneeId = next.assigneeId;
      logRemarks = `Quality Control completed analysis. Forwarding to QC Head for verification. Remarks: ${remarks || ''}`;
    }

    // Resolve next assignee name
    const resolvedName = await getAssigneeNameWithDesignation(connection, nextAssigneeId);
    if (nextAssigneeId && nextAssigneeId !== req.user.id) {
      logRemarks += ` (Assigned to: ${resolvedName})`;
    }

    // 4. Update Header status
    await connection.execute(
      'UPDATE Complaint_Header SET Complaint_Status_ID = ?, Current_Department_ID = ?, Current_Assignee_ID = ? WHERE Complaint_ID = ?',
      [nextStatusId, nextDeptId, nextAssigneeId, id]
    );

    // Update SLA query if set
    if (updateSlaQuery) {
      await connection.execute(updateSlaQuery, updateSlaParams);
    }

    // 5. Log workflow event
    const workflowConfigId = buId === 1 ? 2 : 9; // Stage 2 config ID
    await connection.execute(
      `INSERT INTO Complaint_Workflow_Log (
         Complaint_ID, Workflow_ID, Action_By, Action_Date, Action_Type_ID, 
         Previous_Department_ID, Current_Department_ID, Remarks, Created_On
       ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, NOW())`,
      [id, workflowConfigId, req.user.id, actionTypeLookupId, header.Current_Department_ID, nextDeptId, logRemarks]
    );

    await connection.commit();
    let successMsg = 'QC review updated successfully.';
    if (nextAssigneeId && nextAssigneeId !== req.user.id) {
      successMsg = `QC review action recorded. Assigned to: ${resolvedName}.`;
    }
    return sendSuccess(res, { nextAssigneeName: resolvedName }, successMsg);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * Get QC Review and Sample Tracking details
 */
async function getQcReviewDetails(req, res, next) {
  try {
    const { id } = req.params;
    const [qcRows] = await pool.execute('SELECT * FROM Quality_Control_Details WHERE Complaint_ID = ?', [id]);
    const [sampleRows] = await pool.execute('SELECT * FROM Sample_Tracking WHERE Complaint_ID = ? ORDER BY Sample_Request_Date DESC', [id]);
    
    let responses = [];
    if (qcRows.length > 0) {
      [responses] = await pool.execute(
        `SELECT qr.*, am.File_Path as Original_File_Path, am.File_Name as Original_File_Name
         FROM QC_Attachment_Response qr
         JOIN Attachment_Master am ON qr.Attachment_ID = am.Attachment_ID
         WHERE qr.QC_Details_ID = ?`,
        [qcRows[0].QC_Details_ID]
      );
    }

    return sendSuccess(res, { 
      qcDetails: qcRows[0] || null, 
      samples: sampleRows,
      imageResponses: responses
    }, 'QC Review details loaded.');
  } catch (err) {
    next(err);
  }
}

/**
 * Log CAPA details for a complaint
 */
async function submitCapa(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { rootCause, correctiveAction, preventiveAction, responsibleEmployeeId, targetCompletionDate, remarks } = req.body;

    // Verify claim exists
    const [complaints] = await connection.execute('SELECT Business_Unit_ID, SLA_Paused, SLA_Pause_Reason FROM Complaint_Header WHERE Complaint_ID = ?', [id]);
    if (complaints.length === 0) {
      await connection.rollback();
      return sendError(res, 'Complaint not found.', 404);
    }
    if (complaints[0].SLA_Paused) {
      await connection.rollback();
      return sendError(res, `Action denied. SLA is paused (Reason: ${complaints[0].SLA_Pause_Reason || 'Pending task'}).`, 400);
    }

    const [existing] = await connection.execute('SELECT CAPA_ID FROM CAPA_Analysis WHERE Complaint_ID = ?', [id]);
    if (existing.length > 0) {
      await connection.execute(
        `UPDATE CAPA_Analysis 
         SET Root_Cause_Analysis = ?, Corrective_Action = ?, Preventive_Action = ?, 
             Responsible_Employee_ID = ?, Target_Completion_Date = ?, Remarks = ?, Updated_On = NOW(), Updated_By = ?
         WHERE Complaint_ID = ?`,
        [rootCause || '', correctiveAction || '', preventiveAction || '', responsibleEmployeeId || req.user.id, targetCompletionDate || null, remarks || '', req.user.id, id]
      );
    } else {
      await connection.execute(
        `INSERT INTO CAPA_Analysis (
           Complaint_ID, Root_Cause_Analysis, Corrective_Action, Preventive_Action, 
           Responsible_Employee_ID, Target_Completion_Date, Remarks, Created_On, Created_By
         ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [id, rootCause || '', correctiveAction || '', preventiveAction || '', responsibleEmployeeId || req.user.id, targetCompletionDate || null, remarks || '', req.user.id]
      );
    }

    // Update status to CAPA Pending (22) if not already, then transition dynamically to Stage 6 (Ops Head Approval)
    const [headerRows] = await connection.execute('SELECT Customer_ID, Business_Unit_ID, Current_Department_ID FROM Complaint_Header WHERE Complaint_ID = ?', [id]);
    const header = headerRows[0];
    const next = await resolveNextStage(connection, 5, header.Business_Unit_ID, header.Customer_ID);

    let resolvedName = 'Unassigned';
    let logRemarks = `CAPA logged by Operations Engineer. Forwarded to Operations Head for approval. Remarks: ${remarks || ''}`;
    if (next) {
      resolvedName = await getAssigneeNameWithDesignation(connection, next.assigneeId);
      logRemarks += ` (Assigned to: ${resolvedName})`;
      
      await connection.execute(
        'UPDATE Complaint_Header SET Complaint_Status_ID = ?, Current_Department_ID = ?, Current_Assignee_ID = ? WHERE Complaint_ID = ?',
        [next.statusId, next.departmentId, next.assigneeId, id]
      );

      // Log the transition in timeline
      await connection.execute(
        `INSERT INTO Complaint_Workflow_Log (
           Complaint_ID, Workflow_ID, Action_By, Action_Date, Action_Type_ID, 
           Previous_Department_ID, Current_Department_ID, Remarks, Created_On
         ) VALUES (?, ?, ?, NOW(), 76, ?, ?, ?, NOW())`,
        [id, header.Business_Unit_ID === 1 ? 5 : 16, req.user.id, header.Current_Department_ID, next.departmentId, logRemarks]
      );
    }

    await connection.commit();
    let successMsg = 'CAPA details recorded successfully.';
    if (next && next.assigneeId && next.assigneeId !== req.user.id) {
      successMsg = `CAPA details saved successfully. Assigned to: ${resolvedName}.`;
    }
    return sendSuccess(res, { nextAssigneeName: resolvedName }, successMsg);
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * Get CAPA details for a complaint
 */
async function getCapaDetails(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT ca.*, e.Employee_Name as Responsible_Employee 
       FROM CAPA_Analysis ca 
       LEFT JOIN Employee_Master e ON ca.Responsible_Employee_ID = e.Employee_ID 
       WHERE ca.Complaint_ID = ?`,
      [id]
    );
    return sendSuccess(res, rows[0] || null, 'CAPA details loaded.');
  } catch (err) {
    next(err);
  }
}

/**
 * Approve a complaint stage (Ops Head, Marketing PM, Marketing Head, MD)
 */
async function approveStage(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { stage, remarks, settlementAmount, severityId } = req.body;

    const allowedRoles = {
      'kam': ['KAM', 'Administrator'],
      'qc-head': ['QC Head', 'Administrator'],
      'ops-head': ['Operations Head', 'Administrator'],
      'marketing-pm': ['Marketing Head', 'Marketing Executive', 'Administrator'],
      'marketing-head': ['Marketing Head', 'Administrator'],
      'md': ['Managing Director', 'Administrator'],
      'finance-head': ['Finance Head', 'Administrator']
    };

    if (allowedRoles[stage] && !allowedRoles[stage].includes(req.user.role)) {
      await connection.rollback();
      return sendError(res, `Unauthorized: Your role '${req.user.role}' is not allowed to approve stage '${stage}'.`, 403);
    }

    const [headers] = await connection.execute(
      'SELECT Customer_ID, Business_Unit_ID, Current_Department_ID, Complaint_Status_ID, Expected_Settlement_Amount, Total_Complaint_Value, Complaint_Date, SLA_Paused, SLA_Pause_Reason FROM Complaint_Header WHERE Complaint_ID = ?',
      [id]
    );
    if (headers.length === 0) {
      await connection.rollback();
      return sendError(res, 'Complaint not found.', 404);
    }
    const header = headers[0];
    const buId = header.Business_Unit_ID;

    if (header.SLA_Paused) {
      await connection.rollback();
      return sendError(res, `Action denied. SLA is paused (Reason: ${header.SLA_Pause_Reason || 'Pending task'}).`, 400);
    }

    let nextStatusId = header.Complaint_Status_ID;
    let nextDeptId = header.Current_Department_ID;
    let nextAssigneeId = req.user.id;
    let actionTypeLookupId = 77; // Approved
    let logRemarks = '';

    const statusToStage = {
      17: 1, // Submitted
      18: 2, // Under TS Review
      19: 2, // Visit Scheduled
      21: 3, // Under QC Review
      20: 3, // Waiting Sample
      84: 4, // QC Head Pending
      22: 5, // CAPA Pending
      23: 6, // Ops Head Approval
      24: 7, // Marketing Review
      25: 8, // Marketing Head Approval
      26: 9, // MD Approval
      27: 10, // Finance Pending
      83: 11  // Credit Note Pending
    };

    const currentStageNumber = statusToStage[header.Complaint_Status_ID] || 1;

    if (stage === 'kam') {
      const next = await resolveNextStage(connection, 1, buId, header.Customer_ID);
      nextStatusId = next.statusId;
      nextDeptId = next.departmentId;
      nextAssigneeId = next.assigneeId;

      let severityRemarks = '';
      if (severityId) {
        let slaHours = 336; // Default Low
        if (parseInt(severityId) === 34) slaHours = 24; // Critical
        else if (parseInt(severityId) === 33) slaHours = 72; // High
        else if (parseInt(severityId) === 32) slaHours = 168; // Medium

        const originalDate = new Date(header.Complaint_Date);
        const newSlaDueDate = new Date(originalDate.getTime() + slaHours * 60 * 60 * 1000);

        await connection.execute(
          'UPDATE Complaint_Header SET Priority_ID = ?, SLA_Due_Date = ? WHERE Complaint_ID = ?',
          [severityId, newSlaDueDate, id]
        );

        // Fetch severity text for logging
        const [sevRows] = await connection.execute(
          'SELECT Lookup_Value FROM Lookup_Master WHERE Lookup_ID = ?',
          [severityId]
        );
        const severityName = sevRows.length > 0 ? sevRows[0].Lookup_Value : severityId;
        severityRemarks = ` [Severity updated to ${severityName}]`;
      }

      logRemarks = `KAM approved complaint intake.${severityRemarks} Forwarded to Technical Services. Remarks: ${remarks || ''}`;
    }
    else if (stage === 'qc-head') {
      const next = await resolveNextStage(connection, 4, buId, header.Customer_ID);
      nextStatusId = next.statusId;
      nextDeptId = next.departmentId;
      nextAssigneeId = next.assigneeId;
      logRemarks = `QC Head approved and verified test observations. Forwarding to Operations. Remarks: ${remarks || ''}`;
    }
    else if (stage === 'ops-head') {
      // 1. Verify CAPA exists with root cause & corrective action filled
      const [capa] = await connection.execute('SELECT Root_Cause_Analysis, Corrective_Action FROM CAPA_Analysis WHERE Complaint_ID = ?', [id]);
      if (capa.length === 0 || !capa[0].Root_Cause_Analysis || !capa[0].Corrective_Action) {
        await connection.rollback();
        return sendError(res, 'CAPA record must have root cause and corrective action filled in before approval.', 400);
      }

      const next = await resolveNextStage(connection, 6, buId, header.Customer_ID);
      nextStatusId = next.statusId;
      nextDeptId = next.departmentId;
      nextAssigneeId = next.assigneeId;
      logRemarks = `CAPA approved by Operations Head. Forwarded to Marketing PM. Remarks: ${remarks || ''}`;
    } 
    else if (stage === 'marketing-pm') {
      const next = await resolveNextStage(connection, 7, buId, header.Customer_ID);
      nextStatusId = next.statusId;
      nextDeptId = next.departmentId;
      nextAssigneeId = next.assigneeId;
      logRemarks = `Reviewed by Marketing PM. Forwarded to Marketing Head for approval. Remarks: ${remarks || ''}`;
    } 
    else if (stage === 'marketing-head') {
      let finalSettlementAmount = header.Expected_Settlement_Amount;
      let auditTrail = '';
      if (settlementAmount !== undefined) {
        finalSettlementAmount = parseFloat(settlementAmount);
        const oldAmount = header.Expected_Settlement_Amount !== null ? parseFloat(header.Expected_Settlement_Amount) : null;
        if (oldAmount !== null && oldAmount !== finalSettlementAmount) {
          auditTrail = ` [AUDIT: Settlement amount overridden from ₹${oldAmount} to ₹${finalSettlementAmount} by Admin/Reviewer]`;
        }
        await connection.execute(
          'UPDATE Complaint_Header SET Expected_Settlement_Amount = ? WHERE Complaint_ID = ?',
          [finalSettlementAmount, id]
        );
      }

      const settlementValue = finalSettlementAmount !== null ? finalSettlementAmount : parseFloat(header.Total_Complaint_Value);

      // Query MD approval limit dynamically from configuration
      let mdApprovalLimit = 100000;
      const [limitConfig] = await connection.execute(
        `SELECT Configuration_Value FROM System_Configuration WHERE Configuration_Key = 'MD_APPROVAL_LIMIT'`
      );
      if (limitConfig.length > 0) {
        mdApprovalLimit = parseFloat(limitConfig[0].Configuration_Value);
      }

      if (settlementValue > mdApprovalLimit) {
        // Escalate to MD Approval (Stage 9)
        const next = await resolveNextStage(connection, 8, buId, header.Customer_ID);
        nextStatusId = next.statusId;
        nextDeptId = next.departmentId;
        nextAssigneeId = next.assigneeId;
        logRemarks = `Approved by Marketing Head. Escalated to MD for settlement > ₹${mdApprovalLimit.toLocaleString('en-IN')}. Remarks: ${remarks || ''}${auditTrail}`;
      } else {
        // Skip MD and go straight to Finance Head Approval (Stage 10)
        const next = await resolveNextStage(connection, 9, buId, header.Customer_ID);
        nextStatusId = next.statusId;
        nextDeptId = next.departmentId;
        nextAssigneeId = next.assigneeId;
        logRemarks = `Approved by Marketing Head. Sent to Finance Head. Remarks: ${remarks || ''}${auditTrail}`;
      }
    } 
    else if (stage === 'md') {
      // Go to Finance Head Approval (Stage 10)
      const next = await resolveNextStage(connection, 9, buId, header.Customer_ID);
      nextStatusId = next.statusId;
      nextDeptId = next.departmentId;
      nextAssigneeId = next.assigneeId;
      logRemarks = `Approved by Managing Director. Sent to Finance Head. Remarks: ${remarks || ''}`;
    }
    else if (stage === 'finance-head') {
      nextStatusId = 28; // Closed
      nextDeptId = header.Current_Department_ID;
      nextAssigneeId = null;
      logRemarks = `Finance Head approved and signed off. Credit note successfully issued. Complaint Closed. Remarks: ${remarks || ''}`;

      await connection.execute(
        `UPDATE Complaint_Header 
         SET Closure_Date = NOW(), Closure_Remarks = ?
         WHERE Complaint_ID = ?`,
        [remarks || 'Approved by Finance Head', id]
      );

      await connection.execute(
        `UPDATE Credit_Note SET SAP_Sync_Status_ID = 66, Updated_On = NOW(), Updated_By = ? WHERE Complaint_ID = ?`,
        [req.user.id, id]
      );

      actionTypeLookupId = 28; // Closed
    }

    // If transitioning to Finance Pending (27), write settlement details
    if (nextStatusId === 27) {
      const finalSettlementAmount = stage === 'marketing-head' ? parseFloat(settlementAmount) : header.Expected_Settlement_Amount;
      const settlementValue = finalSettlementAmount !== null ? finalSettlementAmount : parseFloat(header.Total_Complaint_Value);

      const [existingSet] = await connection.execute('SELECT Settlement_ID FROM Settlement_Details WHERE Complaint_ID = ?', [id]);
      if (existingSet.length > 0) {
        await connection.execute(
          `UPDATE Settlement_Details 
           SET Settlement_Type_ID = 59, Proposed_Amount = ?, Approved_Amount = ?, Approval_Status_ID = 77, Approved_By = ?, Approval_Date = NOW(), Updated_On = NOW(), Updated_By = ?
           WHERE Settlement_ID = ?`,
          [parseFloat(header.Total_Complaint_Value), settlementValue, req.user.id, req.user.id, existingSet[0].Settlement_ID]
        );
      } else {
        await connection.execute(
          `INSERT INTO Settlement_Details (
             Complaint_ID, Settlement_Type_ID, Proposed_Amount, Approved_Amount, Approval_Status_ID, Approved_By, Approval_Date, Created_On, Created_By
           ) VALUES (?, 59, ?, ?, 77, ?, NOW(), NOW(), ?)`,
          [id, parseFloat(header.Total_Complaint_Value), settlementValue, req.user.id, req.user.id]
        );
      }
    }

    // Update claim header
    await connection.execute(
      'UPDATE Complaint_Header SET Complaint_Status_ID = ?, Current_Department_ID = ?, Current_Assignee_ID = ? WHERE Complaint_ID = ?',
      [nextStatusId, nextDeptId, nextAssigneeId, id]
    );

    if (nextAssigneeId) {
      const resolvedName = await getAssigneeNameWithDesignation(connection, nextAssigneeId);
      logRemarks += ` (Assigned to: ${resolvedName})`;
    }

    // Resolve timeline Workflow_ID dynamically based on currentStageNumber
    const [wfRows] = await connection.execute(
      'SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID = ? AND Stage_Number = ?',
      [buId, currentStageNumber]
    );
    const stageConfigId = wfRows.length > 0 ? wfRows[0].Workflow_ID : (buId === 1 ? 1 : 12);

    await connection.execute(
      `INSERT INTO Complaint_Workflow_Log (
         Complaint_ID, Workflow_ID, Action_By, Action_Date, Action_Type_ID, 
         Previous_Department_ID, Current_Department_ID, Remarks, Created_On
       ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, NOW())`,
      [id, stageConfigId, req.user.id, actionTypeLookupId, header.Current_Department_ID, nextDeptId, logRemarks]
    );

    await connection.commit();
    return sendSuccess(res, null, 'Stage approved successfully.');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * Handle timeline action: Rejection, Review Request, Clarification
 */
async function timelineAction(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { action, remarks } = req.body; // 'reject', 'review-request', 'clarify'

    const [headers] = await connection.execute(
      'SELECT Customer_ID, Business_Unit_ID, Current_Department_ID, Complaint_Status_ID, Expected_Settlement_Amount, Total_Complaint_Value, SLA_Paused, SLA_Pause_Reason FROM Complaint_Header WHERE Complaint_ID = ?',
      [id]
    );
    if (headers.length === 0) {
      await connection.rollback();
      return sendError(res, 'Complaint not found.', 404);
    }
    const header = headers[0];
    const buId = header.Business_Unit_ID;

    if (header.SLA_Paused) {
      await connection.rollback();
      return sendError(res, `Action denied. SLA is paused (Reason: ${header.SLA_Pause_Reason || 'Pending task'}).`, 400);
    }

    if (header.Complaint_Status_ID === 17 && action !== 'clarify') {
      await connection.rollback();
      return sendError(res, 'For complaints in Submitted status, you can only seek clarifications.', 400);
    }

    let nextStatusId = header.Complaint_Status_ID;
    let nextDeptId = header.Current_Department_ID;
    let nextAssigneeId = req.user.id;
    let actionTypeLookupId = 78; // Default 'Rejected'
    let logRemarks = '';

    if (action === 'clarify') {
      actionTypeLookupId = 79; // Clarification Requested
      logRemarks = `Reviewer sought clarifications: ${remarks || ''}`;
      // Stays in same department and status, but log recorded
    } 
    else if (action === 'reopen') {
      // Role check: Only KAMs and Administrators can reopen complaints
      if (!['Administrator', 'KAM'].includes(req.user.role)) {
        await connection.rollback();
        return sendError(res, 'Unauthorized: Only KAMs and Administrators can reopen closed complaints.', 403);
      }

      // 1. Verify complaint is Closed (28)
      if (header.Complaint_Status_ID !== 28) {
        await connection.rollback();
        return sendError(res, 'Only closed complaints can be reopened.', 400);
      }
      // 2. Resolve dynamic reopen limit (with customer-specific override check)
      const [customerOverride] = await connection.execute(
        `SELECT c.Reopen_Limit_Days 
         FROM Customer_Master c 
         JOIN Complaint_Header ch ON c.Customer_ID = ch.Customer_ID 
         WHERE ch.Complaint_ID = ?`,
        [id]
      );
      
      let reopenLimitDays = 7; // Default fallback
      if (customerOverride.length > 0 && customerOverride[0].Reopen_Limit_Days !== null) {
        reopenLimitDays = parseInt(customerOverride[0].Reopen_Limit_Days, 10);
      } else {
        const [sysConfig] = await connection.execute(
          `SELECT Configuration_Value FROM System_Configuration WHERE Configuration_Key = 'REOPEN_LIMIT_DAYS'`
        );
        if (sysConfig.length > 0) {
          reopenLimitDays = parseInt(sysConfig[0].Configuration_Value, 10);
        }
      }

      // 3. Verify closing date is within resolved reopen limit days
      const [closedLog] = await connection.execute(
        `SELECT Action_Date FROM Complaint_Workflow_Log 
         WHERE Complaint_ID = ? AND Action_Type_ID = 28 
         ORDER BY Action_Date DESC LIMIT 1`,
        [id]
      );
      if (closedLog.length > 0) {
        const closedDate = new Date(closedLog[0].Action_Date);
        const diffDays = (new Date() - closedDate) / (1000 * 60 * 60 * 24);
        if (diffDays > reopenLimitDays) {
          await connection.rollback();
          return sendError(res, `Complaints can only be reopened within ${reopenLimitDays} days of closure.`, 400);
        }
      }

      // Resolve target stage dynamically (defaults to stage 2 TS Review)
      const targetStage = parseInt(req.body.targetStageId, 10) || 2;
      const [wfConfig] = await connection.execute(
        'SELECT * FROM Workflow_Configuration WHERE Business_Unit_ID = ? AND Stage_Number = ?',
        [buId, targetStage]
      );

      if (wfConfig.length === 0) {
        await connection.rollback();
        return sendError(res, `Invalid target stage: ${targetStage}`, 400);
      }

      const stage = wfConfig[0];
      const stageToStatus = {
        1: 17, // KAM Verification Pending
        2: 18, // TS Review
        3: 21, // QC Review
        4: 84, // QC Head Pending
        5: 22, // CAPA Pending
        6: 23, // Ops Head Pending
        7: 24, // Marketing Review Pending
        8: 25, // Marketing Head Pending
        9: 26, // MD Approval Pending
        10: 27, // Finance Credit Note Preparing
        11: 83  // Finance Head Approval
      };

      nextStatusId = stageToStatus[targetStage] || 18;
      nextDeptId = stage.Department_ID;
      nextAssigneeId = await getAssignedEmployeeForDept(connection, header.Customer_ID, nextDeptId, stage.Default_Role_ID, buId);

      logRemarks = `Complaint reopened. Reverted to ${stage.Stage_Name}. Remarks: ${remarks || ''}`;
      actionTypeLookupId = 75; // Assigned / Reopened
    } 
    else {
      const currentStatus = header.Complaint_Status_ID;

      if (action === 'reject') {
        // Rejection: Go directly back to KAM and close as Rejected (29)
        actionTypeLookupId = 78; // Rejected
        nextStatusId = 29; // Rejected
        nextDeptId = buId === 1 ? 6 : 12; // Admin Dept

        // Resolve segment KAM
        const [segmentKam] = await connection.execute(
          `SELECT ksa.KAM_ID, k.Employee_ID 
           FROM Customer_KAM_Segment_Assignment ksa
           JOIN KAM_Master k ON ksa.KAM_ID = k.KAM_ID
           WHERE ksa.Customer_ID = ? AND ksa.Business_Unit_ID = ? AND ksa.Is_Active = TRUE`,
          [header.Customer_ID, buId]
        );
        if (segmentKam.length > 0) {
          nextAssigneeId = segmentKam[0].Employee_ID;
        } else {
          const [cust] = await connection.execute(
            `SELECT k.Employee_ID FROM Customer_Master c LEFT JOIN KAM_Master k ON c.KAM_ID = k.KAM_ID WHERE c.Customer_ID = ?`,
            [header.Customer_ID]
          );
          nextAssigneeId = cust.length > 0 ? cust[0].Employee_ID : 100002;
        }
        logRemarks = `Complaint rejected. Returned to KAM and closed. Remarks: ${remarks || ''}`;
      }
      else {
        // Review Request (go back one stage)
        actionTypeLookupId = 80; // Review Requested

        if ([18, 19].includes(currentStatus)) {
          // From TS -> Go back to KAM (Stage 1)
          nextStatusId = 17;
          nextDeptId = buId === 1 ? 6 : 12;
          // Resolve KAM
          const [segmentKam] = await connection.execute(
            `SELECT ksa.KAM_ID, k.Employee_ID 
             FROM Customer_KAM_Segment_Assignment ksa
             JOIN KAM_Master k ON ksa.KAM_ID = k.KAM_ID
             WHERE ksa.Customer_ID = ? AND ksa.Business_Unit_ID = ? AND ksa.Is_Active = TRUE`,
            [header.Customer_ID, buId]
          );
          nextAssigneeId = segmentKam.length > 0 ? segmentKam[0].Employee_ID : 100002;
          logRemarks = `Review requested. Returned to KAM. Remarks: ${remarks || ''}`;
        }
        else if ([20, 21].includes(currentStatus)) {
          // From QC -> Go back to TS Review (Stage 2)
          nextStatusId = 18;
          nextDeptId = buId === 1 ? 1 : 7;
          nextAssigneeId = await getAssignedEmployeeForDept(connection, header.Customer_ID, nextDeptId, 5, buId);
          logRemarks = `Review requested by QC. Returned to TS Review. Remarks: ${remarks || ''}`;
        }
        else if (currentStatus === 84) {
          // From QC Head -> Go back to QC Review (Stage 3)
          nextStatusId = 21;
          nextDeptId = buId === 1 ? 2 : 8;
          nextAssigneeId = await getAssignedEmployeeForDept(connection, header.Customer_ID, nextDeptId, 7, buId);
          logRemarks = `Review requested by QC Head. Returned to QC Review. Remarks: ${remarks || ''}`;
        }
        else if ([22, 23].includes(currentStatus)) {
          // From Operations/CAPA -> Go back to QC Head Review (Stage 4)
          nextStatusId = 84; // QC Head Pending
          nextDeptId = buId === 1 ? 2 : 8;
          nextAssigneeId = await getAssignedEmployeeForDept(connection, header.Customer_ID, nextDeptId, 6, buId);
          logRemarks = `Review requested by Operations. Returned to QC Head. Remarks: ${remarks || ''}`;
        } 
        else if (currentStatus === 24) {
          // From Marketing PM -> Go back to CAPA Pending (Stage 5)
          nextStatusId = 22;
          nextDeptId = buId === 1 ? 3 : 9;
          nextAssigneeId = await getAssignedEmployeeForDept(connection, header.Customer_ID, nextDeptId, 9, buId);
          logRemarks = `Review requested by Marketing PM. Returned to Operations for CAPA. Remarks: ${remarks || ''}`;
        }
        else if (currentStatus === 25) {
          // From Marketing Head -> Go back to Marketing Review (Stage 7)
          nextStatusId = 24;
          nextDeptId = buId === 1 ? 4 : 10;
          nextAssigneeId = await getAssignedEmployeeForDept(connection, header.Customer_ID, nextDeptId, 11, buId);
          logRemarks = `Review requested by Marketing Head. Returned to Marketing PM. Remarks: ${remarks || ''}`;
        } 
        else if (currentStatus === 26) {
          // From MD -> Go back to Marketing Head Approval (Stage 8)
          nextStatusId = 25;
          nextDeptId = buId === 1 ? 4 : 10;
          nextAssigneeId = await getAssignedEmployeeForDept(connection, header.Customer_ID, nextDeptId, 10, buId);
          logRemarks = `Review requested by Managing Director. Returned to Marketing Head. Remarks: ${remarks || ''}`;
        } 
        else if (currentStatus === 27) {
          // From Finance Executive -> Go back to MD (if above limit) or Marketing Head
          let mdLimit = 100000;
          const [limRow] = await connection.execute("SELECT Configuration_Value FROM System_Configuration WHERE Configuration_Key = 'MD_APPROVAL_LIMIT'");
          if (limRow.length > 0) mdLimit = parseFloat(limRow[0].Configuration_Value);

          const settlementValue = header.Expected_Settlement_Amount !== null ? parseFloat(header.Expected_Settlement_Amount) : parseFloat(header.Total_Complaint_Value);

          if (settlementValue > mdLimit) {
            nextStatusId = 26; // MD
            nextDeptId = buId === 1 ? 6 : 12;
            nextAssigneeId = 100001; // MD
            logRemarks = `Review requested by Finance Executive. Returned to MD. Remarks: ${remarks || ''}`;
          } else {
            nextStatusId = 25; // Marketing Head
            nextDeptId = buId === 1 ? 4 : 10;
            nextAssigneeId = 100008; // Marketing Head
            logRemarks = `Review requested by Finance Executive. Returned to Marketing Head. Remarks: ${remarks || ''}`;
          }
        }
        else if (currentStatus === 83) {
          // From Finance Head -> Go back to Finance Executive (Stage 10)
          nextStatusId = 27;
          nextDeptId = buId === 1 ? 5 : 11;
          nextAssigneeId = await getAssignedEmployeeForDept(connection, header.Customer_ID, nextDeptId, 12, buId);
          logRemarks = `Review requested by Finance Head. Returned to Finance Executive. Remarks: ${remarks || ''}`;
        }
      }
    }

    // Resolve customer actor ID to employee ID mapping for Workflow Log foreign key
    let actorEmployeeId = req.user.id;
    if (req.user.role === 'Customer') {
      const [kamRows] = await connection.execute(
        `SELECT km.Employee_ID 
         FROM Complaint_Header ch
         JOIN KAM_Master km ON ch.KAM_ID = km.KAM_ID
         WHERE ch.Complaint_ID = ?`,
        [id]
      );
      actorEmployeeId = kamRows.length > 0 ? kamRows[0].Employee_ID : 100002;
    }

    // Update header
    await connection.execute(
      'UPDATE Complaint_Header SET Complaint_Status_ID = ?, Current_Department_ID = ?, Current_Assignee_ID = ? WHERE Complaint_ID = ?',
      [nextStatusId, nextDeptId, nextAssigneeId, id]
    );

    if (nextAssigneeId) {
      const resolvedName = await getAssigneeNameWithDesignation(connection, nextAssigneeId);
      logRemarks += ` (Assigned to: ${resolvedName})`;
    }

    // Resolve timeline Workflow_ID dynamically based on current status
    const statusToStage = {
      17: 1, 18: 2, 19: 2, 21: 3, 20: 3, 84: 4, 22: 5, 23: 6, 24: 7, 25: 8, 26: 9, 27: 10, 83: 11
    };
    const [wfRows] = await connection.execute(
      'SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID = ? AND Stage_Number = ?',
      [buId, statusToStage[header.Complaint_Status_ID] || 1]
    );
    const stageConfigId = wfRows.length > 0 ? wfRows[0].Workflow_ID : (buId === 1 ? 1 : 12);

    // Log log
    await connection.execute(
      `INSERT INTO Complaint_Workflow_Log (
         Complaint_ID, Workflow_ID, Action_By, Action_Date, Action_Type_ID, 
         Previous_Department_ID, Current_Department_ID, Remarks, Created_On
       ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, NOW())`,
      [id, stageConfigId, actorEmployeeId, actionTypeLookupId, header.Current_Department_ID, nextDeptId, logRemarks]
    );

    await connection.commit();
    return sendSuccess(res, null, 'Action recorded successfully.');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * Submit Finance Credit Note details to close complaint
 */
async function submitFinanceCreditNote(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { creditNoteNumber, creditNoteDate, creditNoteAmount, fiscalYear, companyCode, remarks } = req.body;

    let finalCreditNoteNumber = creditNoteNumber;
    if (!finalCreditNoteNumber || finalCreditNoteNumber.trim() === '') {
      const currentYear = new Date().getFullYear();
      finalCreditNoteNumber = `SAP-CN-${currentYear}-${String(id).padStart(4, '0')}`;
    }

    // Role check: only Finance Executive (or Administrator) can generate credit notes
    if (!['Finance Executive', 'Administrator'].includes(req.user.role)) {
      await connection.rollback();
      return sendError(res, `Unauthorized: Only Finance Executive can generate credit notes. Your role is '${req.user.role}'.`, 403);
    }

    // 1. Verify header exists and is in Credit Note Preparing (27)
    const [headers] = await connection.execute(
      'SELECT Customer_ID, Business_Unit_ID, Current_Department_ID, Complaint_Status_ID, SLA_Paused, SLA_Pause_Reason FROM Complaint_Header WHERE Complaint_ID = ?',
      [id]
    );
    if (headers.length === 0) {
      await connection.rollback();
      return sendError(res, 'Complaint not found.', 404);
    }
    const header = headers[0];
    if (header.SLA_Paused) {
      await connection.rollback();
      return sendError(res, `Action denied. SLA is paused (Reason: ${header.SLA_Pause_Reason || 'Pending task'}).`, 400);
    }
    if (header.Complaint_Status_ID !== 27) {
      await connection.rollback();
      return sendError(res, 'Action denied. Complaint is not pending credit note preparing stage.', 400);
    }
    const buId = header.Business_Unit_ID;

    // 2. Verify settlement details exist
    const [settlements] = await connection.execute('SELECT Settlement_ID, Approved_Amount FROM Settlement_Details WHERE Complaint_ID = ?', [id]);
    if (settlements.length === 0) {
      await connection.rollback();
      return sendError(res, 'Settlement details not found for this complaint.', 400);
    }
    const settlement = settlements[0];

    // 3. Save or update Credit_Note record
    const [existing] = await connection.execute('SELECT Credit_Note_ID FROM Credit_Note WHERE Complaint_ID = ?', [id]);
    if (existing.length > 0) {
      await connection.execute(
        `UPDATE Credit_Note 
         SET Credit_Note_Number = ?, Credit_Note_Date = ?, Credit_Note_Amount = ?, 
             SAP_Fiscal_Year = ?, SAP_Company_Code = ?, SAP_Sync_Status_ID = 66, 
             SAP_Response_Message = 'Sync successful (posted via CCMS OData mockup)', Updated_On = NOW(), Updated_By = ?
         WHERE Complaint_ID = ?`,
        [finalCreditNoteNumber, creditNoteDate || new Date(), creditNoteAmount || settlement.Approved_Amount, fiscalYear || '2026', companyCode || 'OPM', req.user.id, id]
      );
    } else {
      await connection.execute(
        `INSERT INTO Credit_Note (
           Complaint_ID, Settlement_ID, Credit_Note_Number, Credit_Note_Date, Credit_Note_Amount, 
           SAP_Fiscal_Year, SAP_Company_Code, SAP_Sync_Status_ID, SAP_Response_Message, Created_On, Created_By
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 66, 'Sync successful (posted via CCMS OData mockup)', NOW(), ?)`,
        [id, settlement.Settlement_ID, finalCreditNoteNumber, creditNoteDate || new Date(), creditNoteAmount || settlement.Approved_Amount, fiscalYear || '2026', companyCode || 'OPM', req.user.id]
      );
    }

    // 4. Resolve next stage (Finance Head Approval)
    const nextStage = await resolveNextStage(connection, 10, buId, header.Customer_ID);
    if (!nextStage) {
      await connection.rollback();
      return sendError(res, 'Failed to resolve next stage (Finance Head Approval).', 500);
    }

    // Update header to stage 11
    await connection.execute(
      'UPDATE Complaint_Header SET Complaint_Status_ID = ?, Current_Department_ID = ?, Current_Assignee_ID = ? WHERE Complaint_ID = ?',
      [nextStage.statusId, nextStage.departmentId, nextStage.assigneeId, id]
    );

    // 5. Log in timeline (action type Approved/Forwarded 77)
    const [wfRows] = await connection.execute(
      'SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID = ? AND Stage_Number = 10',
      [buId]
    );
    const stageConfigId = wfRows.length > 0 ? wfRows[0].Workflow_ID : (buId === 1 ? 10 : 21);

    const resolvedName = await getAssigneeNameWithDesignation(connection, nextStage.assigneeId);
    await connection.execute(
      `INSERT INTO Complaint_Workflow_Log (
         Complaint_ID, Workflow_ID, Action_By, Action_Date, Action_Type_ID, 
         Previous_Department_ID, Current_Department_ID, Remarks, Created_On
       ) VALUES (?, ?, ?, NOW(), 77, ?, ?, ?, NOW())`,
      [id, stageConfigId, req.user.id, header.Current_Department_ID, nextStage.departmentId, `Finance processed credit note: ${creditNoteNumber}. Sent for Finance Head approval (Assigned to: ${resolvedName}). ${remarks || ''}`]
    );

    await connection.commit();
    return sendSuccess(res, null, 'Finance credit note prepared and sent for Finance Head approval.');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * Admin: Manually reassign a complaint to any employee in the current stage's department
 */
async function assignComplaint(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { employeeId } = req.body;

    if (!employeeId) {
      await connection.rollback();
      return sendError(res, 'Employee ID is required.', 400);
    }

    // Verify complaint exists
    const [headers] = await connection.execute(
      'SELECT Current_Department_ID, Complaint_Status_ID, Current_Assignee_ID, Business_Unit_ID, Customer_ID FROM Complaint_Header WHERE Complaint_ID = ?',
      [id]
    );
    if (headers.length === 0) {
      await connection.rollback();
      return sendError(res, 'Complaint not found.', 404);
    }
    const header = headers[0];

    // Verify employee exists, is active and belongs to the correct department
    const [employees] = await connection.execute(
      'SELECT Employee_ID, Employee_Name, Role_ID FROM Employee_Master WHERE Employee_ID = ? AND Department_ID = ? AND Is_Active = TRUE',
      [employeeId, header.Current_Department_ID]
    );
    if (employees.length === 0) {
      await connection.rollback();
      return sendError(res, 'Invalid employee. The selected employee is inactive or does not belong to the current stage department.', 400);
    }
    const targetEmp = employees[0];

    // Reassign
    await connection.execute(
      'UPDATE Complaint_Header SET Current_Assignee_ID = ? WHERE Complaint_ID = ?',
      [employeeId, id]
    );

    // Save as sticky Customer-Executive assignment if it is an executive role
    const executiveRoles = [5, 7, 9, 11, 12];
    if (executiveRoles.includes(targetEmp.Role_ID)) {
      await connection.execute(
        `INSERT INTO Customer_Executive_Assignment (Customer_ID, Department_ID, Employee_ID, Business_Unit_ID, Is_Active)
         VALUES (?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE Employee_ID = ?, Is_Active = TRUE, Updated_On = NOW()`,
        [header.Customer_ID, header.Current_Department_ID, employeeId, header.Business_Unit_ID, employeeId]
      );
    }

    // Log this action in timeline (lookup 75: Assigned)
    const [wfRows] = await connection.execute(
      'SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID = ? AND Department_ID = ? AND Is_Active = TRUE LIMIT 1',
      [header.Business_Unit_ID, header.Current_Department_ID]
    );
    const workflowId = wfRows.length > 0 ? wfRows[0].Workflow_ID : 1;

    await connection.execute(
      `INSERT INTO Complaint_Workflow_Log (
         Complaint_ID, Workflow_ID, Action_By, Action_Date, Action_Type_ID, 
         Previous_Department_ID, Current_Department_ID, Remarks, Created_On
       ) VALUES (?, ?, ?, NOW(), 75, ?, ?, ?, NOW())`,
      [id, workflowId, req.user.id, header.Current_Department_ID, header.Current_Department_ID, `Administrator manually reassigned complaint to ${targetEmp.Employee_Name}.`]
    );

    await connection.commit();
    return sendSuccess(res, null, 'Complaint reassigned successfully.');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * Admin: Load per-department workloads and round-robin counter statistics
 */
async function getDeptAssignmentStats(req, res, next) {
  try {
    // Fetch departments and active employees with open complaint counts
    const [workloads] = await pool.execute(`
      SELECT 
        d.Department_ID, 
        d.Department_Name, 
        bu.Business_Unit_Code,
        e.Employee_ID, 
        e.Employee_Name, 
        r.Role_Name,
        COUNT(CASE WHEN ch.Complaint_Status_ID NOT IN (28, 29) AND ch.Is_Active = TRUE THEN 1 END) AS Open_Complaints
      FROM Employee_Master e
      JOIN Department_Master d ON e.Department_ID = d.Department_ID
      JOIN Business_Unit_Master bu ON d.Business_Unit_ID = bu.Business_Unit_ID
      JOIN Role_Master r ON e.Role_ID = r.Role_ID
      LEFT JOIN Complaint_Header ch ON ch.Current_Assignee_ID = e.Employee_ID
      WHERE e.Is_Active = TRUE
      GROUP BY e.Employee_ID, d.Department_ID, r.Role_ID
      ORDER BY bu.Business_Unit_Code, d.Department_Name, r.Role_Name, e.Employee_Name
    `);

    // Fetch active round-robin counter configuration values
    const [counters] = await pool.execute(`
      SELECT Configuration_Key, Configuration_Value, Remarks 
      FROM System_Configuration 
      WHERE Configuration_Key LIKE 'ASSIGN_CTR_%' AND Is_Active = TRUE
    `);

    // Fetch list of open complaints for ease of reassignment selection
    const [openComplaints] = await pool.execute(`
      SELECT 
        ch.Complaint_ID, 
        ch.Complaint_Number, 
        ch.Complaint_Title, 
        cust.Customer_Name,
        ch.Current_Assignee_ID, 
        ch.Current_Department_ID,
        l_status.Lookup_Value as Status
      FROM Complaint_Header ch
      JOIN Customer_Master cust ON ch.Customer_ID = cust.Customer_ID
      JOIN Lookup_Master l_status ON ch.Complaint_Status_ID = l_status.Lookup_ID
      WHERE ch.Complaint_Status_ID NOT IN (28, 29) AND ch.Is_Active = TRUE
      ORDER BY ch.Complaint_Number DESC
    `);

    return sendSuccess(res, { workloads, counters, openComplaints }, 'Department assignment statistics loaded.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCustomers,
  getEmployees,
  getInvoices,
  getInvoiceDetails,
  getLookups,
  createComplaint,
  getComplaints,
  getComplaintDetails,
  getDashboardStats,
  submitTsReview,
  getTsReviewDetails,
  submitVisitMemberRemarks,
  submitQcReview,
  getQcReviewDetails,
  submitCapa,
  getCapaDetails,
  approveStage,
  submitFinanceCreditNote,
  timelineAction,
  assignComplaint,
  getDeptAssignmentStats
};
