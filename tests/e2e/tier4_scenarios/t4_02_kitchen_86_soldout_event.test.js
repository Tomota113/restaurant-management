/**
 * Tier 4: Real-World Scenarios - RW-02
 * Kitchen 86 / Emergency Sold-Out Incident Protocol
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient, getKitchenClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 4 - RW-02: Kitchen 86 Emergency Sold-Out Protocol';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);
  const { client: kitchen } = await getKitchenClient(baseUrl);

  try {
    // 1. Manager setups menu with "Fresh Oysters on Half Shell" ($24.00) & "Clam Chowder" ($12.00)
    const catRes = await manager.getCategories();
    const catId = (Array.isArray(catRes.body) ? catRes.body : catRes.body?.categories)?.[0]?.id;

    const oystersRes = await manager.createMenuItem({
      category_id: catId,
      name: 'Fresh Oysters RW02 ' + Date.now(),
      description: 'Dozen pacific oysters on shaved ice',
      price: 24.00,
      is_available: true
    });
    const oystersId = oystersRes.body?.item?.id || oystersRes.body?.id;

    const chowderRes = await manager.createMenuItem({
      category_id: catId,
      name: 'Clam Chowder RW02 ' + Date.now(),
      description: 'Creamy New England clam chowder in bread bowl',
      price: 12.00,
      is_available: true
    });
    const chowderId = chowderRes.body?.item?.id || chowderRes.body?.id;

    const tableRes = await manager.createTable({ table_number: 'T_RW02_' + Date.now(), capacity: 2 });
    const tableId = tableRes.body?.table?.id || tableRes.body?.id;

    // 2. Incident occurs: Kitchen informs manager that last oyster batch is spoiled
    // Kitchen triggers / manager toggles "86" on Fresh Oysters
    const toggleRes = await manager.toggleItemAvailability(oystersId, false);
    Assertions.assertStatus(toggleRes, 200, 'Toggle 86 Sold Out on Oysters');

    // 3. Waiter attempts to submit order with Oysters for guest at Table 1
    const orderFailAttempt = await waiter.createOrder({
      table_id: tableId,
      items: [{ menu_item_id: oystersId, quantity: 1 }]
    });
    Assertions.assertStatus(orderFailAttempt, 400, 'Order containing 86 item must be rejected');

    // 4. Waiter explains to guest and recommends Clam Chowder instead
    const orderSuccessRes = await waiter.createOrder({
      table_id: tableId,
      items: [{ menu_item_id: chowderId, quantity: 1 }],
      notes: 'Substituted Chowder for 86 Oysters per guest request'
    });
    Assertions.assertStatus(orderSuccessRes, 201, 'Alternative dish order accepted');
    const orderId = orderSuccessRes.body?.order?.id || orderSuccessRes.body?.id;

    // 5. Kitchen fulfills substituted order smoothly
    await kitchen.updateOrderStatus(orderId, 'ready');
    await waiter.closeOrder(orderId, { payment_method: 'card' });

    results.push({ id: 'RW-02', name: 'Kitchen 86 Emergency Protocol: Immediate Sold-Out Enforcement & Order Re-routing', passed: true });
  } catch (err) {
    results.push({ id: 'RW-02', name: 'Kitchen 86 Emergency Protocol: Immediate Sold-Out Enforcement & Order Re-routing', passed: false, error: err.message });
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
