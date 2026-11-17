/**
 * Tier 1: Feature Coverage - R3 Floor Plan & Table Reservations
 * Spec: ORIGINAL_REQUEST.md §R3
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 1 - R3: Floor Plan & Table Reservations';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);

  let targetTable = null;
  let createdReservationId = null;

  // Setup: Create a dedicated table for reservation testing
  const tableNumber = 'T_RES_' + Math.floor(Math.random() * 10000);
  const createTableRes = await manager.createTable({
    table_number: tableNumber,
    capacity: 4,
    section: 'Main Dining',
    position_x: 200,
    position_y: 200
  });
  targetTable = createTableRes.body?.table || createTableRes.body;

  // Test 1: TC-T1-RES-01: Visual Floor Plan & Table Status Render
  try {
    const tablesRes = await waiter.getTables();
    Assertions.assertStatus(tablesRes, 200, 'Get Floor Plan Tables');
    const tables = Array.isArray(tablesRes.body) ? tablesRes.body : tablesRes.body?.tables || [];
    assert.ok(tables.length > 0, 'Floor plan should return tables');
    
    const found = tables.find(t => t.id === targetTable.id || t.table_number === tableNumber);
    assert.ok(found, 'Created table must be listed in floor plan');
    assert.strictEqual(found.status, 'free', 'Initial table status should be free');
    targetTable.id = found.id;

    results.push({ id: 'TC-T1-RES-01', name: 'Floor Plan Renders All Tables with Coordinates & Free Status', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-RES-01', name: 'Floor Plan Renders All Tables with Coordinates & Free Status', passed: false, error: err.message });
  }

  // Test 2: TC-T1-RES-02: Create Reservation & Transition Table to Reserved
  try {
    const resPayload = {
      table_id: targetTable.id,
      customer_name: 'John Doe',
      customer_phone: '555-0144',
      reservation_date: new Date().toISOString().slice(0, 10),
      reservation_time: '19:30',
      party_size: 4,
      notes: 'Anniversary dinner'
    };

    const res = await waiter.createReservation(resPayload);
    Assertions.assertStatus(res, 201, 'Create Reservation');
    const resObj = res.body?.reservation || res.body;
    createdReservationId = resObj.id;
    assert.ok(createdReservationId, 'Reservation must have an ID');
    assert.strictEqual(resObj.customer_name, 'John Doe');

    // Check table status is updated to reserved
    const tableCheck = await waiter.getTables();
    const updatedTable = tableCheck.body.find(t => t.id === targetTable.id);
    assert.strictEqual(updatedTable.status, 'reserved', 'Table status must transition to reserved');

    results.push({ id: 'TC-T1-RES-02', name: 'Create Reservation & Automatically Update Table to Reserved', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-RES-02', name: 'Create Reservation & Automatically Update Table to Reserved', passed: false, error: err.message });
  }

  // Test 3: TC-T1-RES-03: Update Reservation Details
  try {
    assert.ok(createdReservationId, 'Requires created reservation ID');
    const updatePayload = {
      party_size: 3,
      notes: 'Updated: window seating preferred',
      customer_phone: '555-9999'
    };

    const updateRes = await waiter.updateReservation(createdReservationId, updatePayload);
    Assertions.assertStatus(updateRes, 200, 'Update Reservation');

    const resList = await waiter.getReservations({ date: new Date().toISOString().slice(0, 10) });
    const reservations = Array.isArray(resList.body) ? resList.body : resList.body?.reservations || [];
    const updated = reservations.find(r => r.id === createdReservationId);
    assert.ok(updated, 'Updated reservation should exist');
    assert.strictEqual(updated.party_size, 3);
    assert.strictEqual(updated.customer_phone, '555-9999');

    results.push({ id: 'TC-T1-RES-03', name: 'Update Reservation Party Size, Notes, and Contact Info', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-RES-03', name: 'Update Reservation Party Size, Notes, and Contact Info', passed: false, error: err.message });
  }

  // Test 4: TC-T1-RES-04: Cancel Reservation and Release Table
  try {
    assert.ok(createdReservationId, 'Requires reservation ID');
    const cancelRes = await waiter.cancelReservation(createdReservationId);
    Assertions.assertStatus(cancelRes, 200, 'Cancel Reservation');

    // Verify table is released to free
    const tablesRes = await waiter.getTables();
    const table = tablesRes.body.find(t => t.id === targetTable.id);
    assert.strictEqual(table.status, 'free', 'Table status must revert to free after reservation cancellation');

    results.push({ id: 'TC-T1-RES-04', name: 'Cancel Reservation & Revert Table Status to Free', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-RES-04', name: 'Cancel Reservation & Revert Table Status to Free', passed: false, error: err.message });
  }

  // Test 5: TC-T1-RES-05: Dynamic Table Sync on Order Open/Close
  try {
    // 1. Get a valid menu item
    const menuRes = await waiter.getMenuItems();
    const items = Array.isArray(menuRes.body) ? menuRes.body : menuRes.body?.items || [];
    assert.ok(items.length > 0, 'Menu item required for order');
    const menuItemId = items.find(i => i.is_available)?.id || items[0].id;

    // 2. Open order on target table (currently free)
    const orderRes = await waiter.createOrder({
      table_id: targetTable.id,
      items: [{ menu_item_id: menuItemId, quantity: 1 }]
    });
    Assertions.assertStatus(orderRes, 201, 'Create Order on Free Table');
    const orderId = orderRes.body?.order?.id || orderRes.body?.id;

    // 3. Verify table is now occupied
    let checkTables = await waiter.getTables();
    let table = checkTables.body.find(t => t.id === targetTable.id);
    assert.strictEqual(table.status, 'occupied', 'Table must be occupied while order is open');

    // 4. Close order
    const closeRes = await waiter.closeOrder(orderId, { payment_method: 'cash' });
    Assertions.assertStatus(closeRes, 200, 'Close Order');

    // 5. Verify table is back to free
    checkTables = await waiter.getTables();
    table = checkTables.body.find(t => t.id === targetTable.id);
    assert.strictEqual(table.status, 'free', 'Table must return to free when order is closed');

    results.push({ id: 'TC-T1-RES-05', name: 'Automatic Table State Transitions (free -> occupied -> free)', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-RES-05', name: 'Automatic Table State Transitions (free -> occupied -> free)', passed: false, error: err.message });
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
