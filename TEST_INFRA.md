# Comprehensive Test Infrastructure & Architecture Specification
## Restaurant Management System (E2E & Integration Test Suite)

**Document Version**: 1.0.0  
**Project Root**: `/home/ibrahim-tomota/teamwork_projects/restaurant_management`  
**Author**: E2E Test Suite Designer & Writer (`e2e_test_writer_1`)  
**Target Environment**: Node.js v24.x, SQLite (WAL mode), Express REST API, React SPA  

---

## 1. Test Philosophy & Engineering Principles

The Restaurant Management System is a mission-critical, multi-role operational web application used simultaneously by Managers, Waiters, and Kitchen staff. Flaws in order lifecycles, billing calculations, access control, or inventory deductions directly impact restaurant operations and financial accounting.

Our test infrastructure adheres to five core quality tenets:

1. **Deterministic & Isolated Test State**:
   - Every test suite creates and operates on isolated data or cleanly managed transactions.
   - Tests do not rely on execution order; each test sets up its own preconditions and cleans up or uses isolated IDs.

2. **Authoritative Specification Derivation**:
   - All expected values, status codes, state transitions, and arithmetic formulas are strictly derived from `ORIGINAL_REQUEST.md` and the formal architectural specifications.
   - Zero facade tests; every test exercises real HTTP API endpoints, database state mutations, and business logic.

3. **4-Tier Hierarchical Testing Model**:
   - **Tier 1 (Feature Coverage)**: Validates primary happy paths for all 6 core features ($\ge 5$ tests per feature, $\ge 30$ tests total).
   - **Tier 2 (Boundary & Corner Cases)**: Validates invalid inputs, overflow limits, concurrency constraints, and unauthorized access attempts ($\ge 5$ tests per feature, $\ge 30$ tests total).
   - **Tier 3 (Cross-Feature Interactions)**: Validates integrated multi-domain workflows bridging reservations, orders, kitchen display, inventory BOM deductions, and dashboard analytics ($\ge 7$ tests).
   - **Tier 4 (Real-World Scenarios)**: Validates full operational simulations of peak dinner rush, kitchen 86 events, full shift lifecycles, and concurrent multi-table services ($\ge 4$ tests).

4. **Multi-Role Security Validation**:
   - Dedicated role contexts (`Manager`, `Waiter`, `Kitchen Staff`, `Unauthenticated`) to ensure strict RBAC compliance (401 Unauthorized / 403 Forbidden enforcement).

5. **Financial & Inventory Precision**:
   - Decimal rounding, total recalculation on item edits, BOM recipe deductions, and threshold-based alert generation are asserted down to exact mathematical values.

---

## 2. Test Architecture & Harness Structure

### 2.1 Directory Layout

