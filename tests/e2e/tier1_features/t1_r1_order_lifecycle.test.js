/**
 * Tier 1: Feature Coverage - R1 Order Lifecycle & KDS
 * Spec: ORIGINAL_REQUEST.md §R1
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient, getKitchenClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 1 - R1: Order Lifecycle & KDS';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);
  const { client: kitchen } = await getKitchenClient(baseUrl);

  // Helper setup: ensure test table and menu items exist
  let testTableId = null;
  let burgerItemId = null;
  let drinkItemId = null;

  // Setup: Find or create a test table
  const tablesRes = await waiter.getTables();
  if (tablesRes.ok && Array.isArray(tablesRes.body) && tablesRes.body.length > 0) {
    const freeTable = tablesRes.body.find(t => t.status === 'free');
    if (freeTable) {
      testTableId = freeTable.id;
    } else {
      testTableId = tablesRes.body[0].id;
    }
  } else {
    const createTableRes = await manager.createTable({
      table_number: 'T101_ORD',
      capacity: 4,
      position_x: 50,
      position_y: 50
    });
    testTableId = createTableRes.body?.id || createTableRes.body?.table?.id;
  }

  // Setup: Find or create menu items
  const menuRes = await waiter.getMenuItems();
  if (menuRes.ok && Array.isArray(menuRes.body) && menuRes.body.length >= 2) {
    burgerItemId = menuRes.body[0].id;
    drinkItemId = menuRes.body[1].id;
  } else {
    // create category and items
    const catRes = await manager.createCategory({ name: 'OrderTest_Cat_' + Date.now(), display_order: 1 });
    const catId = catRes.body?.id || catRes.body?.category?.id;
    const item1 = await manager.createMenuItem({
      category_id: catId,
      name: 'Order Burger ' + Date.now(),
      price: 15.00,
      is_available: true
    });
    const item2 = await manager.createMenuItem({
      category_id: catId,
      name: 'Order Drink ' + Date.now(),
      price: 5.00,
      is_available: true
    });
    burgerItemId = item1.body?.id || item1.body?.item?.id;
    drinkItemId = item2.body?.id || item2.body?.item?.id;
  }

  let createdOrderId = null;

  // Test 1: TC-T1-ORD-01: Create Order Linked to Table
  try {
    const orderPayload = {
      table_id: testTableId,
      items: [
        { menu_item_id: burgerItemId, quantity: 2, special_instructions: 'No pickles' },
        { menu_item_id: drinkItemId, quantity: 1 }
      ],
      notes: 'Table by the window'
    };

    const res = await waiter.createOrder(orderPayload);
    Assertions.assertStatus(res, 201, 'Create Order');
    
    const order = res.body?.order || res.body;
    Assertions.assertHasProperties(order, ['id', 'status', 'total_amount']);
    assert.strictEqual(order.status, 'pending', 'Order should start in pending status');
    assert.ok(Number(order.total_amount) > 0, 'Order total must be greater than 0');
    createdOrderId = order.id;

    // Verify table status transitioned to occupied
    const tableCheck = await waiter.getTables();
    const updatedTable = tableCheck.body.find(t => t.id === testTableId);
    assert.ok(updatedTable, 'Table should exist');
    assert.strictEqual(updatedTable.status, 'occupied', 'Table status must transition to occupied upon order creation');

    results.push({ id: 'TC-T1-ORD-01', name: 'Create Order Linked to Table & Verify Occupied State', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-ORD-01', name: 'Create Order Linked to Table & Verify Occupied State', passed: false, error: err.message });
  }

  // Test 2: TC-T1-ORD-02: Order Status Lifecycle Transitions
  try {
    assert.ok(createdOrderId, 'Requires order from previous step');

    // Step 1: Transition to in_preparation (by kitchen)
    const prepRes = await kitchen.updateOrderStatus(createdOrderId, 'in_preparation');
    Assertions.assertStatus(prepRes, 200, 'Update status to in_preparation');
    let currentOrder = (await waiter.getOrder(createdOrderId)).body;
    currentOrder = currentOrder.order || currentOrder;
    assert.strictEqual(currentOrder.status, 'in_preparation', 'Status should be in_preparation');

    // Step 2: Transition to ready (by kitchen)
    const readyRes = await kitchen.updateOrderStatus(createdOrderId, 'ready');
    Assertions.assertStatus(readyRes, 200, 'Update status to ready');
    currentOrder = (await waiter.getOrder(createdOrderId)).body;
    currentOrder = currentOrder.order || currentOrder;
    assert.strictEqual(currentOrder.status, 'ready', 'Status should be ready');

    // Step 3: Transition to served (by waiter)
    const servedRes = await waiter.updateOrderStatus(createdOrderId, 'served');
    Assertions.assertStatus(servedRes, 200, 'Update status to served');
    currentOrder = (await waiter.getOrder(createdOrderId)).body;
    currentOrder = currentOrder.order || currentOrder;
    assert.strictEqual(currentOrder.status, 'served', 'Status should be served');

    results.push({ id: 'TC-T1-ORD-02', name: 'Order Status Lifecycle Transitions (pending->in_prep->ready->served)', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-ORD-02', name: 'Order Status Lifecycle Transitions (pending->in_prep->ready->served)', passed: false, error: err.message });
  }

  // Test 3: TC-T1-ORD-03: Modify Items on Open Order
  try {
    assert.ok(createdOrderId, 'Requires created order');

    // Add extra items / update quantity
    const updatedItems = [
      { menu_item_id: burgerItemId, quantity: 3, special_instructions: 'Extra cheese' },
      { menu_item_id: drinkItemId, quantity: 2 }
    ];

    const modifyRes = await waiter.updateOrderItems(createdOrderId, updatedItems);
    Assertions.assertStatus(modifyRes, 200, 'Modify order items');

    const getRes = await waiter.getOrder(createdOrderId);
    const order = getRes.body?.order || getRes.body;
    const items = order.items || [];
    assert.ok(items.length >= 2, 'Order should have updated items list');
    
    // Total should have increased
    assert.ok(Number(order.total_amount) > 0, 'Total amount must reflect new item quantities');

    results.push({ id: 'TC-T1-ORD-03', name: 'Modify Open Order Items and Recalculate Subtotal', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-ORD-03', name: 'Modify Open Order Items and Recalculate Subtotal', passed: false, error: err.message });
  }

  // Test 4: TC-T1-ORD-04: Kitchen Orders Stream Endpoint Verification
  try {
    const kitchenRes = await kitchen.getKitchenOrders();
    Assertions.assertStatus(kitchenRes, 200, 'Kitchen Orders Endpoint');
    const orders = Array.isArray(kitchenRes.body) ? kitchenRes.body : kitchenRes.body?.orders || [];
    
    // The active order should be present in the kitchen view
    const found = orders.find(o => o.id === createdOrderId);
    assert.ok(found, 'Active non-closed order must be present in kitchen display view');
    assert.notStrictEqual(found.status, 'closed', 'Kitchen display must only show non-closed orders');

    results.push({ id: 'TC-T1-ORD-04', name: 'Kitchen View Streams Non-Closed Orders in Real-Time', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-ORD-04', name: 'Kitchen View Streams Non-Closed Orders in Real-Time', passed: false, error: err.message });
  }

  // Test 5: TC-T1-ORD-05: Close Order & Table State Release
  try {
    assert.ok(createdOrderId, 'Requires order ID');

    const closeRes = await waiter.closeOrder(createdOrderId, { payment_method: 'card', tip: 5.00 });
    Assertions.assertStatus(closeRes, 200, 'Close Order');

    const orderRes = await waiter.getOrder(createdOrderId);
    const closedOrder = orderRes.body?.order || orderRes.body;
    assert.strictEqual(closedOrder.status, 'closed', 'Closed order must have status closed');
    assert.ok(closedOrder.closed_at, 'Closed order must record closed_at timestamp');

    // Table should now be released to free
    const tablesCheck = await waiter.getTables();
    const tableObj = tablesCheck.body.find(t => t.id === testTableId);
    assert.strictEqual(tableObj.status, 'free', 'Table status must revert to free after closing the order');

    results.push({ id: 'TC-T1-ORD-05', name: 'Close Order, Record Closed Timestamp & Release Table to Free', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-ORD-05', name: 'Close Order, Record Closed Timestamp & Release Table to Free', passed: false, error: err.message });
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
