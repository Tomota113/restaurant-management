/**
 * Tier 4: Real-World Scenarios - RW-03
 * Full Restaurant Shift Lifecycle (Morning Open -> Lunch -> Waste -> Dinner -> Nightly Closeout)
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient, getKitchenClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 4 - RW-03: Full Restaurant Daily Shift Lifecycle Simulation';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);
  const { client: kitchen } = await getKitchenClient(baseUrl);

  try {
    // -------------------------------------------------------------
    // PHASE 1: Morning Open (09:00 - 11:00)
    // Receive inventory delivery & setup specials
    // -------------------------------------------------------------
    const ribeyeRes = await manager.createIngredient({
      name: 'Prime Ribeye RW03 ' + Date.now(),
      unit: 'kg',
      current_stock: 5.0,
      low_stock_threshold: 2.0
    });
    const ribeyeId = ribeyeRes.body?.ingredient?.id || ribeyeRes.body?.id;

    // Receive morning supplier delivery: +10kg
    const deliveryRes = await manager.adjustStock({
      ingredient_id: ribeyeId,
      adjustment_type: 'delivery',
      quantity_delta: 10.0,
      reason: 'Morning distributor invoice #8849'
    });
    Assertions.assertStatus(deliveryRes, 200, 'Morning delivery logged');

    // Create dish and recipe BOM
    const catRes = await manager.getCategories();
    const catId = (Array.isArray(catRes.body) ? catRes.body : catRes.body?.categories)?.[0]?.id;

    const steakRes = await manager.createMenuItem({
      category_id: catId,
      name: 'Prime Ribeye Steak RW03 ' + Date.now(),
      price: 38.00,
      is_available: true
    });
    const steakId = steakRes.body?.item?.id || steakRes.body?.id;

    await manager.createRecipe({
      menu_item_id: steakId,
      ingredients: [{ ingredient_id: ribeyeId, quantity_required: 0.5 }] // 0.5kg per steak
    });

    const shiftTableRes = await manager.createTable({
      table_number: 'T_SHIFT_' + Date.now(),
      capacity: 4,
      section: 'Main Dining'
    });
    const shiftTableId = shiftTableRes.body?.table?.id || shiftTableRes.body?.id;

    // -------------------------------------------------------------
    // PHASE 2: Lunch Service (11:30 - 14:30)
    // First turnover: 2 steaks ordered & completed
    // -------------------------------------------------------------
    const lunchOrderRes = await waiter.createOrder({
      table_id: shiftTableId,
      items: [{ menu_item_id: steakId, quantity: 2 }]
    });
    const lunchOrderId = lunchOrderRes.body?.order?.id || lunchOrderRes.body?.id;

    await kitchen.updateOrderStatus(lunchOrderId, 'in_preparation');
    await kitchen.updateOrderStatus(lunchOrderId, 'ready');
    await waiter.updateOrderStatus(lunchOrderId, 'served');
    await waiter.closeOrder(lunchOrderId, { payment_method: 'card' });

    // Table freed after lunch turnover
    let tables = (await waiter.getTables()).body;
    let shiftTable = tables.find(t => t.id === shiftTableId);
    assert.strictEqual(shiftTable.status, 'free', 'Table freed after lunch turnover');

    // -------------------------------------------------------------
    // PHASE 3: Midday Prep & Waste Audit (15:00 - 16:30)
    // Log 1kg waste
    // -------------------------------------------------------------
    const wasteRes = await manager.adjustStock({
      ingredient_id: ribeyeId,
      adjustment_type: 'waste',
      quantity_delta: -1.0,
      reason: 'Trimmed fat and spoilage'
    });
    Assertions.assertStatus(wasteRes, 200, 'Midday waste recorded');

    // -------------------------------------------------------------
    // PHASE 4: Dinner Service (17:30 - 21:30)
    // Second turnover: 4 steaks ordered & completed
    // -------------------------------------------------------------
    const dinnerOrderRes = await waiter.createOrder({
      table_id: shiftTableId,
      items: [{ menu_item_id: steakId, quantity: 4 }]
    });
    const dinnerOrderId = dinnerOrderRes.body?.order?.id || dinnerOrderRes.body?.id;

    await kitchen.updateOrderStatus(dinnerOrderId, 'ready');
    await waiter.closeOrder(dinnerOrderId, { payment_method: 'card' });

    // -------------------------------------------------------------
    // PHASE 5: Nightly Closeout & Audit (22:00)
    // Verify inventory balance: 5 + 10 (delivery) - 1 (lunch: 2*0.5) - 1 (waste) - 2 (dinner: 4*0.5) = 11kg
    // Verify Dashboard figures reflect completed orders
    // -------------------------------------------------------------
    const ings = (await manager.getIngredients()).body;
    const ingredients = Array.isArray(ings) ? ings : ings.ingredients || [];
    const ribeye = ingredients.find(i => i.id === ribeyeId);
    Assertions.assertDecimal(ribeye.current_stock, 11.0, 0.01, 'Stock balance after full shift operations');

    const summary = (await manager.getDashboardSummary()).body;
    assert.ok(Number(summary.today_revenue) > 0, 'Dashboard reflects today shift revenue');

    results.push({ id: 'RW-03', name: 'Full Daily Shift Lifecycle: Open -> Delivery -> Lunch -> Waste -> Dinner -> Nightly Audit', passed: true });
  } catch (err) {
    results.push({ id: 'RW-03', name: 'Full Daily Shift Lifecycle: Open -> Delivery -> Lunch -> Waste -> Dinner -> Nightly Audit', passed: false, error: err.message });
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
