import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { useWebSocket } from '../services/websocket';
import { Category, MenuItem } from '../types';
import { Modal } from '../components/Modal';
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  FolderPlus
} from 'lucide-react';

export const MenuManagement: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('all');

  // Item modal
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState<string>('');
  const [itemCategory, setItemCategory] = useState<string>('');
  const [itemPrice, setItemPrice] = useState<string>('');
  const [itemDescription, setItemDescription] = useState<string>('');
  const [itemAvailable, setItemAvailable] = useState<boolean>(true);
  const [itemError, setItemError] = useState<string | null>(null);
  const [submittingItem, setSubmittingItem] = useState<boolean>(false);

  // Category modal
  const [isCatModalOpen, setIsCatModalOpen] = useState<boolean>(false);
  const [catName, setCatName] = useState<string>('');
  const [catOrder, setCatOrder] = useState<number>(1);
  const [catDesc, setCatDesc] = useState<string>('');
  const [catError, setCatError] = useState<string | null>(null);

  const loadMenuData = useCallback(async () => {
    try {
      const [cList, mList] = await Promise.all([api.getCategories(), api.getMenuItems()]);
      setCategories(cList);
      setMenuItems(mList);
    } catch (err) {
      console.error('Error loading menu data:', err);
    }
  }, []);

  useEffect(() => {
    loadMenuData();
  }, [loadMenuData]);

  // Real-time WebSocket sync
  useWebSocket((event) => {
    if (['menu_item_created', 'menu_item_updated', 'menu_item_deleted', 'category_created', 'category_updated', 'category_deleted'].includes(event)) {
      loadMenuData();
    }
  });

  const openAddItemModal = () => {
    setEditingItem(null);
    setItemName('');
    setItemCategory(categories[0]?.id || '');
    setItemPrice('');
    setItemDescription('');
    setItemAvailable(true);
    setItemError(null);
    setIsItemModalOpen(true);
  };

  const openEditItemModal = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemCategory(item.category_id);
    setItemPrice(String(item.price));
    setItemDescription(item.description || '');
    setItemAvailable(item.is_available);
    setItemError(null);
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setItemError(null);
    setSubmittingItem(true);

    try {
      const payload = {
        name: itemName,
        category_id: itemCategory,
        price: parseFloat(itemPrice),
        description: itemDescription,
        is_available: itemAvailable
      };

      if (editingItem) {
        await api.updateMenuItem(editingItem.id, payload);
      } else {
        await api.createMenuItem(payload);
      }

      setIsItemModalOpen(false);
      await loadMenuData();
    } catch (err: any) {
      setItemError(err.message || 'Failed to save menu item');
    } finally {
      setSubmittingItem(false);
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      await api.toggleMenuItemAvailability(item.id, !item.is_available);
      await loadMenuData();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle item availability');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this menu dish?')) return;
    try {
      await api.deleteMenuItem(id);
      await loadMenuData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete dish');
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatError(null);
    try {
      await api.createCategory({
        name: catName,
        display_order: catOrder,
        description: catDesc
      });
      setIsCatModalOpen(false);
      setCatName('');
      setCatDesc('');
      await loadMenuData();
    } catch (err: any) {
      setCatError(err.message || 'Failed to create category');
    }
  };

  const filteredItems = selectedCatId === 'all'
    ? menuItems
    : menuItems.filter((i) => i.category_id === selectedCatId);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Menu & Sold-Out Management</h2>
          <p className="text-xs text-slate-400 mt-0.5">Organize categories, configure dish prices, and toggle 86 sold-out status</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCatModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors min-h-[44px]"
          >
            <FolderPlus className="w-4 h-4 text-amber-400" /> New Category
          </button>
          <button
            onClick={openAddItemModal}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> Add Menu Item
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCatId('all')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
            selectedCatId === 'all'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          All Categories ({menuItems.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCatId(cat.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
              selectedCatId === cat.id
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            {cat.name} ({menuItems.filter((i) => i.category_id === cat.id).length})
          </button>
        ))}
      </div>

      {/* Items Table / Cards */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-semibold">Dish / Item</th>
                <th className="pb-3 font-semibold">Category</th>
                <th className="pb-3 font-semibold">Price</th>
                <th className="pb-3 font-semibold text-center">Availability (Sold Out Toggle)</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-850/50 transition-colors">
                  <td className="py-4">
                    <p className="font-bold text-white text-sm">{item.name}</p>
                    {item.description && (
                      <p className="text-slate-400 text-xs mt-0.5 max-w-md line-clamp-1">{item.description}</p>
                    )}
                  </td>
                  <td className="py-4">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 border border-slate-800 text-[11px] font-semibold">
                      {item.category_name}
                    </span>
                  </td>
                  <td className="py-4 font-extrabold text-amber-400 text-sm">
                    ${item.price.toFixed(2)}
                  </td>
                  <td className="py-4 text-center">
                    <button
                      onClick={() => handleToggleAvailability(item)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all min-h-[36px] ${
                        item.is_available
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                      }`}
                    >
                      {item.is_available ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Available
                        </>
                      ) : (
                        <>
                          <X className="w-3.5 h-3.5 text-rose-400" /> 86 Sold Out
                        </>
                      )}
                    </button>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditItemModal(item)}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Menu Item Modal */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          {itemError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{itemError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Dish / Item Name *</label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Truffle Risotto"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Category *</label>
              <select
                required
                value={itemCategory}
                onChange={(e) => setItemCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Price ($) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                placeholder="18.50"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
            <textarea
              rows={2}
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="Ingredients, culinary details, allergens..."
              className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
            ></textarea>
          </div>

          <div className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              id="itemAvail"
              checked={itemAvailable}
              onChange={(e) => setItemAvailable(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-950 border-slate-800"
            />
            <label htmlFor="itemAvail" className="text-xs font-medium text-slate-300">
              Dish is currently Available (Uncheck if 86 Sold Out)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsItemModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingItem}
              className="px-6 py-2.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-xl hover:bg-amber-400 shadow-md shadow-amber-500/20 min-h-[44px]"
            >
              {submittingItem ? 'Saving...' : 'Save Dish'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        title="Add Menu Category"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          {catError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{catError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Category Name *</label>
            <input
              type="text"
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="e.g. Cocktails & Wines"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Display Order</label>
            <input
              type="number"
              value={catOrder}
              onChange={(e) => setCatOrder(parseInt(e.target.value, 10))}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
            <input
              type="text"
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              placeholder="Short category summary"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCatModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-xl hover:bg-amber-400 shadow-md shadow-amber-500/20 min-h-[44px]"
            >
              Create Category
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
