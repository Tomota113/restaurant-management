import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection';
import { config } from '../config';
import { authenticate } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', (req: Request, res: Response): void => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const user = db.prepare('SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = ?').get(username) as any;

  if (!user) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  if (!user.is_active) {
    res.status(401).json({ error: 'Account is deactivated' });
    return;
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: '24h' }
  );

  const safeUser = {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    is_active: Boolean(user.is_active)
  };

  res.status(200).json({
    token,
    accessToken: token,
    user: safeUser
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req: Request, res: Response): void => {
  const user = req.user!;
  res.status(200).json({
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      is_active: Boolean(user.is_active)
    }
  });
});

export default router;
