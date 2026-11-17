/**
 * Tier 1: Feature Coverage - R4 Inventory, Recipes & Stock Alerts
 * Spec: ORIGINAL_REQUEST.md §R4
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 1 - R4: Inventory, Recipes & Stock Alerts';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);

  let testIngredientId = null;
  let testDishId = null;

  // Test 1: TC-T1-INV-01: Create Ingredient with Unit and Threshold
  try {
    const ingPayload = {
      name: 'Wagyu Patty ' + Date.now(),
      unit: 'pcs',
      current_stock: 20,
      low_stock_threshold: 5,
      cost_per_unit: 5.50
    };

    const res = await manager.createIngredient(ingPayload);
    Assertions.assertStatus(res, 201, 'Create Ingredient');
    const ing = res.body?.ingredient || res.body;
    testIngredientId = ing.id;
    assert.ok(testIngredientId, 'Ingredient must have an ID');
    assert.strictEqual(ing.name, ingPayload.name);
    Assertions.assertDecimal(ing.current_stock, 20);
    Assertions.assertDecimal(ing.low_stock_threshold, 5);

    results.push({ id: 'TC-T1-INV-01', name: 'Create Ingredient with Stock Level, Unit, and Low Threshold', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-INV-01', name: 'Create Ingredient with Stock Level, Unit, and Low Threshold', passed: false, error: err.message });
  }

  // Test 2: TC-T1-INV-02: Configure Recipe BOM Mapping for Menu Dish
  try {
    assert.ok(testIngredientId, 'Requires test ingredient ID');

    // Create a new dish to map recipe to
    const catRes = await manager.getCategories();
    const categories = Array.isArray(catRes.body) ? catRes.body : catRes.body?.categories || [];
    const catId = categories[0]?.id;

    const dishRes = await manager.createMenuItem({
      category_id: catId,
      name: 'Wagyu Burger ' + Date.now(),
      description: 'Single wagyu beef burger',
      price: 25.00,
      is_available: true
    });
    testDishId = dishRes.body?.item?.id || dishRes.body?.id;

    const recipePayload = {
      menu_item_id: testDishId,
      ingredients: [
        { ingredient_id: testIngredientId, quantity_required: 2 } // 2 patties per burger
      ]
    };

    const recipeRes = await manager.createRecipe(recipePayload);
    Assertions.assertStatus(recipeRes, 201, 'Create Recipe BOM');

    const getRecipeRes = await manager.getRecipes(testDishId);
    const recipeData = getRecipeRes.body?.ingredients || getRecipeRes.body?.recipe || getRecipeRes.body || [];
    assert.ok(recipeData.length > 0, 'Recipe must contain ingredients');

    results.push({ id: 'TC-T1-INV-02', name: 'Configure Dish Recipe Mapping (Bill of Materials)', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-INV-02', name: 'Configure Dish Recipe Mapping (Bill of Materials)', passed: false, error: err.message });
  }

  // Test 3: TC-T1-INV-03: Manual Stock Adjustments (Delivery & Waste)
  try {
    assert.ok(testIngredientId, 'Requires test ingredient ID');

    // 1. Delivery (+10)
    const deliveryRes = await manager.adjustStock({
      ingredient_id: testIngredientId,
      adjustment_type: 'delivery',
      quantity_delta: 10,
      reason: 'Morning supplier shipment PO-102'
    });
    Assertions.assertStatus(deliveryRes, 200, 'Adjust stock for delivery');

    // Check stock: 20 + 10 = 30
    let ingList = await manager.getIngredients();
    let ingredients = Array.isArray(ingList.body) ? ingList.body : ingList.body?.ingredients || [];
    let ing = ingredients.find(i => i.id === testIngredientId);
    Assertions.assertDecimal(ing.current_stock, 30);

    // 2. Waste (-2)
    const wasteRes = await manager.adjustStock({
      ingredient_id: testIngredientId,
      adjustment_type: 'waste',
      quantity_delta: -2,
      reason: 'Dropped on floor / spoiled'
    });
    Assertions.assertStatus(wasteRes, 200, 'Adjust stock for waste');

    // Check stock: 30 - 2 = 28
    ingList = await manager.getIngredients();
    ingredients = Array.isArray(ingList.body) ? ingList.body : ingList.body?.ingredients || [];
    ing = ingredients.find(i => i.id === testIngredientId);
    Assertions.assertDecimal(ing.current_stock, 28);

    results.push({ id: 'TC-T1-INV-03', name: 'Manual Stock Adjustments with Audit Reason (Delivery & Waste)', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-INV-03', name: 'Manual Stock Adjustments with Audit Reason (Delivery & Waste)', passed: false, error: err.message });
  }

  // Test 4: TC-T1-INV-04: Automated Recipe Stock Deduction on Order Close
  try {
    assert.ok(testDishId && testIngredientId, 'Requires dish and ingredient ID');

    // Get a free table
    const tablesRes = await waiter.getTables();
    let table = tablesRes.body?.find(t => t.status === 'free');
    if (!table) {
      const ct = await manager.createTable({ table_number: 'T_INV_' + Date.now(), capacity: 2 });
      table = ct.body?.table || ct.body;
    }

    // Initial stock is 28
    // Order 3x Wagyu Burger -> requires 3 * 2 = 6 Wagyu Patties
    const orderRes = await waiter.createOrder({
      table_id: table.id,
      items: [{ menu_item_id: testDishId, quantity: 3 }]
    });
    const orderId = orderRes.body?.order?.id || orderRes.body?.id;

    // Close order -> triggers recipe stock deduction
    const closeRes = await waiter.closeOrder(orderId, { payment_method: 'card' });
    Assertions.assertStatus(closeRes, 200, 'Close Order');

    // Expected stock: 28 - 6 = 22
    const ingList = await manager.getIngredients();
    const ingredients = Array.isArray(ingList.body) ? ingList.body : ingList.body?.ingredients || [];
    const ing = ingredients.find(i => i.id === testIngredientId);
    Assertions.assertDecimal(ing.current_stock, 22, 0.01, 'Stock should decrease by 6 patties');

    results.push({ id: 'TC-T1-INV-04', name: 'Automatic Recipe Ingredient Deduction on Order Completion', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-INV-04', name: 'Automatic Recipe Ingredient Deduction on Order Completion', passed: false, error: err.message });
  }

  // Test 5: TC-T1-INV-05: Low-Stock Alert Generation When Stock <= Threshold
  try {
    assert.ok(testIngredientId, 'Requires test ingredient ID');

    // Adjust stock down so it is below threshold (Threshold is 5, adjust delta -18: 22 - 18 = 4)
    await manager.adjustStock({
      ingredient_id: testIngredientId,
      adjustment_type: 'waste',
      quantity_delta: -18,
      reason: 'Batch discarded after shelf life'
    });

    const alertsRes = await manager.getAlerts();
    Assertions.assertStatus(alertsRes, 200, 'Get Low Stock Alerts');
    const alerts = Array.isArray(alertsRes.body) ? alertsRes.body : alertsRes.body?.alerts || [];
    
    const alertFound = alerts.find(a => a.id === testIngredientId || a.ingredient_id === testIngredientId || a.name?.includes('Wagyu Patty'));
    assert.ok(alertFound, 'Low stock alert must be generated when stock <= threshold');

    results.push({ id: 'TC-T1-INV-05', name: 'Low-Stock Alert Triggered When Stock Crosses Configured Threshold', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-INV-05', name: 'Low-Stock Alert Triggered When Stock Crosses Configured Threshold', passed: false, error: err.message });
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
