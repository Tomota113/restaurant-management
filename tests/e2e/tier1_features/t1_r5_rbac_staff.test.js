/**
 * Tier 1: Feature Coverage - R5 Staff Management & RBAC
 * Spec: ORIGINAL_REQUEST.md §R5
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient, getKitchenClient, ApiClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');
const FIXTURES = require('../helpers/fixtures');

async function runTests(baseUrl) {
  const suiteName = 'Tier 1 - R5: Staff Management & RBAC';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);
  const { client: kitchen } = await getKitchenClient(baseUrl);

  let createdStaffId = null;
  const newStaffUsername = 'waiter_test_' + Date.now();

  // Test 1: TC-T1-AUT-01: Valid User Login & JWT Token Generation
  try {
    const rawClient = new ApiClient(baseUrl);
    const loginRes = await rawClient.login(FIXTURES.users.manager.username, FIXTURES.users.manager.password);
    Assertions.assertStatus(loginRes, 200, 'Login as manager');
    
    assert.ok(rawClient.token, 'Login must issue JWT token');
    const user = loginRes.body?.user || rawClient.currentUser;
    assert.ok(user, 'Login must return user profile');
    assert.strictEqual(user.role, 'manager', 'User role must match manager');

    const meRes = await rawClient.getMe();
    Assertions.assertStatus(meRes, 200, 'Get authenticated user info (/api/auth/me)');

    results.push({ id: 'TC-T1-AUT-01', name: 'User Authentication & JWT Issuance', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-AUT-01', name: 'User Authentication & JWT Issuance', passed: false, error: err.message });
  }

  // Test 2: TC-T1-AUT-02: Manager Creates New Staff Account
  try {
    const createRes = await manager.createStaff({
      username: newStaffUsername,
      password: 'SecurePassword123!',
      full_name: 'Test Staff User',
      role: 'waiter'
    });
    Assertions.assertStatus(createRes, 201, 'Create Staff Account');
    const staff = createRes.body?.user || createRes.body?.staff || createRes.body;
    createdStaffId = staff.id;
    assert.ok(createdStaffId, 'Created staff account must have an ID');
    assert.strictEqual(staff.username, newStaffUsername);
    assert.strictEqual(staff.role, 'waiter');
    assert.strictEqual(staff.password_hash, undefined, 'Password hash must not be exposed');

    results.push({ id: 'TC-T1-AUT-02', name: 'Manager Creates Staff Account with Role Assignment', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-AUT-02', name: 'Manager Creates Staff Account with Role Assignment', passed: false, error: err.message });
  }

  // Test 3: TC-T1-AUT-03: Waiter Role Blocked from Manager-Only Routes (403 Forbidden)
  try {
    // Attempt 1: GET /api/staff (Manager only)
    const staffAttempt = await waiter.getStaff();
    Assertions.assertStatus(staffAttempt, 403, 'Waiter accessing /api/staff');

    // Attempt 2: GET /api/dashboard/summary (Manager only)
    const dashAttempt = await waiter.getDashboardSummary();
    Assertions.assertStatus(dashAttempt, 403, 'Waiter accessing /api/dashboard/summary');

    // Attempt 3: POST /api/inventory/adjust (Manager only)
    const adjustAttempt = await waiter.adjustStock({ ingredient_id: 'test', quantity_delta: 10, adjustment_type: 'delivery', reason: 'unauthorized' });
    Assertions.assertStatus(adjustAttempt, 403, 'Waiter accessing /api/inventory/adjust');

    results.push({ id: 'TC-T1-AUT-03', name: 'Waiter Role Blocked from Manager APIs with 403 Forbidden', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-AUT-03', name: 'Waiter Role Blocked from Manager APIs with 403 Forbidden', passed: false, error: err.message });
  }

  // Test 4: TC-T1-AUT-04: Kitchen Role Scoped Access Enforcement
  try {
    // Kitchen staff can access KDS
    const kdsRes = await kitchen.getKitchenOrders();
    Assertions.assertStatus(kdsRes, 200, 'Kitchen accessing KDS');

    // Kitchen staff CANNOT access /api/staff
    const staffAttempt = await kitchen.getStaff();
    Assertions.assertStatus(staffAttempt, 403, 'Kitchen accessing /api/staff');

    // Kitchen staff CANNOT access dashboard
    const dashAttempt = await kitchen.getDashboardSummary();
    Assertions.assertStatus(dashAttempt, 403, 'Kitchen accessing dashboard');

    results.push({ id: 'TC-T1-AUT-04', name: 'Kitchen Staff Scoped Exclusively to KDS Views (403 on Admin)', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-AUT-04', name: 'Kitchen Staff Scoped Exclusively to KDS Views (403 on Admin)', passed: false, error: err.message });
  }

  // Test 5: TC-T1-AUT-05: Staff Profile Update & Deactivation
  try {
    assert.ok(createdStaffId, 'Requires created staff ID');

    // Update full name
    const updateRes = await manager.updateStaff(createdStaffId, { full_name: 'Updated Staff User' });
    Assertions.assertStatus(updateRes, 200, 'Update staff profile');

    // Deactivate user
    const deactivateRes = await manager.toggleStaffStatus(createdStaffId, false);
    Assertions.assertStatus(deactivateRes, 200, 'Deactivate staff account');

    // Check staff list
    const staffList = await manager.getStaff();
    const staffMembers = Array.isArray(staffList.body) ? staffList.body : staffList.body?.staff || [];
    const target = staffMembers.find(s => s.id === createdStaffId);
    assert.ok(target, 'Target staff should exist in staff list');
    assert.strictEqual(Boolean(target.is_active), false, 'is_active should be false');

    results.push({ id: 'TC-T1-AUT-05', name: 'Staff Profile Update and Account Deactivation', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-AUT-05', name: 'Staff Profile Update and Account Deactivation', passed: false, error: err.message });
  }

  return { suiteName, results };
}

module.exports = { runTests };

if (require.main === module) {
  runTests().then(res => {
    console.log(`\n=== ${res.suiteName} ===`);
    res.results.forEach(r => {
      console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.id}: ${r.name} ${r.error ? '(' + r.error + ')' : ''}`);
    });
  });
}
