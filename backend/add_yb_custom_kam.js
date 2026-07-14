const bcrypt = require('bcryptjs');
const { pool } = require('./config/db');

async function setupCustomKamAndCustomer() {
  console.log('🚀 Running database transaction to create new KAM and Customer accounts...');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const kamEmail = 'db@orientpaper.com';
    const kamPassword = 'db123';
    const kamEmpId = 100020;
    const kamCode = 'EMP100020';

    const custEmail = 'yb@itc.in';
    const custPassword = 'yb123';
    const custId = 'CUST100006';

    // 1. Verify accounts do not exist
    const [existingKam] = await connection.execute('SELECT Employee_ID FROM Employee_Master WHERE Official_Email = ?', [kamEmail]);
    if (existingKam.length > 0) {
      console.log(`⚠️ KAM ${kamEmail} already exists.`);
      await connection.rollback();
      return;
    }

    const [existingCust] = await connection.execute('SELECT Customer_ID FROM Customer_Master WHERE Customer_Email = ?', [custEmail]);
    if (existingCust.length > 0) {
      console.log(`⚠️ Customer ${custEmail} already exists.`);
      await connection.rollback();
      return;
    }

    // 2. Hash passwords
    console.log('   - Hashing passwords...');
    const kamHash = await bcrypt.hash(kamPassword, 10);
    const custHash = await bcrypt.hash(custPassword, 10);

    // 3. Insert Employee record (Role ID 3 = KAM, Status ID 6 = Active, Dept ID 1 = Technical Services)
    console.log('   - Creating employee record...');
    await connection.execute(`
      INSERT INTO Employee_Master (
        Employee_ID, Employee_Code, Employee_Name, Official_Email,
        Department_ID, Role_ID, Employee_Status_ID, Created_On, Is_Active
      ) VALUES (?, ?, 'Dev Brat (KAM)', ?, 1, 3, 6, NOW(), 1)
    `, [kamEmpId, kamCode, kamEmail]);

    // Insert Login details for KAM in Login_Master (Type 2 = Employee)
    await connection.execute(`
      INSERT INTO Login_Master (Email, Password_Hash, Login_Type_ID, Employee_ID, Is_Active)
      VALUES (?, ?, 2, ?, 1)
      ON DUPLICATE KEY UPDATE Password_Hash = ?
    `, [kamEmail, kamHash, kamEmpId, kamHash]);

    // 4. Insert KAM record in KAM_Master
    console.log('   - Registering employee in KAM_Master...');
    const [kamInsertRes] = await connection.execute(`
      INSERT INTO KAM_Master (
        Employee_ID, KAM_Status_ID, Created_On, Is_Active
      ) VALUES (?, 14, NOW(), 1)
    `, [kamEmpId]);
    const newKamId = kamInsertRes.insertId;

    // 5. Insert Customer in Customer_Master (Assigned to newKamId)
    console.log('   - Creating customer record in Customer_Master...');
    await connection.execute(`
      INSERT INTO Customer_Master (
        Customer_ID, Customer_Name, Business_Unit_ID, KAM_ID, GSTIN, PAN_Number,
        Customer_Email, Customer_Phone, Billing_Address, Shipping_Address,
        City, State, Country, Postal_Code, Customer_Portal_Access, Customer_Status_ID,
        Last_SAP_Sync, Created_By, Is_Active
      ) VALUES (
        ?, 'ITC Limited (YB Division)', 1, ?, '19AAACI5950L1ZB', 'AAACI5950L',
        ?, '9877000001', 'Virginia House, Kolkata', 'Virginia House, Kolkata',
        'Kolkata', 'West Bengal', 'India', '700071', 1, 3,
        NOW(), 'Admin', 1
      )
    `, [custId, newKamId, custEmail]);

    // Insert Login details for Customer in Login_Master (Type 1 = Customer)
    await connection.execute(`
      INSERT INTO Login_Master (Email, Password_Hash, Login_Type_ID, Customer_ID, Is_Active)
      VALUES (?, ?, 1, ?, 1)
      ON DUPLICATE KEY UPDATE Password_Hash = ?
    `, [custEmail, custHash, custId, custHash]);

    // 6. Duplicate Invoice INV100009 as INV900010 for YB customer
    console.log('   - Mapping duplicate mock invoice INV900010 to YB Division...');
    await connection.execute(`
      INSERT INTO Invoice_Master (
        Invoice_No, Line_Item, Customer_ID, Product_Code, Invoice_Date, Delivery_Date,
        Quantity, Unit_Of_Measure, Unit_Price, Net_Amount, Purchase_Order_No,
        Billing_Type, Distribution_Channel, Division, Transporter_Name, Truck_No, LR_Number
      )
      SELECT 
        'INV900010', Line_Item, ?, Product_Code, Invoice_Date, Delivery_Date,
        Quantity, Unit_Of_Measure, Unit_Price, Net_Amount, Purchase_Order_No,
        Billing_Type, Distribution_Channel, Division, Transporter_Name, Truck_No, LR_Number
      FROM Invoice_Master
      WHERE Invoice_No = 'INV100009'
    `, [custId]);

    await connection.commit();
    console.log(`\n🎉 SUCCESS! 🎉`);
    console.log(`   - KAM created: ${kamEmail} (password: ${kamPassword}, KAM_ID: ${newKamId})`);
    console.log(`   - Customer created: ${custEmail} (password: ${custPassword}, Customer_ID: ${custId})`);
    console.log(`   - Invoices mapped: INV900010 successfully linked.`);
  } catch (err) {
    await connection.rollback();
    console.error('❌ Transaction failed:', err.message);
  } finally {
    connection.release();
    process.exit();
  }
}

setupCustomKamAndCustomer();
