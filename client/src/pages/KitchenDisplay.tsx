import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { useWebSocket } from '../services/websocket';
import { Order, OrderStatus } from '../types';
import {
  ChefHat,
  Clock,
  CheckCircle,
  Flame,
  Utensils,
  MessageSquare
} from 'lucide-react';

export const KitchenDisplay: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [now, setNow] = useState<number>(Date.now());

  // Update timer every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const loadKitchenOrders = useCallback(async () => {
    try {
      const data = await api.getKitchenOrders();
      setOrders(data);
    } catch (err) {
      console.error('Error loading kitchen orders:', err);
    }
  }, []);

  useEffect(() => {
    loadKitchenOrders();
  }, [loadKitchenOrders]);

  // Real-time updates via WebSockets
  useWebSocket((event) => {
    if (['order_created', 'order_updated', 'order_status_changed', 'order_closed'].includes(event)) {
      loadKitchenOrders();
    }
  });

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await api.updateOrderStatus(orderId, newStatus);
      await loadKitchenOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to update order status');
    }
  };

  const calculateElapsedMinutes = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    return Math.max(0, Math.floor((now - created) / 60000));
  };

  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter((o) => o.status === filterStatus);

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return 'border-amber-500/40 bg-amber-500/5 text-amber-300';
      case 'in_preparation':
        return 'border-blue-500/40 bg-blue-500/5 text-blue-300';
      case 'ready':
        return 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300';
      case 'served':
        return 'border-purple-500/40 bg-purple-500/5 text-purple-300';
      default:
        return 'border-slate-800 bg-slate-900 text-slate-300';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <ChefHat className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Kitchen Display System (KDS)</h2>
            <p className="text-xs text-slate-400 mt-0.5">Real-time live ticket rail (<span className="text-emerald-400 font-semibold">&lt;50ms</span> sync)</p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
              filterStatus === 'all'
                ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            All Active ({orders.length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
              filterStatus === 'pending'
                ? 'bg-amber-500 text-slate-950 font-extrabold shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-amber-400 border border-slate-800 hover:text-white'
            }`}
          >
            Pending ({orders.filter((o) => o.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilterStatus('in_preparation')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
              filterStatus === 'in_preparation'
                ? 'bg-blue-500 text-white font-extrabold shadow-md shadow-blue-500/20'
                : 'bg-slate-900 text-blue-400 border border-slate-800 hover:text-white'
            }`}
          >
            In Prep ({orders.filter((o) => o.status === 'in_preparation').length})
          </button>
          <button
            onClick={() => setFilterStatus('ready')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
              filterStatus === 'ready'
                ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 text-emerald-400 border border-slate-800 hover:text-white'
            }`}
          >
            Ready ({orders.filter((o) => o.status === 'ready').length})
          </button>
        </div>
      </div>

      {/* Orders Ticket Grid */}
      {filteredOrders.length === 0 ? (
        <div className="py-24 text-center text-slate-500 bg-slate-900/40 rounded-3xl border border-slate-800">
          <Utensils className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-500" />
          <h4 className="text-base font-bold text-slate-400">Kitchen Rail Clear!</h4>
          <p className="text-xs text-slate-500 mt-1">No active incoming kitchen tickets at this moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredOrders.map((order) => {
            const elapsed = calculateElapsedMinutes(order.created_at);
            const isUrgent = elapsed >= 15;

            return (
              <div
                key={order.id}
                className={`rounded-3xl bg-slate-900 border-2 ${getStatusColor(
                  order.status
                )} p-5 flex flex-col justify-between shadow-xl transition-all animate-scaleUp`}
              >
                <div>
                  {/* Ticket Header */}
                  <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-white">Table {order.table_number}</span>
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase bg-slate-950 border border-slate-800 text-slate-300">
                          {order.table_section}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">Waiter: {order.staff_name || 'Staff'}</p>
                    </div>

                    {/* Timer */}
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                        isUrgent
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{elapsed}m ago</span>
                    </div>
                  </div>

                  {/* Order Items List */}
                  <div className="py-4 space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {order.items?.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm flex items-center justify-center border border-amber-500/30 shrink-0">
                              {item.quantity}×
                            </span>
                            <span className="text-sm font-bold text-white">{item.name}</span>
                          </div>
                        </div>

                        {/* Cooking instruction */}
                        {item.special_instructions && (
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1.5 mt-1">
                            <MessageSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{item.special_instructions}</span>
                          </div>
                        )}
                      </div>
                    ))}

                    {order.notes && (
                      <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs">
                        <strong>Order Note:</strong> {order.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bump Action Buttons (Touch friendly min-h >= 44px) */}
                <div className="pt-4 border-t border-slate-800 mt-2">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'in_preparation')}
                      className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-2xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all min-h-[44px]"
                    >
                      <Flame className="w-4 h-4" /> Start Preparation (In Prep)
                    </button>
                  )}

                  {order.status === 'in_preparation' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'ready')}
                      className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all min-h-[44px]"
                    >
                      <CheckCircle className="w-4 h-4" /> Mark Ready for Pickup
                    </button>
                  )}

                  {order.status === 'ready' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'served')}
                      className="w-full py-3.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-2xl shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all min-h-[44px]"
                    >
                      <Utensils className="w-4 h-4" /> Mark Dishes Served
                    </button>
                  )}

                  {order.status === 'served' && (
                    <div className="p-2.5 rounded-xl bg-slate-950 text-center text-xs font-bold text-purple-300 border border-purple-500/20">
                      Dishes served • Awaiting Waiter Bill Settlement
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
