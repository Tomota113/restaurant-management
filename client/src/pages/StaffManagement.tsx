import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { User, UserRole } from '../types';
import { Modal } from '../components/Modal';
import {
  Plus,
  Shield,
  User as UserIcon,
  ChefHat,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

export const StaffManagement: React.FC = () => {
  const [staff, setStaff] = useState<User[]>([]);

  // Add staff modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole>('waiter');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadStaff = useCallback(async () => {
    try {
      const data = await api.getStaff();
      setStaff(data);
    } catch (err) {
      console.error('Error loading staff accounts:', err);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await api.createStaff({
        username,
        full_name: fullName,
        password,
        role
      });
      setIsAddModalOpen(false);
      setUsername('');
      setFullName('');
      setPassword('');
      await loadStaff();
    } catch (err: any) {
      setError(err.message || 'Failed to create staff member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await api.toggleStaffStatus(user.id, !user.is_active);
      await loadStaff();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle account status');
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'manager':
        return <Shield className="w-4 h-4 text-purple-400" />;
      case 'kitchen':
        return <ChefHat className="w-4 h-4 text-amber-400" />;
      case 'waiter':
        return <UserIcon className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Staff & Access Control (RBAC)</h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage personnel accounts, assign operational roles, and revoke system access</p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 min-h-[44px]"
        >
          <Plus className="w-4 h-4" /> Add Staff Account
        </button>
      </div>

      {/* Staff Table */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-semibold">Staff Member</th>
                <th className="pb-3 font-semibold">Username</th>
                <th className="pb-3 font-semibold">Assigned Role</th>
                <th className="pb-3 font-semibold text-center">Account Status</th>
                <th className="pb-3 font-semibold text-right">Access Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-slate-850/50 transition-colors">
                  <td className="py-4">
                    <p className="font-bold text-white text-sm">{member.full_name}</p>
                    <p className="text-[11px] text-slate-400">ID: {member.id.slice(0, 8)}...</p>
                  </td>
                  <td className="py-4 font-medium text-slate-300">
                    @{member.username}
                  </td>
                  <td className="py-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-950 border border-slate-800 capitalize text-white">
                      {getRoleIcon(member.role)} {member.role}
                    </span>
                  </td>
                  <td className="py-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        member.is_active
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {member.is_active ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Active
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-rose-400" /> Deactivated
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <button
                      onClick={() => handleToggleStatus(member)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition-colors min-h-[36px] ${
                        member.is_active
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {member.is_active ? 'Deactivate Access' : 'Reactivate Account'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create Staff Account"
      >
        <form onSubmit={handleCreateStaff} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jordan Smith"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Username *</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. waiter_jordan"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Password *</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">System Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 min-h-[44px]"
            >
              <option value="waiter">Waiter (Order taking, floor tables, payment close)</option>
              <option value="kitchen">Kitchen Staff (KDS order preparation view)</option>
              <option value="manager">Manager (Full administrative & financial access)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-xl hover:bg-amber-400 shadow-md shadow-amber-500/20 min-h-[44px]"
            >
              {submitting ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
