/**
 * Tier 1: Feature Coverage - R2 Menu & Sold-out Management
 * Spec: ORIGINAL_REQUEST.md §R2
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 1 - R2: Menu & Sold-out Management';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);

  let testCategoryId = null;
  let testItemId = null;
  let soldOutItemId = null;

  // Test 1: TC-T1-MNU-01: Create Category and Menu Items
  try {
    const catPayload = {
      name: 'Chef Specials ' + Date.now(),
      display_order: 5,
      description: 'Daily rotating chef specialities'
    };
    const catRes = await manager.createCategory(catPayload);
    Assertions.assertStatus(catRes, 201, 'Create Menu Category');
    testCategoryId = catRes.body?.id || catRes.body?.category?.id;
    assert.ok(testCategoryId, 'Created category must have an ID');

    const itemPayload = {
      category_id: testCategoryId,
      name: 'Truffle Risotto ' + Date.now(),
      description: 'Creamy arborio rice with black truffle shavings',
      price: 24.50,
      is_available: true
    };
    const itemRes = await manager.createMenuItem(itemPayload);
    Assertions.assertStatus(itemRes, 201, 'Create Menu Item');
    const createdItem = itemRes.body?.item || itemRes.body;
    testItemId = createdItem.id;
    assert.ok(testItemId, 'Created menu item must have an ID');
    assert.strictEqual(createdItem.name, itemPayload.name);
    Assertions.assertDecimal(createdItem.price, 24.50);

    results.push({ id: 'TC-T1-MNU-01', name: 'Create Menu Category & Menu Item with Attributes', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-MNU-01', name: 'Create Menu Category & Menu Item with Attributes', passed: false, error: err.message });
  }

  // Test 2: TC-T1-MNU-02: Category Filtering and Search
  try {
    assert.ok(testCategoryId, 'Requires created category ID');
    const filterRes = await waiter.getMenuItems({ category_id: testCategoryId });
    Assertions.assertStatus(filterRes, 200, 'Get Menu Items by Category');
    const items = Array.isArray(filterRes.body) ? filterRes.body : filterRes.body?.items || [];
    assert.ok(items.length >= 1, 'Filtered list should contain at least 1 item');
    assert.ok(items.every(i => i.category_id === testCategoryId), 'All returned items must belong to target category');

    results.push({ id: 'TC-T1-MNU-02', name: 'Filter Menu Items by Category ID', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-MNU-02', name: 'Filter Menu Items by Category ID', passed: false, error: err.message });
  }

  // Test 3: TC-T1-MNU-03: Update Menu Item Price & Description
  try {
    assert.ok(testItemId, 'Requires test item ID');
    const updatePayload = {
      name: 'Signature Truffle Risotto',
      description: 'Upgraded with white truffle oil and aged parmesan',
      price: 28.00
    };
    const updateRes = await manager.updateMenuItem(testItemId, updatePayload);
    Assertions.assertStatus(updateRes, 200, 'Update Menu Item');

    const checkRes = await waiter.getMenuItems({ category_id: testCategoryId });
    const items = Array.isArray(checkRes.body) ? checkRes.body : checkRes.body?.items || [];
    const updated = items.find(i => i.id === testItemId);
    assert.ok(updated, 'Updated item should exist');
    assert.strictEqual(updated.name, updatePayload.name);
    Assertions.assertDecimal(updated.price, 28.00);

    results.push({ id: 'TC-T1-MNU-03', name: 'Update Menu Item Price, Name, and Description', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-MNU-03', name: 'Update Menu Item Price, Name, and Description', passed: false, error: err.message });
  }

  // Test 4: TC-T1-MNU-04: Toggle Menu Item Availability to Sold Out
  try {
    assert.ok(testItemId, 'Requires test item ID');
    const toggleRes = await manager.toggleItemAvailability(testItemId, false);
    Assertions.assertStatus(toggleRes, 200, 'Toggle Item Availability to Sold Out');

    const checkRes = await waiter.getMenuItems();
    const items = Array.isArray(checkRes.body) ? checkRes.body : checkRes.body?.items || [];
    const targetItem = items.find(i => i.id === testItemId);
    assert.ok(targetItem, 'Target item should exist');
    assert.strictEqual(Boolean(targetItem.is_available), false, 'Item is_available must be false after sold-out toggle');
    soldOutItemId = testItemId;

    results.push({ id: 'TC-T1-MNU-04', name: 'Toggle Menu Item to Sold Out and Verify State', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-MNU-04', name: 'Toggle Menu Item to Sold Out and Verify State', passed: false, error: err.message });
  }

  // Test 5: TC-T1-MNU-05: Sold Out Item Cannot Be Added to New Orders
  try {
    assert.ok(soldOutItemId, 'Requires sold out item ID');
    
    // Find a free table
    const tablesRes = await waiter.getTables();
    let freeTable = tablesRes.body?.find(t => t.status === 'free');
    if (!freeTable) {
      const ctRes = await manager.createTable({ table_number: 'T_MNU_TEST_' + Date.now(), capacity: 2, position_x: 10, position_y: 10 });
      freeTable = ctRes.body?.table || ctRes.body;
    }

    const orderAttempt = await waiter.createOrder({
      table_id: freeTable.id,
      items: [
        { menu_item_id: soldOutItemId, quantity: 1 }
      ]
    });

    // Should be rejected with 400 Bad Request
    Assertions.assertStatus(orderAttempt, 400, 'Order creation with sold out item should fail');
    Assertions.assertError(orderAttempt, 400, 'sold');

    results.push({ id: 'TC-T1-MNU-05', name: 'Reject New Order Containing Sold Out Menu Item (400)', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-MNU-05', name: 'Reject New Order Containing Sold Out Menu Item (400)', passed: false, error: err.message });
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
