/**
 * Tier 3: Cross-Feature Interaction - XF-04
 * Role Permission Enforcement across Complete Multi-Role Operational Flow
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient, getKitchenClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 3 - XF-04: Cross-Role Operational Flow & RBAC Enforcement';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);
  const { client: kitchen } = await getKitchenClient(baseUrl);

  try {
    // 1. Manager prepares table & dishes
    const tableRes = await manager.createTable({ table_number: 'T_XF04_' + Date.now(), capacity: 4 });
    const tableId = tableRes.body?.table?.id || tableRes.body?.id;

    const menuRes = await waiter.getMenuItems();
    const items = Array.isArray(menuRes.body) ? menuRes.body : menuRes.body?.items || [];
    const itemId = items[0]?.id;

    // 2. Waiter opens order
    const orderRes = await waiter.createOrder({
      table_id: tableId,
      items: [{ menu_item_id: itemId, quantity: 2 }]
    });
    Assertions.assertStatus(orderRes, 201, 'Waiter opens order');
    const orderId = orderRes.body?.order?.id || orderRes.body?.id;

    // 3. Kitchen views ticket on KDS and updates to in_preparation
    const kdsRes = await kitchen.getKitchenOrders();
    Assertions.assertStatus(kdsRes, 200, 'Kitchen views KDS');
    
    const prepRes = await kitchen.updateOrderStatus(orderId, 'in_preparation');
    Assertions.assertStatus(prepRes, 200, 'Kitchen updates status to in_preparation');

    // 4. Kitchen marks ready
    const readyRes = await kitchen.updateOrderStatus(orderId, 'ready');
    Assertions.assertStatus(readyRes, 200, 'Kitchen marks order ready');

    // 5. Kitchen attempts to close order / settle payment -> MUST BE FORBIDDEN (403)
    const kitchenCloseAttempt = await kitchen.closeOrder(orderId, { payment_method: 'card' });
    Assertions.assertStatus(kitchenCloseAttempt, 403, 'Kitchen closing order is forbidden');

    // 6. Waiter serves order & closes bill
    const servedRes = await waiter.updateOrderStatus(orderId, 'served');
    Assertions.assertStatus(servedRes, 200, 'Waiter marks order served');

    const closeRes = await waiter.closeOrder(orderId, { payment_method: 'card' });
    Assertions.assertStatus(closeRes, 200, 'Waiter settles bill and closes order');

    // 7. Waiter attempts to view manager financial dashboard -> FORBIDDEN (403)
    const waiterDashAttempt = await waiter.getDashboardSummary();
    Assertions.assertStatus(waiterDashAttempt, 403, 'Waiter accessing financial dashboard is forbidden');

    results.push({ id: 'XF-04', name: 'Cross-Role Multi-Step Workflow with Strict Role Isolation', passed: true });
  } catch (err) {
    results.push({ id: 'XF-04', name: 'Cross-Role Multi-Step Workflow with Strict Role Isolation', passed: false, error: err.message });
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
