/**
 * Tier 3: Cross-Feature Interaction - XF-02
 * Order Fulfillment -> Multi-Ingredient Recipe Deduction -> Low-Stock Alert Generation
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient, getKitchenClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 3 - XF-02: Recipe BOM Deduction & Threshold Alert Triggering';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);
  const { client: kitchen } = await getKitchenClient(baseUrl);

  try {
    // 1. Manager creates 2 ingredients with tight threshold
    // Ingredient A: Fresh Salmon (Initial: 500g, Alert threshold: 250g)
    const ingARes = await manager.createIngredient({
      name: 'Atlantic Salmon XF02 ' + Date.now(),
      unit: 'g',
      current_stock: 500,
      low_stock_threshold: 250,
      cost_per_unit: 0.05
    });
    const ingAId = ingARes.body?.ingredient?.id || ingARes.body?.id;

    // Ingredient B: Asparagus (Initial: 20 pcs, Alert threshold: 8 pcs)
    const ingBRes = await manager.createIngredient({
      name: 'Asparagus Spears XF02 ' + Date.now(),
      unit: 'pcs',
      current_stock: 20,
      low_stock_threshold: 8,
      cost_per_unit: 0.5
    });
    const ingBId = ingBRes.body?.ingredient?.id || ingBRes.body?.id;

    // 2. Manager creates menu dish "Grilled Salmon Dinner"
    const catRes = await manager.getCategories();
    const catId = (Array.isArray(catRes.body) ? catRes.body : catRes.body?.categories)?.[0]?.id;

    const dishRes = await manager.createMenuItem({
      category_id: catId,
      name: 'Grilled Salmon Dinner XF02 ' + Date.now(),
      description: 'Pan-seared salmon with roasted asparagus',
      price: 28.00,
      is_available: true
    });
    const dishId = dishRes.body?.item?.id || dishRes.body?.id;

    // 3. Manager maps Recipe BOM (1 order consumes 200g salmon + 6 asparagus)
    await manager.createRecipe({
      menu_item_id: dishId,
      ingredients: [
        { ingredient_id: ingAId, quantity_required: 200 },
        { ingredient_id: ingBId, quantity_required: 6 }
      ]
    });

    // 4. Waiter takes order for 2x "Grilled Salmon Dinner"
    // Expected consumption: 2 * 200 = 400g Salmon (leaving 100g <= 250g threshold -> ALERT)
    // 2 * 6 = 12 Asparagus (leaving 8 pcs <= 8 threshold -> ALERT)
    const tableRes = await manager.createTable({ table_number: 'T_XF02_' + Date.now(), capacity: 2 });
    const tableId = tableRes.body?.table?.id || tableRes.body?.id;

    const orderRes = await waiter.createOrder({
      table_id: tableId,
      items: [{ menu_item_id: dishId, quantity: 2 }]
    });
    const orderId = orderRes.body?.order?.id || orderRes.body?.id;

    // 5. Kitchen preps and completes
    await kitchen.updateOrderStatus(orderId, 'in_preparation');
    await kitchen.updateOrderStatus(orderId, 'ready');
    await waiter.updateOrderStatus(orderId, 'served');

    // 6. Order is closed/settled
    const closeRes = await waiter.closeOrder(orderId, { payment_method: 'card' });
    Assertions.assertStatus(closeRes, 200, 'Close order and trigger stock deduction');

    // 7. Verify inventory levels
    const ingList = await manager.getIngredients();
    const ings = Array.isArray(ingList.body) ? ingList.body : ingList.body?.ingredients || [];
    
    const stockA = ings.find(i => i.id === ingAId);
    const stockB = ings.find(i => i.id === ingBId);

    Assertions.assertDecimal(stockA.current_stock, 100, 0.01, 'Salmon stock should be 500 - 400 = 100g');
    Assertions.assertDecimal(stockB.current_stock, 8, 0.01, 'Asparagus stock should be 20 - 12 = 8 pcs');

    // 8. Verify Low-Stock Alerts generated for BOTH ingredients
    const alertsRes = await manager.getAlerts();
    const alerts = Array.isArray(alertsRes.body) ? alertsRes.body : alertsRes.body?.alerts || [];
    
    const alertA = alerts.find(a => a.id === ingAId || a.ingredient_id === ingAId);
    const alertB = alerts.find(a => a.id === ingBId || a.ingredient_id === ingBId);

    assert.ok(alertA, 'Salmon low-stock alert must be triggered');
    assert.ok(alertB, 'Asparagus low-stock alert must be triggered');

    results.push({ id: 'XF-02', name: 'Order Fulfillment -> Multi-Ingredient BOM Deduction -> Dual Low-Stock Alerts', passed: true });
  } catch (err) {
    results.push({ id: 'XF-02', name: 'Order Fulfillment -> Multi-Ingredient BOM Deduction -> Dual Low-Stock Alerts', passed: false, error: err.message });
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
