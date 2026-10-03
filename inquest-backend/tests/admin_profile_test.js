const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(s) {
      this.statusCode = s;
      return this;
    },
    json(d) {
      this.body = d;
      return this;
    },
  };
}

async function runTests() {
  console.log("🧪 Starting Admin Profile tests with PostgreSQL...");
  const db = require("../src/db/connection");
  const adminController = require("../src/controllers/admin.controller");
  const customerController = require("../src/controllers/customer.controller");

  async function cleanup() {
    await db.query("DELETE FROM admin_profiles WHERE email LIKE '%@test.com' OR user_id LIKE 'test-%'");
  }

  try {
    // Clean test rows before starting
    await cleanup();

    // ----------------------------------------------------
    // Test 1: getOrCreateProfile creates profile with JWT caller id & sequential code
    // ----------------------------------------------------
    const mockReq1 = {
      user: { id: "test-user-1", role: "admin" },
      body: {
        email: "admin1@test.com",
        name: "Test Admin One",
      },
    };
    const mockRes1 = createMockRes();
    await adminController.getOrCreateProfile(mockReq1, mockRes1);

    assert.strictEqual(mockRes1.statusCode, 200, "Status should be 200");
    assert.strictEqual(mockRes1.body.success, true, "Success should be true");
    assert.strictEqual(mockRes1.body.profile.user_id, "test-user-1");
    assert.strictEqual(mockRes1.body.profile.email, "admin1@test.com");
    assert.strictEqual(mockRes1.body.profile.name, "Test Admin One");
    assert(mockRes1.body.profile.employee_code.startsWith("INQ-ADM-"), "Employee code should start with INQ-ADM-");
    console.log("✅ Test 1 Passed: Admin 1 profile created with code", mockRes1.body.profile.employee_code);

    // Test 1b: Second call from same user returns existing profile (or updates name if provided)
    const mockReq1Update = {
      user: { id: "test-user-1", role: "admin" },
      body: {
        email: "admin1_different@test.com", // Body email ignored for existing user_id
        name: "Updated Admin One",
      },
    };
    const mockRes1Update = createMockRes();
    await adminController.getOrCreateProfile(mockReq1Update, mockRes1Update);
    assert.strictEqual(mockRes1Update.statusCode, 200);
    assert.strictEqual(mockRes1Update.body.profile.user_id, "test-user-1");
    assert.strictEqual(mockRes1Update.body.profile.name, "Updated Admin One");
    assert.strictEqual(mockRes1Update.body.profile.email, "admin1@test.com");
    console.log("✅ Test 1b Passed: Profile lookup and name update by user_id verified");

    // ----------------------------------------------------
    // Test 2: Ownership isolation
    // ----------------------------------------------------
    const userAReq = {
      user: { id: "test-user-a", role: "admin" },
      body: { email: "admin_a@test.com", name: "Admin A" },
    };
    const userBReq = {
      user: { id: "test-user-b", role: "admin" },
      body: { email: "admin_b@test.com", name: "Admin B" },
    };
    await adminController.getOrCreateProfile(userAReq, createMockRes());
    await adminController.getOrCreateProfile(userBReq, createMockRes());

    // Caller B attempts to update name passing Caller A's email in body
    const hackNameReq = {
      user: { id: "test-user-b", role: "admin" },
      body: { email: "admin_a@test.com", name: "Hacked By B" },
    };
    const hackNameRes = createMockRes();
    await adminController.updateProfileName(hackNameReq, hackNameRes);
    assert.strictEqual(hackNameRes.statusCode, 200);
    assert.strictEqual(hackNameRes.body.profile.user_id, "test-user-b");
    assert.strictEqual(hackNameRes.body.profile.name, "Hacked By B");

    // Verify caller A's row was not modified
    const profileARes = await db.query("SELECT * FROM admin_profiles WHERE user_id = $1", ["test-user-a"]);
    assert.strictEqual(profileARes.rows[0].name, "Admin A", "Caller A profile name must remain 'Admin A'");

    // Caller B attempts to update photo passing Caller A's email in body
    const validPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const hackPhotoReq = {
      user: { id: "test-user-b", role: "admin" },
      body: { email: "admin_a@test.com", photo: validPng },
    };
    const hackPhotoRes = createMockRes();
    await adminController.updateProfilePhoto(hackPhotoReq, hackPhotoRes);
    assert.strictEqual(hackPhotoRes.statusCode, 200);
    assert.strictEqual(hackPhotoRes.body.profile.user_id, "test-user-b");
    assert.strictEqual(hackPhotoRes.body.profile.profile_photo, validPng);

    const profileAPhotoRes = await db.query("SELECT * FROM admin_profiles WHERE user_id = $1", ["test-user-a"]);
    assert.strictEqual(profileAPhotoRes.rows[0].profile_photo, null, "Caller A photo must remain null");

    // Unregistered caller C gets 404 on update even if valid email in body
    const nonExistentReq = {
      user: { id: "test-user-c", role: "admin" },
      body: { email: "admin_a@test.com", name: "Does Not Exist" },
    };
    const nonExistentRes = createMockRes();
    await adminController.updateProfileName(nonExistentReq, nonExistentRes);
    assert.strictEqual(nonExistentRes.statusCode, 404);
    assert.strictEqual(nonExistentRes.body.error, "Admin profile not found");
    console.log("✅ Test 2 Passed: Ownership isolation verified (email in body ignored for identity)");

    // ----------------------------------------------------
    // Test 3: 409 on email collision
    // ----------------------------------------------------
    // 3a: Existing user email collision
    const collisionReq = {
      user: { id: "test-user-collision", role: "admin" },
      body: { email: "admin1@test.com", name: "Collision Admin" },
    };
    const collisionRes = createMockRes();
    await adminController.getOrCreateProfile(collisionReq, collisionRes);
    assert.strictEqual(collisionRes.statusCode, 409, "Should return 409 on email collision");
    assert.strictEqual(collisionRes.body.success, false);
    assert.strictEqual(collisionRes.body.error, "Profile email already in use");

    // 3b: Legacy row with user_id NULL collision
    await db.query(
      "INSERT INTO admin_profiles (email, name, employee_code, profile_photo, created_at, updated_at, user_id) VALUES ('legacy@test.com', 'Legacy Admin', 'INQ-ADM-998', NULL, NOW(), NOW(), NULL)"
    );
    const legacyClaimReq = {
      user: { id: "test-user-legacy-claim", role: "admin" },
      body: { email: "legacy@test.com", name: "Attempted Claimer" },
    };
    const legacyClaimRes = createMockRes();
    await adminController.getOrCreateProfile(legacyClaimReq, legacyClaimRes);
    assert.strictEqual(legacyClaimRes.statusCode, 409, "Should return 409 on legacy email collision");
    assert.strictEqual(legacyClaimRes.body.error, "Profile email already in use");

    // Verify legacy row was not claimed
    const legacyCheck = await db.query("SELECT user_id FROM admin_profiles WHERE email = $1", ["legacy@test.com"]);
    assert.strictEqual(legacyCheck.rows[0].user_id, null, "Legacy row user_id must remain null");
    console.log("✅ Test 3 Passed: 409 returned on email collision & legacy rows not auto-claimed");

    // ----------------------------------------------------
    // Test 4: 5 parallel creates with distinct user ids all succeed with distinct codes
    // ----------------------------------------------------
    const parallelAdmins = [1, 2, 3, 4, 5].map((i) => ({
      user: { id: `test-parallel-${i}`, role: "admin" },
      body: { email: `parallel_${i}@test.com`, name: `Parallel Admin ${i}` },
    }));

    const parallelResults = await Promise.all(
      parallelAdmins.map((req) => {
        const res = createMockRes();
        return adminController.getOrCreateProfile(req, res).then(() => res);
      })
    );

    const codes = new Set();
    for (let i = 0; i < 5; i++) {
      assert.strictEqual(parallelResults[i].statusCode, 200, `Parallel ${i + 1} status should be 200`);
      assert.strictEqual(parallelResults[i].body.success, true);
      const code = parallelResults[i].body.profile.employee_code;
      assert(code.startsWith("INQ-ADM-"), "Code must start with INQ-ADM-");
      codes.add(code);
    }
    assert.strictEqual(codes.size, 5, "All 5 employee codes must be distinct");
    console.log("✅ Test 4 Passed: 5 parallel creates succeeded with distinct codes:", Array.from(codes));

    // ----------------------------------------------------
    // Test 5: Profile photo validation
    // ----------------------------------------------------
    const photoUser = { user: { id: "test-user-1", role: "admin" } };

    // 5a: Bad MIME type (e.g. gif)
    const badTypeRes = createMockRes();
    await adminController.updateProfilePhoto(
      { ...photoUser, body: { photo: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" } },
      badTypeRes
    );
    assert.strictEqual(badTypeRes.statusCode, 400);
    assert.strictEqual(badTypeRes.body.error, "Invalid photo");

    // 5b: Too large (> 512 KB)
    const largeBuf = Buffer.alloc(512 * 1024 + 1);
    const largePhoto = "data:image/png;base64," + largeBuf.toString("base64");
    const tooLargeRes = createMockRes();
    await adminController.updateProfilePhoto({ ...photoUser, body: { photo: largePhoto } }, tooLargeRes);
    assert.strictEqual(tooLargeRes.statusCode, 400);
    assert.strictEqual(tooLargeRes.body.error, "Invalid photo");

    // 5c: Invalid format / invalid base64
    const badBase64Res = createMockRes();
    await adminController.updateProfilePhoto({ ...photoUser, body: { photo: "data:image/png;base64,invalid#data!" } }, badBase64Res);
    assert.strictEqual(badBase64Res.statusCode, 400);
    assert.strictEqual(badBase64Res.body.error, "Invalid photo");

    // 5d: Valid PNG
    const validPngRes = createMockRes();
    await adminController.updateProfilePhoto({ ...photoUser, body: { photo: validPng } }, validPngRes);
    assert.strictEqual(validPngRes.statusCode, 200);
    assert.strictEqual(validPngRes.body.profile.profile_photo, validPng);

    // 5e: Explicit null clears photo
    const nullPhotoRes = createMockRes();
    await adminController.updateProfilePhoto({ ...photoUser, body: { photo: null } }, nullPhotoRes);
    assert.strictEqual(nullPhotoRes.statusCode, 200);
    assert.strictEqual(nullPhotoRes.body.profile.profile_photo, null);

    // 5f: Empty string clears photo
    await adminController.updateProfilePhoto({ ...photoUser, body: { photo: validPng } }, createMockRes());
    const emptyPhotoRes = createMockRes();
    await adminController.updateProfilePhoto({ ...photoUser, body: { photo: "" } }, emptyPhotoRes);
    assert.strictEqual(emptyPhotoRes.statusCode, 200);
    assert.strictEqual(emptyPhotoRes.body.profile.profile_photo, null);
    console.log("✅ Test 5 Passed: Profile photo validation verified (bad type, too large, invalid b64, valid png, null/empty clears)");

    // ----------------------------------------------------
    // Test 6: getOverview has no customers/orders/payments keys
    // ----------------------------------------------------
    const overviewRes = createMockRes();
    await adminController.getOverview({}, overviewRes);
    assert.strictEqual(overviewRes.statusCode, 200);
    assert.strictEqual(overviewRes.body.success, true);
    assert.strictEqual("customers" in overviewRes.body.data, false, "customers key must not exist");
    assert.strictEqual("orders" in overviewRes.body.data, false, "orders key must not exist");
    assert.strictEqual("payments" in overviewRes.body.data, false, "payments key must not exist");
    assert(Array.isArray(overviewRes.body.data.tickets), "tickets should be array");
    assert(Array.isArray(overviewRes.body.data.refunds), "refunds should be array");
    assert(Array.isArray(overviewRes.body.data.securityEvents), "securityEvents should be array");
    assert(Array.isArray(overviewRes.body.data.policies), "policies should be array");
    console.log("✅ Test 6 Passed: getOverview returns tickets/refunds/securityEvents/policies without customers/orders/payments");

    // ----------------------------------------------------
    // Test 7: listCustomers and createCustomer return 501
    // ----------------------------------------------------
    const listRes = createMockRes();
    await customerController.listCustomers({}, listRes);
    assert.strictEqual(listRes.statusCode, 501);
    assert.strictEqual(listRes.body.success, false);
    assert.strictEqual(listRes.body.error, "Not implemented: customer data is managed by SpareRoute");

    const createCustRes = createMockRes();
    await customerController.createCustomer({}, createCustRes);
    assert.strictEqual(createCustRes.statusCode, 501);
    assert.strictEqual(createCustRes.body.success, false);
    assert.strictEqual(createCustRes.body.error, "Not implemented: customer data is managed by SpareRoute");
    console.log("✅ Test 7 Passed: customerController methods return 501 Not Implemented");

    console.log("🎉 ALL ADMIN CONTROLLER TESTS PASSED PERFECTLY!");
  } finally {
    // Cleanup test profiles
    await cleanup();
  }
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
