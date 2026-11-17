/**
 * Standalone Unified E2E Test Runner for Restaurant Management System
 * Executes Tier 1, Tier 2, Tier 3, and Tier 4 automated test suites.
 */

const path = require('path');

// Test Suite Modules
const t1_r1 = require('./tier1_features/t1_r1_order_lifecycle.test');
const t1_r2 = require('./tier1_features/t1_r2_menu_soldout.test');
const t1_r3 = require('./tier1_features/t1_r3_tables_reservations.test');
const t1_r4 = require('./tier1_features/t1_r4_inventory_recipes.test');
const t1_r5 = require('./tier1_features/t1_r5_rbac_staff.test');
const t1_r6 = require('./tier1_features/t1_r6_dashboard_metrics.test');

const t2_r1 = require('./tier2_boundaries/t2_r1_order_boundaries.test');
const t2_r2 = require('./tier2_boundaries/t2_r2_menu_boundaries.test');
const t2_r3 = require('./tier2_boundaries/t2_r3_table_reservation_boundaries.test');
const t2_r4 = require('./tier2_boundaries/t2_r4_inventory_boundaries.test');
const t2_r5 = require('./tier2_boundaries/t2_r5_auth_rbac_boundaries.test');
const t2_r6 = require('./tier2_boundaries/t2_r6_dashboard_boundaries.test');

const t3_01 = require('./tier3_combinations/t3_01_res_order_kds_sync.test');
const t3_02 = require('./tier3_combinations/t3_02_recipe_deduction_low_stock.test');
const t3_03 = require('./tier3_combinations/t3_03_soldout_inflight_orders.test');
const t3_04 = require('./tier3_combinations/t3_04_cross_role_workflow.test');
const t3_05 = require('./tier3_combinations/t3_05_stock_depletion_auto_soldout.test');
const t3_06 = require('./tier3_combinations/t3_06_cancellation_waste_accounting.test');
const t3_07 = require('./tier3_combinations/t3_07_split_bill_table_dashboard.test');

const t4_01 = require('./tier4_scenarios/t4_01_dinner_rush_multi_table.test');
const t4_02 = require('./tier4_scenarios/t4_02_kitchen_86_soldout_event.test');
const t4_03 = require('./tier4_scenarios/t4_03_full_shift_lifecycle.test');
const t4_04 = require('./tier4_scenarios/t4_04_concurrency_multi_waiter.test');

const SUITES = {
  tier1: [
    { name: 'R1: Order Lifecycle', runner: t1_r1 },
    { name: 'R2: Menu & Sold-Out', runner: t1_r2 },
    { name: 'R3: Floor Plan & Reservations', runner: t1_r3 },
    { name: 'R4: Inventory & Recipes', runner: t1_r4 },
    { name: 'R5: Staff & RBAC', runner: t1_r5 },
    { name: 'R6: Dashboard Calculations', runner: t1_r6 }
  ],
  tier2: [
    { name: 'R1: Order Boundaries', runner: t2_r1 },
    { name: 'R2: Menu Boundaries', runner: t2_r2 },
    { name: 'R3: Reservation Boundaries', runner: t2_r3 },
    { name: 'R4: Inventory Boundaries', runner: t2_r4 },
    { name: 'R5: RBAC & Auth Boundaries', runner: t2_r5 },
    { name: 'R6: Dashboard Boundaries', runner: t2_r6 }
  ],
  tier3: [
    { name: 'XF-01: Res -> Seating -> Order -> KDS', runner: t3_01 },
    { name: 'XF-02: Order -> BOM Deduct -> Alerts', runner: t3_02 },
    { name: 'XF-03: Sold-Out -> Cart Integrity', runner: t3_03 },
    { name: 'XF-04: Cross-Role Operational Flow', runner: t3_04 },
    { name: 'XF-05: Inventory 0 -> Threshold Alert', runner: t3_05 },
    { name: 'XF-06: Line Edits -> Final Recipe BOM', runner: t3_06 },
    { name: 'XF-07: Close Order -> Table Free -> KPI', runner: t3_07 }
  ],
  tier4: [
    { name: 'RW-01: Peak Dinner Rush Simulation', runner: t4_01 },
    { name: 'RW-02: Kitchen 86 Emergency Protocol', runner: t4_02 },
    { name: 'RW-03: Full Restaurant Shift Lifecycle', runner: t4_03 },
    { name: 'RW-04: High-Concurrency Multi-Waiter', runner: t4_04 }
  ]
};

