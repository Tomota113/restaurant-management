/**
 * Tier 3: Cross-Feature Interaction - XF-05
 * Inventory Depletion to Zero -> Alert Generation -> Dashboard State Reflection
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 3 - XF-05: Inventory Depletion & Dashboard State Reflection';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);

  try {
    // 1. Manager creates a scarce ingredient (e.g. Rare Vintage Wine Bottle - Stock: 1, Threshold: 1)
    const wineIngRes = await manager.createIngredient({
      name: 'Chateau Margaux 2015 ' + Date.now(),
      unit: 'pcs',
      current_stock: 1,
      low_stock_threshold: 1,
      cost_per_unit: 120.00
    });
    const wineIngId = wineIngRes.body?.ingredient?.id || wineIngRes.body?.id;

    // 2. Map recipe to menu item
    const catRes = await manager.getCategories();
    const catId = (Array.isArray(catRes.body) ? catRes.body : catRes.body?.categories)?.[0]?.id;

    const wineItemRes = await manager.createMenuItem({
      category_id: catId,
      name: 'Glass of Chateau Margaux ' + Date.now(),
      price: 150.00,
      is_available: true
    });
    const wineItemId = wineItemRes.body?.item?.id || wineItemRes.body?.id;

    await manager.createRecipe({
      menu_item_id: wineItemId,
      ingredients: [{ ingredient_id: wineIngId, quantity_required: 1 }]
    });

    // 3. Waiter orders the last bottle on Table 1
    const tableRes = await manager.createTable({ table_number: 'T_XF05_' + Date.now(), capacity: 2 });
    const tableId = tableRes.body?.table?.id || tableRes.body?.id;

    const orderRes = await waiter.createOrder({
      table_id: tableId,
      items: [{ menu_item_id: wineItemId, quantity: 1 }]
    });
    const orderId = orderRes.body?.order?.id || orderRes.body?.id;

    // 4. Close order -> Stock becomes 0
    const closeRes = await waiter.closeOrder(orderId, { payment_method: 'card' });
    Assertions.assertStatus(closeRes, 200, 'Close order');

    // 5. Verify stock is 0
    const ings = (await manager.getIngredients()).body;
    const ingredients = Array.isArray(ings) ? ings : ings.ingredients || [];
    const wineIng = ingredients.find(i => i.id === wineIngId);
    Assertions.assertDecimal(wineIng.current_stock, 0, 0.01, 'Wine stock should be depleted to 0');

    // 6. Verify Low Stock Alert is triggered
    const alerts = (await manager.getAlerts()).body;
    const alertList = Array.isArray(alerts) ? alerts : alerts.alerts || [];
    const foundAlert = alertList.find(a => a.id === wineIngId || a.ingredient_id === wineIngId);
    assert.ok(foundAlert, 'Depleted ingredient must appear in low stock alerts');

    results.push({ id: 'XF-05', name: 'Inventory Depletion to Zero -> Alert Generation -> Dashboard State Reflection', passed: true });
  } catch (err) {
    results.push({ id: 'XF-05', name: 'Inventory Depletion to Zero -> Alert Generation -> Dashboard State Reflection', passed: false, error: err.message });
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
