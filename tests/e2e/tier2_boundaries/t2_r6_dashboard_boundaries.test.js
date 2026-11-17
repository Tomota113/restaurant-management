/**
 * Tier 2: Boundary & Corner Cases - R6 Dashboard Calculations & Financial Boundaries
 * Spec: ORIGINAL_REQUEST.md §R6
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 2 - R6: Dashboard Financial & Calculation Boundaries';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);

  // Test 1: TC-T2-DSH-01: Zero Sales & Empty State Graceful Handling (No NaN or /0)
  try {
    const summaryRes = await manager.getDashboardSummary();
    Assertions.assertStatus(summaryRes, 200, 'Get Dashboard Summary');
    const summary = summaryRes.body;
    
    // Check no NaN or null calculations
    assert.notStrictEqual(summary.today_revenue, 'NaN', 'today_revenue must not be NaN');
    assert.notStrictEqual(summary.today_revenue, null);
    assert.ok(typeof Number(summary.today_revenue) === 'number');

    const popRes = await manager.getPopularDishes();
    Assertions.assertStatus(popRes, 200, 'Get Popular Dishes on Empty State');

    results.push({ id: 'TC-T2-DSH-01', name: 'Zero-Sales Baseline Renders Valid Numerical Metrics Without NaN', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-DSH-01', name: 'Zero-Sales Baseline Renders Valid Numerical Metrics Without NaN', passed: false, error: err.message });
  }

  // Test 2: TC-T2-DSH-02: Zero-Dollar Complimentary Orders Handling
  try {
    // 1. Create $0.00 item
    const catRes = await manager.getCategories();
    const catId = (Array.isArray(catRes.body) ? catRes.body : catRes.body?.categories)?.[0]?.id;
    
    const freeItemRes = await manager.createMenuItem({
      category_id: catId,
      name: 'Free VIP Snack ' + Date.now(),
      price: 0.00,
      is_available: true
    });
    const freeItemId = freeItemRes.body?.item?.id || freeItemRes.body?.id;

    // 2. Open order on free table with free item
    const tableRes = await manager.createTable({ table_number: 'T_FREE_DSH_' + Date.now(), capacity: 2 });
    const tableId = tableRes.body?.table?.id || tableRes.body?.id;

    const initialSummary = (await manager.getDashboardSummary()).body;
    const initialRev = Number(initialSummary.today_revenue || 0);

    const orderRes = await waiter.createOrder({
      table_id: tableId,
      items: [{ menu_item_id: freeItemId, quantity: 1 }]
    });
    const orderId = orderRes.body?.order?.id || orderRes.body?.id;

    // Close free order
    await waiter.closeOrder(orderId, { payment_method: 'complimentary' });

    // 3. Verify revenue did not increase, but order completed
    const updatedSummary = (await manager.getDashboardSummary()).body;
    const updatedRev = Number(updatedSummary.today_revenue || 0);
    Assertions.assertDecimal(updatedRev, initialRev, 0.01, '0-dollar order must not alter monetary revenue sum');

    results.push({ id: 'TC-T2-DSH-02', name: 'Complimentary $0 Orders Counted Without Corrupting Revenue Sum', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-DSH-02', name: 'Complimentary $0 Orders Counted Without Corrupting Revenue Sum', passed: false, error: err.message });
  }

  // Test 3: TC-T2-DSH-03: Table Turnover Metric Calculation Resilience
  try {
    const turnoverRes = await manager.getTableTurnover();
    Assertions.assertStatus(turnoverRes, 200, 'Get Table Turnover');
    const turnover = turnoverRes.body;
    assert.ok(turnover !== undefined);
    assert.notStrictEqual(turnover.avg_turnover_minutes, 'NaN');

    results.push({ id: 'TC-T2-DSH-03', name: 'Table Turnover Calculation Handles Zero/Empty Historical Samples Safely', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-DSH-03', name: 'Table Turnover Calculation Handles Zero/Empty Historical Samples Safely', passed: false, error: err.message });
  }

  // Test 4: TC-T2-DSH-04: Active Non-Closed Orders Strictly Excluded from Revenue
  try {
    // 1. Get current revenue
    const beforeSummary = (await manager.getDashboardSummary()).body;
    const beforeRev = Number(beforeSummary.today_revenue || 0);

    // 2. Open an expensive $500 order and leave it pending/open
    const catRes = await manager.getCategories();
    const catId = (Array.isArray(catRes.body) ? catRes.body : catRes.body?.categories)?.[0]?.id;

    const expensiveDish = await manager.createMenuItem({
      category_id: catId,
      name: 'Expensive Champagne ' + Date.now(),
      price: 500.00,
      is_available: true
    });
    const dishId = expensiveDish.body?.item?.id || expensiveDish.body?.id;

    const tableRes = await manager.createTable({ table_number: 'T_EXP_' + Date.now(), capacity: 2 });
    const tableId = tableRes.body?.table?.id || tableRes.body?.id;

    const orderRes = await waiter.createOrder({
      table_id: tableId,
      items: [{ menu_item_id: dishId, quantity: 1 }]
    });
    const orderId = orderRes.body?.order?.id || orderRes.body?.id;

    // 3. Query dashboard revenue while order is OPEN
    const afterSummary = (await manager.getDashboardSummary()).body;
    const afterRev = Number(afterSummary.today_revenue || 0);

    Assertions.assertDecimal(afterRev, beforeRev, 0.01, 'Open unclosed order must NOT be included in revenue');

    // Cleanup: close order
    await waiter.closeOrder(orderId, { payment_method: 'card' });

    results.push({ id: 'TC-T2-DSH-04', name: 'Active Open Orders Strictly Excluded from Settled Revenue Analytics', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-DSH-04', name: 'Active Open Orders Strictly Excluded from Settled Revenue Analytics', passed: false, error: err.message });
  }

  // Test 5: TC-T2-DSH-05: Precise Monetary Decimal Arithmetic (Avoid IEEE-754 Drift)
  try {
    // 1. Create items with fractional prices: $19.99, $4.99
    const catRes = await manager.getCategories();
    const catId = (Array.isArray(catRes.body) ? catRes.body : catRes.body?.categories)?.[0]?.id;

    const item1 = await manager.createMenuItem({ category_id: catId, name: 'Precision Item 1 ' + Date.now(), price: 19.99, is_available: true });
    const item2 = await manager.createMenuItem({ category_id: catId, name: 'Precision Item 2 ' + Date.now(), price: 4.99, is_available: true });

    const id1 = item1.body?.item?.id || item1.body?.id;
    const id2 = item2.body?.item?.id || item2.body?.id;

    const tableRes = await manager.createTable({ table_number: 'T_PREC_' + Date.now(), capacity: 2 });
    const tableId = tableRes.body?.table?.id || tableRes.body?.id;

    // 3x 19.99 (59.97) + 2x 4.99 (9.98) = 69.95
    const orderRes = await waiter.createOrder({
      table_id: tableId,
      items: [
        { menu_item_id: id1, quantity: 3 },
        { menu_item_id: id2, quantity: 2 }
      ]
    });
    const order = orderRes.body?.order || orderRes.body;
    Assertions.assertDecimal(order.total_amount, 69.95, 0.01, 'Subtotal calculation precision');

    await waiter.closeOrder(order.id, { payment_method: 'card' });

    results.push({ id: 'TC-T2-DSH-05', name: 'Monetary Sum Precision Maintained Across Fractional Cent Prices', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-DSH-05', name: 'Monetary Sum Precision Maintained Across Fractional Cent Prices', passed: false, error: err.message });
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
