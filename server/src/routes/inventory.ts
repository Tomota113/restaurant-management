import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { authenticate, requireRole } from '../middleware/auth';
import { wsManager } from '../websocket/server';

const router = Router();

router.use(authenticate);

// ================= Ingredients =================

// GET /api/inventory/ingredients
router.get('/ingredients', (req: Request, res: Response): void => {
  const ingredients = db.prepare(`
    SELECT id, name, unit, current_stock, low_stock_threshold, cost_per_unit, created_at, updated_at
    FROM ingredients
    ORDER BY name ASC
  `).all() as any[];

  const formatted = ingredients.map(i => ({
    ...i,
    current_stock: Number(i.current_stock),
    low_stock_threshold: Number(i.low_stock_threshold),
    cost_per_unit: Number(i.cost_per_unit || 0)
  }));

  res.status(200).json(formatted);
});

// POST /api/inventory/ingredients (Manager only)
router.post('/ingredients', requireRole('manager'), (req: Request, res: Response): void => {
  const { name, unit, current_stock = 0, low_stock_threshold = 0, cost_per_unit = 0 } = req.body;

  if (!name || !unit) {
    res.status(400).json({ error: 'Ingredient name and unit are required' });
    return;
  }

  const numStock = Number(current_stock);
  const numThreshold = Number(low_stock_threshold);
  const numCost = Number(cost_per_unit);

  if (numStock < 0 || numThreshold < 0 || numCost < 0) {
    res.status(400).json({ error: 'Stock, threshold, and cost cannot be negative' });
    return;
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO ingredients (id, name, unit, current_stock, low_stock_threshold, cost_per_unit)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), unit.trim(), numStock, numThreshold, numCost);

  const ing = db.prepare('SELECT id, name, unit, current_stock, low_stock_threshold, cost_per_unit, created_at, updated_at FROM ingredients WHERE id = ?').get(id) as any;

  const formatted = {
    ...ing,
    current_stock: Number(ing.current_stock),
    low_stock_threshold: Number(ing.low_stock_threshold),
    cost_per_unit: Number(ing.cost_per_unit)
  };

  res.status(201).json(formatted);
});

