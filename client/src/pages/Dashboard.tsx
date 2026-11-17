import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { useWebSocket } from '../services/websocket';
import { DashboardSummary, PopularDish, TableTurnover, OrderTrends, Ingredient } from '../types';
import { StatCard } from '../components/StatCard';
import {
  DollarSign,
  TrendingUp,
  Clock,
  ShoppingBag,
  AlertTriangle,
  Flame,
  RotateCw,
  Award
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [popularDishes, setPopularDishes] = useState<PopularDish[]>([]);
  const [turnover, setTurnover] = useState<TableTurnover | null>(null);
  const [trends, setTrends] = useState<OrderTrends | null>(null);
  const [alerts, setAlerts] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [sumData, popData, turnData, trendData, alertsData] = await Promise.all([
        api.getDashboardSummary(),
        api.getPopularDishes(8),
        api.getTableTurnover(),
        api.getOrderTrends(7),
        api.getAlerts()
      ]);
      setSummary(sumData);
      setPopularDishes(popData);
      setTurnover(turnData);
      setTrends(trendData);
      setAlerts(alertsData);
    } catch (err) {
      console.error('Error loading dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Real-time updates on WebSocket events
  useWebSocket((event) => {
    if (['order_created', 'order_closed', 'order_status_changed', 'inventory_alert'].includes(event)) {
      fetchDashboardData();
    }
  });

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-slate-400">
          <RotateCw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-500" />
          <p className="text-sm">Loading Live Financial Analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Executive Operations Dashboard</h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time revenue, table turnover, order throughput & inventory</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-colors self-start min-h-[44px]"
        >
          <RotateCw className="w-4 h-4 text-amber-400" /> Refresh KPI Data
        </button>
      </div>

      {/* Low Stock Alerts Banner */}
      {alerts.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-rose-300">
              Low Stock Warning ({alerts.length} ingredients below threshold)
            </h4>
            <div className="flex flex-wrap gap-2 mt-2">
              {alerts.map((ing) => (
                <span
                  key={ing.id}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-200 text-xs font-medium border border-rose-500/30"
                >
                  {ing.name}: <strong>{ing.current_stock} {ing.unit}</strong> (Min: {ing.low_stock_threshold})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Revenue"
          value={`$${(summary?.today_revenue || 0).toFixed(2)}`}
          subtitle={`${summary?.today_orders || 0} completed orders today`}
          icon={<DollarSign className="w-6 h-6" />}
          color="emerald"
          trend="+ Today Settled"
        />
        <StatCard
          title="Weekly Revenue"
          value={`$${(summary?.week_revenue || 0).toFixed(2)}`}
          subtitle="Past 7 rolling days"
          icon={<TrendingUp className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Monthly Revenue"
          value={`$${(summary?.month_revenue || 0).toFixed(2)}`}
          subtitle="Past 30 rolling days"
          icon={<DollarSign className="w-6 h-6" />}
          color="purple"
        />
        <StatCard
          title="Avg Table Turnover"
          value={`${turnover?.avg_turnover_minutes || 0} min`}
          subtitle={`${turnover?.total_completed_tables || 0} seated dining sessions`}
          icon={<Clock className="w-6 h-6" />}
          color="amber"
        />
      </div>

      {/* Second Row: Active Orders & Daily Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Orders Summary */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-400" /> Active In-Service Orders
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {summary?.active_orders || 0} Open
              </span>
            </div>
            <p className="text-4xl font-extrabold text-white tracking-tight mt-2">
              {summary?.active_orders || 0}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Currently dining, in kitchen preparation, or waiting for payment settlement.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Low Stock Items:</span>
              <span className="font-semibold text-rose-400">{summary?.low_stock_alerts_count || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Settled Orders Today:</span>
              <span className="font-semibold text-emerald-400">{summary?.today_orders || 0}</span>
            </div>
          </div>
        </div>

        {/* 7-Day Revenue Trend Bars */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" /> Daily Order Volume & Revenue (Past 7 Days)
          </h3>

          {trends?.daily && trends.daily.length > 0 ? (
            <div className="space-y-3 mt-4">
              {trends.daily.map((day) => {
                const maxRev = Math.max(...trends.daily.map((d) => d.revenue), 100);
                const percent = Math.min(100, Math.max(8, (day.revenue / maxRev) * 100));
                return (
                  <div key={day.date} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-300">{day.date}</span>
                      <span className="text-slate-400">
                        <strong className="text-white">${day.revenue.toFixed(2)}</strong> ({day.order_count} orders)
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-xs text-slate-500">
              No historical revenue records yet. Completed orders will chart here.
            </div>
          )}
        </div>
      </div>

      {/* Most Popular Dishes Ranking */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500" /> Menu Dish Performance & Ranking
          </h3>
          <span className="text-xs text-slate-500">Ordered by quantity sold</span>
        </div>

        {popularDishes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold">Rank</th>
                  <th className="pb-3 font-semibold">Dish Name</th>
                  <th className="pb-3 font-semibold">Category</th>
                  <th className="pb-3 font-semibold">Price</th>
                  <th className="pb-3 font-semibold text-center">Units Sold</th>
                  <th className="pb-3 font-semibold text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {popularDishes.map((dish, index) => (
                  <tr key={dish.id || dish.menu_item_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 font-bold text-slate-500 flex items-center gap-1.5">
                      {index === 0 ? (
                        <Award className="w-4 h-4 text-amber-400" />
                      ) : (
                        <span>#{index + 1}</span>
                      )}
                    </td>
                    <td className="py-3 font-semibold text-white">{dish.name}</td>
                    <td className="py-3 text-slate-400">{dish.category_name || 'General'}</td>
                    <td className="py-3 text-slate-300">${dish.price.toFixed(2)}</td>
                    <td className="py-3 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
                        {dish.quantity_sold || dish.total_orders}
                      </span>
                    </td>
                    <td className="py-3 text-right font-bold text-emerald-400">
                      ${dish.total_revenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 text-center py-6">No dish sales data yet.</p>
        )}
      </div>
    </div>
  );
};
