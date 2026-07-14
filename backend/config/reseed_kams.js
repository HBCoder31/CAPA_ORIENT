const { pool } = require('./db');
const bcrypt = require('bcryptjs');

async function run() {
  console.log('🔄 Reseeding KAMs & Customer Mappings...');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Ensure new KAM employees exist in Employee_Master
    const kams = [
      { id: 100020, name: 'Dev Brat (KAM)', code: 'EMP100020', email: 'db@orientpaper.com', deptId: 6 },
      { id: 100021, name: 'Siddharth Roy (KAM)', code: 'EMP100021', email: 'siddharth@orientpaper.com', deptId: 6 },
      { id: 100022, name: 'Komal Sharma (KAM)', code: 'EMP100022', email: 'komal@orientpaper.com', deptId: 12 },
      { id: 100023, name: 'Vikas Malhotra (KAM)', code: 'EMP100023', email: 'vikas@orientpaper.com', deptId: 12 }
    ];

    for (const kam of kams) {
      await connection.execute(`
        INSERT INTO Employee_Master (
          Employee_ID, Employee_Code, Employee_Name, Official_Email, Department_ID, Role_ID, Employee_Status_ID, Is_Active
        ) VALUES (?, ?, ?, ?, ?, 3, 6, 1)
        ON DUPLICATE KEY UPDATE 
          Employee_Name = VALUES(Employee_Name),
          Department_ID = VALUES(Department_ID),
          Role_ID = VALUES(Role_ID),
          Is_Active = 1
      `, [kam.id, kam.code, kam.name, kam.email, kam.deptId]);
      console.log(`✅ Configured employee: ${kam.name}`);
    }

    // 2. Clear old mappings in KAM_Master and re-insert 4 clean KAM IDs
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('DELETE FROM KAM_Master');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    const kamMasterSeeds = [
      { id: 1, empId: 100020 }, // Dev Brat
      { id: 2, empId: 100021 }, // Siddharth Roy
      { id: 3, empId: 100022 }, // Komal Sharma
      { id: 4, empId: 100023 }  // Vikas Malhotra
    ];

    for (const seed of kamMasterSeeds) {
      await connection.execute(`
        INSERT INTO KAM_Master (KAM_ID, Employee_ID, KAM_Status_ID, Is_Active)
        VALUES (?, ?, 14, 1)
      `, [seed.id, seed.empId]);
    }
    console.log('✅ Re-seeded KAM_Master with real KAM employees.');

    // 3. Update Customer_Master KAM assignments
    const customerMappings = [
      { customerId: 'CUST100001', kamId: 1 },
      { customerId: 'CUST100002', kamId: 1 },
      { customerId: 'CUST100003', kamId: 2 },
      { customerId: 'CUST100004', kamId: 2 },
      { customerId: 'CUST100005', kamId: 1 },
      { customerId: 'CUST100006', kamId: 1 }, // Map ITC YB Division to KAM_ID = 1 (Dev Brat) as well
      { customerId: 'CUST200001', kamId: 3 },
      { customerId: 'CUST200002', kamId: 3 },
      { customerId: 'CUST200003', kamId: 4 },
      { customerId: 'CUST200004', kamId: 4 }
    ];

    for (const map of customerMappings) {
      await connection.execute(`
        UPDATE Customer_Master SET KAM_ID = ? WHERE Customer_ID = ?
      `, [map.kamId, map.customerId]);
    }
    console.log('✅ Updated Customer_Master KAM assignments.');

    // 4. Truncate & Re-populate Customer_KAM_Segment_Assignment
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('DELETE FROM Customer_KAM_Segment_Assignment');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    await connection.execute(`
      INSERT INTO Customer_KAM_Segment_Assignment (Customer_ID, Business_Unit_ID, KAM_ID)
      SELECT Customer_ID, Business_Unit_ID, KAM_ID
      FROM Customer_Master
      WHERE KAM_ID IS NOT NULL
    `);
    console.log('✅ Re-populated Customer_KAM_Segment_Assignment segment table.');

    // 5. Seed credentials inside Login_Master with default password "password123"
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);

    for (const kam of kams) {
      await connection.execute(`
        INSERT INTO Login_Master (Email, Password_Hash, Login_Type_ID, Employee_ID, Is_Active)
        VALUES (?, ?, 2, ?, 1)
        ON DUPLICATE KEY UPDATE Password_Hash = VALUES(Password_Hash), Employee_ID = VALUES(Employee_ID)
      `, [kam.email, hash, kam.id]);
    }
    console.log('✅ Seeded KAM credentials in Login_Master.');

    await connection.commit();
    console.log('🎉 KAM Reseeding completed successfully!');
    process.exit(0);
  } catch (err) {
    await connection.rollback();
    console.error('❌ Reseeding failed:', err);
    process.exit(1);
  } finally {
    connection.release();
  }
}

run();
