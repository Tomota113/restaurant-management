/**
 * Tier 2: Boundary & Corner Cases - R3 Floor Plan & Reservations
 * Spec: ORIGINAL_REQUEST.md §R3
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 2 - R3: Table & Reservation Boundaries';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);

  // Setup: Create a test table with capacity = 2
  const tableNum = 'T_BOUND_RES_' + Math.floor(Math.random() * 10000);
  const tableCreate = await manager.createTable({
    table_number: tableNum,
    capacity: 2,
    section: 'Main Dining'
  });
  const testTable = tableCreate.body?.table || tableCreate.body;

  // Test 1: TC-T2-RES-01: Party Size Exceeding Table Capacity Rejected
  try {
    const overflowRes = await waiter.createReservation({
      table_id: testTable.id,
      customer_name: 'Big Group',
      customer_phone: '555-0100',
      reservation_date: '2026-09-01',
      reservation_time: '18:00',
      party_size: 10 // table capacity is 2
    });
    assert.ok(
      overflowRes.status === 400 || overflowRes.status === 422,
      `Expected 400/422 for party size exceeding table capacity, got ${overflowRes.status}`
    );

    results.push({ id: 'TC-T2-RES-01', name: 'Reject Reservation When Party Size Exceeds Table Capacity', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-RES-01', name: 'Reject Reservation When Party Size Exceeds Table Capacity', passed: false, error: err.message });
  }

  // Test 2: TC-T2-RES-02: Zero or Negative Party Size Rejected
  try {
    const zeroPartyRes = await waiter.createReservation({
      table_id: testTable.id,
      customer_name: 'Zero Guests',
      customer_phone: '555-0100',
      reservation_date: '2026-09-01',
      reservation_time: '18:00',
      party_size: 0
    });
    assert.ok(
      zeroPartyRes.status === 400 || zeroPartyRes.status === 422,
      `Expected 400/422 for zero party size, got ${zeroPartyRes.status}`
    );

    results.push({ id: 'TC-T2-RES-02', name: 'Reject Reservation with Zero or Negative Party Size', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-RES-02', name: 'Reject Reservation with Zero or Negative Party Size', passed: false, error: err.message });
  }

  // Test 3: TC-T2-RES-03: Duplicate / Overlapping Reservation Time Slot Rejected
  try {
    // 1. Create first reservation
    const res1 = await waiter.createReservation({
      table_id: testTable.id,
      customer_name: 'First Guest',
      customer_phone: '555-1111',
      reservation_date: '2026-09-05',
      reservation_time: '20:00',
      party_size: 2
    });
    Assertions.assertStatus(res1, 201, 'First reservation creation');

    // 2. Attempt second reservation for same table, same date, same time
    const res2 = await waiter.createReservation({
      table_id: testTable.id,
      customer_name: 'Second Guest Conflict',
      customer_phone: '555-2222',
      reservation_date: '2026-09-05',
      reservation_time: '20:00',
      party_size: 2
    });
    assert.ok(
      res2.status === 400 || res2.status === 409,
      `Expected 400/409 for overlapping reservation conflict, got ${res2.status}`
    );

    results.push({ id: 'TC-T2-RES-03', name: 'Reject Overlapping Reservation on Same Table & Time Slot', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-RES-03', name: 'Reject Overlapping Reservation on Same Table & Time Slot', passed: false, error: err.message });
  }

  // Test 4: TC-T2-RES-04: Duplicate Table Number Rejected in Table Management
  try {
    const dupRes = await manager.createTable({
      table_number: tableNum, // already exists
      capacity: 4
    });
    assert.ok(
      dupRes.status === 400 || dupRes.status === 409,
      `Expected 400/409 for duplicate table number, got ${dupRes.status}`
    );

    results.push({ id: 'TC-T2-RES-04', name: 'Reject Table Creation with Duplicate Table Number', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-RES-04', name: 'Reject Table Creation with Duplicate Table Number', passed: false, error: err.message });
  }

  // Test 5: TC-T2-RES-05: Reject Table Deletion While Occupied
  try {
    // 1. Get menu item
    const menuRes = await waiter.getMenuItems();
    const items = Array.isArray(menuRes.body) ? menuRes.body : menuRes.body?.items || [];
    const validItemId = items[0]?.id;

    // 2. Create order to make table occupied
    const orderRes = await waiter.createOrder({
      table_id: testTable.id,
      items: [{ menu_item_id: validItemId, quantity: 1 }]
    });
    const orderId = orderRes.body?.order?.id || orderRes.body?.id;

    // 3. Attempt to delete table while occupied
    const deleteAttempt = await manager.deleteTable(testTable.id);
    assert.ok(
      deleteAttempt.status === 400 || deleteAttempt.status === 409,
      `Expected 400/409 when deleting occupied table, got ${deleteAttempt.status}`
    );

    // Cleanup: close order
    await waiter.closeOrder(orderId, { payment_method: 'cash' });

    results.push({ id: 'TC-T2-RES-05', name: 'Reject Table Deletion While Occupied with Active Order', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-RES-05', name: 'Reject Table Deletion While Occupied with Active Order', passed: false, error: err.message });
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