```
tests/
└── e2e/
    ├── helpers/
    │   ├── apiClient.js       # HTTP REST Client with JWT auth, role tokens, error handling
    │   ├── fixtures.js        # Seed constants for users, tables, categories, items, ingredients
    │   ├── testDb.js          # SQLite test database utilities & direct state queries
    │   └── assertions.js      # Custom test assertions (status, error responses, financial precision)
    ├── tier1_features/
    │   ├── t1_r1_order_lifecycle.test.js          # R1: Order creation, items, KDS, status flow, close (5+ tests)
    │   ├── t1_r2_menu_soldout.test.js             # R2: Menu CRUD, category filter, sold-out toggling (5+ tests)
    │   ├── t1_r3_tables_reservations.test.js      # R3: Table layout, reservations, auto status sync (5+ tests)
    │   ├── t1_r4_inventory_recipes.test.js        # R4: Ingredients, recipe BOM, stock deduction, alerts (5+ tests)
    │   ├── t1_r5_rbac_staff.test.js               # R5: Staff accounts, login, role restrictions (5+ tests)
    │   └── t1_r6_dashboard_metrics.test.js        # R6: Revenue, popular dishes, turnover, trends (5+ tests)
    ├── tier2_boundaries/
    │   ├── t2_r1_order_boundaries.test.js         # R1: Empty orders, invalid tables, double close (5+ tests)
    │   ├── t2_r2_menu_boundaries.test.js          # R2: Negative prices, missing fields, sold-out cart (5+ tests)
    │   ├── t2_r3_table_reservation_boundaries.test.js # R3: Capacity overflow, overlap, occupied delete (5+ tests)
    │   ├── t2_r4_inventory_boundaries.test.js     # R4: 0-stock fulfillment, negative adjust, micro-units (5+ tests)
    │   ├── t2_r5_auth_rbac_boundaries.test.js     # R5: Expired tokens, tampered roles, deactivated users (5+ tests)
    │   └── t2_r6_dashboard_boundaries.test.js     # R6: 0-revenue baseline, active order exclusion (5+ tests)
    ├── tier3_combinations/
    │   ├── t3_01_res_order_kds_sync.test.js       # Res -> Seat -> Order -> KDS -> Occupied
    │   ├── t3_02_recipe_deduction_low_stock.test.js # Order -> Fulfill -> BOM Deduct -> Alert Trigger
    │   ├── t3_03_soldout_inflight_orders.test.js  # Sold Out Toggle -> In-Flight Cart Integrity
    │   ├── t3_04_cross_role_workflow.test.js      # Waiter -> Kitchen -> Manager RBAC elevation
    │   ├── t3_05_stock_depletion_auto_soldout.test.js # Inventory 0 -> Threshold Alert -> Dashboard
    │   ├── t3_06_cancellation_waste_accounting.test.js # Order item edits -> Recalculation -> KDS
    │   └── t3_07_split_bill_table_dashboard.test.js # Full Order Close -> Free Table -> Dashboard KPI
    ├── tier4_scenarios/
    │   ├── t4_01_dinner_rush_multi_table.test.js  # Peak rush: 4 concurrent tables, multi-waiter, KDS
    │   ├── t4_02_kitchen_86_soldout_event.test.js # 86 Event: Stock depletion, item 86, order reroute
    │   ├── t4_03_full_shift_lifecycle.test.js     # Full shift: Open -> Lunch -> Waste -> Dinner -> Close
    │   └── t4_04_concurrency_multi_waiter.test.js # High-concurrency table ordering & inventory safety
    ├── testRunner.js          # Unified standalone test runner with colored reporting & summary
    └── run_all_e2e.js         # Entrypoint script for CI/local execution
```

### 2.2 Role-Based Client Abstraction

Tests interact with the system using pre-configured role clients:
- `ManagerClient`: Authenticated as `manager` (full administrative & financial permissions).
- `WaiterClient`: Authenticated as `waiter` (floor plan, order taking, table servicing, payments).
- `KitchenClient`: Authenticated as `kitchen` (KDS view, prep status transitions).
- `UnauthenticatedClient`: No credentials (verifies 401 Unauthorized protection).

---

## 3. Feature Inventory to Test Suite Mapping

| Feature ID | Feature Name | Tier 1 (Happy Path) | Tier 2 (Boundaries) | Tier 3 (Cross-Feature) | Tier 4 (Real-World) |
|:---|:---|:---|:---|:---|:---|
| **R1** | Order Lifecycle & KDS | `TC-T1-ORD-01` to `05` | `TC-T2-ORD-01` to `05` | `XF-01`, `XF-04`, `XF-06`, `XF-07` | `RW-01`, `RW-02`, `RW-03`, `RW-04` |
| **R2** | Menu & Sold-out Toggling | `TC-T1-MNU-01` to `05` | `TC-T2-MNU-01` to `05` | `XF-03`, `XF-05` | `RW-02`, `RW-03` |
| **R3** | Floor Plan & Reservations | `TC-T1-RES-01` to `05` | `TC-T2-RES-01` to `05` | `XF-01`, `XF-07` | `RW-01`, `RW-03`, `RW-04` |
| **R4** | Inventory, Recipes & Alerts | `TC-T1-INV-01` to `05` | `TC-T2-INV-01` to `05` | `XF-02`, `XF-05`, `XF-06` | `RW-01`, `RW-02`, `RW-03`, `RW-04` |
| **R5** | RBAC & Staff Management | `TC-T1-AUT-01` to `05` | `TC-T2-AUT-01` to `05` | `XF-04` | `RW-01`, `RW-03` |
| **R6** | Dashboard & Analytics | `TC-T1-DSH-01` to `05` | `TC-T2-DSH-01` to `05` | `XF-02`, `XF-05`, `XF-07` | `RW-01`, `RW-03` |

