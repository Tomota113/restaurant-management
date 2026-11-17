import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { useWebSocket } from '../services/websocket';
import { Table, Category, MenuItem, Order, OrderItem } from '../types';
import { Modal } from '../components/Modal';
import {
  Plus,
  Minus,
  Trash2,
  Send,
  CreditCard,
  Utensils,
  CheckCircle,
  MessageSquare,
  ShoppingBag
} from 'lucide-react';

export const WaiterOrderPad: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // Cart state for new or modifying order
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Special instructions modal
  const [instructionItemIndex, setInstructionItemIndex] = useState<number | null>(null);
  const [instructionText, setInstructionText] = useState<string>('');

  // Payment modal
  const [isPaymentOpen, setIsPaymentOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('card');
  const [tipAmount, setTipAmount] = useState<number>(0);

  const loadData = useCallback(async () => {
    try {
      const [tList, cList, mList, oList] = await Promise.all([
        api.getTables(),
        api.getCategories(),
        api.getMenuItems(),
        api.getOrders()
      ]);
      setTables(tList);
      setCategories(cList);
      setMenuItems(mList);

      // Set initial table if none selected
      if (!selectedTableId && tList.length > 0) {
        setSelectedTableId(tList[0].id);
      }

      // Check if current selected table has an active order
      const targetTableId = selectedTableId || (tList.length > 0 ? tList[0].id : '');
      if (targetTableId) {
        const foundActive = oList.find(
          (o) => o.table_id === targetTableId && o.status !== 'closed' && o.status !== 'cancelled'
        );
        if (foundActive) {
          setActiveOrder(foundActive);
          setCart(foundActive.items || []);
          setOrderNotes(foundActive.notes || '');
        } else {
          setActiveOrder(null);
          setCart([]);
          setOrderNotes('');
        }
      }
    } catch (err) {
      console.error('Error loading order pad data:', err);
    }
  }, [selectedTableId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle table switch
  const handleSelectTable = async (tableId: string) => {
    setSelectedTableId(tableId);
    try {
      const orders = await api.getOrders({ table_id: tableId });
      const foundActive = orders.find(
        (o) => o.status !== 'closed' && o.status !== 'cancelled'
      );
      if (foundActive) {
        setActiveOrder(foundActive);
        setCart(foundActive.items || []);
        setOrderNotes(foundActive.notes || '');
      } else {
        setActiveOrder(null);
        setCart([]);
        setOrderNotes('');
      }
    } catch {
      setActiveOrder(null);
      setCart([]);
    }
  };

  // Real-time WebSocket listener
  useWebSocket((event) => {
    if (['order_created', 'order_updated', 'order_status_changed', 'order_closed', 'table_updated', 'menu_item_updated'].includes(event)) {
      loadData();
    }
  });

  const filteredItems = selectedCategoryId === 'all'
    ? menuItems
    : menuItems.filter((i) => i.category_id === selectedCategoryId);

  const addToCart = (item: MenuItem) => {
    if (!item.is_available) return;

    setCart((prev) => {
      const existingIdx = prev.findIndex((i) => i.menu_item_id === item.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + 1,
          subtotal: Number(((updated[existingIdx].quantity + 1) * (item.price || 0)).toFixed(2))
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            menu_item_id: item.id,
            name: item.name,
            unit_price: item.price,
            quantity: 1,
            special_instructions: '',
            subtotal: item.price
          }
        ];
      }
    });
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      } else {
        updated[index] = {
          ...updated[index],
          quantity: newQty,
          subtotal: Number((newQty * (updated[index].unit_price || 0)).toFixed(2))
        };
        return updated;
      }
    });
  };

  const removeItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const openInstructionModal = (index: number) => {
    setInstructionItemIndex(index);
    setInstructionText(cart[index].special_instructions || '');
  };

  const saveInstruction = () => {
    if (instructionItemIndex !== null) {
      setCart((prev) => {
        const updated = [...prev];
        updated[instructionItemIndex] = {
          ...updated[instructionItemIndex],
          special_instructions: instructionText
        };
        return updated;
      });
    }
    setInstructionItemIndex(null);
    setInstructionText('');
  };

  const cartSubtotal = Number(
    cart.reduce((acc, item) => acc + (item.unit_price || 0) * item.quantity, 0).toFixed(2)
  );

  const handleSendOrder = async () => {
    if (!selectedTableId || cart.length === 0) return;
    setSubmitting(true);
    setFeedbackMsg(null);

    try {
      if (activeOrder) {
        // Update existing open order
        await api.updateOrderItems(
          activeOrder.id,
          cart.map((i) => ({
            menu_item_id: i.menu_item_id,
            quantity: i.quantity,
            special_instructions: i.special_instructions
          }))
        );
        setFeedbackMsg({ text: 'Order updated and sent to Kitchen!', type: 'success' });
      } else {
        // Create new order
        const newOrder = await api.createOrder({
          table_id: selectedTableId,
          items: cart.map((i) => ({
            menu_item_id: i.menu_item_id,
            quantity: i.quantity,
            special_instructions: i.special_instructions
          })),
          notes: orderNotes
        });
        setActiveOrder(newOrder);
        setFeedbackMsg({ text: `Order created on Table! Ticket sent to KDS.`, type: 'success' });
      }
      await loadData();
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'Failed to submit order', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseOrder = async () => {
    if (!activeOrder) return;
    setSubmitting(true);
    try {
      await api.closeOrder(activeOrder.id, {
        payment_method: paymentMethod,
        tip: tipAmount
      });
      setIsPaymentOpen(false);
      setCart([]);
      setActiveOrder(null);
      setOrderNotes('');
      setFeedbackMsg({ text: 'Payment settled. Order closed and table freed!', type: 'success' });
      await loadData();
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'Failed to close order', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTable = tables.find((t) => t.id === selectedTableId);

  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-fadeIn pb-12">
      {/* Left / Main Section: Menu & Item Selection */}
      <div className="flex-1 space-y-6">
        {/* Table Selector Header */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Active Dining Table</p>
              <div className="flex items-center gap-2 mt-0.5">
                <select
                  value={selectedTableId}
                  onChange={(e) => handleSelectTable(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white font-bold text-base rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500 min-h-[44px]"
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.table_number} ({t.section} - {t.capacity} seats) [{t.status.toUpperCase()}]
                    </option>
                  ))}
                </select>
                {selectedTable && (
                  <span
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                      selectedTable.status === 'occupied'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : selectedTable.status === 'reserved'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {selectedTable.status.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {activeOrder && (
            <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400">Order Status:</span>
              <span className="font-bold text-amber-400 uppercase tracking-wide px-2 py-0.5 rounded bg-amber-500/10">
                {activeOrder.status.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center gap-2 animate-fadeIn ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}
          >
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Category Filter Pills (Touch friendly >=44px) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategoryId('all')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 min-h-[44px] ${
              selectedCategoryId === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 min-h-[44px] ${
                selectedCategoryId === cat.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Dishes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isSoldOut = !item.is_available;
            return (
              <div
                key={item.id}
                onClick={() => !isSoldOut && addToCart(item)}
                className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between min-h-[120px] ${
                  isSoldOut
                    ? 'bg-slate-900/40 border-slate-800/60 opacity-60 cursor-not-allowed'
                    : 'bg-slate-900 border-slate-800 hover:border-amber-500/50 hover:bg-slate-850 cursor-pointer active:scale-[0.98]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-white leading-tight">{item.name}</h4>
                    {isSoldOut && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-extrabold uppercase border border-rose-500/30 shrink-0">
                        Sold Out
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
                  )}
                </div>

                <div className="flex items-center justify-between mt-4 pt-2 border-t border-slate-800/80">
                  <span className="text-base font-extrabold text-amber-400">
                    ${item.price.toFixed(2)}
                  </span>
                  <button
                    disabled={isSoldOut}
                    className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 min-h-[44px] min-w-[44px] justify-center ${
                      isSoldOut
                        ? 'bg-slate-800 text-slate-500'
                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500 hover:text-slate-950'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Section: Order Cart & Bill Summary */}
      <div className="w-full lg:w-96 shrink-0 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-2xl h-fit sticky top-20">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">Table Cart</h3>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
              >
                Clear Cart
              </button>
            )}
          </div>

          {/* Cart Item List */}
          <div className="mt-4 space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <Utensils className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Tap on menu items on the left to build the table ticket.
              </div>
            ) : (
              cart.map((item, idx) => (
                <div
                  key={`${item.menu_item_id}-${idx}`}
                  className="p-3 bg-slate-950 border border-slate-800/80 rounded-2xl flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-white">{item.name}</p>
                      <p className="text-[11px] text-slate-400">${(item.unit_price || 0).toFixed(2)} each</p>
                    </div>
                    <span className="text-xs font-extrabold text-amber-400">
                      ${((item.unit_price || 0) * item.quantity).toFixed(2)}
                    </span>
                  </div>

                  {/* Special instruction preview */}
                  {item.special_instructions && (
                    <div className="text-[11px] bg-slate-900 px-2 py-1 rounded-lg text-amber-300 border border-slate-800 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">{item.special_instructions}</span>
                    </div>
                  )}

                  {/* Item controls */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                    <button
                      onClick={() => openInstructionModal(idx)}
                      className="text-[11px] text-slate-400 hover:text-amber-400 font-medium flex items-center gap-1 min-h-[36px]"
                    >
                      <MessageSquare className="w-3 h-3" /> Note
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(idx, -1)}
                        className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold text-white px-1">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(idx, 1)}
                        className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeItem(idx)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Totals & Submit Section */}
        <div className="mt-6 pt-4 border-t border-slate-800 space-y-4">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span className="font-semibold text-white">${cartSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800/80">
              <span>Total Bill:</span>
              <span className="text-amber-400 font-extrabold text-lg">${cartSubtotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleSendOrder}
              disabled={submitting || cart.length === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 text-xs uppercase tracking-wider transition-all min-h-[44px] disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
              {activeOrder ? 'Update Kitchen Ticket' : 'Send Order to Kitchen'}
            </button>

            {activeOrder && (
              <button
                onClick={() => setIsPaymentOpen(true)}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 text-xs uppercase tracking-wider transition-all min-h-[44px]"
              >
                <CreditCard className="w-4 h-4" /> Settle Bill & Free Table
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Special Instruction Modal */}
      <Modal
        isOpen={instructionItemIndex !== null}
        onClose={() => setInstructionItemIndex(null)}
        title="Kitchen Cooking Instruction"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Add modifier notes for the chef (e.g. "No onions", "Medium Rare", "Gluten allergy"):
          </p>
          <textarea
            value={instructionText}
            onChange={(e) => setInstructionText(e.target.value)}
            placeholder="Special instructions..."
            rows={3}
            className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
          ></textarea>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setInstructionItemIndex(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl min-h-[44px]"
            >
              Cancel
            </button>
            <button
              onClick={saveInstruction}
              className="px-4 py-2 text-xs font-bold bg-amber-500 text-slate-950 rounded-xl hover:bg-amber-400 min-h-[44px]"
            >
              Save Note
            </button>
          </div>
        </div>
      </Modal>

      {/* Payment Settlement Modal */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        title={`Settle Bill - Table ${selectedTable?.table_number}`}
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <p className="text-xs text-slate-400 uppercase font-semibold">Total Amount Due</p>
            <h3 className="text-3xl font-extrabold text-emerald-400 mt-1">
              ${(cartSubtotal + Number(tipAmount || 0)).toFixed(2)}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Subtotal: ${cartSubtotal.toFixed(2)}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {['card', 'cash', 'complimentary'].map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`py-2.5 text-xs font-bold rounded-xl border capitalize min-h-[44px] ${
                    paymentMethod === m
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Add Tip ($)</label>
            <div className="flex gap-2">
              {[0, 2, 5, 10].map((t) => (
                <button
                  key={t}
                  onClick={() => setTipAmount(t)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl border min-h-[44px] ${
                    tipAmount === t
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  ${t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              onClick={() => setIsPaymentOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl min-h-[44px]"
            >
              Cancel
            </button>
            <button
              onClick={handleCloseOrder}
              disabled={submitting}
              className="px-6 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/25 min-h-[44px]"
            >
              {submitting ? 'Processing...' : 'Complete Payment & Free Table'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
