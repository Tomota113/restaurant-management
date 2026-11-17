import { Router, Request, Response } from 'express';
import { db } from '../db/connection';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/kitchen/orders (Active orders for KDS)
router.get('/orders', (req: Request, res: Response): void => {
  const activeOrders = db.prepare(`
    SELECT o.id, o.table_id, t.table_number, t.section AS table_section,
           o.user_id, u.full_name AS staff_name, o.status, o.total_amount,
           o.notes, o.created_at
    FROM orders o
    JOIN tables t ON o.table_id = t.id
    LEFT JOIN users u ON o.user_id = u.id
    WHERE o.status NOT IN ('closed', 'cancelled')
    ORDER BY o.created_at ASC
  `).all() as any[];

  const orderIds = activeOrders.map(o => o.id);
  const itemsByOrder = new Map<string, any[]>();

  if (orderIds.length > 0) {
    const placeholders = orderIds.map(() => '?').join(',');
    const items = db.prepare(`
      SELECT oi.id, oi.order_id, oi.menu_item_id, m.name, oi.quantity,
             oi.special_instructions, c.name AS category_name
      FROM order_items oi
      JOIN menu_items m ON oi.menu_item_id = m.id
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE oi.order_id IN (${placeholders})
      ORDER BY oi.created_at ASC
    `).all(...orderIds) as any[];

    for (const item of items) {
      if (!itemsByOrder.has(item.order_id)) {
        itemsByOrder.set(item.order_id, []);
      }
      itemsByOrder.get(item.order_id)!.push({
        id: item.id,
        menu_item_id: item.menu_item_id,
        name: item.name,
        quantity: Number(item.quantity),
        special_instructions: item.special_instructions,
        category_name: item.category_name
      });
    }
  }

  const result = activeOrders.map(order => ({
    ...order,
    total_amount: Number(order.total_amount),
    items: itemsByOrder.get(order.id) || []
  }));

  res.status(200).json(result);
});

export default router;
