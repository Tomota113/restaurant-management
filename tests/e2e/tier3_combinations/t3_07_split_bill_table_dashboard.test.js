/**
 * Tier 3: Cross-Feature Interaction - XF-07
 * Full Order Lifecycle -> Table Release -> Immediate Dashboard Revenue & Popular Dishes Update
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient, getKitchenClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 3 - XF-07: Full Order Lifecycle to Immediate Dashboard Metrics Update';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);
  const { client: kitchen } = await getKitchenClient(baseUrl);

  try {
    // 1. Snapshot initial today revenue
    const initSummary = (await manager.getDashboardSummary()).body;
    const initialTodayRev = Number(initSummary.today_revenue || 0);

    // 2. Create distinct test item with price $40.00
    const catRes = await manager.getCategories();
    const catId = (Array.isArray(catRes.body) ? catRes.body : catRes.body?.categories)?.[0]?.id;

    const dishRes = await manager.createMenuItem({
      category_id: catId,
      name: 'Signature Feast XF07 ' + Date.now(),
      price: 40.00,
      is_available: true
    });
    const dishId = dishRes.body?.item?.id || dishRes.body?.id;

    // 3. Create table
    const tableRes = await manager.createTable({ table_number: 'T_XF07_' + Date.now(), capacity: 4 });
    const tableId = tableRes.body?.table?.id || tableRes.body?.id;

    // 4. Open order for 2x Signature Feast -> $80.00
    const orderRes = await waiter.createOrder({
      table_id: tableId,
      items: [{ menu_item_id: dishId, quantity: 2 }]
    });
    const orderId = orderRes.body?.order?.id || orderRes.body?.id;

    // 5. Lifecycle progression
    await kitchen.updateOrderStatus(orderId, 'in_preparation');
    await kitchen.updateOrderStatus(orderId, 'ready');
    await waiter.updateOrderStatus(orderId, 'served');

    // 6. Close order
    const closeRes = await waiter.closeOrder(orderId, { payment_method: 'card', tip: 10.00 });
    Assertions.assertStatus(closeRes, 200, 'Close Order');

    // 7. Verify table is released to free
    const tables = (await waiter.getTables()).body;
    const table = tables.find(t => t.id === tableId);
    assert.strictEqual(table.status, 'free', 'Table status must revert to free');

    // 8. Verify dashboard revenue increased by exactly $80.00
    const postSummary = (await manager.getDashboardSummary()).body;
    const postTodayRev = Number(postSummary.today_revenue || 0);
    Assertions.assertDecimal(postTodayRev - initialTodayRev, 80.00, 0.05, 'Revenue must increment by exactly the closed order amount');

    // 9. Verify dish is recorded in popular dishes ranking
    const popRes = await manager.getPopularDishes();
    const popularDishes = Array.isArray(popRes.body) ? popRes.body : popRes.body?.dishes || [];
    const feastDish = popularDishes.find(d => d.id === dishId || d.menu_item_id === dishId || d.name?.includes('Signature Feast'));
    assert.ok(feastDish, 'Closed dish must appear in popular dishes analytics');

    results.push({ id: 'XF-07', name: 'Order Close -> Table Free -> Instant Live Dashboard Revenue & Popular Dishes Update', passed: true });
  } catch (err) {
    results.push({ id: 'XF-07', name: 'Order Close -> Table Free -> Instant Live Dashboard Revenue & Popular Dishes Update', passed: false, error: err.message });
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
