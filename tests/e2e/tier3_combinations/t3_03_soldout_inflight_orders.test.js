/**
 * Tier 3: Cross-Feature Interaction - XF-03
 * Menu Sold-Out Toggling -> Active In-Flight Order Integrity & New Order Prevention
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 3 - XF-03: Sold-Out Toggling & In-Flight Cart Integrity';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);

  try {
    // 1. Manager creates a limited special dish
    const catRes = await manager.getCategories();
    const catId = (Array.isArray(catRes.body) ? catRes.body : catRes.body?.categories)?.[0]?.id;

    const dishRes = await manager.createMenuItem({
      category_id: catId,
      name: 'Fresh Lobster Tail XF03 ' + Date.now(),
      price: 45.00,
      is_available: true
    });
    const lobsterId = dishRes.body?.item?.id || dishRes.body?.id;

    // 2. Waiter opens order on Table A with 1x Lobster
    const tableARes = await manager.createTable({ table_number: 'T_XF03_A_' + Date.now(), capacity: 2 });
    const tableAId = tableARes.body?.table?.id || tableARes.body?.id;

    const orderARes = await waiter.createOrder({
      table_id: tableAId,
      items: [{ menu_item_id: lobsterId, quantity: 1 }]
    });
    Assertions.assertStatus(orderARes, 201, 'Order A created with Lobster');
    const orderAId = orderARes.body?.order?.id || orderARes.body?.id;

    // 3. Manager marks Lobster as SOLD OUT
    const soldOutRes = await manager.toggleItemAvailability(lobsterId, false);
    Assertions.assertStatus(soldOutRes, 200, 'Mark Lobster Sold Out');

    // 4. Waiter attempts to create a NEW order on Table B with Lobster -> MUST FAIL (400)
    const tableBRes = await manager.createTable({ table_number: 'T_XF03_B_' + Date.now(), capacity: 2 });
    const tableBId = tableBRes.body?.table?.id || tableBRes.body?.id;

    const orderBAttempt = await waiter.createOrder({
      table_id: tableBId,
      items: [{ menu_item_id: lobsterId, quantity: 1 }]
    });
    Assertions.assertStatus(orderBAttempt, 400, 'New order containing sold out item must be rejected');

    // 5. Verify Table A's open order still safely fulfills the already-submitted Lobster
    const orderACheck = await waiter.getOrder(orderAId);
    const orderA = orderACheck.body?.order || orderACheck.body;
    assert.ok(orderA.items.some(i => i.menu_item_id === lobsterId), 'Open order A retains its lobster line item');

    // Close Table A order successfully
    const closeRes = await waiter.closeOrder(orderAId, { payment_method: 'card' });
    Assertions.assertStatus(closeRes, 200, 'Close Table A order successfully');

    results.push({ id: 'XF-03', name: 'Menu Sold-Out Toggling -> Active In-Flight Order Integrity & New Order Prevention', passed: true });
  } catch (err) {
    results.push({ id: 'XF-03', name: 'Menu Sold-Out Toggling -> Active In-Flight Order Integrity & New Order Prevention', passed: false, error: err.message });
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
