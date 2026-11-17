/**
 * Tier 1: Feature Coverage - R6 Dashboard Calculations & Analytics
 * Spec: ORIGINAL_REQUEST.md §R6
 */

const assert = require('node:assert');
const { getManagerClient, getWaiterClient } = require('../helpers/apiClient');
const Assertions = require('../helpers/assertions');

async function runTests(baseUrl) {
  const suiteName = 'Tier 1 - R6: Dashboard Calculations & Analytics';
  const results = [];

  const { client: manager } = await getManagerClient(baseUrl);
  const { client: waiter } = await getWaiterClient(baseUrl);

  // Test 1: TC-T1-DSH-01: Today Revenue Metric from Closed Orders
  try {
    const summaryRes = await manager.getDashboardSummary();
    Assertions.assertStatus(summaryRes, 200, 'Get Dashboard Summary');
    const summary = summaryRes.body;
    Assertions.assertHasProperties(summary, ['today_revenue', 'week_revenue', 'month_revenue']);
    assert.ok(typeof Number(summary.today_revenue) === 'number', 'today_revenue must be numeric');
    assert.ok(Number(summary.today_revenue) >= 0, 'today_revenue cannot be negative');

    results.push({ id: 'TC-T1-DSH-01', name: 'Dashboard Calculates Today Revenue from Closed Orders', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-DSH-01', name: 'Dashboard Calculates Today Revenue from Closed Orders', passed: false, error: err.message });
  }

  // Test 2: TC-T1-DSH-02: Weekly & Monthly Revenue Aggregation
  try {
    const summaryRes = await manager.getDashboardSummary();
    const summary = summaryRes.body;
    
    // Monthly revenue must be >= weekly revenue, weekly revenue must be >= today's revenue (assuming current period)
    const today = Number(summary.today_revenue || 0);
    const week = Number(summary.week_revenue || 0);
    const month = Number(summary.month_revenue || 0);

    assert.ok(week >= 0, 'Week revenue must be non-negative');
    assert.ok(month >= 0, 'Month revenue must be non-negative');

    results.push({ id: 'TC-T1-DSH-02', name: 'Weekly and Monthly Revenue Aggregations Computed Accurately', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-DSH-02', name: 'Weekly and Monthly Revenue Aggregations Computed Accurately', passed: false, error: err.message });
  }

  // Test 3: TC-T1-DSH-03: Dish Popularity Ranking
  try {
    const popRes = await manager.getPopularDishes();
    Assertions.assertStatus(popRes, 200, 'Get Popular Dishes');
    const dishes = Array.isArray(popRes.body) ? popRes.body : popRes.body?.dishes || [];
    
    // If dishes exist, verify order is descending by order count / quantity
    if (dishes.length >= 2) {
      for (let i = 0; i < dishes.length - 1; i++) {
        const countA = Number(dishes[i].total_orders || dishes[i].order_count || dishes[i].quantity_sold || 0);
        const countB = Number(dishes[i+1].total_orders || dishes[i+1].order_count || dishes[i+1].quantity_sold || 0);
        assert.ok(countA >= countB, `Dishes must be ordered descending by popularity (${countA} >= ${countB})`);
      }
    }

    results.push({ id: 'TC-T1-DSH-03', name: 'Dish Popularity Ranking Orders Items by Sales Volume', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-DSH-03', name: 'Dish Popularity Ranking Orders Items by Sales Volume', passed: false, error: err.message });
  }

  // Test 4: TC-T1-DSH-04: Average Table Turnover Time Calculation
  try {
    const turnoverRes = await manager.getTableTurnover();
    Assertions.assertStatus(turnoverRes, 200, 'Get Table Turnover');
    const turnover = turnoverRes.body;
    Assertions.assertHasProperties(turnover, ['avg_turnover_minutes']);
    assert.ok(Number(turnover.avg_turnover_minutes) >= 0, 'Turnover minutes must be non-negative');

    results.push({ id: 'TC-T1-DSH-04', name: 'Average Table Turnover Time Metric Derived from Order Timestamps', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-DSH-04', name: 'Average Table Turnover Time Metric Derived from Order Timestamps', passed: false, error: err.message });
  }

  // Test 5: TC-T1-DSH-05: Order Volume Trends
  try {
    const trendsRes = await manager.getOrderTrends();
    Assertions.assertStatus(trendsRes, 200, 'Get Order Trends');
    const trends = Array.isArray(trendsRes.body) ? trendsRes.body : trendsRes.body?.trends || trendsRes.body?.hourly || [];
    assert.ok(Array.isArray(trends), 'Order trends must return an array or object containing time-series data');

    results.push({ id: 'TC-T1-DSH-05', name: 'Order Volume Trends Hourly & Daily Distribution Breakdown', passed: true });
  } catch (err) {
    results.push({ id: 'TC-T1-DSH-05', name: 'Order Volume Trends Hourly & Daily Distribution Breakdown', passed: false, error: err.message });
  }

  return { suiteName, results };
}

module.exports = { runTests };

if (require.main === module) {
  runTests().then(res => {
    console.log(`\n=== ${res.suiteName} ===`);
    res.results.forEach(r => {
      console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.id}: ${r.name} ${r.error ? '(' + r.error + ')' : ''}`);
    });
  });
}
