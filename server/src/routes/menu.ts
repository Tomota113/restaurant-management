import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { authenticate, requireRole } from '../middleware/auth';
import { wsManager } from '../websocket/server';

const router = Router();

// ================= Categories =================

// GET /api/menu/categories (All authenticated users)
router.get('/categories', authenticate, (req: Request, res: Response): void => {
  const categories = db.prepare(`
    SELECT id, name, display_order, description, created_at
    FROM categories
    ORDER BY display_order ASC, name ASC
  `).all();

  res.status(200).json(categories);
});

// POST /api/menu/categories (Manager only)
router.post('/categories', authenticate, requireRole('manager'), (req: Request, res: Response): void => {
  const { name, display_order = 0, description } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Category name is required' });
    return;
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO categories (id, name, display_order, description)
    VALUES (?, ?, ?, ?)
  `).run(id, name.trim(), display_order, description || null);

  const category = db.prepare('SELECT id, name, display_order, description, created_at FROM categories WHERE id = ?').get(id);

  wsManager.broadcast('category_created', category);
  res.status(201).json(category);
});

// PUT /api/menu/categories/:id (Manager only)
router.put('/categories/:id', authenticate, requireRole('manager'), (req: Request, res: Response): void => {
  const { id } = req.params;
  const { name, display_order, description } = req.body;

  const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  db.prepare(`
    UPDATE categories
    SET name = COALESCE(?, name),
        display_order = COALESCE(?, display_order),
        description = COALESCE(?, description)
    WHERE id = ?
  `).run(name ? name.trim() : null, display_order !== undefined ? display_order : null, description !== undefined ? description : null, id);

  const updated = db.prepare('SELECT id, name, display_order, description, created_at FROM categories WHERE id = ?').get(id);

  wsManager.broadcast('category_updated', updated);
  res.status(200).json(updated);
});

// DELETE /api/menu/categories/:id (Manager only)
router.delete('/categories/:id', authenticate, requireRole('manager'), (req: Request, res: Response): void => {
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);

  wsManager.broadcast('category_deleted', { id });
  res.status(200).json({ message: 'Category deleted successfully' });
});

// ================= Menu Items =================

// GET /api/menu/items (All authenticated users)
router.get('/items', authenticate, (req: Request, res: Response): void => {
  const { category_id, available_only } = req.query;

  let query = `
    SELECT m.id, m.category_id, c.name AS category_name, m.name, m.description, m.price, m.is_available, m.created_at, m.updated_at
    FROM menu_items m
    JOIN categories c ON m.category_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (category_id) {
    query += ' AND m.category_id = ?';
    params.push(category_id);
  }

  if (available_only === 'true' || available_only === '1') {
    query += ' AND m.is_available = 1';
  }

  query += ' ORDER BY c.display_order ASC, m.name ASC';

  const items = db.prepare(query).all(...params) as any[];
  const formatted = items.map(item => ({
    ...item,
    price: Number(item.price),
    is_available: Boolean(item.is_available)
  }));

  res.status(200).json(formatted);
});

// POST /api/menu/items (Manager only)
router.post('/items', authenticate, requireRole('manager'), (req: Request, res: Response): void => {
  const { category_id, name, description, price, is_available = true } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Menu item name is required' });
    return;
  }

  if (!category_id) {
    res.status(400).json({ error: 'Category ID is required' });
    return;
  }

  if (price === undefined || price === null || isNaN(Number(price))) {
    res.status(400).json({ error: 'Price is required and must be a number' });
    return;
  }

  const numPrice = Number(price);
  if (numPrice < 0) {
    res.status(400).json({ error: 'Price cannot be negative' });
    return;
  }

  const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id);
  if (!cat) {
    res.status(400).json({ error: 'Category does not exist' });
    return;
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO menu_items (id, category_id, name, description, price, is_available)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, category_id, name.trim(), description || null, numPrice, is_available ? 1 : 0);

  const item = db.prepare(`
    SELECT m.id, m.category_id, c.name AS category_name, m.name, m.description, m.price, m.is_available, m.created_at, m.updated_at
    FROM menu_items m
    JOIN categories c ON m.category_id = c.id
    WHERE m.id = ?
  `).get(id) as any;

  const formatted = {
    ...item,
    price: Number(item.price),
    is_available: Boolean(item.is_available)
  };

  wsManager.broadcast('menu_item_created', formatted);
  res.status(201).json(formatted);
});

// PUT /api/menu/items/:id (Manager only)
router.put('/items/:id', authenticate, requireRole('manager'), (req: Request, res: Response): void => {
  const { id } = req.params;
  const { category_id, name, description, price, is_available } = req.body;

  const existing = db.prepare('SELECT id FROM menu_items WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Menu item not found' });
    return;
  }

  if (price !== undefined && Number(price) < 0) {
    res.status(400).json({ error: 'Price cannot be negative' });
    return;
  }

  db.prepare(`
    UPDATE menu_items
    SET category_id = COALESCE(?, category_id),
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        is_available = COALESCE(?, is_available),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    category_id || null,
    name ? name.trim() : null,
    description !== undefined ? description : null,
    price !== undefined ? Number(price) : null,
    is_available !== undefined ? (is_available ? 1 : 0) : null,
    id
  );

  const updated = db.prepare(`
    SELECT m.id, m.category_id, c.name AS category_name, m.name, m.description, m.price, m.is_available, m.created_at, m.updated_at
    FROM menu_items m
    JOIN categories c ON m.category_id = c.id
    WHERE m.id = ?
  `).get(id) as any;

  const formatted = {
    ...updated,
    price: Number(updated.price),
    is_available: Boolean(updated.is_available)
  };

  wsManager.broadcast('menu_item_updated', formatted);
  res.status(200).json(formatted);
});

// PATCH /api/menu/items/:id/availability (Manager only)
router.patch('/items/:id/availability', authenticate, requireRole('manager'), (req: Request, res: Response): void => {
  const { id } = req.params;
  const { is_available } = req.body;

  if (is_available === undefined) {
    res.status(400).json({ error: 'is_available field is required' });
    return;
  }

  const existing = db.prepare('SELECT id FROM menu_items WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Menu item not found' });
    return;
  }

  db.prepare(`
    UPDATE menu_items
    SET is_available = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(is_available ? 1 : 0, id);

  const updated = db.prepare(`
    SELECT m.id, m.category_id, c.name AS category_name, m.name, m.description, m.price, m.is_available, m.created_at, m.updated_at
    FROM menu_items m
    JOIN categories c ON m.category_id = c.id
    WHERE m.id = ?
  `).get(id) as any;

  const formatted = {
    ...updated,
    price: Number(updated.price),
    is_available: Boolean(updated.is_available)
  };

  wsManager.broadcast('menu_item_updated', formatted);
  res.status(200).json(formatted);
});

// DELETE /api/menu/items/:id (Manager only)
router.delete('/items/:id', authenticate, requireRole('manager'), (req: Request, res: Response): void => {
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM menu_items WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Menu item not found' });
    return;
  }

  db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);

  wsManager.broadcast('menu_item_deleted', { id });
  res.status(200).json({ message: 'Menu item deleted successfully' });
});

export default router;
