import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { authenticate } from '../middleware/auth';
import { wsManager } from '../websocket/server';

const router = Router();

// All reservation endpoints require authentication (waiters and managers can create/manage reservations)
router.use(authenticate);

// GET /api/reservations
router.get('/', (req: Request, res: Response): void => {
  const { date, table_id, status } = req.query;

  let query = `
    SELECT r.id, r.table_id, t.table_number, r.customer_name, r.customer_phone,
           r.reservation_date, r.reservation_time, r.party_size, r.notes, r.status,
           r.created_at, r.updated_at
    FROM reservations r
    JOIN tables t ON r.table_id = t.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (date) {
    query += ' AND r.reservation_date = ?';
    params.push(date);
  }

  if (table_id) {
    query += ' AND r.table_id = ?';
    params.push(table_id);
  }

  if (status) {
    query += ' AND r.status = ?';
    params.push(status);
  }

  query += ' ORDER BY r.reservation_date ASC, r.reservation_time ASC';

  const reservations = db.prepare(query).all(...params) as any[];
  res.status(200).json(reservations);
});

// POST /api/reservations
router.post('/', (req: Request, res: Response): void => {
  const { table_id, customer_name, customer_phone, reservation_date, reservation_time, party_size, notes } = req.body;

  if (!table_id || !customer_name || !reservation_date || !reservation_time || party_size === undefined) {
    res.status(400).json({ error: 'table_id, customer_name, reservation_date, reservation_time, and party_size are required' });
    return;
  }

  const numPartySize = Number(party_size);
  if (isNaN(numPartySize) || numPartySize <= 0) {
    res.status(400).json({ error: 'Party size must be greater than 0' });
    return;
  }

  // Check table
  const table = db.prepare('SELECT id, table_number, capacity, status FROM tables WHERE id = ?').get(table_id) as any;
  if (!table) {
    res.status(404).json({ error: 'Table not found' });
    return;
  }

  if (numPartySize > table.capacity) {
    res.status(400).json({ error: `Party size (${numPartySize}) exceeds table capacity (${table.capacity})` });
    return;
  }

  // Check overlapping reservation on same table, date and time
  const conflict = db.prepare(`
    SELECT id FROM reservations
    WHERE table_id = ? AND reservation_date = ? AND reservation_time = ? AND status = 'confirmed'
  `).get(table_id, reservation_date, reservation_time);

  if (conflict) {
    res.status(409).json({ error: 'Table already has a confirmed reservation for this time slot' });
    return;
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO reservations (id, table_id, customer_name, customer_phone, reservation_date, reservation_time, party_size, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
  `).run(id, table_id, customer_name, customer_phone || null, reservation_date, reservation_time, numPartySize, notes || null);

  // Update table status to 'reserved' if currently free
  if (table.status === 'free') {
    db.prepare("UPDATE tables SET status = 'reserved', updated_at = datetime('now') WHERE id = ?").run(table_id);
    const updatedTable = db.prepare('SELECT id, table_number, capacity, section, position_x, position_y, status FROM tables WHERE id = ?').get(table_id);
    wsManager.broadcast('table_updated', updatedTable);
  }

  const reservation = db.prepare(`
    SELECT r.id, r.table_id, t.table_number, r.customer_name, r.customer_phone,
           r.reservation_date, r.reservation_time, r.party_size, r.notes, r.status,
           r.created_at, r.updated_at
    FROM reservations r
    JOIN tables t ON r.table_id = t.id
    WHERE r.id = ?
  `).get(id);

  wsManager.broadcast('reservation_created', reservation);
  res.status(201).json(reservation);
});

// PUT /api/reservations/:id
router.put('/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const { customer_name, customer_phone, reservation_date, reservation_time, party_size, notes, status } = req.body;

  const existing = db.prepare('SELECT id, table_id, party_size FROM reservations WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Reservation not found' });
    return;
  }

  if (party_size !== undefined) {
    const numPartySize = Number(party_size);
    if (numPartySize <= 0) {
      res.status(400).json({ error: 'Party size must be greater than 0' });
      return;
    }
    const table = db.prepare('SELECT capacity FROM tables WHERE id = ?').get(existing.table_id) as any;
    if (table && numPartySize > table.capacity) {
      res.status(400).json({ error: `Party size (${numPartySize}) exceeds table capacity (${table.capacity})` });
      return;
    }
  }

  db.prepare(`
    UPDATE reservations
    SET customer_name = COALESCE(?, customer_name),
        customer_phone = COALESCE(?, customer_phone),
        reservation_date = COALESCE(?, reservation_date),
        reservation_time = COALESCE(?, reservation_time),
        party_size = COALESCE(?, party_size),
        notes = COALESCE(?, notes),
        status = COALESCE(?, status),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    customer_name || null,
    customer_phone !== undefined ? customer_phone : null,
    reservation_date || null,
    reservation_time || null,
    party_size !== undefined ? Number(party_size) : null,
    notes !== undefined ? notes : null,
    status || null,
    id
  );

  const updated = db.prepare(`
    SELECT r.id, r.table_id, t.table_number, r.customer_name, r.customer_phone,
           r.reservation_date, r.reservation_time, r.party_size, r.notes, r.status,
           r.created_at, r.updated_at
    FROM reservations r
    JOIN tables t ON r.table_id = t.id
    WHERE r.id = ?
  `).get(id);

  wsManager.broadcast('reservation_updated', updated);
  res.status(200).json(updated);
});

// DELETE /api/reservations/:id
router.delete('/:id', (req: Request, res: Response): void => {
  const { id } = req.params;

  const reservation = db.prepare('SELECT id, table_id, status FROM reservations WHERE id = ?').get(id) as any;
  if (!reservation) {
    res.status(404).json({ error: 'Reservation not found' });
    return;
  }

  db.prepare("UPDATE reservations SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(id);

  // Check if table has active order or other reservations
  const activeOrder = db.prepare("SELECT id FROM orders WHERE table_id = ? AND status NOT IN ('closed', 'cancelled')").get(reservation.table_id);
  const otherRes = db.prepare("SELECT id FROM reservations WHERE table_id = ? AND status = 'confirmed' AND id != ?").get(reservation.table_id, id);

  if (!activeOrder && !otherRes) {
    db.prepare("UPDATE tables SET status = 'free', updated_at = datetime('now') WHERE id = ?").run(reservation.table_id);
    const updatedTable = db.prepare('SELECT id, table_number, capacity, section, position_x, position_y, status FROM tables WHERE id = ?').get(reservation.table_id);
    wsManager.broadcast('table_updated', updatedTable);
  }

  wsManager.broadcast('reservation_cancelled', { id, table_id: reservation.table_id });
  res.status(200).json({ message: 'Reservation cancelled successfully' });
});

export default router;