---

## 4. Complete Test Catalog (71+ Test Specifications)

### 4.1 Tier 1: Feature Coverage Specifications ($\ge 30$ tests)

#### R1: Order Lifecycle (`t1_r1_order_lifecycle.test.js`)
- `TC-T1-ORD-01`: Create order on a free table with items; verify initial status `pending`, subtotal, and table status `occupied`.
- `TC-T1-ORD-02`: Order status lifecycle transitions (`pending` $\rightarrow$ `in_preparation` $\rightarrow$ `ready` $\rightarrow$ `served` $\rightarrow$ `closed`).
- `TC-T1-ORD-03`: Open order item modifications (add new item, update quantities, remove items) and verify recalculated total.
- `TC-T1-ORD-04`: Kitchen display endpoint (`GET /api/kitchen/orders`) returns active non-closed orders with details.
- `TC-T1-ORD-05`: Order closure (`POST /api/orders/:id/close`) sets status to `closed`, records `closed_at`, and frees table.

#### R2: Menu & Sold-Out Management (`t1_r2_menu_soldout.test.js`)
- `TC-T1-MNU-01`: Create menu categories and menu items with name, price, category, and description.
- `TC-T1-MNU-02`: Filter and retrieve menu items by category (`GET /api/menu/items?category_id=...`).
- `TC-T1-MNU-03`: Update menu item attributes (name, price, description) and verify persistence.
- `TC-T1-MNU-04`: Toggle menu item availability to "sold out" (`PATCH /api/menu/items/:id/availability`).
- `TC-T1-MNU-05`: Block new order creation containing a sold-out dish (returns 400 Bad Request).

#### R3: Floor Plan & Reservations (`t1_r3_tables_reservations.test.js`)
- `TC-T1-RES-01`: Floor plan tables list returns all tables with current occupancy status (`free`).
- `TC-T1-RES-02`: Create reservation for table with customer name, party size, date, time slot; table shows `reserved`.
- `TC-T1-RES-03`: Update reservation details (party size, notes, contact phone).
- `TC-T1-RES-04`: Cancel reservation and verify table status immediately reverts to `free`.
- `TC-T1-RES-05`: Automatic table occupancy sync on order create (`free` $\rightarrow$ `occupied`) and close (`occupied` $\rightarrow$ `free`).

#### R4: Inventory, Recipes & Stock Alerts (`t1_r4_inventory_recipes.test.js`)
- `TC-T1-INV-01`: Create ingredients with unit, initial stock, and low-stock threshold.
- `TC-T1-INV-02`: Create recipe BOM mappings connecting dishes to ingredients and required quantities.
- `TC-T1-INV-03`: Manual stock adjustments (delivery: positive delta, waste: negative delta) with audit reason logging.
- `TC-T1-INV-04`: Automatic recipe ingredient deduction upon order completion/closure.
- `TC-T1-INV-05`: Low-stock alert generation when ingredient stock $\le$ configured threshold.

#### R5: Staff Management & RBAC (`t1_r5_rbac_staff.test.js`)
- `TC-T1-AUT-01`: User login with valid credentials generates JWT token and returns user profile.
- `TC-T1-AUT-02`: Manager creates staff account with specified role (`waiter`, `kitchen`, `manager`).
- `TC-T1-AUT-03`: Waiter role blocked from manager endpoints (`/api/staff`, `/api/dashboard/*`) with 403 Forbidden.
- `TC-T1-AUT-04`: Kitchen staff role can access KDS and update order prep status, but is blocked from billing and staff APIs (403).
- `TC-T1-AUT-05`: Manager updates staff account details and deactivates staff member (`is_active: false`).

#### R6: Dashboard Calculations & Analytics (`t1_r6_dashboard_metrics.test.js`)
- `TC-T1-DSH-01`: Daily revenue calculated strictly from closed orders on the current date.
- `TC-T1-DSH-02`: Weekly and monthly revenue aggregations accurately sum historical closed orders.
- `TC-T1-DSH-03`: Popular dishes ranking orders menu items by total quantity sold.
- `TC-T1-DSH-04`: Average table turnover time calculated from elapsed duration (`closed_at - opened_at`).
- `TC-T1-DSH-05`: Order volume trends report hourly and daily order counts.

