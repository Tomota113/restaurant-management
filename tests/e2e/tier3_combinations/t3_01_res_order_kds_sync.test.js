/**
 * Tier 3: Cross-Feature Interaction - XF-01
 * Reservation -> Seating -> Order Creation -> KDS Sync -> Table Occupied
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient, getKitchenClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 3 - XF-01: Reservation to Seating to KDS Order Sync';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);
  const { client: kitchen } = await getKitchenClient(baseUrl);

  try {
    // 1. Manager sets up table
    const tableRes = await manager.createTable({
      table_number: 'T_XF01_' + Math.floor(Math.random() * 10000),
      capacity: 4,
      section: 'Main Dining'
    });
    const table = tableRes.body?.table || tableRes.body;
    const tableId = table.id;

    // 2. Waiter books a reservation for table
    const todayStr = new Date().toISOString().slice(0, 10);
    const resPayload = {
      table_id: tableId,
      customer_name: 'Dr. Evelyn Vance',
      customer_phone: '555-0188',
      reservation_date: todayStr,
      reservation_time: '19:00',
      party_size: 3,
      notes: 'VIP Guest'
    };
    const resRes = await waiter.createReservation(resPayload);
    Assertions.assertStatus(resRes, 201, 'Create Reservation');

    // Verify table is marked reserved
    let tables = (await waiter.getTables()).body;
    let currentTable = tables.find(t => t.id === tableId);
    assert.strictEqual(currentTable.status, 'reserved', 'Table must show reserved status');

    // 3. Guest arrives; Waiter opens order on the reserved table
    const menuRes = await waiter.getMenuItems();
    const menuItems = Array.isArray(menuRes.body) ? menuRes.body : menuRes.body?.items || [];
    assert.ok(menuItems.length >= 2, 'Requires menu items');

    const orderPayload = {
      table_id: tableId,
      items: [
        { menu_item_id: menuItems[0].id, quantity: 2, special_instructions: 'Gluten allergy' },
        { menu_item_id: menuItems[1].id, quantity: 1 }
      ],
      notes: 'VIP table order'
    };
    const orderRes = await waiter.createOrder(orderPayload);
    Assertions.assertStatus(orderRes, 201, 'Create Order on Reserved Table');
    const orderId = orderRes.body?.order?.id || orderRes.body?.id;

    // 4. Verify table transitioned from reserved to occupied
    tables = (await waiter.getTables()).body;
    currentTable = tables.find(t => t.id === tableId);
    assert.strictEqual(currentTable.status, 'occupied', 'Table must transition to occupied');

    // 5. Verify order immediately flashes on Kitchen Display View
    const kdsRes = await kitchen.getKitchenOrders();
    Assertions.assertStatus(kdsRes, 200, 'Kitchen display stream');
    const kdsOrders = Array.isArray(kdsRes.body) ? kdsRes.body : kdsRes.body?.orders || [];
    const kdsOrder = kdsOrders.find(o => o.id === orderId);
    assert.ok(kdsOrder, 'Order must appear on Kitchen Display View');
    assert.strictEqual(kdsOrder.table_id, tableId);

    // 6. Cleanup: close order
    await waiter.closeOrder(orderId, { payment_method: 'card' });

    results.push({ id: 'XF-01', name: 'Reservation -> Seating -> Order Creation -> KDS Sync -> Table Occupied', passed: true });
  } catch (err) {
    results.push({ id: 'XF-01', name: 'Reservation -> Seating -> Order Creation -> KDS Sync -> Table Occupied', passed: false, error: err.message });
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
