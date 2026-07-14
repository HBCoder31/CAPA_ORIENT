const { pool } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/responseHelper');

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
    10: 27, // Finance Head
    11: 83  // Finance Exec
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
    // Only employees can view all customers
    if (req.user.role === 'Customer') {
      return sendError(res, 'Access denied. Customers cannot search other customers.', 403);
    }
    const [rows] = await pool.execute(`
      SELECT c.Customer_ID, c.Customer_Name, c.City, c.State, c.KAM_ID, e.Employee_Name as KAM_Name 
      FROM Customer_Master c
      LEFT JOIN KAM_Master k ON c.KAM_ID = k.KAM_ID
      LEFT JOIN Employee_Master e ON k.Employee_ID = e.Employee_ID
      WHERE c.Is_Active = TRUE 
      ORDER BY c.Customer_Name
    `);
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
      'SELECT Employee_ID, Employee_Name, Official_Email FROM Employee_Master WHERE Is_Active = TRUE ORDER BY Employee_Name'
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

    if (!title || !description || !priorityId || !lineItems || lineItems.length === 0) {
      await connection.rollback();
      return sendError(res, 'Missing required complaint header or line item fields.', 400);
    }

    // Validate attachments if provided (base64 array with sizes)
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
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

      if (attachments.length > maxImageCount) {
        await connection.rollback();
        return sendError(res, `Attachment upload limit exceeded. Maximum allowed: ${maxImageCount} files.`, 400);
      }

      for (const att of attachments) {
        let fileSizeMb = 0;
        if (att.content) {
          const stringLength = att.content.length - (att.content.indexOf(',') + 1);
          const sizeInBytes = (stringLength * 3) / 4;
          fileSizeMb = sizeInBytes / (1024 * 1024);
        } else if (att.fileSize) {
          fileSizeMb = att.fileSize / (1024 * 1024);
        }

        if (fileSizeMb > maxImageSizeMb) {
          await connection.rollback();
          return sendError(res, `Attachment size limit exceeded. Maximum allowed: ${maxImageSizeMb} MB per file.`, 400);
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

    // 3. Resolve Business Unit from first invoice item
    const [invoiceInfo] = await connection.execute(
      'SELECT Division, Unit_Price FROM Invoice_Master WHERE Invoice_No = ? LIMIT 1',
      [lineItems[0].invoiceNo]
    );

    if (invoiceInfo.length === 0) {
      await connection.rollback();
      return sendError(res, `Invoice ${lineItems[0].invoiceNo} not found.`, 404);
    }

    const isChemical = invoiceInfo[0].Division.toLowerCase().includes('chemical');
    const businessUnitId = isChemical ? 2 : 1; // 1 = Paper, 2 = Chemical

    // 3b. Resolve segment-specific KAM assignment if defined in Customer_KAM_Segment_Assignment
    const [segmentKam] = await connection.execute(
      `SELECT ksa.KAM_ID, k.Employee_ID 
       FROM Customer_KAM_Segment_Assignment ksa
       JOIN KAM_Master k ON ksa.KAM_ID = k.KAM_ID
       WHERE ksa.Customer_ID = ? AND ksa.Business_Unit_ID = ? AND ksa.Is_Active = TRUE`,
      [customerId, businessUnitId]
    );

    if (segmentKam.length > 0) {
      kamId = segmentKam[0].KAM_ID;
      assignedKamEmployeeId = segmentKam[0].Employee_ID;
    }

    // 4. Calculate SLA Due Date based on priority
    // 31: Low, 32: Medium, 33: High, 34: Critical
    let resolvedPriorityId = priorityId;
    if (req.user.role === 'Customer') {
      resolvedPriorityId = 32; // Force to Medium
    }

    let slaHours = 336; // Default Low = 14 days (14 * 24)
    if (parseInt(resolvedPriorityId) === 34) slaHours = 24; // Critical = 24 hrs
    else if (parseInt(resolvedPriorityId) === 33) slaHours = 72; // High = 3 days (3 * 24)
    else if (parseInt(resolvedPriorityId) === 32) slaHours = 168; // Medium = 7 days (7 * 24)

    const createdAt = new Date();
    const slaDueDate = new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000);

    // 5. Generate sequential complaint number
    const [maxResult] = await connection.execute('SELECT MAX(Complaint_ID) as maxId FROM Complaint_Header');
    const nextId = (maxResult[0].maxId || 0) + 1;
    const currentYear = new Date().getFullYear();
    const complaintNumber = `CMP${currentYear}${String(nextId).padStart(4, '0')}`;

    // 6. Set initial owner, status, assignee, and department based on role routing
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
      logRemarks = 'Complaint logged by KAM. Directed to Technical Services.';
    } else {
      currentDeptId = businessUnitId === 1 ? 6 : 12; // KAM Verification Department
      initialStatusId = 17; // Submitted / KAM Verification Pending
      initialAssigneeId = assignedKamEmployeeId;

      const [wfRows] = await connection.execute(
        'SELECT Workflow_ID FROM Workflow_Configuration WHERE Business_Unit_ID = ? AND Stage_Number = 1',
        [businessUnitId]
      );
      workflowConfigId = wfRows.length > 0 ? wfRows[0].Workflow_ID : (businessUnitId === 1 ? 1 : 12);
      logRemarks = 'Complaint logged. Directed to KAM for verification.';
    }

    // Insert header
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
        kamId,
        businessUnitId,
        sourceId,
        createdAt,
        slaDueDate,
        title,
        description,
        resolvedPriorityId,
        initialStatusId,
        currentDeptId,
        initialAssigneeId,
        req.user.role === 'Customer' ? null : req.user.id, // Created By
        createdAt
      ]
    );

    const complaintId = headerResult.insertId;

    // 7. Insert line items & compute total value
    let totalComplaintValue = 0;

    for (const item of lineItems) {
      // Get unit price from invoice master to auto-calculate complaint value
      const [lineData] = await connection.execute(
        'SELECT Unit_Price FROM Invoice_Master WHERE Invoice_No = ? AND Line_Item = ?',
        [item.invoiceNo, item.lineItem]
      );

      const price = lineData.length > 0 ? parseFloat(lineData[0].Unit_Price) : 0;
      const defectiveQty = parseFloat(item.defectiveQty);
      const complaintValue = price * defectiveQty;
      totalComplaintValue += complaintValue;

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
          item.customerRemarks || null,
          createdAt
        ]
      );
    }

    // Update total value in header
    await connection.execute(
      'UPDATE Complaint_Header SET Total_Complaint_Value = ? WHERE Complaint_ID = ?',
      [totalComplaintValue, complaintId]
    );

    // Save attachments to disk and DB if provided
    const actorEmployeeId = req.user.role === 'Customer' ? assignedKamEmployeeId : req.user.id;
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(__dirname, '..', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      for (const att of attachments) {
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

    // 8. Log timeline event
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
        currentDeptId, // Previous
        currentDeptId, // Current
        logRemarks,
        createdAt
      ]
    );

    // Fetch assigned KAM name for success metadata response
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

    await connection.commit();
    return sendSuccess(res, { 
      complaintId, 
      complaintNumber,
      assignedKamName,
      initialQueue: req.user.role === 'KAM' ? 'Technical Services (TS) Review' : 'Submitted (Pending KAM Review)'
    }, 'Complaint logged successfully.', 210);
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
             e.Employee_Name as Assignee
      FROM Complaint_Header c
      JOIN Customer_Master cust ON c.Customer_ID = cust.Customer_ID
      JOIN Lookup_Master l_status ON c.Complaint_Status_ID = l_status.Lookup_ID
      JOIN Lookup_Master l_priority ON c.Priority_ID = l_priority.Lookup_ID
      LEFT JOIN Employee_Master e ON c.Current_Assignee_ID = e.Employee_ID
      WHERE c.Is_Active = TRUE
    `;
    const params = [];

    // Role-based scoping
    if (req.user.role === 'Customer') {
      query += ' AND c.Customer_ID = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'KAM') {
      // Find employee's KAM_ID
      const [kamRows] = await pool.execute('SELECT KAM_ID FROM KAM_Master WHERE Employee_ID = ?', [req.user.id]);
      if (kamRows.length > 0) {
        query += ' AND (c.KAM_ID = ? OR c.Current_Assignee_ID = ?)';
        params.push(kamRows[0].KAM_ID, req.user.id);
      } else {
        query += ' AND c.Current_Assignee_ID = ?';
        params.push(req.user.id);
      }
    } else if (req.user.role === 'QC Head' || req.user.role === 'QC Engineer') {
      // QC can see all, but prioritizes QC statuses. No hard filter unless specified.
    }

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
    const [headers] = await pool.execute(
      `SELECT c.*, cust.Customer_Name, cust.Customer_Email, cust.Customer_Phone,
              l_status.Lookup_Value as Status, l_priority.Lookup_Value as Severity,
              bu.Business_Unit_Name, d.Department_Name, e.Employee_Name as Assignee,
              k_emp.Employee_Name as KAM_Name
       FROM Complaint_Header c
       JOIN Customer_Master cust ON c.Customer_ID = cust.Customer_ID
       JOIN Lookup_Master l_status ON c.Complaint_Status_ID = l_status.Lookup_ID
       JOIN Lookup_Master l_priority ON c.Priority_ID = l_priority.Lookup_ID
       JOIN Business_Unit_Master bu ON c.Business_Unit_ID = bu.Business_Unit_ID
       LEFT JOIN Department_Master d ON c.Current_Department_ID = d.Department_ID
       LEFT JOIN Employee_Master e ON c.Current_Assignee_ID = e.Employee_ID
       LEFT JOIN KAM_Master k ON c.KAM_ID = k.KAM_ID
       LEFT JOIN Employee_Master k_emp ON k.Employee_ID = k_emp.Employee_ID
       WHERE c.Complaint_ID = ? AND c.Is_Active = TRUE`,
      [id]
    );

    if (headers.length === 0) {
      return sendError(res, 'Complaint not found.', 404);
    }

    const complaint = headers[0];

    // Validate ownership for customer
    if (req.user.role === 'Customer' && complaint.Customer_ID !== req.user.id) {
      return sendError(res, 'Access denied. You do not own this complaint.', 403);
    }

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
              d_curr.Department_Name as Curr_Dept
       FROM Complaint_Workflow_Log wl
       JOIN Employee_Master e ON wl.Action_By = e.Employee_ID
       JOIN Role_Master r ON e.Role_ID = r.Role_ID
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

    // Fetch attachments
    const [attachments] = await pool.execute(
      `SELECT Attachment_ID, File_Name, File_Path, File_Type, File_Size_KB, Upload_Date, Remarks
       FROM attachment_master
       WHERE Complaint_ID = ?`,
      [id]
    );

    return sendSuccess(
      res, 
      { 
        complaint, 
        lineItems, 
        logs,
        settlement: settlements[0] || null,
        creditNote: creditNotes[0] || null,
        attachments: attachments
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

    // Role filtering
    if (req.user.role === 'Customer') {
      whereClause += ' AND c.Customer_ID = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'KAM') {
      const [kamRows] = await pool.execute('SELECT KAM_ID FROM KAM_Master WHERE Employee_ID = ?', [req.user.id]);
      if (kamRows.length > 0) {
        whereClause += ' AND (c.KAM_ID = ? OR c.Current_Assignee_ID = ?)';
        params.push(kamRows[0].KAM_ID, req.user.id);
      } else {
        whereClause += ' AND c.Current_Assignee_ID = ?';
        params.push(req.user.id);
      }
    }

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
      `SELECT AVG(TIMESTAMPDIFF(HOUR, c.Created_On, c.Closure_Date)) / 24 as avgDays
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
      actionType, observation, clarificationRequired, sampleRequired, 
      visitRequired, recommendedAction, canCloseComplaint, remarks,
      visitDate, findings, feedback, followUpRequired
    } = req.body;

    // 1. Fetch current claim header details
    const [headers] = await connection.execute(
      'SELECT Business_Unit_ID, Current_Department_ID, Complaint_Status_ID FROM Complaint_Header WHERE Complaint_ID = ?',
      [id]
    );
    if (headers.length === 0) {
      await connection.rollback();
      return sendError(res, 'Complaint not found.', 404);
    }
    const header = headers[0];
    const buId = header.Business_Unit_ID;

    // 2. Save or update Technical_Service_Details
    const [existing] = await connection.execute('SELECT TS_Details_ID FROM Technical_Service_Details WHERE Complaint_ID = ?', [id]);
    if (existing.length > 0) {
      await connection.execute(
        `UPDATE Technical_Service_Details 
         SET Assigned_Engineer_ID = ?, Investigation_Date = NOW(), Technical_Observation = ?, 
             Clarification_Required = ?, Sample_Required = ?, Visit_Required = ?, 
             Recommended_Action = ?, Can_Close_Complaint = ?, Remarks = ?, Updated_On = NOW(), Updated_By = ?
         WHERE Complaint_ID = ?`,
        [req.user.id, observation || '', clarificationRequired ? 1 : 0, sampleRequired ? 1 : 0, visitRequired ? 1 : 0, recommendedAction || '', canCloseComplaint ? 1 : 0, remarks || '', req.user.id, id]
      );
    } else {
      await connection.execute(
        `INSERT INTO Technical_Service_Details (
           Complaint_ID, Assigned_Engineer_ID, Investigation_Date, Technical_Observation, 
           Clarification_Required, Sample_Required, Visit_Required, Recommended_Action, 
           Can_Close_Complaint, Remarks, Created_On, Created_By
         ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [id, req.user.id, observation || '', clarificationRequired ? 1 : 0, sampleRequired ? 1 : 0, visitRequired ? 1 : 0, recommendedAction || '', canCloseComplaint ? 1 : 0, remarks || '', req.user.id]
      );
    }

    // 3. Process action type state updates
    let nextStatusId = header.Complaint_Status_ID;
    let nextDeptId = header.Current_Department_ID;
    let nextAssigneeId = req.user.id;
    let actionTypeLookupId = 76; // Default 'Forwarded'
    let logRemarks = '';

    if (actionType === 'clarify') {
      actionTypeLookupId = 79; // Clarification Requested
      nextStatusId = 18; // Under TS Review
      logRemarks = `TS Engineer sought offline clarification: ${remarks || ''}`;
    } else if (actionType === 'visit-schedule') {
      actionTypeLookupId = 75; // Assigned
      nextStatusId = 19; // Visit Scheduled
      logRemarks = `TS scheduled customer visit for ${visitDate}. Remarks: ${remarks || ''}`;

      // Log into Visit_Details
      await connection.execute(
        `INSERT INTO Visit_Details (
           Complaint_ID, Engineer_ID, Visit_Date, Visit_Status_ID, Remarks, Created_On, Created_By
         ) VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
        [id, req.user.id, visitDate, 51, remarks || '', req.user.id]
      );
    } else if (actionType === 'visit-complete') {
      actionTypeLookupId = 77; // Approved / Completed
      nextStatusId = 18; // Under TS Review
      logRemarks = `TS completed customer visit. Findings: ${findings || ''}. Feedback: ${feedback || ''}`;

      // Update Visit_Details
      await connection.execute(
        `UPDATE Visit_Details 
         SET Visit_Status_ID = 52, Visit_Findings = ?, Customer_Feedback = ?, Follow_Up_Required = ?, Updated_On = NOW(), Updated_By = ?
         WHERE Complaint_ID = ? AND Visit_Status_ID = 51`,
        [findings || '', feedback || '', followUpRequired ? 1 : 0, req.user.id, id]
      );
    } else if (actionType === 'forward') {
      actionTypeLookupId = 76; // Forwarded
      const next = await resolveNextStage(connection, 2, buId, header.Customer_ID);
      nextStatusId = next.statusId;
      nextDeptId = next.departmentId;
      nextAssigneeId = next.assigneeId;
      logRemarks = `Technical Service completed review. Forwarding to QC. Remarks: ${remarks || ''}`;
    }

    // 4. Update Header status
    await connection.execute(
      'UPDATE Complaint_Header SET Complaint_Status_ID = ?, Current_Department_ID = ?, Current_Assignee_ID = ? WHERE Complaint_ID = ?',
      [nextStatusId, nextDeptId, nextAssigneeId, id]
    );

    // 5. Log workflow event
    const workflowConfigId = buId === 1 ? 1 : 8; // Stage 1 config ID
    await connection.execute(
      `INSERT INTO Complaint_Workflow_Log (
         Complaint_ID, Workflow_ID, Action_By, Action_Date, Action_Type_ID, 
         Previous_Department_ID, Current_Department_ID, Remarks, Created_On
       ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, NOW())`,
      [id, workflowConfigId, req.user.id, actionTypeLookupId, header.Current_Department_ID, nextDeptId, logRemarks]
    );

    await connection.commit();
    return sendSuccess(res, null, 'TS review updated successfully.');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

