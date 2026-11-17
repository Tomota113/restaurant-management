import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { useWebSocket } from '../services/websocket';
import { Table, Reservation, Order } from '../types';
import { Modal } from '../components/Modal';
import {
  Users,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  XCircle,
  ShoppingBag,
  DollarSign
} from 'lucide-react';

interface FloorPlanProps {
  onSelectTableForOrder?: (tableId: string) => void;
}

export const FloorPlan: React.FC<FloorPlanProps> = ({ onSelectTableForOrder }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('all');

  // Reservation modal
  const [isReserveModalOpen, setIsReserveModalOpen] = useState<boolean>(false);
  const [targetTable, setTargetTable] = useState<Table | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [reservationDate, setReservationDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reservationTime, setReservationTime] = useState<string>('19:00');
  const [partySize, setPartySize] = useState<number>(2);
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const [tList, rList, oList] = await Promise.all([
        api.getTables(),
        api.getReservations({ date: new Date().toISOString().slice(0, 10) }),
        api.getOrders()
      ]);
      setTables(tList);
      setReservations(rList);
      setActiveOrders(oList.filter((o) => o.status !== 'closed' && o.status !== 'cancelled'));
    } catch (err) {
      console.error('Error loading floor plan data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time WebSocket updates
  useWebSocket((event) => {
    if (['table_updated', 'table_created', 'table_deleted', 'reservation_created', 'reservation_cancelled', 'order_created', 'order_closed'].includes(event)) {
      loadData();
    }
  });

  const sections = Array.from(new Set(tables.map((t) => t.section || 'Main Dining')));

  const filteredTables = selectedSection === 'all'
    ? tables
    : tables.filter((t) => t.section === selectedSection);

  const openReservationModal = (table: Table) => {
    setTargetTable(table);
    setPartySize(Math.min(2, table.capacity));
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setFormError(null);
    setIsReserveModalOpen(true);
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTable) return;
    setFormError(null);
    setSubmitting(true);

    try {
      await api.createReservation({
        table_id: targetTable.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        reservation_date: reservationDate,
        reservation_time: reservationTime,
        party_size: Number(partySize),
        notes: notes
      });
      setIsReserveModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create reservation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReservation = async (resId: string) => {
    try {
      await api.cancelReservation(resId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel reservation');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header & Status Legend */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Interactive Restaurant Floor Plan</h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time table occupancy, reservations, and instant seating</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-2xl border border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
            <span className="text-slate-300 font-medium">Free ({tables.filter((t) => t.status === 'free').length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
            <span className="text-slate-300 font-medium">Occupied ({tables.filter((t) => t.status === 'occupied').length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></span>
            <span className="text-slate-300 font-medium">Reserved ({tables.filter((t) => t.status === 'reserved').length})</span>
          </div>
        </div>
      </div>

      {/* Section Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedSection('all')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
            selectedSection === 'all'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          All Floor Sections ({tables.length})
        </button>
        {sections.map((sec) => (
          <button
            key={sec}
            onClick={() => setSelectedSection(sec)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
              selectedSection === sec
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            {sec} ({tables.filter((t) => t.section === sec).length})
          </button>
        ))}
      </div>

      {/* Tables Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTables.map((table) => {
          const currentOrder = activeOrders.find((o) => o.table_id === table.id);
          const currentReservation = reservations.find(
            (r) => r.table_id === table.id && r.status === 'confirmed'
          );

          let statusColor = 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400';
          let badgeBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

          if (table.status === 'occupied') {
            statusColor = 'border-rose-500/30 bg-rose-500/5 text-rose-400';
            badgeBg = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
          } else if (table.status === 'reserved') {
            statusColor = 'border-amber-500/30 bg-amber-500/5 text-amber-400';
            badgeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
          }

          return (
            <div
              key={table.id}
              className={`p-6 rounded-3xl bg-slate-900 border ${statusColor} flex flex-col justify-between shadow-lg transition-all duration-200 hover:border-amber-500/40`}
            >
              <div>
                {/* Table Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-extrabold text-white">Table {table.table_number}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase ${badgeBg}`}>
                        {table.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                      <span>{table.section}</span> • 
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> Max {table.capacity} Guests
                      </span>
                    </p>
                  </div>
                </div>

                {/* State Details */}
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  {table.status === 'occupied' && currentOrder && (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-300 font-semibold">
                        <span className="flex items-center gap-1 text-slate-400">
                          <ShoppingBag className="w-3.5 h-3.5 text-rose-400" /> Active Order:
                        </span>
                        <span className="text-amber-400 font-bold">${currentOrder.total_amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Items in ticket:</span>
                        <span className="text-white font-medium">{currentOrder.items?.length || 0} items</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Ticket status:</span>
                        <span className="text-rose-300 font-bold uppercase tracking-wider">
                          {currentOrder.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  )}

                  {table.status === 'reserved' && currentReservation && (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-300 font-semibold">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" /> Reserved for:
                        </span>
                        <span className="text-white font-bold">{currentReservation.customer_name}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Time Slot:</span>
                        <span className="text-amber-300 font-bold">{currentReservation.reservation_time} ({currentReservation.party_size} guests)</span>
                      </div>
                      {currentReservation.customer_phone && (
                        <div className="flex justify-between text-slate-400">
                          <span>Phone:</span>
                          <span className="text-slate-300">{currentReservation.customer_phone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {table.status === 'free' && (
                    <p className="text-xs text-emerald-400/80 flex items-center gap-1.5 py-2">
                      <CheckCircle2 className="w-4 h-4" /> Ready for immediate guest seating
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons (Touch targets >= 44px) */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-2">
                {table.status === 'free' && (
                  <>
                    <button
                      onClick={() => onSelectTableForOrder && onSelectTableForOrder(table.id)}
                      className="flex-1 py-3 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/20 min-h-[44px]"
                    >
                      <Plus className="w-4 h-4" /> Seat & Order
                    </button>
                    <button
                      onClick={() => openReservationModal(table)}
                      className="py-3 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-1 min-h-[44px]"
                    >
                      <Calendar className="w-4 h-4" /> Reserve
                    </button>
                  </>
                )}

                {table.status === 'reserved' && (
                  <>
                    <button
                      onClick={() => onSelectTableForOrder && onSelectTableForOrder(table.id)}
                      className="flex-1 py-3 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all min-h-[44px]"
                    >
                      <Plus className="w-4 h-4" /> Seat Guests
                    </button>
                    {currentReservation && (
                      <button
                        onClick={() => handleCancelReservation(currentReservation.id)}
                        className="py-3 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1 min-h-[44px]"
                      >
                        <XCircle className="w-4 h-4" /> Cancel
                      </button>
                    )}
                  </>
                )}

                {table.status === 'occupied' && (
                  <button
                    onClick={() => onSelectTableForOrder && onSelectTableForOrder(table.id)}
                    className="w-full py-3 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all min-h-[44px]"
                  >
                    <DollarSign className="w-4 h-4" /> View Ticket / Settle Bill
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reservation Booking Modal */}
      <Modal
        isOpen={isReserveModalOpen}
        onClose={() => setIsReserveModalOpen(false)}
        title={`Book Reservation - Table ${targetTable?.table_number}`}
      >
        <form onSubmit={handleCreateReservation} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Customer Full Name *</label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Marie Curie"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Contact Phone</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="555-0199"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Party Size (Max: {targetTable?.capacity}) *
              </label>
              <input
                type="number"
                required
                min={1}
                max={targetTable?.capacity || 10}
                value={partySize}
                onChange={(e) => setPartySize(parseInt(e.target.value, 10))}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Date *</label>
              <input
                type="date"
                required
                value={reservationDate}
                onChange={(e) => setReservationDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Time Slot *</label>
              <input
                type="time"
                required
                value={reservationTime}
                onChange={(e) => setReservationTime(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Notes / Preferences</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Birthday celebration, window seat..."
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
            ></textarea>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsReserveModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-xl hover:bg-amber-400 shadow-md shadow-amber-500/20 min-h-[44px]"
            >
              {submitting ? 'Booking...' : 'Confirm Reservation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
