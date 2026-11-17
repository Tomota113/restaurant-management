import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { useWebSocket } from '../services/websocket';
import { Ingredient, MenuItem } from '../types';
import { Modal } from '../components/Modal';
import {
  Boxes,
  Plus,
  Truck,
  Trash2,
  AlertTriangle,
  Layers,
  CheckCircle,
  AlertCircle,
  PlusCircle
} from 'lucide-react';

export const InventoryManagement: React.FC = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [alerts, setAlerts] = useState<Ingredient[]>([]);

  // Add ingredient modal
  const [isAddIngModalOpen, setIsAddIngModalOpen] = useState<boolean>(false);
  const [ingName, setIngName] = useState<string>('');
  const [ingUnit, setIngUnit] = useState<string>('g');
  const [ingStock, setIngStock] = useState<string>('0');
  const [ingThreshold, setIngThreshold] = useState<string>('10');
  const [ingCost, setIngCost] = useState<string>('0.00');
  const [ingError, setIngError] = useState<string | null>(null);

  // Stock adjust modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);
  const [adjustIng, setAdjustIng] = useState<Ingredient | null>(null);
  const [adjustType, setAdjustType] = useState<'delivery' | 'waste' | 'manual'>('delivery');
  const [adjustDelta, setAdjustDelta] = useState<string>('10');
  const [adjustReason, setAdjustReason] = useState<string>('Supplier shipment delivery');
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Recipe BOM modal
  const [isBomModalOpen, setIsBomModalOpen] = useState<boolean>(false);
  const [selectedDishId, setSelectedDishId] = useState<string>('');
  const [bomItems, setBomItems] = useState<Array<{ ingredient_id: string; quantity_required: number }>>([]);
  const [bomError, setBomError] = useState<string | null>(null);
  const [savingBom, setSavingBom] = useState<boolean>(false);

  const loadInventoryData = useCallback(async () => {
    try {
      const [iList, mList, aList] = await Promise.all([
        api.getIngredients(),
        api.getMenuItems(),
        api.getAlerts()
      ]);
      setIngredients(iList);
      setMenuItems(mList);
      setAlerts(aList);
      if (!selectedDishId && mList.length > 0) {
        setSelectedDishId(mList[0].id);
      }
    } catch (err) {
      console.error('Error loading inventory data:', err);
    }
  }, [selectedDishId]);

  useEffect(() => {
    loadInventoryData();
  }, [loadInventoryData]);

  // Real-time updates
  useWebSocket((event) => {
    if (['inventory_alert', 'order_closed', 'menu_item_created'].includes(event)) {
      loadInventoryData();
    }
  });

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngError(null);
    try {
      await api.createIngredient({
        name: ingName,
        unit: ingUnit,
        current_stock: parseFloat(ingStock),
        low_stock_threshold: parseFloat(ingThreshold),
        cost_per_unit: parseFloat(ingCost)
      });
      setIsAddIngModalOpen(false);
      setIngName('');
      setIngStock('0');
      setIngThreshold('10');
      await loadInventoryData();
    } catch (err: any) {
      setIngError(err.message || 'Failed to create ingredient');
    }
  };

  const openAdjustModal = (ing: Ingredient, defaultType: 'delivery' | 'waste') => {
    setAdjustIng(ing);
    setAdjustType(defaultType);
    setAdjustDelta(defaultType === 'delivery' ? '10' : '2');
    setAdjustReason(defaultType === 'delivery' ? 'Supplier shipment delivery' : 'Spoilage / culinary waste');
    setAdjustError(null);
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustIng) return;
    setAdjustError(null);

    try {
      const rawDelta = parseFloat(adjustDelta);
      const delta = adjustType === 'waste' ? -Math.abs(rawDelta) : Math.abs(rawDelta);

      await api.adjustStock({
        ingredient_id: adjustIng.id,
        adjustment_type: adjustType,
        quantity_delta: delta,
        reason: adjustReason
      });

      setIsAdjustModalOpen(false);
      await loadInventoryData();
    } catch (err: any) {
      setAdjustError(err.message || 'Failed to adjust stock');
    }
  };

  // Recipe BOM handlers
  const openRecipeBuilder = async (dishId: string) => {
    setSelectedDishId(dishId);
    setBomError(null);
    try {
      const existing = await api.getRecipes(dishId);
      setBomItems(
        existing.map((r) => ({
          ingredient_id: r.ingredient_id,
          quantity_required: r.quantity_required
        }))
      );
      setIsBomModalOpen(true);
    } catch (err) {
      console.error('Error fetching recipes:', err);
    }
  };

  const addBomIngredientRow = () => {
    if (ingredients.length === 0) return;
    setBomItems((prev) => [
      ...prev,
      { ingredient_id: ingredients[0].id, quantity_required: 1 }
    ]);
  };

  const updateBomRow = (index: number, field: 'ingredient_id' | 'quantity_required', val: any) => {
    setBomItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: field === 'quantity_required' ? parseFloat(val) || 0 : val
      };
      return updated;
    });
  };

  const removeBomRow = (index: number) => {
    setBomItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveBom = async () => {
    if (!selectedDishId) return;
    setBomError(null);
    setSavingBom(true);

    try {
      await api.saveRecipes(selectedDishId, bomItems);
      setIsBomModalOpen(false);
    } catch (err: any) {
      setBomError(err.message || 'Failed to save recipe bill of materials');
    } finally {
      setSavingBom(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Inventory & Recipe Bill of Materials (BOM)</h2>
          <p className="text-xs text-slate-400 mt-0.5">Automated stock deductions upon order closure, supplier restocks & waste auditing</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddIngModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> Add Ingredient
          </button>
        </div>
      </div>

      {/* Low Stock Alerts Banner */}
      {alerts.length > 0 && (
        <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-rose-300">
              Low Stock Threshold Breached ({alerts.length} Items Require Restock)
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              The following ingredients have reached or fallen below their configured minimum threshold:
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {alerts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => openAdjustModal(a, 'delivery')}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[36px]"
                >
                  <Truck className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {a.name}: <strong>{a.current_stock} {a.unit}</strong> (Min: {a.low_stock_threshold}) → Restock
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inventory Ingredients Table */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-amber-400" /> Stock Level Registry ({ingredients.length} items)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-semibold">Ingredient</th>
                <th className="pb-3 font-semibold">Current Balance</th>
                <th className="pb-3 font-semibold">Alert Threshold</th>
                <th className="pb-3 font-semibold">Unit Cost</th>
                <th className="pb-3 font-semibold text-center">Status</th>
                <th className="pb-3 font-semibold text-right">Stock Adjustments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {ingredients.map((ing) => {
                const isLow = ing.current_stock <= ing.low_stock_threshold;
                return (
                  <tr key={ing.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-4">
                      <p className="font-bold text-white text-sm">{ing.name}</p>
                      <p className="text-[11px] text-slate-400 uppercase">Unit: {ing.unit}</p>
                    </td>
                    <td className="py-4 font-extrabold text-sm text-white">
                      {ing.current_stock} <span className="text-xs font-normal text-slate-400">{ing.unit}</span>
                    </td>
                    <td className="py-4 text-slate-300 font-medium">
                      {ing.low_stock_threshold} {ing.unit}
                    </td>
                    <td className="py-4 text-slate-400 font-medium">
                      ${ing.cost_per_unit.toFixed(3)}
                    </td>
                    <td className="py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                          isLow
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {isLow ? <AlertTriangle className="w-3 h-3 text-rose-400" /> : <CheckCircle className="w-3 h-3 text-emerald-400" />}
                        {isLow ? 'LOW STOCK' : 'OPTIMAL'}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openAdjustModal(ing, 'delivery')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold text-xs flex items-center gap-1 transition-colors min-h-[36px]"
                        >
                          <Truck className="w-3.5 h-3.5" /> + Restock
                        </button>
                        <button
                          onClick={() => openAdjustModal(ing, 'waste')}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold text-xs flex items-center gap-1 transition-colors min-h-[36px]"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> - Waste
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recipe BOM Builder Section */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" /> Recipe Bill of Materials (BOM) Configurator
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Map menu dishes to precise ingredient requirements for automatic stock deduction</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
          {menuItems.map((dish) => (
            <div
              key={dish.id}
              className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between"
            >
              <div>
                <h4 className="font-bold text-white text-sm">{dish.name}</h4>
                <p className="text-xs text-amber-400 font-extrabold mt-0.5">${dish.price.toFixed(2)}</p>
              </div>

              <button
                onClick={() => openRecipeBuilder(dish.id)}
                className="mt-4 w-full py-2.5 px-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors min-h-[40px]"
              >
                <Layers className="w-3.5 h-3.5" /> Configure BOM Recipe
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add Ingredient Modal */}
      <Modal
        isOpen={isAddIngModalOpen}
        onClose={() => setIsAddIngModalOpen(false)}
        title="Add New Stock Ingredient"
      >
        <form onSubmit={handleCreateIngredient} className="space-y-4">
          {ingError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{ingError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Ingredient Name *</label>
            <input
              type="text"
              required
              value={ingName}
              onChange={(e) => setIngName(e.target.value)}
              placeholder="e.g. Atlantic Salmon Fillet"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Unit of Measure *</label>
              <select
                value={ingUnit}
                onChange={(e) => setIngUnit(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
              >
                <option value="g">Grams (g)</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="ml">Milliliters (ml)</option>
                <option value="L">Liters (L)</option>
                <option value="pcs">Pieces (pcs)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Cost Per Unit ($)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={ingCost}
                onChange={(e) => setIngCost(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Initial Stock Level *</label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={ingStock}
                onChange={(e) => setIngStock(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Low Stock Alert Threshold *</label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={ingThreshold}
                onChange={(e) => setIngThreshold(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddIngModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-xl hover:bg-amber-400 shadow-md shadow-amber-500/20 min-h-[44px]"
            >
              Register Ingredient
            </button>
          </div>
        </form>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title={`Adjust Stock: ${adjustIng?.name}`}
      >
        <form onSubmit={handleSaveAdjustment} className="space-y-4">
          {adjustError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{adjustError}</span>
            </div>
          )}

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between text-xs">
            <span className="text-slate-400">Current Balance:</span>
            <span className="text-white font-bold">{adjustIng?.current_stock} {adjustIng?.unit}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Adjustment Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdjustType('delivery');
                  setAdjustReason('Supplier shipment delivery');
                }}
                className={`py-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 min-h-[44px] ${
                  adjustType === 'delivery'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <Truck className="w-4 h-4" /> Restock (+ Shipment)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdjustType('waste');
                  setAdjustReason('Spoilage / culinary waste');
                }}
                className={`py-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 min-h-[44px] ${
                  adjustType === 'waste'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                <Trash2 className="w-4 h-4" /> Waste (- Loss)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Quantity Delta ({adjustIng?.unit}) *
            </label>
            <input
              type="number"
              step="any"
              min="0.0001"
              required
              value={adjustDelta}
              onChange={(e) => setAdjustDelta(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Audit Reason / PO Number *</label>
            <input
              type="text"
              required
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="e.g. PO-9811 from Seafood Supplier"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-6 py-2.5 text-xs font-bold text-slate-950 rounded-xl min-h-[44px] ${
                adjustType === 'delivery'
                  ? 'bg-emerald-500 hover:bg-emerald-400 shadow-md shadow-emerald-500/20'
                  : 'bg-rose-500 hover:bg-rose-400 shadow-md shadow-rose-500/20'
              }`}
            >
              Apply Stock Adjustment
            </button>
          </div>
        </form>
      </Modal>

      {/* Recipe BOM Builder Modal */}
      <Modal
        isOpen={isBomModalOpen}
        onClose={() => setIsBomModalOpen(false)}
        title={`Configure Recipe BOM: ${menuItems.find((m) => m.id === selectedDishId)?.name}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {bomError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{bomError}</span>
            </div>
          )}

          <p className="text-xs text-slate-400">
            Define ingredients deducted from inventory whenever this dish is served:
          </p>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {bomItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <select
                  value={item.ingredient_id}
                  onChange={(e) => updateBomRow(idx, 'ingredient_id', e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
                >
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  value={item.quantity_required}
                  onChange={(e) => updateBomRow(idx, 'quantity_required', e.target.value)}
                  placeholder="Qty"
                  className="w-24 bg-slate-900 border border-slate-800 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
                />

                <button
                  type="button"
                  onClick={() => removeBomRow(idx)}
                  className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addBomIngredientRow}
            className="w-full py-2.5 border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-xl text-xs font-semibold text-slate-400 hover:text-amber-400 flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
          >
            <PlusCircle className="w-4 h-4" /> Add Ingredient to Recipe
          </button>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsBomModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveBom}
              disabled={savingBom}
              className="px-6 py-2.5 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-md shadow-purple-600/25 min-h-[44px]"
            >
              {savingBom ? 'Saving BOM...' : 'Save Recipe BOM'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