async function executeTier(tierKey, baseUrl) {
  const suites = SUITES[tierKey] || [];
  const tierResults = [];

  console.log(`\n================================================================================`);
  console.log(`  EXECUTING ${tierKey.toUpperCase()} SUITES`);
  console.log(`================================================================================`);

  for (const s of suites) {
    try {
      const suiteRes = await s.runner.runTests(baseUrl);
      tierResults.push(suiteRes);

      console.log(`\n  📂 [${suiteRes.suiteName}]`);
      for (const t of suiteRes.results) {
        const icon = t.passed ? '\x1b[32m✔ PASS\x1b[0m' : '\x1b[31m✖ FAIL\x1b[0m';
        console.log(`    ${icon}  \x1b[1m${t.id}\x1b[0m: ${t.name}`);
        if (!t.passed && t.error) {
          console.log(`        \x1b[31mError: ${t.error}\x1b[0m`);
        }
      }
    } catch (err) {
      console.log(`    \x1b[31m✖ Suite Crash in ${s.name}: ${err.message}\x1b[0m`);
      tierResults.push({
        suiteName: s.name,
        results: [{ id: 'CRASH', name: s.name, passed: false, error: err.message }]
      });
    }
  }

  return tierResults;
}

async function runAll(targetTier = null, baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001') {
  const startTime = Date.now();
  console.log(`\n🚀 Starting Restaurant Management System E2E Automated Test Suite`);
  console.log(`📡 Target API: ${baseUrl}`);
  console.log(`⏱  Timestamp: ${new Date().toISOString()}\n`);

  const tiersToRun = targetTier ? [targetTier] : ['tier1', 'tier2', 'tier3', 'tier4'];
  const allResults = {};

  for (const tier of tiersToRun) {
    if (SUITES[tier]) {
      allResults[tier] = await executeTier(tier, baseUrl);
    } else {
      console.log(`\x1b[31mUnknown tier: ${tier}. Choose from: tier1, tier2, tier3, tier4\x1b[0m`);
    }
  }

  // Summary Metrics Calculation
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  console.log(`\n================================================================================`);
  console.log(`  E2E TEST EXECUTION SUMMARY BREAKDOWN`);
  console.log(`================================================================================\n`);

  console.log(`| Tier / Category                      | Total Tests | Passed | Failed | Status |`);
  console.log(`|:-------------------------------------|:------------|:-------|:-------|:-------|`);

  for (const [tier, suiteList] of Object.entries(allResults)) {
    let tierTotal = 0;
    let tierPassed = 0;
    let tierFailed = 0;

    for (const s of suiteList) {
      for (const t of s.results) {
        tierTotal++;
        if (t.passed) tierPassed++;
        else tierFailed++;
      }
    }

    totalTests += tierTotal;
    passedTests += tierPassed;
    failedTests += tierFailed;

    const statusBadge = tierFailed === 0 ? '\x1b[32mPASSED\x1b[0m' : '\x1b[31mFAILED\x1b[0m';
    const tierName = tier.toUpperCase();
    console.log(`| ${tierName.padEnd(36)} | ${String(tierTotal).padStart(11)} | ${String(tierPassed).padStart(6)} | ${String(tierFailed).padStart(6)} | ${statusBadge.padEnd(6)} |`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n--------------------------------------------------------------------------------`);
  console.log(`  Total Test Cases : \x1b[1m${totalTests}\x1b[0m`);
  console.log(`  Passed           : \x1b[32m${passedTests}\x1b[0m`);
  console.log(`  Failed           : ${failedTests > 0 ? '\x1b[31m' + failedTests + '\x1b[0m' : '0'}`);
  console.log(`  Duration         : ${durationSec}s`);
  console.log(`--------------------------------------------------------------------------------\n`);

  return { totalTests, passedTests, failedTests, durationSec };
}

module.exports = { runAll, SUITES };

if (require.main === module) {
  const argTier = process.argv[2];
  runAll(argTier).then(summary => {
    if (summary.failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  });
}
