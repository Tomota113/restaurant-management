# Original User Request

## Initial Request — 2026-08-21T00:47:59Z

Build a production-grade restaurant management system — a web application used by real restaurant staff (managers, waiters, kitchen) to manage daily operations including orders, menus, tables, inventory, personnel, and business analytics. The application must have responsive views optimized for tablets and mobile devices so that waitstaff can use it on the floor.

Working directory: ~/teamwork_projects/restaurant_management
Integrity mode: development

## Requirements

### R1. Order Management
The system must support the full lifecycle of a customer order: creating an order linked to a table, adding/removing/modifying items, sending the order to the kitchen, tracking order status (pending, in preparation, ready, served), and closing the order. Kitchen staff must have a dedicated view showing incoming and active orders in real time.

### R2. Menu Management
The system must allow creating, editing, and organizing menu items into categories (starters, mains, desserts, drinks, etc.) with name, description, price, and availability status. Managers must be able to toggle item availability (e.g., mark a dish as sold out) and the change must be immediately reflected in the order-taking interface.

### R3. Table and Reservation Management
The system must provide a visual representation of the restaurant floor plan with table statuses (free, occupied, reserved). It must support creating, modifying, and canceling reservations with date, time, party size, and customer name. Table status must update automatically based on orders and reservations.

### R4. Inventory and Stock Management
The system must track ingredient stock levels, support manual stock adjustments (deliveries, waste), and alert when stock falls below configurable thresholds. Stock levels should decrease as orders are fulfilled based on configurable ingredient-to-dish mappings.

### R5. Staff Management
The system must support user accounts with role-based access control (at minimum: manager, waiter, kitchen staff). Managers can create/edit/deactivate staff accounts and assign roles. Each role must see only the views and actions relevant to their responsibilities.

### R6. Dashboard and Statistics
The system must provide a manager-facing dashboard showing key metrics: daily/weekly/monthly revenue, most and least popular dishes, average table turnover time, and order volume trends. Data must be derived from actual order and table data.

## Acceptance Criteria

### Functional — Orders
- [ ] An order can be created, linked to an occupied table, and items from the menu can be added to it
- [ ] An order's status can transition through the full lifecycle (pending → in preparation → ready → served → closed) and each transition is persisted
- [ ] The kitchen view displays all non-closed orders and updates within 5 seconds of a new order being placed
- [ ] Modifying or removing an item from an open order is reflected immediately in the kitchen view

### Functional — Menu
- [ ] A menu item can be created with name, category, price, and description, and appears in the order-taking interface
- [ ] Toggling a menu item's availability to "sold out" prevents it from being added to new orders
- [ ] Menu items can be filtered or browsed by category

### Functional — Tables & Reservations
- [ ] The floor plan displays all tables with their current status (free/occupied/reserved)
- [ ] A reservation can be created with date, time, party size, and customer name, and the table shows as reserved for that time slot
- [ ] Opening an order on a table changes its status to occupied; closing the order changes it back to free

### Functional — Inventory
- [ ] Stock levels can be viewed and manually adjusted (increase on delivery, decrease on waste)
- [ ] When an order is completed, stock levels for the relevant ingredients decrease according to the configured mappings
- [ ] A low-stock alert is generated when any ingredient falls below its configured threshold

### Functional — Staff & Access Control
- [ ] A manager can create a new staff account with a specific role
- [ ] A waiter account cannot access manager-only features (e.g., staff management, dashboard)
- [ ] Kitchen staff account sees only the kitchen order view

### Functional — Dashboard
- [ ] The dashboard displays revenue for the current day, week, and month, computed from closed orders
- [ ] The dashboard shows a ranking of dishes by number of times ordered
- [ ] All dashboard figures update to reflect new closed orders without requiring manual refresh of underlying data

### Non-Functional
- [ ] The application starts successfully with a single documented command (e.g., a start script or docker-compose)
- [ ] A README documents how to install dependencies, seed sample data, and start the application
- [ ] The order-taking and kitchen views are usable on a tablet-sized viewport (768px width) without horizontal scrolling
- [ ] All automated tests pass (the project must include a test suite covering at minimum the order lifecycle and access control)
