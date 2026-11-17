import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, UserCheck, UtensilsCrossed, Shield, ChefHat, User } from 'lucide-react';
import { UserRole } from '../types';

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = () => {
  const { user, logout, quickSwitchUser } = useAuth();

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Shield className="w-3.5 h-3.5" /> Manager
          </span>
        );
      case 'kitchen':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <ChefHat className="w-3.5 h-3.5" /> Kitchen
          </span>
        );
      case 'waiter':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <User className="w-3.5 h-3.5" /> Waiter
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 md:px-8 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <UtensilsCrossed className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-wide">RESTAURO</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest hidden sm:block">Management & POS</p>
        </div>
      </div>

      {/* Quick Switch Demo Tools & User Info */}
      <div className="flex items-center gap-3 md:gap-6">
        {/* Quick Role Switcher Buttons */}
        <div className="hidden lg:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <span className="px-2 text-slate-500 font-medium flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5" /> Fast Role:
          </span>
          <button
            onClick={() => quickSwitchUser('manager')}
            className={`px-2.5 py-1 rounded-lg transition-all ${user?.role === 'manager' ? 'bg-purple-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Manager
          </button>
          <button
            onClick={() => quickSwitchUser('waiter')}
            className={`px-2.5 py-1 rounded-lg transition-all ${user?.role === 'waiter' ? 'bg-emerald-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Waiter
          </button>
          <button
            onClick={() => quickSwitchUser('kitchen')}
            className={`px-2.5 py-1 rounded-lg transition-all ${user?.role === 'kitchen' ? 'bg-amber-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Kitchen
          </button>
        </div>

        {/* User profile & logout */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-semibold text-white">{user.full_name}</p>
                <p className="text-[10px] text-slate-400">@{user.username}</p>
              </div>
              {getRoleBadge(user.role)}
            </div>
          )}

          <button
            onClick={logout}
            title="Sign out"
            className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