/**
 * Get TS Review and Visit Details for a claim
 */
async function getTsReviewDetails(req, res, next) {
  try {
    const { id } = req.params;
    const [tsRows] = await pool.execute('SELECT * FROM Technical_Service_Details WHERE Complaint_ID = ?', [id]);
    const [visitRows] = await pool.execute('SELECT * FROM Visit_Details WHERE Complaint_ID = ? ORDER BY Visit_Date DESC', [id]);
    return sendSuccess(res, { tsDetails: tsRows[0] || null, visits: visitRows }, 'TS Review details loaded.');
  } catch (err) {
    next(err);
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
      sampleRequestDate, sampleDispatchedDate, sampleReceivedDate, courierDetails, sampleCondition
    } = req.body;

    // 1. Fetch current claim header details
    const [headers] = await connection.execute(
      'SELECT Business_Unit_ID, Current_Department_ID, Complaint_Status_ID FROM Complaint_Header WHERE Complaint_ID = ?',
      [id]
    );
    if (headers.length === 0) {
      await connection.rollback();
      return sendError(res, 'Complaint not found.', 404);
    }
    const header = headers[0];
    const buId = header.Business_Unit_ID;

    // 2. Save or update Quality_Control_Details
    const [existing] = await connection.execute('SELECT QC_Details_ID FROM Quality_Control_Details WHERE Complaint_ID = ?', [id]);
    if (existing.length > 0) {
      await connection.execute(
        `UPDATE Quality_Control_Details 
         SET QC_Engineer_ID = ?, Inspection_Date = NOW(), Sample_Verified = ?, 
             QC_Observation = ?, QC_Recommendation = ?, Remarks = ?, Updated_On = NOW(), Updated_By = ?
         WHERE Complaint_ID = ?`,
        [req.user.id, sampleVerified ? 1 : 0, observation || '', recommendation || '', remarks || '', req.user.id, id]
      );
    } else {
      await connection.execute(
        `INSERT INTO Quality_Control_Details (
           Complaint_ID, QC_Engineer_ID, Inspection_Date, Sample_Verified, 
           QC_Observation, QC_Recommendation, Remarks, Created_On, Created_By
         ) VALUES (?, ?, NOW(), ?, ?, ?, ?, NOW(), ?)`,
        [id, req.user.id, sampleVerified ? 1 : 0, observation || '', recommendation || '', remarks || '', req.user.id]
      );
    }

    // 3. Process action type state updates
    let nextStatusId = header.Complaint_Status_ID;
    let nextDeptId = header.Current_Department_ID;
    let nextAssigneeId = req.user.id;
    let actionTypeLookupId = 76; // Forwarded
    let logRemarks = '';

    if (actionType === 'sample-request') {
      actionTypeLookupId = 79; // Clarification / Sample Request
      nextStatusId = 20; // Waiting Sample
      logRemarks = `QC requested physical sample. Remarks: ${remarks || ''}`;

      // Insert Sample_Tracking
      await connection.execute(
        `INSERT INTO Sample_Tracking (
           Complaint_ID, Sample_Request_Date, Sample_Status_ID, Courier_Details, Remarks, Created_On, Created_By
         ) VALUES (?, ?, 54, ?, ?, NOW(), ?)`,
        [id, sampleRequestDate || new Date(), courierDetails || '', remarks || '', req.user.id]
      );
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
    } else if (actionType === 'forward') {
      actionTypeLookupId = 76; // Forwarded
      const next = await resolveNextStage(connection, 3, buId, header.Customer_ID);
      nextStatusId = next.statusId;
      nextDeptId = next.departmentId;
      nextAssigneeId = next.assigneeId;
      logRemarks = `Quality Control completed analysis. Forwarding to QC Head for verification. Remarks: ${remarks || ''}`;
    }

    // 4. Update Header status
    await connection.execute(
      'UPDATE Complaint_Header SET Complaint_Status_ID = ?, Current_Department_ID = ?, Current_Assignee_ID = ? WHERE Complaint_ID = ?',
      [nextStatusId, nextDeptId, nextAssigneeId, id]
    );

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
    return sendSuccess(res, null, 'QC review updated successfully.');
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
    return sendSuccess(res, { qcDetails: qcRows[0] || null, samples: sampleRows }, 'QC Review details loaded.');
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
    const [complaints] = await connection.execute('SELECT Business_Unit_ID FROM Complaint_Header WHERE Complaint_ID = ?', [id]);
    if (complaints.length === 0) {
      await connection.rollback();
      return sendError(res, 'Complaint not found.', 404);
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

    if (next) {
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
        [id, header.Business_Unit_ID === 1 ? 5 : 16, req.user.id, header.Current_Department_ID, next.departmentId, `CAPA logged by Operations Engineer. Forwarded to Operations Head for approval. Remarks: ${remarks || ''}`]
      );
    }

    await connection.commit();
    return sendSuccess(res, null, 'CAPA details recorded successfully.');
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
      'SELECT Customer_ID, Business_Unit_ID, Current_Department_ID, Complaint_Status_ID, Expected_Settlement_Amount, Total_Complaint_Value, Complaint_Date FROM Complaint_Header WHERE Complaint_ID = ?',
      [id]
    );
    if (headers.length === 0) {
      await connection.rollback();
      return sendError(res, 'Complaint not found.', 404);
    }
    const header = headers[0];
    const buId = header.Business_Unit_ID;

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
      // Go to Finance Credit Note execution (Stage 11)
      const next = await resolveNextStage(connection, 10, buId, header.Customer_ID);
      nextStatusId = next.statusId;
      nextDeptId = next.departmentId;
      nextAssigneeId = next.assigneeId;
      logRemarks = `Commercial settlement approved by Finance Head. Sent to Finance Executive for Credit Note generation. Remarks: ${remarks || ''}`;
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
      'SELECT Business_Unit_ID, Current_Department_ID, Complaint_Status_ID, Expected_Settlement_Amount, Total_Complaint_Value FROM Complaint_Header WHERE Complaint_ID = ?',
      [id]
    );
    if (headers.length === 0) {
      await connection.rollback();
      return sendError(res, 'Complaint not found.', 404);
    }
    const header = headers[0];
    const buId = header.Business_Unit_ID;

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

      nextStatusId = 18; // Under TS Review
      nextDeptId = buId === 1 ? 1 : 7; // TS Dept
      nextAssigneeId = 100002; // Amit Sharma (TS Head / Engineer)
      logRemarks = `Complaint reopened. Reverted to TS Review. Remarks: ${remarks || ''}`;
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
          nextAssigneeId = 100003; // TS Engineer
          logRemarks = `Review requested by QC. Returned to TS Review. Remarks: ${remarks || ''}`;
        }
        else if (currentStatus === 84) {
          // From QC Head -> Go back to QC Review (Stage 3)
          nextStatusId = 21;
          nextDeptId = buId === 1 ? 2 : 8;
          nextAssigneeId = buId === 1 ? 100005 : 100012; // QC Engineer
          logRemarks = `Review requested by QC Head. Returned to QC Review. Remarks: ${remarks || ''}`;
        }
        else if ([22, 23].includes(currentStatus)) {
          // From Operations/CAPA -> Go back to QC Head Review (Stage 4)
          nextStatusId = 84; // QC Head Pending
          nextDeptId = buId === 1 ? 2 : 8;
          nextAssigneeId = 100004; // QC Head
          logRemarks = `Review requested by Operations. Returned to QC Head. Remarks: ${remarks || ''}`;
        } 
        else if (currentStatus === 24) {
          // From Marketing PM -> Go back to CAPA Pending (Stage 5)
          nextStatusId = 22;
          nextDeptId = buId === 1 ? 3 : 9;
          nextAssigneeId = buId === 1 ? 100006 : 100006;
          logRemarks = `Review requested by Marketing PM. Returned to Operations for CAPA. Remarks: ${remarks || ''}`;
        }
        else if (currentStatus === 25) {
          // From Marketing Head -> Go back to Marketing Review (Stage 7)
          nextStatusId = 24;
          nextDeptId = buId === 1 ? 4 : 10;
          nextAssigneeId = 100009; // Marketing PM
          logRemarks = `Review requested by Marketing Head. Returned to Marketing PM. Remarks: ${remarks || ''}`;
        } 
        else if (currentStatus === 26) {
          // From MD -> Go back to Marketing Head Approval (Stage 8)
          nextStatusId = 25;
          nextDeptId = buId === 1 ? 4 : 10;
          nextAssigneeId = 100008; // Marketing Head
          logRemarks = `Review requested by Managing Director. Returned to Marketing Head. Remarks: ${remarks || ''}`;
        } 
        else if (currentStatus === 27) {
          // From Finance Head -> Go back to Marketing Head Approval (Stage 8)
          nextStatusId = 25;
          nextDeptId = buId === 1 ? 4 : 10;
          nextAssigneeId = 100008; // Marketing Head
          logRemarks = `Review requested by Finance Head. Returned to Marketing Head. Remarks: ${remarks || ''}`;
        }
        else if (currentStatus === 83) {
          // From Finance Executive -> Go back to Finance Head Approval (Stage 10)
          nextStatusId = 27;
          nextDeptId = buId === 1 ? 5 : 11;
          nextAssigneeId = 100018; // Finance Head
          logRemarks = `Review requested by Finance Executive. Returned to Finance Head. Remarks: ${remarks || ''}`;
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

    // 1. Verify header exists and is in Credit Note Pending (83)
    const [headers] = await connection.execute(
      'SELECT Business_Unit_ID, Current_Department_ID, Complaint_Status_ID FROM Complaint_Header WHERE Complaint_ID = ?',
      [id]
    );
    if (headers.length === 0) {
      await connection.rollback();
      return sendError(res, 'Complaint not found.', 404);
    }
    const header = headers[0];
    if (header.Complaint_Status_ID !== 83) {
      await connection.rollback();
      return sendError(res, 'Action denied. Complaint is not pending credit note sync.', 400);
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

    // 4. Update status to Closed (28)
    await connection.execute(
      'UPDATE Complaint_Header SET Complaint_Status_ID = 28, Current_Assignee_ID = NULL WHERE Complaint_ID = ?',
      [id]
    );

    // 5. Log in timeline
    const stageConfigId = buId === 1 ? 11 : 22; // Stage 11 config ID
    await connection.execute(
      `INSERT INTO Complaint_Workflow_Log (
         Complaint_ID, Workflow_ID, Action_By, Action_Date, Action_Type_ID, 
         Previous_Department_ID, Current_Department_ID, Remarks, Created_On
       ) VALUES (?, ?, ?, NOW(), 28, ?, ?, ?, NOW())`,
      [id, stageConfigId, req.user.id, header.Current_Department_ID, header.Current_Department_ID, `Finance processed credit note: ${creditNoteNumber}. Complaint Closed. ${remarks || ''}`]
    );

    await connection.commit();
    return sendSuccess(res, null, 'Finance credit note processed and complaint closed.');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
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
  submitQcReview,
  getQcReviewDetails,
  submitCapa,
  getCapaDetails,
  approveStage,
  submitFinanceCreditNote,
  timelineAction
};
