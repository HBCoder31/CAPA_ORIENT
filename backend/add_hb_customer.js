const bcrypt = require('bcryptjs');
const { pool } = require('./config/db');

async function addCustomer() {
  console.log('Adding new customer login hb@itc.in to the database...');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const email = 'hb@itc.in';
    const password = 'hb123';
    const customerId = 'CUST100005';

    // 1. Check if email already exists
    const [existing] = await connection.execute('SELECT Customer_ID FROM Customer_Master WHERE Customer_Email = ?', [email]);
    if (existing.length > 0) {
      console.log(`⚠️ User with email ${email} already exists in DB. Customer_ID: ${existing[0].Customer_ID}`);
      await connection.rollback();
      return;
    }

    // 2. Hash password
    console.log('Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // 3. Insert customer record based on ITC CUST100001 details
    console.log('Inserting customer record in Customer_Master...');
    await connection.execute(`
      INSERT INTO Customer_Master (
        Customer_ID, Customer_Name, Business_Unit_ID, KAM_ID, GSTIN, PAN_Number,
        Customer_Email, Customer_Phone, Billing_Address, Shipping_Address,
        City, State, Country, Postal_Code, Customer_Portal_Access, Customer_Status_ID,
        Last_SAP_Sync, Created_By, Is_Active
      ) VALUES (
        ?, 'ITC Limited (HB Division)', 1, 1, '19AAACI5950L1ZB', 'AAACI5950L',
        ?, '9877000001', 'Virginia House, Kolkata', 'Virginia House, Kolkata',
        'Kolkata', 'West Bengal', 'India', '700071', 1, 3,
        NOW(), 'Admin', 1
      )
    `, [customerId, email]);

    // Insert Login details in Login_Master
    await connection.execute(`
      INSERT INTO Login_Master (Email, Password_Hash, Login_Type_ID, Customer_ID, Is_Active)
      VALUES (?, ?, 1, ?, 1)
      ON DUPLICATE KEY UPDATE Password_Hash = ?
    `, [email, hash, customerId, hash]);

    // 4. Duplicate invoice INV100009 for the new customer so they have selectable invoice lines
    console.log('Duplicating invoice records in Invoice_Master for the new customer...');
    await connection.execute(`
      INSERT INTO Invoice_Master (
        Invoice_No, Line_Item, Customer_ID, Product_Code, Invoice_Date, Delivery_Date,
        Quantity, Unit_Of_Measure, Unit_Price, Net_Amount, Purchase_Order_No,
        Billing_Type, Distribution_Channel, Division, Transporter_Name, Truck_No, LR_Number
      )
      SELECT 
        'INV900009', Line_Item, ?, Product_Code, Invoice_Date, Delivery_Date,
        Quantity, Unit_Of_Measure, Unit_Price, Net_Amount, Purchase_Order_No,
        Billing_Type, Distribution_Channel, Division, Transporter_Name, Truck_No, LR_Number
      FROM Invoice_Master
      WHERE Invoice_No = 'INV100009'
    `, [customerId]);

    await connection.commit();
    console.log(`✅ Success! Customer hb@itc.in (Customer_ID: ${customerId}) added with password hb123.`);
    console.log('✅ Success! Invoice INV900009 created and mapped to the new customer account.');
  } catch (err) {
    await connection.rollback();
    console.error('❌ Failed to add customer:', err.message);
  } finally {
    connection.release();
    process.exit();
  }
}

addCustomer();
