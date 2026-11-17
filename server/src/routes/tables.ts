import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { authenticate, requireRole } from '../middleware/auth';
import { wsManager } from '../websocket/server';

const router = Router();

// GET /api/tables (All authenticated users)
router.get('/', authenticate, (req: Request, res: Response): void => {
  const tables = db.prepare(`
    SELECT id, table_number, capacity, section, position_x, position_y, status, created_at, updated_at
    FROM tables
    ORDER BY table_number ASC
  `).all() as any[];

  res.status(200).json(tables);
});

// POST /api/tables (Manager only)
router.post('/', authenticate, requireRole('manager'), (req: Request, res: Response): void => {
  const { table_number, capacity, section = 'Main Dining', position_x = 0, position_y = 0 } = req.body;

  if (!table_number) {
    res.status(400).json({ error: 'Table number is required' });
    return;
  }

  if (capacity === undefined || Number(capacity) <= 0) {
    res.status(400).json({ error: 'Capacity must be greater than 0' });
    return;
  }

  const existing = db.prepare('SELECT id FROM tables WHERE table_number = ?').get(table_number);
  if (existing) {
    res.status(409).json({ error: `Table number '${table_number}' already exists` });
    return;
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO tables (id, table_number, capacity, section, position_x, position_y, status)
    VALUES (?, ?, ?, ?, ?, ?, 'free')
  `).run(id, table_number, Number(capacity), section, Number(position_x), Number(position_y));

  const table = db.prepare('SELECT id, table_number, capacity, section, position_x, position_y, status, created_at, updated_at FROM tables WHERE id = ?').get(id);

  wsManager.broadcast('table_created', table);
  res.status(201).json(table);
});

// PUT /api/tables/:id (Manager only)
router.put('/:id', authenticate, requireRole('manager'), (req: Request, res: Response): void => {
  const { id } = req.params;
  const { table_number, capacity, section, position_x, position_y, status } = req.body;

  const existing = db.prepare('SELECT id, table_number FROM tables WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Table not found' });
    return;
  }

  if (table_number && table_number !== existing.table_number) {
    const dup = db.prepare('SELECT id FROM tables WHERE table_number = ? AND id != ?').get(table_number, id);
    if (dup) {
      res.status(409).json({ error: `Table number '${table_number}' already exists` });
      return;
    }
  }

  if (capacity !== undefined && Number(capacity) <= 0) {
    res.status(400).json({ error: 'Capacity must be greater than 0' });
    return;
  }

  if (status && !['free', 'occupied', 'reserved'].includes(status)) {
    res.status(400).json({ error: "Status must be 'free', 'occupied', or 'reserved'" });
    return;
  }

  db.prepare(`
    UPDATE tables
    SET table_number = COALESCE(?, table_number),
        capacity = COALESCE(?, capacity),
        section = COALESCE(?, section),
        position_x = COALESCE(?, position_x),
        position_y = COALESCE(?, position_y),
        status = COALESCE(?, status),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    table_number || null,
    capacity !== undefined ? Number(capacity) : null,
    section !== undefined ? section : null,
    position_x !== undefined ? Number(position_x) : null,
    position_y !== undefined ? Number(position_y) : null,
    status || null,
    id
  );

  const updated = db.prepare('SELECT id, table_number, capacity, section, position_x, position_y, status, created_at, updated_at FROM tables WHERE id = ?').get(id);

  wsManager.broadcast('table_updated', updated);
  res.status(200).json(updated);
});

// DELETE /api/tables/:id (Manager only)
router.delete('/:id', authenticate, requireRole('manager'), (req: Request, res: Response): void => {
  const { id } = req.params;

  const table = db.prepare('SELECT id, status FROM tables WHERE id = ?').get(id) as { id: string; status: string } | undefined;
  if (!table) {
    res.status(404).json({ error: 'Table not found' });
    return;
  }

  // Check if table is occupied or has active orders
  const activeOrder = db.prepare(`
    SELECT id FROM orders
    WHERE table_id = ? AND status NOT IN ('closed', 'cancelled')
  `).get(id);

  if (table.status === 'occupied' || activeOrder) {
    res.status(400).json({ error: 'Cannot delete table while it is occupied with an active order' });
    return;
  }

  db.prepare('DELETE FROM tables WHERE id = ?').run(id);

  wsManager.broadcast('table_deleted', { id });
  res.status(200).json({ message: 'Table deleted successfully' });
});

export default router;