---

### 4.2 Tier 2: Boundary & Corner Case Specifications ($\ge 30$ tests)

#### R1 Order Boundaries (`t2_r1_order_boundaries.test.js`)
- `TC-T2-ORD-01`: Empty order submission (0 line items) rejected with 400 Bad Request.
- `TC-T2-ORD-02`: Non-existent table ID in order creation rejected with 400 or 404.
- `TC-T2-ORD-03`: Double-order creation on an already occupied table rejected with 400.
- `TC-T2-ORD-04`: Invalid state machine transition (e.g. reverting `closed` to `pending`) rejected with 400.
- `TC-T2-ORD-05`: Modifying items on an already closed/finalized order rejected with 400.

#### R2 Menu Boundaries (`t2_r2_menu_boundaries.test.js`)
- `TC-T2-MNU-01`: Menu item with negative price rejected with 400/422.
- `TC-T2-MNU-02`: Missing required fields (name, category_id, price) rejected with 400.
- `TC-T2-MNU-03`: Zero-dollar item ($0.00 complimentary) accepted and calculated properly.
- `TC-T2-MNU-04`: Unicode, emojis, and special characters in item name/description handled safely.
- `TC-T2-MNU-05`: Toggling sold-out on an item in an open draft order preserves open order items.

#### R3 Floor Plan & Reservation Boundaries (`t2_r3_table_reservation_boundaries.test.js`)
- `TC-T2-RES-01`: Reservation party size exceeding table capacity rejected with 400.
- `TC-T2-RES-02`: Reservation with 0 or negative party size rejected with 400.
- `TC-T2-RES-03`: Duplicate overlapping reservation on same table and time slot rejected with 400/409.
- `TC-T2-RES-04`: Table creation with duplicate table number rejected with 400.
- `TC-T2-RES-05`: Table deletion blocked when table has an active occupied order.

#### R4 Inventory Boundaries (`t2_r4_inventory_boundaries.test.js`)
- `TC-T2-INV-01`: Negative initial stock or negative threshold rejected with 400.
- `TC-T2-INV-02`: Manual stock adjustment resulting in negative stock handled with audit logging.
- `TC-T2-INV-03`: High-precision micro-unit recipe deductions (e.g. 0.0025 kg) without rounding loss.
- `TC-T2-INV-04`: Order fulfillment of dish without recipe mapping proceeds smoothly without crash.
- `TC-T2-INV-05`: Alert threshold boundary: Stock exactly at threshold (`stock == threshold`) triggers alert.

#### R5 RBAC & Auth Boundaries (`t2_r5_auth_rbac_boundaries.test.js`)
- `TC-T2-AUT-01`: Unauthenticated request (no Bearer token) returns 401 Unauthorized.
- `TC-T2-AUT-02`: Malformed, invalid, or forged JWT token returns 401 Unauthorized.
- `TC-T2-AUT-03`: Login with incorrect password returns 401 Unauthorized.
- `TC-T2-AUT-04`: Login with non-existent username returns 401 Unauthorized.
- `TC-T2-AUT-05`: Deactivated user attempting to use previously issued JWT returns 401/403.

#### R6 Dashboard Boundaries (`t2_r6_dashboard_boundaries.test.js`)
- `TC-T2-DSH-01`: Zero sales state on clean database returns $0.00 revenue and 0 orders without NaN/divide-by-zero errors.
- `TC-T2-DSH-02`: $0.00 complimentary orders included in order count without corrupting revenue math.
- `TC-T2-DSH-03`: Table turnover calculation with 0 completed orders returns 0 / N/A gracefully.
- `TC-T2-DSH-04`: Active non-closed orders strictly excluded from revenue metrics.
- `TC-T2-DSH-05`: Large revenue sums computed with accurate currency decimal precision.

---

### 4.3 Tier 3: Cross-Feature Interaction Specifications ($\ge 7$ tests)

- `XF-01`: **Reservation $\rightarrow$ Seating $\rightarrow$ Order Creation $\rightarrow$ Table State Sync**
  - Verify reservation creation sets table `reserved`, seating transitions table to `occupied`, order is bound to table, and double seating is blocked.
