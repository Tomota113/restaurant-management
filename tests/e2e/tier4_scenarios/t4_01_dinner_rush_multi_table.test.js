/**
 * Tier 4: Real-World Scenarios - RW-01
 * Peak Dinner Rush Simulation: Concurrent Multi-Table, Multi-Waiter Service
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient, getKitchenClient, ApiClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 4 - RW-01: Peak Dinner Rush Multi-Table Service Simulation';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter1 } = await getWaiterClient(baseUrl);
  const { client: kitchen } = await getKitchenClient(baseUrl);

  // Create second waiter
  const waiter2Username = 'waiter_rush_2_' + Date.now();
  await manager.createStaff({
    username: waiter2Username,
    password: 'Password123!',
    full_name: 'Rush Waiter Two',
    role: 'waiter'
  });
  const waiter2 = new ApiClient(baseUrl);
  await waiter2.login(waiter2Username, 'Password123!');

  try {
    // 1. Setup 4 tables for the dinner rush
    const tableIds = [];
    for (let i = 1; i <= 4; i++) {
      const tRes = await manager.createTable({
        table_number: `T_RUSH_${i}_` + Date.now(),
        capacity: 4,
        section: i <= 2 ? 'Main Dining' : 'Patio'
      });
      tableIds.push(tRes.body?.table?.id || tRes.body?.id);
    }

    // 2. Setup menu items
    const menuRes = await waiter1.getMenuItems();
    const menuItems = Array.isArray(menuRes.body) ? menuRes.body : menuRes.body?.items || [];
    assert.ok(menuItems.length >= 2, 'Requires menu items');

    // 3. Guests arrive at all 4 tables simultaneously:
    // Waiter 1 seats & takes orders for Table 1 and Table 2
    // Waiter 2 seats & takes orders for Table 3 and Table 4
    const [order1Res, order2Res, order3Res, order4Res] = await Promise.all([
      waiter1.createOrder({
        table_id: tableIds[0],
        items: [{ menu_item_id: menuItems[0].id, quantity: 2 }]
      }),
      waiter1.createOrder({
        table_id: tableIds[1],
        items: [{ menu_item_id: menuItems[1].id, quantity: 3 }]
      }),
      waiter2.createOrder({
        table_id: tableIds[2],
        items: [{ menu_item_id: menuItems[0].id, quantity: 1 }, { menu_item_id: menuItems[1].id, quantity: 1 }]
      }),
      waiter2.createOrder({
        table_id: tableIds[3],
        items: [{ menu_item_id: menuItems[0].id, quantity: 4 }]
      })
    ]);

    Assertions.assertStatus(order1Res, 201, 'Order 1 placed');
    Assertions.assertStatus(order2Res, 201, 'Order 2 placed');
    Assertions.assertStatus(order3Res, 201, 'Order 3 placed');
    Assertions.assertStatus(order4Res, 201, 'Order 4 placed');

    const o1 = order1Res.body?.order?.id || order1Res.body?.id;
    const o2 = order2Res.body?.order?.id || order2Res.body?.id;
    const o3 = order3Res.body?.order?.id || order3Res.body?.id;
    const o4 = order4Res.body?.order?.id || order4Res.body?.id;

    // 4. Kitchen view checks: all 4 orders appear in active queue
    const kdsRes = await kitchen.getKitchenOrders();
    const kdsOrders = Array.isArray(kdsRes.body) ? kdsRes.body : kdsRes.body?.orders || [];
    assert.ok(kdsOrders.some(o => o.id === o1), 'Order 1 on KDS');
    assert.ok(kdsOrders.some(o => o.id === o2), 'Order 2 on KDS');
    assert.ok(kdsOrders.some(o => o.id === o3), 'Order 3 on KDS');
    assert.ok(kdsOrders.some(o => o.id === o4), 'Order 4 on KDS');

    // 5. Kitchen bumps Table 1 & Table 2 to in_preparation, then ready
    await Promise.all([
      kitchen.updateOrderStatus(o1, 'in_preparation'),
      kitchen.updateOrderStatus(o2, 'in_preparation')
    ]);
    await Promise.all([
      kitchen.updateOrderStatus(o1, 'ready'),
      kitchen.updateOrderStatus(o2, 'ready')
    ]);

    // 6. Waiters serve and close Table 1 and Table 2
    await waiter1.updateOrderStatus(o1, 'served');
    await waiter1.closeOrder(o1, { payment_method: 'card' });

    await waiter1.updateOrderStatus(o2, 'served');
    await waiter1.closeOrder(o2, { payment_method: 'cash' });

    // Verify Table 1 & Table 2 are freed up immediately
    const tablesCheck = (await waiter1.getTables()).body;
    const t1 = tablesCheck.find(t => t.id === tableIds[0]);
    const t2 = tablesCheck.find(t => t.id === tableIds[1]);
    assert.strictEqual(t1.status, 'free', 'Table 1 is freed for next guest party');
    assert.strictEqual(t2.status, 'free', 'Table 2 is freed for next guest party');

    // 7. Complete Table 3 & Table 4
    await kitchen.updateOrderStatus(o3, 'ready');
    await kitchen.updateOrderStatus(o4, 'ready');
    await waiter2.closeOrder(o3, { payment_method: 'card' });
    await waiter2.closeOrder(o4, { payment_method: 'card' });

    results.push({ id: 'RW-01', name: 'Peak Dinner Rush Simulation: Concurrent 4-Table Multi-Waiter Operations', passed: true });
  } catch (err) {
    results.push({ id: 'RW-01', name: 'Peak Dinner Rush Simulation: Concurrent 4-Table Multi-Waiter Operations', passed: false, error: err.message });
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