// PUT /api/inventory/ingredients/:id (Manager only)
router.put('/ingredients/:id', requireRole('manager'), (req: Request, res: Response): void => {
  const { id } = req.params;
  const { name, unit, current_stock, low_stock_threshold, cost_per_unit } = req.body;

  const existing = db.prepare('SELECT id FROM ingredients WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Ingredient not found' });
    return;
  }

  if (
    (current_stock !== undefined && Number(current_stock) < 0) ||
    (low_stock_threshold !== undefined && Number(low_stock_threshold) < 0) ||
    (cost_per_unit !== undefined && Number(cost_per_unit) < 0)
  ) {
    res.status(400).json({ error: 'Stock, threshold, and cost cannot be negative' });
    return;
  }

  db.prepare(`
    UPDATE ingredients
    SET name = COALESCE(?, name),
        unit = COALESCE(?, unit),
        current_stock = COALESCE(?, current_stock),
        low_stock_threshold = COALESCE(?, low_stock_threshold),
        cost_per_unit = COALESCE(?, cost_per_unit),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ? name.trim() : null,
    unit ? unit.trim() : null,
    current_stock !== undefined ? Number(current_stock) : null,
    low_stock_threshold !== undefined ? Number(low_stock_threshold) : null,
    cost_per_unit !== undefined ? Number(cost_per_unit) : null,
    id
  );

  const updated = db.prepare('SELECT id, name, unit, current_stock, low_stock_threshold, cost_per_unit, created_at, updated_at FROM ingredients WHERE id = ?').get(id) as any;

  res.status(200).json({
    ...updated,
    current_stock: Number(updated.current_stock),
    low_stock_threshold: Number(updated.low_stock_threshold),
    cost_per_unit: Number(updated.cost_per_unit)
  });
});

// POST /api/inventory/adjust (Manager only)
router.post('/adjust', requireRole('manager'), (req: Request, res: Response): void => {
  const { ingredient_id, adjustment_type, quantity_delta, reason } = req.body;

  if (!ingredient_id || quantity_delta === undefined || !reason) {
    res.status(400).json({ error: 'ingredient_id, quantity_delta, and reason are required' });
    return;
  }

  const validTypes = ['delivery', 'waste', 'manual', 'order_fulfillment'];
  const type = adjustment_type || 'manual';
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `Invalid adjustment_type. Must be one of: ${validTypes.join(', ')}` });
    return;
  }

  const ing = db.prepare('SELECT id, name, unit, current_stock, low_stock_threshold FROM ingredients WHERE id = ?').get(ingredient_id) as any;
  if (!ing) {
    res.status(404).json({ error: 'Ingredient not found' });
    return;
  }

  const delta = Number(quantity_delta);
  if (isNaN(delta)) {
    res.status(400).json({ error: 'quantity_delta must be a number' });
    return;
  }

  const newStock = Math.max(0, Number((Number(ing.current_stock) + delta).toFixed(6)));

  const adjustTx = db.transaction(() => {
    db.prepare(`
      UPDATE ingredients
      SET current_stock = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newStock, ingredient_id);

    db.prepare(`
      INSERT INTO inventory_logs (id, ingredient_id, adjustment_type, quantity_delta, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), ingredient_id, type, delta, reason);
  });

  adjustTx();

  const updated = db.prepare('SELECT id, name, unit, current_stock, low_stock_threshold, cost_per_unit, created_at, updated_at FROM ingredients WHERE id = ?').get(ingredient_id) as any;

  const formatted = {
    ...updated,
    current_stock: Number(updated.current_stock),
    low_stock_threshold: Number(updated.low_stock_threshold),
    cost_per_unit: Number(updated.cost_per_unit)
  };

  if (formatted.current_stock <= formatted.low_stock_threshold) {
    wsManager.broadcast('inventory_alert', formatted);
  }

  res.status(200).json({
    message: 'Stock adjusted successfully',
    ingredient: formatted
  });
});

// GET /api/inventory/alerts (Ingredients at or below threshold)
router.get('/alerts', (req: Request, res: Response): void => {
  const alerts = db.prepare(`
    SELECT id, name, unit, current_stock, low_stock_threshold, cost_per_unit, updated_at
    FROM ingredients
    WHERE current_stock <= low_stock_threshold
    ORDER BY (current_stock - low_stock_threshold) ASC
  `).all() as any[];

  const formatted = alerts.map(a => ({
    ...a,
    current_stock: Number(a.current_stock),
    low_stock_threshold: Number(a.low_stock_threshold),
    cost_per_unit: Number(a.cost_per_unit)
  }));

  res.status(200).json(formatted);
});

// ================= Recipes (BOM) =================

// GET /api/inventory/recipes/:menuItemId
router.get('/recipes/:menuItemId', (req: Request, res: Response): void => {
  const { menuItemId } = req.params;

  const recipes = db.prepare(`
    SELECT r.id, r.menu_item_id, r.ingredient_id, i.name, i.unit, r.quantity_required, i.cost_per_unit
    FROM recipes r
    JOIN ingredients i ON r.ingredient_id = i.id
    WHERE r.menu_item_id = ?
    ORDER BY i.name ASC
  `).all(menuItemId) as any[];

  const formatted = recipes.map(r => ({
    ...r,
    quantity_required: Number(r.quantity_required),
    cost_per_unit: Number(r.cost_per_unit)
  }));

  res.status(200).json(formatted);
});

// POST /api/inventory/recipes (Manager only)
router.post('/recipes', requireRole('manager'), (req: Request, res: Response): void => {
  const { menu_item_id, ingredients } = req.body;

  if (!menu_item_id || !ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    res.status(400).json({ error: 'menu_item_id and a non-empty array of ingredients are required' });
    return;
  }

  const menuItem = db.prepare('SELECT id FROM menu_items WHERE id = ?').get(menu_item_id);
  if (!menuItem) {
    res.status(404).json({ error: 'Menu item not found' });
    return;
  }

  const recipeTx = db.transaction(() => {
    db.prepare('DELETE FROM recipes WHERE menu_item_id = ?').run(menu_item_id);

    const insertRecipe = db.prepare(`
      INSERT INTO recipes (id, menu_item_id, ingredient_id, quantity_required)
      VALUES (?, ?, ?, ?)
    `);

    for (const ing of ingredients) {
      if (!ing.ingredient_id || ing.quantity_required === undefined || Number(ing.quantity_required) <= 0) {
        throw new Error('Each recipe ingredient must have a valid ingredient_id and quantity_required > 0');
      }
      insertRecipe.run(uuidv4(), menu_item_id, ing.ingredient_id, Number(ing.quantity_required));
    }
  });

  try {
    recipeTx();
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  const updatedRecipes = db.prepare(`
    SELECT r.id, r.menu_item_id, r.ingredient_id, i.name, i.unit, r.quantity_required, i.cost_per_unit
    FROM recipes r
    JOIN ingredients i ON r.ingredient_id = i.id
    WHERE r.menu_item_id = ?
  `).all(menu_item_id) as any[];

  res.status(201).json(updatedRecipes.map(r => ({
    ...r,
    quantity_required: Number(r.quantity_required),
    cost_per_unit: Number(r.cost_per_unit)
  })));
});

export default router;
