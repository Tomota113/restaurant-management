/**
 * Tier 2: Boundary & Corner Cases - R2 Menu & Sold-Out
 * Spec: ORIGINAL_REQUEST.md §R2
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 2 - R2: Menu Boundaries & Corner Cases';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);

  // Setup: Find or create a category
  let testCatId = null;
  const catRes = await manager.getCategories();
  const cats = Array.isArray(catRes.body) ? catRes.body : catRes.body?.categories || [];
  if (cats.length > 0) {
    testCatId = cats[0].id;
  } else {
    const c = await manager.createCategory({ name: 'Boundaries_Cat_' + Date.now(), display_order: 1 });
    testCatId = c.body?.id || c.body?.category?.id;
  }

  // Test 1: TC-T2-MNU-01: Negative Price Menu Item Rejected (400/422)
  try {
    const negPriceRes = await manager.createMenuItem({
      category_id: testCatId,
      name: 'Invalid Negative Item',
      price: -15.50,
      description: 'Should not be allowed'
    });
    assert.ok(
      negPriceRes.status === 400 || negPriceRes.status === 422,
      `Expected 400/422 for negative price, got ${negPriceRes.status}`
    );

    results.push({ id: 'TC-T2-MNU-01', name: 'Reject Menu Item Creation with Negative Price', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-MNU-01', name: 'Reject Menu Item Creation with Negative Price', passed: false, error: err.message });
  }

  // Test 2: TC-T2-MNU-02: Missing Required Fields Validation (400)
  try {
    const missingRes = await manager.createMenuItem({
      category_id: testCatId,
      price: 10.00
      // missing name
    });
    Assertions.assertStatus(missingRes, 400, 'Missing name in menu item');

    results.push({ id: 'TC-T2-MNU-02', name: 'Reject Menu Item with Missing Required Fields', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-MNU-02', name: 'Reject Menu Item with Missing Required Fields', passed: false, error: err.message });
  }

  // Test 3: TC-T2-MNU-03: Zero-Dollar Complimentary Item Handled Gracefully
  try {
    const zeroItemRes = await manager.createMenuItem({
      category_id: testCatId,
      name: 'Complimentary Bread & Butter ' + Date.now(),
      price: 0.00,
      description: 'Free house bread basket'
    });
    Assertions.assertStatus(zeroItemRes, 201, 'Create 0.00 dollar item');
    const item = zeroItemRes.body?.item || zeroItemRes.body;
    Assertions.assertDecimal(item.price, 0.00);

    results.push({ id: 'TC-T2-MNU-03', name: 'Support Zero-Dollar ($0.00) Complimentary Menu Items', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-MNU-03', name: 'Support Zero-Dollar ($0.00) Complimentary Menu Items', passed: false, error: err.message });
  }

  // Test 4: TC-T2-MNU-04: Unicode, Emojis, and Special Characters in Menu Item
  try {
    const unicodePayload = {
      category_id: testCatId,
      name: '🍕 Margherita Royale <Deluxe> & "Special" — 100% Organic',
      description: 'Fresh basil 🌿, buffalo mozzarella 🧀 & San Marzano tomatoes 🍅. $10 & up!',
      price: 18.75
    };
    const unicodeRes = await manager.createMenuItem(unicodePayload);
    Assertions.assertStatus(unicodeRes, 201, 'Create Unicode/Emoji Menu Item');
    const item = unicodeRes.body?.item || unicodeRes.body;
    assert.strictEqual(item.name, unicodePayload.name);
    assert.strictEqual(item.description, unicodePayload.description);

    results.push({ id: 'TC-T2-MNU-04', name: 'Safe Handling of Unicode, Emojis, and Special HTML Characters', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-MNU-04', name: 'Safe Handling of Unicode, Emojis, and Special HTML Characters', passed: false, error: err.message });
  }

  // Test 5: TC-T2-MNU-05: Sold Out Toggle Preserves Open In-Flight Order Items
  try {
    // 1. Create new item
    const itemRes = await manager.createMenuItem({
      category_id: testCatId,
      name: 'Special Salmon ' + Date.now(),
      price: 30.00,
      is_available: true
    });
    const itemId = itemRes.body?.item?.id || itemRes.body?.id;

    // 2. Open an order containing this item
    const tableRes = await manager.createTable({ table_number: 'T_T2_MNU_' + Date.now(), capacity: 2 });
    const tableId = tableRes.body?.table?.id || tableRes.body?.id;

    const orderRes = await waiter.createOrder({
      table_id: tableId,
      items: [{ menu_item_id: itemId, quantity: 1 }]
    });
    const orderId = orderRes.body?.order?.id || orderRes.body?.id;

    // 3. Manager marks item sold out
    await manager.toggleItemAvailability(itemId, false);

    // 4. Verify existing open order still retains the item
    const orderCheck = await waiter.getOrder(orderId);
    const order = orderCheck.body?.order || orderCheck.body;
    assert.ok(order.items && order.items.length > 0, 'Open order must retain previously ordered item');
    assert.strictEqual(order.items[0].menu_item_id, itemId);

    // Cleanup: close order
    await waiter.closeOrder(orderId, { payment_method: 'card' });

    results.push({ id: 'TC-T2-MNU-05', name: 'Sold-Out Toggle Preserves Previously Submitted Open Order Items', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T2-MNU-05', name: 'Sold-Out Toggle Preserves Previously Submitted Open Order Items', passed: false, error: err.message });
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
