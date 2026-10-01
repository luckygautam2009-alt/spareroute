const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function runTests() {
  console.log('🧪 Starting Admin Profile tests with PostgreSQL...');
  const db = require('../src/db/connection');
  const adminController = require('../src/controllers/admin.controller');

  // Clean test rows
  await db.query("DELETE FROM admin_profiles WHERE email LIKE '%@test.com'");

  // Test 1: getOrCreateProfile creates a new admin profile with sequential employee code
  const mockReq1 = {
    body: {
      email: 'admin1@test.com',
      name: 'Test Admin One',
    },
  };

  let resData1 = null;
  let resStatus1 = 0;
  const mockRes1 = {
    status(s) { resStatus1 = s; return this; },
    json(d) { resData1 = d; return this; },
  };

  await adminController.getOrCreateProfile(mockReq1, mockRes1);

  assert.strictEqual(resStatus1, 200, 'Status should be 200');
  assert.strictEqual(resData1.success, true, 'Success should be true');
  assert.strictEqual(resData1.profile.email, 'admin1@test.com');
  assert.strictEqual(resData1.profile.name, 'Test Admin One');
  assert(resData1.profile.employee_code.startsWith('INQ-ADM-'), 'Employee code should start with INQ-ADM-');
  console.log('✅ Test 1 Passed: Admin 1 profile created with code', resData1.profile.employee_code);

  // Test 2: Second admin gets next sequential code
  const mockReq2 = {
    body: {
      email: 'admin2@test.com',
      name: 'Test Admin Two',
    },
  };
  let resData2 = null;
  const mockRes2 = {
    status() { return this; },
    json(d) { resData2 = d; return this; },
  };
  await adminController.getOrCreateProfile(mockReq2, mockRes2);
  assert.notStrictEqual(resData1.profile.employee_code, resData2.profile.employee_code, 'Employee codes must be unique');
  console.log('✅ Test 2 Passed: Admin 2 profile created with code', resData2.profile.employee_code);

  // Test 3: Photo update via API
  const photoData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const photoReq = {
    body: {
      email: 'admin1@test.com',
      photo: photoData,
    },
  };
  let photoResData = null;
  const photoRes = {
    status() { return this; },
    json(d) { photoResData = d; return this; },
  };
  await adminController.updateProfilePhoto(photoReq, photoRes);
  assert.strictEqual(photoResData.profile.profile_photo, photoData, 'Photo should be saved to profile');
  console.log('✅ Test 3 Passed: Profile photo updated successfully');

  // Test 4: Name update via API
  const nameReq = {
    body: {
      email: 'admin1@test.com',
      name: 'Updated Admin One',
    },
  };
  let nameResData = null;
  const nameRes = {
    status() { return this; },
    json(d) { nameResData = d; return this; },
  };
  await adminController.updateProfileName(nameReq, nameRes);
  assert.strictEqual(nameResData.profile.name, 'Updated Admin One', 'Name should be updated');
  console.log('✅ Test 4 Passed: Profile name updated successfully');

  // Test 5: getOverview returns tickets, refunds, securityEvents, policies and empty customers/orders/payments
  let overviewData = null;
  const overviewRes = {
    status(s) { return this; },
    json(d) { overviewData = d; return this; },
  };
  await adminController.getOverview({}, overviewRes);
  assert.strictEqual(overviewData.success, true);
  assert(Array.isArray(overviewData.data.customers), 'customers should be array');
  assert.strictEqual(overviewData.data.customers.length, 0, 'customers should be empty array');
  assert(Array.isArray(overviewData.data.orders), 'orders should be array');
  assert.strictEqual(overviewData.data.orders.length, 0, 'orders should be empty array');
  assert(Array.isArray(overviewData.data.payments), 'payments should be array');
  assert.strictEqual(overviewData.data.payments.length, 0, 'payments should be empty array');
  assert(Array.isArray(overviewData.data.tickets), 'tickets should be array');
  assert(Array.isArray(overviewData.data.refunds), 'refunds should be array');
  assert(Array.isArray(overviewData.data.securityEvents), 'securityEvents should be array');
  assert(Array.isArray(overviewData.data.policies), 'policies should be array');
  console.log('✅ Test 5 Passed: getOverview returns correct schema with PostgreSQL data');

  // Cleanup test profiles
  await db.query("DELETE FROM admin_profiles WHERE email LIKE '%@test.com'");
  console.log('🎉 ALL ADMIN CONTROLLER TESTS PASSED PERFECTLY!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
