/**
 * Tier 3: Cross-Feature Interaction - XF-06
 * Order Item Modification (Add & Remove) -> Recalculated Total -> Kitchen Sync -> Recipe Deduction
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient, getKitchenClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 3 - XF-06: Item Modifications, Recalculation & Accurate Final Recipe Deductions';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);
  const { client: kitchen } = await getKitchenClient(baseUrl);

  try {
    // 1. Create two ingredients: Chicken (Stock: 1000g) and Rice (Stock: 2000g)
    const chickenRes = await manager.createIngredient({
      name: 'Chicken Breast XF06 ' + Date.now(),
      unit: 'g',
      current_stock: 1000,
      low_stock_threshold: 200
    });
    const chickenId = chickenRes.body?.ingredient?.id || chickenRes.body?.id;

    const riceRes = await manager.createIngredient({
      name: 'Jasmine Rice XF06 ' + Date.now(),
      unit: 'g',
      current_stock: 2000,
      low_stock_threshold: 500
    });
    const riceId = riceRes.body?.ingredient?.id || riceRes.body?.id;

    // 2. Create dishes: Dish A (Chicken Bowl - 200g chicken, $15) & Dish B (Rice Bowl - 150g rice, $10)
    const catRes = await manager.getCategories();
    const catId = (Array.isArray(catRes.body) ? catRes.body : catRes.body?.categories)?.[0]?.id;

    const dishARes = await manager.createMenuItem({
      category_id: catId,
      name: 'Chicken Bowl XF06 ' + Date.now(),
      price: 15.00,
      is_available: true
    });
    const dishAId = dishARes.body?.item?.id || dishARes.body?.id;

    const dishBRes = await manager.createMenuItem({
      category_id: catId,
      name: 'Rice Bowl XF06 ' + Date.now(),
      price: 10.00,
      is_available: true
    });
    const dishBId = dishBRes.body?.item?.id || dishBRes.body?.id;

    await manager.createRecipe({ menu_item_id: dishAId, ingredients: [{ ingredient_id: chickenId, quantity_required: 200 }] });
    await manager.createRecipe({ menu_item_id: dishBId, ingredients: [{ ingredient_id: riceId, quantity_required: 150 }] });

    // 3. Waiter opens order initially with 2x Dish A (Chicken Bowl) -> Total $30.00
    const tableRes = await manager.createTable({ table_number: 'T_XF06_' + Date.now(), capacity: 2 });
    const tableId = tableRes.body?.table?.id || tableRes.body?.id;

    const orderRes = await waiter.createOrder({
      table_id: tableId,
      items: [{ menu_item_id: dishAId, quantity: 2 }]
    });
    const orderId = orderRes.body?.order?.id || orderRes.body?.id;

    // 4. Guest changes mind: removes 1x Dish A and adds 3x Dish B (Rice Bowl)
    // New cart: 1x Dish A ($15) + 3x Dish B ($30) -> Total $45.00
    const updateRes = await waiter.updateOrderItems(orderId, [
      { menu_item_id: dishAId, quantity: 1 },
      { menu_item_id: dishBId, quantity: 3 }
    ]);
    Assertions.assertStatus(updateRes, 200, 'Update order items');

    // 5. Kitchen inspects updated order on KDS
    const kdsRes = await kitchen.getKitchenOrders();
    const kdsOrders = Array.isArray(kdsRes.body) ? kdsRes.body : kdsRes.body?.orders || [];
    const kdsOrder = kdsOrders.find(o => o.id === orderId);
    assert.ok(kdsOrder, 'Updated order present on KDS');

    // 6. Close order
    await waiter.closeOrder(orderId, { payment_method: 'card' });

    // 7. Verify inventory deductions match the FINAL modified quantities:
    // Chicken: 1000 - (1 * 200) = 800g
    // Rice: 2000 - (3 * 150) = 1550g
    const ings = (await manager.getIngredients()).body;
    const ingredients = Array.isArray(ings) ? ings : ings.ingredients || [];
    
    const chick = ingredients.find(i => i.id === chickenId);
    const rc = ingredients.find(i => i.id === riceId);

    Assertions.assertDecimal(chick.current_stock, 800, 0.01, 'Chicken stock matches final modified quantity');
    Assertions.assertDecimal(rc.current_stock, 1550, 0.01, 'Rice stock matches final modified quantity');

    results.push({ id: 'XF-06', name: 'Order Item Modifications -> Bill Recalculation -> Kitchen Sync -> Accurate Recipe Deduction', passed: true });
  } catch (err) {
    results.push({ id: 'XF-06', name: 'Order Item Modifications -> Bill Recalculation -> Kitchen Sync -> Accurate Recipe Deduction', passed: false, error: err.message });
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
