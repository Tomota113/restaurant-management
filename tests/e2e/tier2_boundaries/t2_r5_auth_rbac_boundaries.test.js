/**
 * Tier 2: Boundary & Corner Cases - R5 Auth & RBAC Security
 * Spec: ORIGINAL_REQUEST.md §R5
 */

const assert = require('node:assert');
const { getManagerClient, getUnauthenticatedClient, ApiClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 2 - R5: Auth & RBAC Boundaries';
  const results = [];

  const unauthClient = getUnauthenticatedClient(baseUrl);
  const { client: manager } = await getManagerClient(baseUrl);

  // Test 1: TC-T2-AUT-01: Unauthenticated Request Returns 401 Unauthorized
  try {
    const res = await unauthClient.get('/api/staff');
    Assertions.assertStatus(res, 401, 'Unauthenticated request to protected endpoint');

    results.push({ id: 'TC-T2-AUT-01', name: 'Reject Unauthenticated API Requests with 401 Unauthorized', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-AUT-01', name: 'Reject Unauthenticated API Requests with 401 Unauthorized', passed: false, error: err.message });
  }

  // Test 2: TC-T2-AUT-02: Forged / Malformed JWT Token Rejected with 401
  try {
    const forgedClient = new ApiClient(baseUrl, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoibWFuYWdlciJ9.INVALID_SIGNATURE');
    const res = await forgedClient.get('/api/staff');
    Assertions.assertStatus(res, 401, 'Forged JWT token');

    results.push({ id: 'TC-T2-AUT-02', name: 'Reject Forged, Tampered or Malformed JWT Tokens with 401', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-AUT-02', name: 'Reject Forged, Tampered or Malformed JWT Tokens with 401', passed: false, error: err.message });
  }

  // Test 3: TC-T2-AUT-03: Login with Wrong Password Rejected (401)
  try {
    const client = new ApiClient(baseUrl);
    const badLoginRes = await client.login('manager_admin', 'WrongPassword123!');
    Assertions.assertStatus(badLoginRes, 401, 'Login with incorrect password');

    results.push({ id: 'TC-T2-AUT-03', name: 'Reject Login Attempts with Incorrect Password (401)', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-AUT-03', name: 'Reject Login Attempts with Incorrect Password (401)', passed: false, error: err.message });
  }

  // Test 4: TC-T2-AUT-04: Login with Non-Existent User Rejected (401)
  try {
    const client = new ApiClient(baseUrl);
    const nonExistentRes = await client.login('ghost_user_99999', 'AnyPassword123!');
    Assertions.assertStatus(nonExistentRes, 401, 'Login with non-existent username');

    results.push({ id: 'TC-T2-AUT-04', name: 'Reject Login Attempts for Non-Existent Accounts (401)', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-AUT-04', name: 'Reject Login Attempts for Non-Existent Accounts (401)', passed: false, error: err.message });
  }

  // Test 5: TC-T2-AUT-05: Deactivated User Session Invalidation
  try {
    // 1. Create temporary staff
    const tempUsername = 'temp_deact_' + Date.now();
    const tempStaffRes = await manager.createStaff({
      username: tempUsername,
      password: 'Password123!',
      full_name: 'Deactivate Target',
      role: 'waiter'
    });
    const staffId = tempStaffRes.body?.user?.id || tempStaffRes.body?.id;

    // 2. Log in as that staff member and obtain token
    const staffClient = new ApiClient(baseUrl);
    const loginRes = await staffClient.login(tempUsername, 'Password123!');
    Assertions.assertStatus(loginRes, 200, 'Staff login before deactivation');

    // 3. Manager deactivates staff account
    await manager.toggleStaffStatus(staffId, false);

    // 4. Deactivated staff member attempts request with existing token
    const checkRes = await staffClient.get('/api/tables');
    assert.ok(
      checkRes.status === 401 || checkRes.status === 403,
      `Expected 401/403 for deactivated user session, got ${checkRes.status}`
    );

    results.push({ id: 'TC-T2-AUT-05', name: 'Invalidate Active Sessions Immediately Upon Account Deactivation', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-AUT-05', name: 'Invalidate Active Sessions Immediately Upon Account Deactivation', passed: false, error: err.message });
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
