import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { authenticate, requireRole } from '../middleware/auth';
import { wsManager } from '../websocket/server';

const router = Router();

// All order endpoints require authentication
router.use(authenticate);

function deductInventoryForOrder(orderId: string): void {
  const items = db.prepare(`
    SELECT menu_item_id, quantity
    FROM order_items
    WHERE order_id = ?
  `).all(orderId) as Array<{ menu_item_id: string; quantity: number }>;

  const deductTx = db.transaction(() => {
    for (const item of items) {
      const recipes = db.prepare(`
        SELECT ingredient_id, quantity_required
        FROM recipes
        WHERE menu_item_id = ?
      `).all(item.menu_item_id) as Array<{ ingredient_id: string; quantity_required: number }>;

      for (const recipe of recipes) {
        const totalDeduction = Number((item.quantity * recipe.quantity_required).toFixed(6));
        
        // Update stock
        db.prepare(`
          UPDATE ingredients
          SET current_stock = MAX(0, current_stock - ?),
              updated_at = datetime('now')
          WHERE id = ?
        `).run(totalDeduction, recipe.ingredient_id);

        // Record audit log
        db.prepare(`
          INSERT INTO inventory_logs (id, ingredient_id, order_id, adjustment_type, quantity_delta, reason)
          VALUES (?, ?, ?, 'order_fulfillment', ?, 'Order closed fulfillment')
        `).run(uuidv4(), recipe.ingredient_id, orderId, -totalDeduction);

        // Check for low stock alert
        const ing = db.prepare('SELECT id, name, unit, current_stock, low_stock_threshold FROM ingredients WHERE id = ?').get(recipe.ingredient_id) as any;
        if (ing && ing.current_stock <= ing.low_stock_threshold) {
          wsManager.broadcast('inventory_alert', ing);
        }
      }
    }
  });

  deductTx();
}

function formatOrder(orderId: string): any {
  const order = db.prepare(`
    SELECT o.id, o.table_id, t.table_number, t.section AS table_section,
           o.user_id, u.full_name AS staff_name, o.status, o.total_amount,
           o.payment_method, o.tip, o.notes, o.created_at, o.closed_at
    FROM orders o
    JOIN tables t ON o.table_id = t.id
    LEFT JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `).get(orderId) as any;

  if (!order) return null;

  const items = db.prepare(`
    SELECT oi.id, oi.menu_item_id, m.name, oi.unit_price, oi.quantity,
           oi.special_instructions, (oi.unit_price * oi.quantity) AS subtotal,
           c.name AS category_name
    FROM order_items oi
    JOIN menu_items m ON oi.menu_item_id = m.id
    LEFT JOIN categories c ON m.category_id = c.id
    WHERE oi.order_id = ?
    ORDER BY oi.created_at ASC
  `).all(orderId) as any[];

  return {
    ...order,
    total_amount: Number(order.total_amount),
    tip: Number(order.tip || 0),
    items: items.map(i => ({
      ...i,
      unit_price: Number(i.unit_price),
      quantity: Number(i.quantity),
      subtotal: Number(i.subtotal)
    }))
  };
}

// GET /api/orders
router.get('/', (req: Request, res: Response): void => {
  const { status, table_id } = req.query;

  let query = 'SELECT id FROM orders WHERE 1=1';
  const params: any[] = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (table_id) {
    query += ' AND table_id = ?';
    params.push(table_id);
  }

  query += ' ORDER BY created_at DESC';

  const orderRows = db.prepare(query).all(...params) as Array<{ id: string }>;
  const orders = orderRows.map(row => formatOrder(row.id));

  res.status(200).json(orders);
});

