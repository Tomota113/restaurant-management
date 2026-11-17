import { Router, Request, Response } from 'express';
import { db } from '../db/connection';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// All dashboard analytics are restricted to managers
router.use(authenticate, requireRole('manager'));

// GET /api/dashboard/summary
router.get('/summary', (req: Request, res: Response): void => {
  // Compute revenues strictly from closed orders
  const todayRevRow = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0.0) AS today_rev, COUNT(id) AS today_cnt
    FROM orders
    WHERE status = 'closed' AND date(closed_at) = date('now')
  `).get() as any;

  const weekRevRow = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0.0) AS week_rev
    FROM orders
    WHERE status = 'closed' AND closed_at >= datetime('now', '-7 days')
  `).get() as any;

  const monthRevRow = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0.0) AS month_rev
    FROM orders
    WHERE status = 'closed' AND closed_at >= datetime('now', '-30 days')
  `).get() as any;

  const activeOrdersRow = db.prepare(`
    SELECT COUNT(id) AS active_cnt
    FROM orders
    WHERE status NOT IN ('closed', 'cancelled')
  `).get() as any;

  const lowStockRow = db.prepare(`
    SELECT COUNT(id) AS low_stock_cnt
    FROM ingredients
    WHERE current_stock <= low_stock_threshold
  `).get() as any;

  const todayRevenue = Number(Number(todayRevRow?.today_rev || 0).toFixed(2));
  const weekRevenue = Number(Number(weekRevRow?.week_rev || 0).toFixed(2));
  const monthRevenue = Number(Number(monthRevRow?.month_rev || 0).toFixed(2));

  res.status(200).json({
    today_revenue: todayRevenue,
    week_revenue: weekRevenue,
    month_revenue: monthRevenue,
    today_orders: Number(todayRevRow?.today_cnt || 0),
    active_orders: Number(activeOrdersRow?.active_cnt || 0),
    low_stock_alerts_count: Number(lowStockRow?.low_stock_cnt || 0)
  });
});

// GET /api/dashboard/popular-dishes
router.get('/popular-dishes', (req: Request, res: Response): void => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

  const popular = db.prepare(`
    SELECT m.id, m.id AS menu_item_id, m.name, c.name AS category_name, m.price,
           COALESCE(SUM(oi.quantity), 0) AS total_orders,
           COALESCE(SUM(oi.quantity), 0) AS quantity_sold,
           COALESCE(SUM(oi.quantity * oi.unit_price), 0.0) AS total_revenue
    FROM menu_items m
    JOIN order_items oi ON m.id = oi.menu_item_id
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN categories c ON m.category_id = c.id
    WHERE o.status = 'closed'
    GROUP BY m.id
    ORDER BY total_orders DESC, total_revenue DESC
    LIMIT ?
  `).all(limit) as any[];

  // If no closed orders yet, also list available items with 0 count
  if (popular.length === 0) {
    const defaultItems = db.prepare(`
      SELECT m.id, m.id AS menu_item_id, m.name, c.name AS category_name, m.price,
             0 AS total_orders, 0 AS quantity_sold, 0.0 AS total_revenue
      FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id
      LIMIT ?
    `).all(limit) as any[];

    res.status(200).json(defaultItems.map(d => ({
      ...d,
      price: Number(d.price),
      total_orders: 0,
      quantity_sold: 0,
      total_revenue: 0.0
    })));
    return;
  }

  const formatted = popular.map(item => ({
    ...item,
    price: Number(item.price),
    total_orders: Number(item.total_orders),
    quantity_sold: Number(item.quantity_sold),
    total_revenue: Number(Number(item.total_revenue).toFixed(2))
  }));

  res.status(200).json(formatted);
});

// GET /api/dashboard/table-turnover
router.get('/table-turnover', (req: Request, res: Response): void => {
  const turnoverRow = db.prepare(`
    SELECT 
      AVG((strftime('%s', closed_at) - strftime('%s', created_at)) / 60.0) AS avg_turnover,
      COUNT(id) AS total_completed
    FROM orders
    WHERE status = 'closed' AND closed_at IS NOT NULL
  `).get() as any;

  const avgMinutes = turnoverRow?.avg_turnover !== null && turnoverRow?.avg_turnover !== undefined
    ? Number(Number(turnoverRow.avg_turnover).toFixed(1))
    : 0;

  res.status(200).json({
    avg_turnover_minutes: avgMinutes,
    total_completed_tables: Number(turnoverRow?.total_completed || 0)
  });
});

// GET /api/dashboard/order-trends
router.get('/order-trends', (req: Request, res: Response): void => {
  const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;

  const dailyTrends = db.prepare(`
    SELECT 
      date(closed_at) AS date,
      COUNT(id) AS order_count,
      COALESCE(SUM(total_amount), 0.0) AS revenue
    FROM orders
    WHERE status = 'closed' AND closed_at >= datetime('now', '-' || ? || ' days')
    GROUP BY date(closed_at)
    ORDER BY date ASC
  `).all(days) as any[];

  const hourlyToday = db.prepare(`
    SELECT 
      strftime('%H:00', closed_at) AS hour,
      COUNT(id) AS order_count,
      COALESCE(SUM(total_amount), 0.0) AS revenue
    FROM orders
    WHERE status = 'closed' AND date(closed_at) = date('now')
    GROUP BY strftime('%H', closed_at)
    ORDER BY hour ASC
  `).all() as any[];

  res.status(200).json({
    daily: dailyTrends.map(d => ({
      date: d.date,
      order_count: Number(d.order_count),
      revenue: Number(Number(d.revenue).toFixed(2))
    })),
    hourly: hourlyToday.map(h => ({
      hour: h.hour,
      order_count: Number(h.order_count),
      revenue: Number(Number(h.revenue).toFixed(2))
    }))
  });
});

export default router;