- `XF-02`: **Order Fulfillment $\rightarrow$ BOM Recipe Deduction $\rightarrow$ Low-Stock Alert Generation**
  - Verify ordering a multi-ingredient recipe deducts all ingredient BOMs upon order close and raises `low_stock` alert when threshold is crossed.
- `XF-03`: **Menu Sold-Out Toggling $\rightarrow$ Active In-Flight Order Modification**
  - Verify manager marking item sold out prevents addition of new units to orders while preserving existing open order items.
- `XF-04`: **Cross-Role Permissions Across Operational Flow**
  - Verify Waiter creates order $\rightarrow$ Kitchen updates status $\rightarrow$ Waiter blocked from staff/dashboard $\rightarrow$ Manager has full administrative oversight.
- `XF-05`: **Stock Depletion to 0 $\rightarrow$ Threshold Alert $\rightarrow$ Dashboard Live Sync**
  - Verify inventory depletion triggers low-stock alerts and updates inventory dashboard metrics in real time.
- `XF-06`: **Order Item Modification $\rightarrow$ Recalculated Total $\rightarrow$ Kitchen Stream $\rightarrow$ Correct Recipe BOM Deduction**
  - Verify modifying quantities and adding items on open orders updates total amount, reflects on KDS, and correctly deducts final item recipes upon closing.
- `XF-07`: **Full Order Lifecycle $\rightarrow$ Table Release $\rightarrow$ Instant Dashboard Revenue & Popular Dish Update**
  - Verify closing order releases table back to `free`, increments daily revenue by exact total, and updates dish popularity ranking immediately.

---

### 4.4 Tier 4: Real-World Scenario Specifications ($\ge 4$ tests)

- `RW-01`: **Peak Dinner Rush Multi-Table Service**
  - Simulates 4 concurrent dining tables served by multiple staff: opening orders, sending dishes to kitchen, KDS bumping to preparation and ready, serving, payment settlement, and table turnover.
- `RW-02`: **Kitchen "86" Emergency Sold-Out Protocol**
  - Simulates an ingredient shortage during service: manager flags dish sold out, waiter order pad blocks selection, waiter guides guest to alternative dish, and service proceeds smoothly.
- `RW-03`: **Full Restaurant Shift Lifecycle (Open to Closeout)**
  - Simulates a full daily operational cycle: Morning stock delivery (+restock) $\rightarrow$ Lunch rush orders and table turnovers $\rightarrow$ Afternoon waste adjustment (-waste) $\rightarrow$ Dinner service $\rightarrow$ End-of-day revenue & turnover reconciliation.
- `RW-04`: **High-Concurrency Multi-Waiter Ordering & Stock Safety**
  - Simulates simultaneous order placement across multiple tables competing for limited inventory, ensuring strict transactional integrity, correct stock deduction, and zero orphaned records.

---

## 5. Test Execution Commands & Automation

### 5.1 Standalone Test Runner
The E2E test suite can be run standalone against any running instance of the Restaurant Management backend or directly:

```bash
# Run entire 4-tier E2E test suite
node tests/e2e/run_all_e2e.js

# Run specific tiers
node tests/e2e/testRunner.js tier1
node tests/e2e/testRunner.js tier2
node tests/e2e/testRunner.js tier3
node tests/e2e/testRunner.js tier4

# Run specific feature test file
node tests/e2e/tier1_features/t1_r1_order_lifecycle.test.js
```

### 5.2 Environment Variables

| Variable | Default | Purpose |
|:---|:---|:---|
| `TEST_BASE_URL` | `http://localhost:3000` | Target backend REST API URL |
| `TEST_PORT` | `3000` | Server port for in-process or local server execution |
| `NODE_ENV` | `test` | Sets application environment to test mode |
| `DEBUG_TESTS` | `false` | Enables verbose HTTP request/response logging |

---

## 6. Verification and Reporting

The test runner outputs:
- Real-time colored test execution indicators (`✔ PASS`, `✖ FAIL`).
- Detailed assertion error messages with expected vs actual values.
- Comprehensive summary table broken down by Tier and Feature.
- Non-zero exit code on any failure for continuous integration gating.