// GET /api/orders/:id
router.get('/:id', (req: Request, res: Response): void => {
  const order = formatOrder(req.params.id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  res.status(200).json(order);
});

// POST /api/orders (Managers and Waiters)
router.post('/', requireRole('manager', 'waiter'), (req: Request, res: Response): void => {
  const { table_id, items, notes } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Cannot create empty order with no line items' });
    return;
  }

  if (!table_id) {
    res.status(400).json({ error: 'Table ID is required' });
    return;
  }

  // Validate table
  const table = db.prepare('SELECT id, table_number, status FROM tables WHERE id = ?').get(table_id) as any;
  if (!table) {
    res.status(404).json({ error: 'Table not found' });
    return;
  }

  if (table.status === 'occupied') {
    res.status(400).json({ error: 'Table is already occupied with an active order' });
    return;
  }

  // Validate each item and calculate total
  let calculatedTotal = 0;
  const processedItems: Array<{ id: string; menu_item_id: string; quantity: number; unit_price: number; special_instructions: string | null }> = [];

  for (const item of items) {
    if (!item.menu_item_id || item.quantity === undefined || Number(item.quantity) <= 0) {
      res.status(400).json({ error: 'Invalid order item payload: menu_item_id and quantity > 0 required' });
      return;
    }

    const menuItem = db.prepare('SELECT id, name, price, is_available FROM menu_items WHERE id = ?').get(item.menu_item_id) as any;
    if (!menuItem) {
      res.status(400).json({ error: `Menu item with ID '${item.menu_item_id}' not found` });
      return;
    }

    if (!menuItem.is_available) {
      res.status(400).json({ error: `Menu item '${menuItem.name}' is currently sold out and cannot be ordered` });
      return;
    }

    const qty = Number(item.quantity);
    const unitPrice = Number(menuItem.price);
    calculatedTotal += unitPrice * qty;

    processedItems.push({
      id: uuidv4(),
      menu_item_id: menuItem.id,
      quantity: qty,
      unit_price: unitPrice,
      special_instructions: item.special_instructions || null
    });
  }

  calculatedTotal = Number(calculatedTotal.toFixed(2));
  const orderId = uuidv4();
  const userId = req.user?.id || null;

  const createOrderTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO orders (id, table_id, user_id, status, total_amount, notes)
      VALUES (?, ?, ?, 'pending', ?, ?)
    `).run(orderId, table_id, userId, calculatedTotal, notes || null);

    const insertItem = db.prepare(`
      INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price, special_instructions)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const pi of processedItems) {
      insertItem.run(pi.id, orderId, pi.menu_item_id, pi.quantity, pi.unit_price, pi.special_instructions);
    }

    // Set table status to occupied
    db.prepare("UPDATE tables SET status = 'occupied', updated_at = datetime('now') WHERE id = ?").run(table_id);
  });

  createOrderTx();

  const formatted = formatOrder(orderId);
  const updatedTable = db.prepare('SELECT id, table_number, capacity, section, position_x, position_y, status FROM tables WHERE id = ?').get(table_id);

  wsManager.broadcast('order_created', formatted);
  wsManager.broadcast('table_updated', updatedTable);

  res.status(201).json(formatted);
});

