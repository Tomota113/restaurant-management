import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Tablet,
  Grid,
  ChefHat,
  BookOpen,
  Boxes,
  Users
} from 'lucide-react';

export type NavTab = 'dashboard' | 'order-pad' | 'floor-plan' | 'kds' | 'menu' | 'inventory' | 'staff';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const { role } = useAuth();

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode; roles: Array<'manager' | 'waiter' | 'kitchen'> }> = [
    {
      id: 'dashboard',
      label: 'Analytics & KPIs',
      icon: <LayoutDashboard className="w-5 h-5" />,
      roles: ['manager']
    },
    {
      id: 'floor-plan',
      label: 'Floor Plan & Tables',
      icon: <Grid className="w-5 h-5" />,
      roles: ['manager', 'waiter']
    },
    {
      id: 'order-pad',
      label: 'Waiter Order Pad',
      icon: <Tablet className="w-5 h-5" />,
      roles: ['manager', 'waiter']
    },
    {
      id: 'kds',
      label: 'Kitchen Display (KDS)',
      icon: <ChefHat className="w-5 h-5" />,
      roles: ['manager', 'waiter', 'kitchen']
    },
    {
      id: 'menu',
      label: 'Menu & Sold-Out',
      icon: <BookOpen className="w-5 h-5" />,
      roles: ['manager']
    },
    {
      id: 'inventory',
      label: 'Inventory & Recipes',
      icon: <Boxes className="w-5 h-5" />,
      roles: ['manager']
    },
    {
      id: 'staff',
      label: 'Staff Accounts',
      icon: <Users className="w-5 h-5" />,
      roles: ['manager']
    }
  ];

  const allowedItems = navItems.filter(item => role && item.roles.includes(role));

  return (
    <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex md:flex-col justify-between py-2 md:py-6 px-3 shrink-0 overflow-x-auto md:overflow-y-auto">
      <div className="flex md:flex-col gap-1 w-full">
        <div className="hidden md:block px-3 mb-4">
          <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Restaurant Operations</p>
        </div>

        {allowedItems.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 min-h-[44px] shrink-0 ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className={isActive ? 'text-slate-950' : 'text-slate-400'}>{item.icon}</span>
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
