import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  trendColor?: 'green' | 'red' | 'amber' | 'blue';
  color?: 'amber' | 'emerald' | 'blue' | 'purple' | 'rose';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'amber'
}) => {
  const colorMap = {
    amber: 'from-amber-500/10 to-transparent border-amber-500/20 text-amber-400',
    emerald: 'from-emerald-500/10 to-transparent border-emerald-500/20 text-emerald-400',
    blue: 'from-blue-500/10 to-transparent border-blue-500/20 text-blue-400',
    purple: 'from-purple-500/10 to-transparent border-purple-500/20 text-purple-400',
    rose: 'from-rose-500/10 to-transparent border-rose-500/20 text-rose-400',
  };

  return (
    <div
      className={`relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br ${colorMap[color]} bg-slate-900/60 border backdrop-blur-sm transition-all duration-300 hover:translate-y-[-2px] hover:shadow-lg`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <h4 className="mt-2 text-3xl font-bold text-white tracking-tight">{value}</h4>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
          {trend && (
            <p className="mt-2 inline-flex items-center text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-slate-800/80 border border-slate-700/50 ${colorMap[color].split(' ').pop()}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};
