# Project: Restaurant Management System

## Architecture
- **Backend API & Real-time Server**: Express 4.x + TypeScript + WebSockets (`ws`) + `better-sqlite3` + `jsonwebtoken` + `bcryptjs`.
- **Database Layer**: Embedded SQLite with WAL mode (`PRAGMA journal_mode = WAL;`), foreign keys enabled (`PRAGMA foreign_keys = ON;`), busy timeout 5000ms.
- **Client Web Application**: React + Vite + Tailwind CSS + Lucide Icons. Responsive views for tablets (768px touch targets) and desktop.
- **Real-time Event Engine**: WebSocket broadcast bus for instant updates (<50ms) to KDS, floor plan, sold-out toggles, and inventory alerts.

## Code Layout
```
/home/ibrahim-tomota/teamwork_projects/restaurant_management/
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                # Main Express + WebSocket entry point
│   │   ├── config.ts               # Env configs (port, jwt secret, db path)
│   │   ├── db/
│   │   │   ├── connection.ts       # better-sqlite3 with WAL mode
│   │   │   ├── schema.sql          # DDL tables & indexes
│   │   │   ├── migrate.ts          # Migration runner
│   │   │   ├── seed.ts             # Test fixtures & realistic operational seed
│   │   ├── middleware/
│   │   │   ├── auth.ts             # JWT auth & RBAC middleware (manager, waiter, kitchen)
│   │   │   ├── errorHandler.ts     # Global error handling
│   │   ├── routes/
│   │   │   ├── auth.ts             # /api/auth/login, /api/auth/me
│   │   │   ├── staff.ts            # /api/staff (CRUD, status toggle)
│   │   │   ├── menu.ts             # /api/menu/categories, /api/menu/items, availability toggle
│   │   │   ├── tables.ts           # /api/tables (CRUD, status, floor coordinates)
│   │   │   ├── reservations.ts     # /api/reservations (CRUD, time slot check, auto table status)
│   │   │   ├── orders.ts           # /api/orders (lifecycle, item mods, BOM stock deduction, table sync)
│   │   │   ├── kitchen.ts          # /api/kitchen/orders (live active orders)
│   │   │   ├── inventory.ts        # /api/inventory/ingredients, adjust, alerts, recipes BOM
│   │   │   ├── dashboard.ts        # /api/dashboard/summary, popular-dishes, turnover, trends
│   │   ├── websocket/
│   │   │   ├── server.ts           # WS connection manager & event dispatcher
├── client/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── index.html
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/             # Layouts, Navbar, Modals, TouchPad
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx       # Manager KPI dashboard
│   │   │   ├── WaiterOrderPad.tsx  # Tablet 768px order taking interface
│   │   │   ├── FloorPlan.tsx       # Visual floor plan with table statuses
│   │   │   ├── KitchenDisplay.tsx  # Real-time KDS board
│   │   │   ├── MenuManagement.tsx  # Menu CRUD & sold-out toggles
│   │   │   ├── InventoryManagement.tsx # Stock levels, adjustments & alerts
│   │   │   ├── StaffManagement.tsx # Staff accounts & RBAC
│   │   ├── services/               # API client & WebSocket listener
├── tests/
│   ├── e2e/                        # 71 Automated tests (Tiers 1-4)
├── start.sh                        # Single-command launcher
└── README.md                       # Comprehensive documentation
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Order Management & Lifecycle | Create orders, add/remove items, status transitions (pending->prep->ready->served->closed), close payment | M2 | ORIGINAL_REQUEST §R1 |
| 2 | Kitchen Real-time Display (KDS) | Dedicated real-time view of non-closed orders with WebSocket updates <5s | M2 | ORIGINAL_REQUEST §R1 |
| 3 | Menu Categories & Item CRUD | Category hierarchy, menu item attributes (price, desc, category) | M2 | ORIGINAL_REQUEST §R2 |
| 4 | Sold-Out Availability Toggling | Dynamic sold-out status, prevents ordering, instant UI update | M2 | ORIGINAL_REQUEST §R2 |
| 5 | Visual Floor Plan & Table State | Interactive table status (free/occupied/reserved), auto status transitions | M2 | ORIGINAL_REQUEST §R3 |
| 6 | Reservations Management | Create/edit/cancel reservations, table time-slot reservation linking | M2 | ORIGINAL_REQUEST §R3 |
| 7 | Inventory & Recipe BOM | Ingredients stock tracking, dish recipe BOM mapping | M2 | ORIGINAL_REQUEST §R4 |
| 8 | Stock Adjustments & Auto Deduction | Auto BOM deduction on order completion, manual delivery/waste adjustment | M2 | ORIGINAL_REQUEST §R4 |
| 9 | Low-Stock Threshold Alerts | Real-time threshold alerts when stock crosses limit | M2 | ORIGINAL_REQUEST §R4 |
| 10 | Staff Management & RBAC | Manager/Waiter/Kitchen roles, JWT auth, permission enforcement | M2 | ORIGINAL_REQUEST §R5 |
| 11 | Analytics Dashboard | Today/Weekly/Monthly revenue, dish rankings, table turnover, order trends | M2 | ORIGINAL_REQUEST §R6 |
| 12 | SQLite Schema & Migrations | WAL mode, foreign keys, comprehensive seed data matching test fixtures | M1 | ORIGINAL_REQUEST §Non-Functional |
| 13 | Tablet-Optimized Frontend | Touch-friendly (768px viewport, >=44px buttons), role-specific views | M3 | ORIGINAL_REQUEST §Non-Functional |
| 14 | Startup Script & README | Single-command `./start.sh` and rich documentation | M4 | ORIGINAL_REQUEST §Non-Functional |
| 15 | 4-Tier Automated Test Pass | 100% pass on all 71 tests in `tests/e2e/` | M4 | ORIGINAL_REQUEST §Non-Functional |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database & Seed | SQLite WAL, Schema DDL, Migration runner, Seed script | none | IN_PROGRESS |
| M2 | Backend API & WS | REST endpoints (R1-R6), RBAC middleware, WebSocket server | M1 | PLANNED |
| M3 | Tablet Frontend | React + Vite + Tailwind responsive client UI | M2 | PLANNED |
| M4 | Integration & E2E Tests | start.sh, README, Run all 71 E2E tests | M1, M2, M3 | PLANNED |
| M5 | Review & Forensic Audit | Code review, stress verification, clean integrity audit | M4 | PLANNED |

## Interface Contracts
- REST API: Prefix `/api`, JSON payload, Bearer JWT in `Authorization` header.
- Status Codes: `200/201` Success, `400` Bad Request (e.g. ordering sold-out item), `401` Unauthorized, `403` Forbidden (role violation), `404` Not Found, `409` Conflict, `500` Internal Error.
- WebSockets: Endpoint `/ws` with message JSON `{ event: string, data: any }`.
