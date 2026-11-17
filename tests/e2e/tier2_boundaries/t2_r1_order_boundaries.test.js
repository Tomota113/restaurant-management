/**
 * Tier 2: Boundary & Corner Cases - R1 Order Management
 * Spec: ORIGINAL_REQUEST.md §R1 & Acceptance Criteria
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 2 - R1: Order Boundaries & Corner Cases';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);

  // Setup helper: Get a valid menu item and table
  let validItemId = null;
  let testTableId = null;

  const menuRes = await waiter.getMenuItems();
  const items = Array.isArray(menuRes.body) ? menuRes.body : menuRes.body?.items || [];
  validItemId = items[0]?.id;

  const tableCreate = await manager.createTable({
    table_number: 'T_T2_ORD_' + Math.floor(Math.random() * 10000),
    capacity: 4
  });
  testTableId = tableCreate.body?.table?.id || tableCreate.body?.id;

  // Test 1: TC-T2-ORD-01: Empty Order Submission Rejected (400)
  try {
    const emptyOrderRes = await waiter.createOrder({
      table_id: testTableId,
      items: []
    });
    Assertions.assertStatus(emptyOrderRes, 400, 'Empty order should be rejected with 400');
    Assertions.assertError(emptyOrderRes, 400, 'empty');

    results.push({ id: 'TC-T2-ORD-01', name: 'Reject Empty Order Submission with 400 Bad Request', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-ORD-01', name: 'Reject Empty Order Submission with 400 Bad Request', passed: false, error: err.message });
  }

  // Test 2: TC-T2-ORD-02: Non-existent Table ID in Order Creation Rejected
  try {
    const fakeTableOrder = await waiter.createOrder({
      table_id: 'non-existent-table-uuid-99999',
      items: [{ menu_item_id: validItemId, quantity: 1 }]
    });
    assert.ok(
      fakeTableOrder.status === 400 || fakeTableOrder.status === 404,
      `Expected status 400 or 404 for invalid table ID, got ${fakeTableOrder.status}`
    );

    results.push({ id: 'TC-T2-ORD-02', name: 'Reject Order Creation for Non-Existent Table ID', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-ORD-02', name: 'Reject Order Creation for Non-Existent Table ID', passed: false, error: err.message });
  }

  // Test 3: TC-T2-ORD-03: Reject Creating New Order on Already Occupied Table
  try {
    // 1. Create first valid order
    const firstOrderRes = await waiter.createOrder({
      table_id: testTableId,
      items: [{ menu_item_id: validItemId, quantity: 1 }]
    });
    Assertions.assertStatus(firstOrderRes, 201, 'First order creation on table');
    const firstOrderId = firstOrderRes.body?.order?.id || firstOrderRes.body?.id;

    // 2. Attempt second order on the same table (which is now occupied)
    const secondOrderRes = await waiter.createOrder({
      table_id: testTableId,
      items: [{ menu_item_id: validItemId, quantity: 2 }]
    });
    Assertions.assertStatus(secondOrderRes, 400, 'Second order on occupied table must fail');
    Assertions.assertError(secondOrderRes, 400, 'occupied');

    // Cleanup: close first order
    await waiter.closeOrder(firstOrderId, { payment_method: 'cash' });

    results.push({ id: 'TC-T2-ORD-03', name: 'Reject New Order Creation on Already Occupied Table', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-ORD-03', name: 'Reject New Order Creation on Already Occupied Table', passed: false, error: err.message });
  }

  // Test 4: TC-T2-ORD-04: Reject Invalid State Machine Transition
  try {
    // 1. Create order
    const orderRes = await waiter.createOrder({
      table_id: testTableId,
      items: [{ menu_item_id: validItemId, quantity: 1 }]
    });
    const orderId = orderRes.body?.order?.id || orderRes.body?.id;

    // 2. Close order directly
    await waiter.closeOrder(orderId, { payment_method: 'card' });

    // 3. Attempt to transition closed order back to pending or in_preparation
    const invalidTransitionRes = await waiter.updateOrderStatus(orderId, 'pending');
    assert.ok(
      invalidTransitionRes.status === 400 || invalidTransitionRes.status === 422,
      `Expected status 400/422 for invalid transition from closed to pending, got ${invalidTransitionRes.status}`
    );

    results.push({ id: 'TC-T2-ORD-04', name: 'Reject Invalid Order State Transitions (e.g. closed -> pending)', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-ORD-04', name: 'Reject Invalid Order State Transitions (e.g. closed -> pending)', passed: false, error: err.message });
  }

  // Test 5: TC-T2-ORD-05: Reject Modifying Items on Closed Order
  try {
    // 1. Create order
    const orderRes = await waiter.createOrder({
      table_id: testTableId,
      items: [{ menu_item_id: validItemId, quantity: 1 }]
    });
    const orderId = orderRes.body?.order?.id || orderRes.body?.id;

    // 2. Close order
    await waiter.closeOrder(orderId, { payment_method: 'card' });

    // 3. Attempt to modify items
    const modifyRes = await waiter.updateOrderItems(orderId, [
      { menu_item_id: validItemId, quantity: 5 }
    ]);
    assert.ok(
      modifyRes.status === 400 || modifyRes.status === 422,
      `Expected 400/422 when modifying closed order, got ${modifyRes.status}`
    );

    results.push({ id: 'TC-T2-ORD-05', name: 'Reject Mutating Line Items on Finalized/Closed Order', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-ORD-05', name: 'Reject Mutating Line Items on Finalized/Closed Order', passed: false, error: err.message });
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
