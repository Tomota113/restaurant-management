import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { WaiterOrderPad } from './pages/WaiterOrderPad';
import { FloorPlan } from './pages/FloorPlan';
import { KitchenDisplay } from './pages/KitchenDisplay';
import { MenuManagement } from './pages/MenuManagement';
import { InventoryManagement } from './pages/InventoryManagement';
import { StaffManagement } from './pages/StaffManagement';
import { RotateCw } from 'lucide-react';

export const App: React.FC = () => {
  const { isAuthenticated, isLoading, role } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Adjust active tab when user role changes
  useEffect(() => {
    if (role === 'kitchen') {
      setActiveTab('kds');
    } else if (role === 'waiter') {
      setActiveTab('order-pad');
    } else if (role === 'manager') {
      setActiveTab('dashboard');
    }
  }, [role]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-amber-500">
        <RotateCw className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'order-pad':
        return <WaiterOrderPad />;
      case 'floor-plan':
        return (
          <FloorPlan
            onSelectTableForOrder={() => setActiveTab('order-pad')}
          />
        );
      case 'kds':
        return <KitchenDisplay />;
      case 'menu':
        return <MenuManagement />;
      case 'inventory':
        return <InventoryManagement />;
      case 'staff':
        return <StaffManagement />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navigation */}
      <Navbar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />

        {/* Content Area (Tablet scrollable container) */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
};

export default App;
