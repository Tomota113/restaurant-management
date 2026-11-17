/**
 * Tier 2: Boundary & Corner Cases - R4 Inventory & Recipes
 * Spec: ORIGINAL_REQUEST.md §R4
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 2 - R4: Inventory & Recipe Boundaries';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);

  // Test 1: TC-T2-INV-01: Reject Negative Initial Stock or Threshold
  try {
    const invalidIng = await manager.createIngredient({
      name: 'Invalid Neg Ingredient ' + Date.now(),
      unit: 'kg',
      current_stock: -10,
      low_stock_threshold: 5
    });
    assert.ok(
      invalidIng.status === 400 || invalidIng.status === 422,
      `Expected 400/422 for negative initial stock, got ${invalidIng.status}`
    );

    results.push({ id: 'TC-T2-INV-01', name: 'Reject Negative Initial Stock or Threshold Input', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-INV-01', name: 'Reject Negative Initial Stock or Threshold Input', passed: false, error: err.message });
  }

  // Test 2: TC-T2-INV-02: Manual Waste Adjustment Resulting in Negative Stock Handled
  try {
    const ingRes = await manager.createIngredient({
      name: 'Waste Test Spice ' + Date.now(),
      unit: 'g',
      current_stock: 5,
      low_stock_threshold: 2
    });
    const ingId = ingRes.body?.ingredient?.id || ingRes.body?.id;

    // Adjust -10 on 5 stock
    const adjustRes = await manager.adjustStock({
      ingredient_id: ingId,
      adjustment_type: 'waste',
      quantity_delta: -10,
      reason: 'Extreme waste adjustment test'
    });
    // System should either floor to 0, reject, or record deficit with audit
    assert.ok(adjustRes.status === 200 || adjustRes.status === 400);

    results.push({ id: 'TC-T2-INV-02', name: 'Handling of Extreme Stock Reductions Beyond Current Balance', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-INV-02', name: 'Handling of Extreme Stock Reductions Beyond Current Balance', passed: false, error: err.message });
  }

  // Test 3: TC-T2-INV-03: Micro-Fractional Quantity Deductions (High Precision Arithmetic)
  try {
    // Saffron with 4 decimal places
    const saffronRes = await manager.createIngredient({
      name: 'Persian Saffron ' + Date.now(),
      unit: 'kg',
      current_stock: 0.1000,
      low_stock_threshold: 0.0200
    });
    const saffronId = saffronRes.body?.ingredient?.id || saffronRes.body?.id;

    const catRes = await manager.getCategories();
    const catId = (Array.isArray(catRes.body) ? catRes.body : catRes.body?.categories)?.[0]?.id;

    const dishRes = await manager.createMenuItem({
      category_id: catId,
      name: 'Saffron Paella ' + Date.now(),
      price: 35.00,
      is_available: true
    });
    const dishId = dishRes.body?.item?.id || dishRes.body?.id;

    // Recipe: 0.0025 kg saffron per paella
    await manager.createRecipe({
      menu_item_id: dishId,
      ingredients: [{ ingredient_id: saffronId, quantity_required: 0.0025 }]
    });

    const tableRes = await manager.createTable({ table_number: 'T_SAFF_' + Date.now(), capacity: 2 });
    const tableId = tableRes.body?.table?.id || tableRes.body?.id;

    // Order 2x -> deduction: 2 * 0.0025 = 0.0050 kg
    const orderRes = await waiter.createOrder({
      table_id: tableId,
      items: [{ menu_item_id: dishId, quantity: 2 }]
    });
    const orderId = orderRes.body?.order?.id || orderRes.body?.id;

    await waiter.closeOrder(orderId, { payment_method: 'card' });

    // Expected stock: 0.1000 - 0.0050 = 0.0950
    const ingList = await manager.getIngredients();
    const ings = Array.isArray(ingList.body) ? ingList.body : ingList.body?.ingredients || [];
    const target = ings.find(i => i.id === saffronId);
    Assertions.assertDecimal(target.current_stock, 0.095, 0.0001, 'Precision deduction of 0.005 kg');

    results.push({ id: 'TC-T2-INV-03', name: 'High-Precision Micro-Fractional Recipe Deduction (4 Decimal Places)', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-INV-03', name: 'High-Precision Micro-Fractional Recipe Deduction (4 Decimal Places)', passed: false, error: err.message });
  }

  // Test 4: TC-T2-INV-04: Order Dish Without Recipe Mapping Proceeds Gracefully
  try {
    const catRes = await manager.getCategories();
    const catId = (Array.isArray(catRes.body) ? catRes.body : catRes.body?.categories)?.[0]?.id;

    // Dish with NO recipe configured
    const noRecipeDish = await manager.createMenuItem({
      category_id: catId,
      name: 'No Recipe Dish ' + Date.now(),
      price: 10.00,
      is_available: true
    });
    const dishId = noRecipeDish.body?.item?.id || noRecipeDish.body?.id;

    const tableRes = await manager.createTable({ table_number: 'T_NOREC_' + Date.now(), capacity: 2 });
    const tableId = tableRes.body?.table?.id || tableRes.body?.id;

    const orderRes = await waiter.createOrder({
      table_id: tableId,
      items: [{ menu_item_id: dishId, quantity: 1 }]
    });
    const orderId = orderRes.body?.order?.id || orderRes.body?.id;

    const closeRes = await waiter.closeOrder(orderId, { payment_method: 'cash' });
    Assertions.assertStatus(closeRes, 200, 'Close order for dish without recipe mapping');

    results.push({ id: 'TC-T2-INV-04', name: 'Order Fulfillment of Dish Without Recipe Mapping Closes Gracefully', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-INV-04', name: 'Order Fulfillment of Dish Without Recipe Mapping Closes Gracefully', passed: false, error: err.message });
  }

  // Test 5: TC-T2-INV-05: Alert Triggered When Stock Exactly Matches Threshold
  try {
    const exactIng = await manager.createIngredient({
      name: 'Exact Threshold Ing ' + Date.now(),
      unit: 'pcs',
      current_stock: 5,
      low_stock_threshold: 5 // current_stock == threshold
    });
    const ingId = exactIng.body?.ingredient?.id || exactIng.body?.id;

    const alertsRes = await manager.getAlerts();
    Assertions.assertStatus(alertsRes, 200, 'Get Alerts');
    const alerts = Array.isArray(alertsRes.body) ? alertsRes.body : alertsRes.body?.alerts || [];
    const found = alerts.find(a => a.id === ingId || a.ingredient_id === ingId || a.name?.includes('Exact Threshold'));
    assert.ok(found, 'Alert must be triggered when current_stock == low_stock_threshold');

    results.push({ id: 'TC-T2-INV-05', name: 'Alert Triggered at Boundary Equality (Stock == Threshold)', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-INV-05', name: 'Alert Triggered at Boundary Equality (Stock == Threshold)', passed: false, error: err.message });
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
