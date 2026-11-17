import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// All staff endpoints are restricted to managers
router.use(authenticate, requireRole('manager'));

// GET /api/staff
router.get('/', (req: Request, res: Response): void => {
  const staff = db.prepare(`
    SELECT id, username, full_name, role, is_active, created_at, updated_at
    FROM users
    ORDER BY created_at ASC
  `).all() as any[];

  const formatted = staff.map(s => ({
    ...s,
    is_active: Boolean(s.is_active)
  }));

  res.status(200).json(formatted);
});

// POST /api/staff
router.post('/', (req: Request, res: Response): void => {
  const { username, password, full_name, role } = req.body;

  if (!username || !password || !full_name || !role) {
    res.status(400).json({ error: 'Username, password, full_name, and role are required' });
    return;
  }

  if (!['manager', 'waiter', 'kitchen'].includes(role)) {
    res.status(400).json({ error: "Invalid role. Must be 'manager', 'waiter', or 'kitchen'" });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(409).json({ error: 'Username already exists' });
    return;
  }

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (id, username, password_hash, full_name, role, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(id, username, passwordHash, full_name, role);

  const newUser = {
    id,
    username,
    full_name,
    role,
    is_active: true
  };

  res.status(201).json(newUser);
});

// PUT /api/staff/:id
router.put('/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const { full_name, role, password } = req.body;

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Staff member not found' });
    return;
  }

  if (role && !['manager', 'waiter', 'kitchen'].includes(role)) {
    res.status(400).json({ error: "Invalid role. Must be 'manager', 'waiter', or 'kitchen'" });
    return;
  }

  if (password) {
    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare(`
      UPDATE users
      SET full_name = COALESCE(?, full_name),
          role = COALESCE(?, role),
          password_hash = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(full_name || null, role || null, passwordHash, id);
  } else {
    db.prepare(`
      UPDATE users
      SET full_name = COALESCE(?, full_name),
          role = COALESCE(?, role),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(full_name || null, role || null, id);
  }

  const updated = db.prepare('SELECT id, username, full_name, role, is_active, created_at, updated_at FROM users WHERE id = ?').get(id) as any;

  res.status(200).json({
    ...updated,
    is_active: Boolean(updated.is_active)
  });
});

// PATCH /api/staff/:id/status
router.patch('/:id/status', (req: Request, res: Response): void => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (is_active === undefined) {
    res.status(400).json({ error: 'is_active field is required' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Staff member not found' });
    return;
  }

  db.prepare(`
    UPDATE users
    SET is_active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(is_active ? 1 : 0, id);

  const updated = db.prepare('SELECT id, username, full_name, role, is_active, created_at, updated_at FROM users WHERE id = ?').get(id) as any;

  res.status(200).json({
    ...updated,
    is_active: Boolean(updated.is_active)
  });
});

// DELETE /api/staff/:id
router.delete('/:id', (req: Request, res: Response): void => {
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Staff member not found' });
    return;
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.status(200).json({ message: 'Staff member deleted successfully' });
});

export default router;
