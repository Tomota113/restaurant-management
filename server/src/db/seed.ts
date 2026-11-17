import { db } from './connection';
import { runMigrations } from './migrate';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export function runSeed(): void {
  runMigrations();

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password_hash, full_name, role, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(username) DO UPDATE SET
      password_hash=excluded.password_hash,
      full_name=excluded.full_name,
      role=excluded.role,
      is_active=1
  `);

  const passwordHash = bcrypt.hashSync('Password123!', 10);

  const users = [
    { username: 'manager_admin', full_name: 'Main Manager', role: 'manager' },
    { username: 'waiter_alice', full_name: 'Alice Waiter', role: 'waiter' },
    { username: 'waiter_bob', full_name: 'Bob Waiter', role: 'waiter' },
    { username: 'chef_mario', full_name: 'Mario Chef', role: 'kitchen' }
  ];

  for (const u of users) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(u.username) as { id: string } | undefined;
    insertUser.run(existing?.id || uuidv4(), u.username, passwordHash, u.full_name, u.role);
  }

  // Tables
  const insertTable = db.prepare(`
    INSERT INTO tables (id, table_number, capacity, section, position_x, position_y, status)
    VALUES (?, ?, ?, ?, ?, ?, 'free')
    ON CONFLICT(table_number) DO UPDATE SET
      capacity=excluded.capacity,
      section=excluded.section,
      position_x=excluded.position_x,
      position_y=excluded.position_y
  `);

  const tables = [
    { table_number: 'T1', capacity: 2, section: 'Main Dining', position_x: 100, position_y: 100 },
    { table_number: 'T2', capacity: 4, section: 'Main Dining', position_x: 250, position_y: 100 },
    { table_number: 'T3', capacity: 6, section: 'Main Dining', position_x: 400, position_y: 100 },
    { table_number: 'T4', capacity: 4, section: 'Patio', position_x: 100, position_y: 250 },
    { table_number: 'T5', capacity: 2, section: 'Bar', position_x: 250, position_y: 250 },
    { table_number: 'T6', capacity: 8, section: 'Private Room', position_x: 400, position_y: 250 }
  ];

  for (const t of tables) {
    const existing = db.prepare('SELECT id FROM tables WHERE table_number = ?').get(t.table_number) as { id: string } | undefined;
    insertTable.run(existing?.id || uuidv4(), t.table_number, t.capacity, t.section, t.position_x, t.position_y);
  }

  // Categories
  const categories = [
    { name: 'Starters', display_order: 1, description: 'Appetizers and soups' },
    { name: 'Mains', display_order: 2, description: 'Hearty main courses' },
    { name: 'Desserts', display_order: 3, description: 'Sweet treats' },
    { name: 'Drinks', display_order: 4, description: 'Hot & cold beverages' }
  ];

  const categoryMap = new Map<string, string>();
  for (const c of categories) {
    let cat = db.prepare('SELECT id FROM categories WHERE name = ?').get(c.name) as { id: string } | undefined;
    if (!cat) {
      const id = uuidv4();
      db.prepare('INSERT INTO categories (id, name, display_order, description) VALUES (?, ?, ?, ?)').run(id, c.name, c.display_order, c.description);
      categoryMap.set(c.name, id);
    } else {
      categoryMap.set(c.name, cat.id);
    }
  }

  // Ingredients
  const ingredients = [
    { name: 'Beef Patty', unit: 'pcs', current_stock: 50, low_stock_threshold: 10, cost_per_unit: 2.5 },
    { name: 'Brioche Bun', unit: 'pcs', current_stock: 60, low_stock_threshold: 15, cost_per_unit: 0.8 },
    { name: 'Cheddar Cheese', unit: 'g', current_stock: 2000, low_stock_threshold: 500, cost_per_unit: 0.02 },
    { name: 'Salmon Fillet', unit: 'g', current_stock: 3000, low_stock_threshold: 800, cost_per_unit: 0.04 },
    { name: 'Pasta Noodles', unit: 'g', current_stock: 5000, low_stock_threshold: 1000, cost_per_unit: 0.01 },
    { name: 'Tomato Sauce', unit: 'ml', current_stock: 4000, low_stock_threshold: 1000, cost_per_unit: 0.015 },
    { name: 'Craft IPA', unit: 'pcs', current_stock: 48, low_stock_threshold: 12, cost_per_unit: 1.5 },
    { name: 'Chocolate Lava Mix', unit: 'g', current_stock: 1500, low_stock_threshold: 300, cost_per_unit: 0.03 }
  ];

  const ingredientMap = new Map<string, string>();
  for (const ing of ingredients) {
    let row = db.prepare('SELECT id FROM ingredients WHERE name = ?').get(ing.name) as { id: string } | undefined;
    if (!row) {
      const id = uuidv4();
      db.prepare('INSERT INTO ingredients (id, name, unit, current_stock, low_stock_threshold, cost_per_unit) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, ing.name, ing.unit, ing.current_stock, ing.low_stock_threshold, ing.cost_per_unit);
      ingredientMap.set(ing.name, id);
    } else {
      ingredientMap.set(ing.name, row.id);
    }
  }

  // Menu items & recipes
  const menuItems = [
    {
      category: 'Mains',
      name: 'Classic Cheeseburger',
      description: 'Juicy beef patty, cheddar, brioche bun',
      price: 14.50,
      is_available: 1,
      recipe: [
        { ingredient: 'Beef Patty', quantity: 1 },
        { ingredient: 'Brioche Bun', quantity: 1 },
        { ingredient: 'Cheddar Cheese', quantity: 50 }
      ]
    },
    {
      category: 'Mains',
      name: 'Grilled Salmon',
      description: 'Fresh Atlantic salmon with herbs',
      price: 22.00,
      is_available: 1,
      recipe: [
        { ingredient: 'Salmon Fillet', quantity: 200 }
      ]
    },
    {
      category: 'Mains',
      name: 'Penne Pomodoro',
      description: 'Al dente penne in house-made tomato sauce',
      price: 12.00,
      is_available: 1,
      recipe: [
        { ingredient: 'Pasta Noodles', quantity: 150 },
        { ingredient: 'Tomato Sauce', quantity: 100 }
      ]
    },
    {
      category: 'Drinks',
      name: 'House Craft IPA',
      description: 'Chilled local craft IPA',
      price: 6.50,
      is_available: 1,
      recipe: [
        { ingredient: 'Craft IPA', quantity: 1 }
      ]
    },
    {
      category: 'Desserts',
      name: 'Chocolate Lava Cake',
      description: 'Warm chocolate cake with molten core',
      price: 8.00,
      is_available: 1,
      recipe: [
        { ingredient: 'Chocolate Lava Mix', quantity: 100 }
      ]
    }
  ];

  for (const item of menuItems) {
    const categoryId = categoryMap.get(item.category);
    if (!categoryId) continue;

    let row = db.prepare('SELECT id FROM menu_items WHERE name = ?').get(item.name) as { id: string } | undefined;
    let itemId = row?.id;
    if (!itemId) {
      itemId = uuidv4();
      db.prepare('INSERT INTO menu_items (id, category_id, name, description, price, is_available) VALUES (?, ?, ?, ?, ?, ?)')
        .run(itemId, categoryId, item.name, item.description, item.price, item.is_available);
    }

    if (item.recipe && item.recipe.length > 0) {
      db.prepare('DELETE FROM recipes WHERE menu_item_id = ?').run(itemId);
      for (const r of item.recipe) {
        const ingId = ingredientMap.get(r.ingredient);
        if (ingId) {
          db.prepare('INSERT OR REPLACE INTO recipes (id, menu_item_id, ingredient_id, quantity_required) VALUES (?, ?, ?, ?)')
            .run(uuidv4(), itemId, ingId, r.quantity);
        }
      }
    }
  }

  console.log('✔ Database seeded with fixtures successfully.');
}

if (require.main === module) {
  runSeed();
}
