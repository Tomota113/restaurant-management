# 🍽️ Restauro — Restaurant Management & Touch POS System

A high-performance, real-time Restaurant Operations and Point-of-Sale (POS) system built with **TypeScript**, **Node.js/Express**, **SQLite (WAL mode)**, **WebSockets**, and a modern **React SPA (Tailwind CSS)**.

---

## 🌟 Core Features

- **📱 Touch Tablet-Optimized Order Pad (R1)**:
  - 768px viewport responsive UI with touch targets $\ge 44\text{px}$.
  - Category filtering, fast item addition, item modifier notes (special instructions).
  - Live table cart bill summary with payment settlement (Card, Cash, Complimentary, Tip).
- **📋 Menu & Instant Sold-Out Protocol (R2)**:
  - Menu categories & dish CRUD with price validation.
  - One-click **86 Sold-Out** toggle with instant UI & order prevention sync.
- **🪑 Floor Plan & Reservation Management (R3)**:
  - Visual floor layout with capacity checks and section grouping (*Main Dining*, *Patio*, *Bar*, *Private Room*).
  - Real-time table states: `free` (Green), `occupied` (Red), `reserved` (Amber).
  - Time-slot conflict prevention and reservation booking modal.
- **📦 Inventory, Recipes & Bill of Materials (BOM) (R4)**:
  - Real-time ingredient tracking with unit-level precision.
  - Automatic atomic ingredient deduction upon order completion.
  - Low-stock threshold alerts broadcasted via WebSockets in real time.
  - Supplier delivery restocks and waste logging with audit trail.
- **👨‍🍳 Kitchen Display System (KDS) (R1 & R4)**:
  - Live kitchen ticket rail sorted chronologically with elapsed urgency timers.
  - One-touch status progression (`pending` $\rightarrow$ `in_preparation` $\rightarrow$ `ready` $\rightarrow$ `served`).
  - Cooking notes and modification alerts highlighted for kitchen staff.
- **👥 Role-Based Access Control (RBAC) (R5)**:
  - Strict role isolation for `manager`, `waiter`, and `kitchen`.
  - Immediate session invalidation upon user account deactivation.
- **📊 Real-Time Financial Analytics & KPIs (R6)**:
  - Today, Weekly, and Monthly revenues calculated strictly from settled orders.
  - Average Table Turnover duration metric.
  - Dish popularity sales rankings and 7-day volume trends.

---

## 🔐 Default Fixture Credentials

The database comes pre-seeded with three default accounts covering all operational roles:

| Role | Username | Password | Permissions |
|:---|:---|:---|:---|
| **Manager** | `manager_admin` | `Password123!` | Full system access, analytics, menu, inventory BOM, staff accounts |
| **Waiter** | `waiter_alice` | `Password123!` | Table seating, order taking, bill payments, KDS status view |
| **Kitchen** | `chef_mario` | `Password123!` | KDS preparation view, cooking ticket status updates |

*Note: 1-click quick role login buttons are available on the login page for testing and demonstration.*

---

## 🚀 Quick Start

### 1. Launch the unified application
```bash
./start.sh
```
Or start manually:
```bash
# Start server on default port 3001
cd server && npm start
```

Open your browser at: **[http://localhost:3001](http://localhost:3001)**

---

## 🧪 Automated Testing Suite (71 E2E Tests)

Restauro includes a 4-tier automated end-to-end test suite:

- **Tier 1: Feature Functionality (30 tests)**: Full happy-path coverage across all core R1-R6 requirements.
- **Tier 2: Boundaries & Edge Cases (30 tests)**: Zero-dollar orders, table capacity limits, duplicate numbers, sold-out toggles, micro-fractional BOM deductions, negative price rejection, deactivated session revocation.
- **Tier 3: Cross-Feature Interactions (7 tests)**: Multi-step workflows, reservation-to-seating sync, recipe BOM deductions, sold-out cart integrity, cross-role RBAC enforcement.
- **Tier 4: Real-World Scenarios (4 tests)**: Peak dinner rush multi-table concurrency, emergency 86 sold-out protocol, full shift lifecycle, high-concurrency race condition safety.

### Running all 71 tests:
```bash
node tests/e2e/run_all_e2e.js
```

---

## 🏗️ Architecture & Technology Stack

- **Backend**:
  - **Node.js & Express** with TypeScript.
  - **SQLite with WAL mode** (`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; busy_timeout = 5000`) for high-throughput concurrency and ACID transactions.
  - **WebSocket (`ws`)** for low-latency live broadcast events (`order_created`, `order_status_changed`, `table_updated`, `inventory_alert`).
  - **JWT Authentication & bcrypt** password hashing.
- **Frontend**:
  - **React 19 & TypeScript**.
  - **Tailwind CSS** with dark mode slate color palette.
  - **Lucide Icons**.
  - **Vite** build bundler.

---

## 📡 API Endpoint Overview

### Authentication & Staff
- `POST /api/auth/login` — Authenticate and obtain JWT
- `GET /api/auth/me` — Current authenticated session
- `GET /api/staff` — List staff accounts (Manager only)
- `POST /api/staff` — Create staff user
- `PATCH /api/staff/:id/status` — Activate/deactivate account

### Floor Tables & Reservations
- `GET /api/tables` — List floor tables and statuses
- `POST /api/tables` — Create floor table
- `GET /api/reservations` — List reservations
- `POST /api/reservations` — Book reservation with capacity validation
- `DELETE /api/reservations/:id` — Cancel reservation

### Menu & Sold-Out
- `GET /api/menu/categories` — Menu categories
- `GET /api/menu/items` — Menu items
- `POST /api/menu/items` — Create dish
- `PATCH /api/menu/items/:id/availability` — Instant 86 Sold-out toggle

### Orders & Kitchen KDS
- `GET /api/orders` — List orders
- `POST /api/orders` — Create new table order
- `PUT /api/orders/:id/items` — Update order items
- `PATCH /api/orders/:id/status` — Bump order state (`in_preparation`, `ready`, `served`)
- `POST /api/orders/:id/close` — Settle bill, release table & deduct recipe BOM
- `GET /api/kitchen/orders` — Active KDS tickets

### Inventory & BOM
- `GET /api/inventory/ingredients` — Stock balance registry
- `POST /api/inventory/adjust` — Restock delivery / waste logging
- `GET /api/inventory/alerts` — Low stock threshold warnings
- `GET /api/inventory/recipes/:menuItemId` — Dish recipe BOM
- `POST /api/inventory/recipes` — Configure BOM ingredient quantities

### Financial Dashboard
- `GET /api/dashboard/summary` — Today, week, month revenue & active orders
- `GET /api/dashboard/popular-dishes` — Dish sales rankings
- `GET /api/dashboard/table-turnover` — Average turnover duration
- `GET /api/dashboard/order-trends` — Daily & hourly distribution
