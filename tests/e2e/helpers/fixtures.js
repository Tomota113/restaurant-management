/**
 * Test Fixtures & Constants for Restaurant Management System E2E Suite
 */

const FIXTURES = {
  users: {
    manager: {
      username: 'manager_admin',
      password: 'Password123!',
      full_name: 'Main Manager',
      role: 'manager'
    },
    waiter1: {
      username: 'waiter_alice',
      password: 'Password123!',
      full_name: 'Alice Waiter',
      role: 'waiter'
    },
    waiter2: {
      username: 'waiter_bob',
      password: 'Password123!',
      full_name: 'Bob Waiter',
      role: 'waiter'
    },
    kitchen: {
      username: 'chef_mario',
      password: 'Password123!',
      full_name: 'Mario Chef',
      role: 'kitchen'
    }
  },
  tables: [
    { table_number: 'T1', capacity: 2, section: 'Main Dining', position_x: 100, position_y: 100 },
    { table_number: 'T2', capacity: 4, section: 'Main Dining', position_x: 250, position_y: 100 },
    { table_number: 'T3', capacity: 6, section: 'Main Dining', position_x: 400, position_y: 100 },
    { table_number: 'T4', capacity: 4, section: 'Patio', position_x: 100, position_y: 250 },
    { table_number: 'T5', capacity: 2, section: 'Bar', position_x: 250, position_y: 250 },
    { table_number: 'T6', capacity: 8, section: 'Private Room', position_x: 400, position_y: 250 }
  ],
  categories: [
    { name: 'Starters', display_order: 1, description: 'Appetizers and soups' },
    { name: 'Mains', display_order: 2, description: 'Hearty main courses' },
    { name: 'Desserts', display_order: 3, description: 'Sweet treats' },
    { name: 'Drinks', display_order: 4, description: 'Hot & cold beverages' }
  ],
  ingredients: [
    { name: 'Beef Patty', unit: 'pcs', current_stock: 50, low_stock_threshold: 10, cost_per_unit: 2.5 },
    { name: 'Brioche Bun', unit: 'pcs', current_stock: 60, low_stock_threshold: 15, cost_per_unit: 0.8 },
    { name: 'Cheddar Cheese', unit: 'g', current_stock: 2000, low_stock_threshold: 500, cost_per_unit: 0.02 },
    { name: 'Salmon Fillet', unit: 'g', current_stock: 3000, low_stock_threshold: 800, cost_per_unit: 0.04 },
    { name: 'Pasta Noodles', unit: 'g', current_stock: 5000, low_stock_threshold: 1000, cost_per_unit: 0.01 },
    { name: 'Tomato Sauce', unit: 'ml', current_stock: 4000, low_stock_threshold: 1000, cost_per_unit: 0.015 },
    { name: 'Craft IPA', unit: 'pcs', current_stock: 48, low_stock_threshold: 12, cost_per_unit: 1.5 },
    { name: 'Chocolate Lava Mix', unit: 'g', current_stock: 1500, low_stock_threshold: 300, cost_per_unit: 0.03 }
  ],
  menuItems: [
    {
      category: 'Mains',
      name: 'Classic Cheeseburger',
      description: 'Juicy beef patty, cheddar, brioche bun',
      price: 14.50,
      is_available: true,
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
      is_available: true,
      recipe: [
        { ingredient: 'Salmon Fillet', quantity: 200 }
      ]
    },
    {
      category: 'Mains',
      name: 'Penne Pomodoro',
      description: 'Al dente penne in house-made tomato sauce',
      price: 12.00,
      is_available: true,
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
      is_available: true,
      recipe: [
        { ingredient: 'Craft IPA', quantity: 1 }
      ]
    },
    {
      category: 'Desserts',
      name: 'Chocolate Lava Cake',
      description: 'Warm chocolate cake with molten core',
      price: 8.00,
      is_available: true,
      recipe: [
        { ingredient: 'Chocolate Lava Mix', quantity: 100 }
      ]
    }
  ]
};

module.exports = FIXTURES;