// PUT /api/orders/:id/items (Managers and Waiters)
router.put('/:id/items', requireRole('manager', 'waiter'), (req: Request, res: Response): void => {
  const { id } = req.params;
  const { items } = req.body;

  const order = db.prepare('SELECT id, status, table_id FROM orders WHERE id = ?').get(id) as any;
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  if (order.status === 'closed' || order.status === 'cancelled') {
    res.status(400).json({ error: 'Cannot modify items on a closed or cancelled order' });
    return;
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Items list cannot be empty' });
    return;
  }

  let calculatedTotal = 0;
  const processedItems: Array<{ id: string; menu_item_id: string; quantity: number; unit_price: number; special_instructions: string | null }> = [];

  for (const item of items) {
    if (!item.menu_item_id || item.quantity === undefined || Number(item.quantity) <= 0) {
      res.status(400).json({ error: 'Invalid order item payload' });
      return;
    }

    const menuItem = db.prepare('SELECT id, name, price FROM menu_items WHERE id = ?').get(item.menu_item_id) as any;
    if (!menuItem) {
      res.status(400).json({ error: `Menu item with ID '${item.menu_item_id}' not found` });
      return;
    }

    const qty = Number(item.quantity);
    const unitPrice = Number(menuItem.price);
    calculatedTotal += unitPrice * qty;

    processedItems.push({
      id: uuidv4(),
      menu_item_id: menuItem.id,
      quantity: qty,
      unit_price: unitPrice,
      special_instructions: item.special_instructions || null
    });
  }

  calculatedTotal = Number(calculatedTotal.toFixed(2));

  const updateItemsTx = db.transaction(() => {
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(id);

    const insertItem = db.prepare(`
      INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price, special_instructions)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const pi of processedItems) {
      insertItem.run(pi.id, id, pi.menu_item_id, pi.quantity, pi.unit_price, pi.special_instructions);
    }

    db.prepare('UPDATE orders SET total_amount = ? WHERE id = ?').run(calculatedTotal, id);
  });

  updateItemsTx();

  const formatted = formatOrder(id);
  wsManager.broadcast('order_updated', formatted);

  res.status(200).json(formatted);
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', (req: Request, res: Response): void => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'in_preparation', 'ready', 'served', 'closed', 'cancelled'];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    return;
  }

  const order = db.prepare('SELECT id, status, table_id FROM orders WHERE id = ?').get(id) as any;
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  if (order.status === 'closed' && status !== 'closed') {
    res.status(400).json({ error: 'Cannot transition a closed order back to an open status' });
    return;
  }

  // Kitchen role cannot directly close order via status
  if (status === 'closed' && req.user?.role === 'kitchen') {
    res.status(403).json({ error: 'Forbidden: Kitchen staff cannot close orders or settle payments' });
    return;
  }

  if (status === 'closed' && order.status !== 'closed') {
    db.prepare("UPDATE orders SET status = 'closed', closed_at = datetime('now') WHERE id = ?").run(id);
    db.prepare("UPDATE tables SET status = 'free', updated_at = datetime('now') WHERE id = ?").run(order.table_id);
    deductInventoryForOrder(id);
  } else {
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  }

  const formatted = formatOrder(id);
  const updatedTable = db.prepare('SELECT id, table_number, capacity, section, position_x, position_y, status FROM tables WHERE id = ?').get(order.table_id);

  wsManager.broadcast('order_status_changed', formatted);
  wsManager.broadcast('table_updated', updatedTable);

  res.status(200).json(formatted);
});

// POST /api/orders/:id/close (Managers and Waiters only)
router.post('/:id/close', requireRole('manager', 'waiter'), (req: Request, res: Response): void => {
  const { id } = req.params;
  const { payment_method = 'card', tip = 0 } = req.body;

  const order = db.prepare('SELECT id, status, table_id FROM orders WHERE id = ?').get(id) as any;
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  if (order.status === 'closed') {
    res.status(400).json({ error: 'Order is already closed' });
    return;
  }

  const closeTx = db.transaction(() => {
    db.prepare(`
      UPDATE orders
      SET status = 'closed',
          payment_method = ?,
          tip = ?,
          closed_at = datetime('now')
      WHERE id = ?
    `).run(payment_method, Number(tip || 0), id);

    db.prepare("UPDATE tables SET status = 'free', updated_at = datetime('now') WHERE id = ?").run(order.table_id);
    deductInventoryForOrder(id);
  });

  closeTx();

  const formatted = formatOrder(id);
  const updatedTable = db.prepare('SELECT id, table_number, capacity, section, position_x, position_y, status FROM tables WHERE id = ?').get(order.table_id);

  wsManager.broadcast('order_closed', formatted);
  wsManager.broadcast('table_updated', updatedTable);

  res.status(200).json(formatted);
});

export default router;
