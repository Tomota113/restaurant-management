/**
 * Tier 4: Real-World Scenarios - RW-04
 * High-Concurrency Multi-Waiter Ordering & Transactional Stock Deduction Safety
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient, ApiClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 4 - RW-04: High-Concurrency Multi-Waiter Ordering & Stock Safety';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiterA } = await getWaiterClient(baseUrl);

  // Setup waiter B
  const waiterBUser = 'waiter_conc_b_' + Date.now();
  await manager.createStaff({
    username: waiterBUser,
    password: 'Password123!',
    full_name: 'Concurrent Waiter B',
    role: 'waiter'
  });
  const waiterB = new ApiClient(baseUrl);
  await waiterB.login(waiterBUser, 'Password123!');

  try {
    // 1. Setup limited stock item (10 steaks available)
    const steakIng = await manager.createIngredient({
      name: 'Concurrent Wagyu Cut ' + Date.now(),
      unit: 'pcs',
      current_stock: 10,
      low_stock_threshold: 2
    });
    const steakIngId = steakIng.body?.ingredient?.id || steakIng.body?.id;

    const catRes = await manager.getCategories();
    const catId = (Array.isArray(catRes.body) ? catRes.body : catRes.body?.categories)?.[0]?.id;

    const dishRes = await manager.createMenuItem({
      category_id: catId,
      name: 'Concurrent Wagyu Plate ' + Date.now(),
      price: 50.00,
      is_available: true
    });
    const dishId = dishRes.body?.item?.id || dishRes.body?.id;

    await manager.createRecipe({
      menu_item_id: dishId,
      ingredients: [{ ingredient_id: steakIngId, quantity_required: 1 }]
    });

    // 2. Setup 2 tables
    const tARes = await manager.createTable({ table_number: 'T_CONC_A_' + Date.now(), capacity: 2 });
    const tBRes = await manager.createTable({ table_number: 'T_CONC_B_' + Date.now(), capacity: 2 });
    const tAId = tARes.body?.table?.id || tARes.body?.id;
    const tBId = tBRes.body?.table?.id || tBRes.body?.id;

    // 3. Waiter A & Waiter B submit orders concurrently (3 items each = 6 total)
    const [orderARes, orderBRes] = await Promise.all([
      waiterA.createOrder({
        table_id: tAId,
        items: [{ menu_item_id: dishId, quantity: 3 }]
      }),
      waiterB.createOrder({
        table_id: tBId,
        items: [{ menu_item_id: dishId, quantity: 3 }]
      })
    ]);

    Assertions.assertStatus(orderARes, 201, 'Concurrent Order A');
    Assertions.assertStatus(orderBRes, 201, 'Concurrent Order B');

    const oAId = orderARes.body?.order?.id || orderARes.body?.id;
    const oBId = orderBRes.body?.order?.id || orderBRes.body?.id;

    // 4. Concurrently close both orders
    const [closeARes, closeBRes] = await Promise.all([
      waiterA.closeOrder(oAId, { payment_method: 'card' }),
      waiterB.closeOrder(oBId, { payment_method: 'card' })
    ]);

    Assertions.assertStatus(closeARes, 200, 'Close Order A');
    Assertions.assertStatus(closeBRes, 200, 'Close Order B');

    // 5. Verify stock level: 10 - 3 - 3 = 4 pcs (No race conditions or lost updates)
    const ings = (await manager.getIngredients()).body;
    const ingredients = Array.isArray(ings) ? ings : ings.ingredients || [];
    const targetIng = ingredients.find(i => i.id === steakIngId);
    Assertions.assertDecimal(targetIng.current_stock, 4, 0.01, 'Stock accurately reduced to 4 without race condition artifacts');

    results.push({ id: 'RW-04', name: 'Concurrent Multi-Waiter Order Processing & Thread-Safe Stock Deduction', passed: true });
  } catch (err) {
    results.push({ id: 'RW-04', name: 'Concurrent Multi-Waiter Order Processing & Thread-Safe Stock Deduction', passed: false, error: err.message });
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
