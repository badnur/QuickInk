'use client'

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'green',
}) {
  const colorStyles = {
    green: {
      bg: 'bg-emerald-500/10',
      text: 'text-[#00bf63]',
      border: 'border-emerald-500/20',
      glow: 'shadow-emerald-500/5',
    },
    blue: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      border: 'border-blue-500/20',
      glow: 'shadow-blue-500/5',
    },
    purple: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
      border: 'border-purple-500/20',
      glow: 'shadow-purple-500/5',
    },
    amber: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/20',
      glow: 'shadow-amber-500/5',
    },
  }[color] || colorStyles.green

  return (
    <div className={`bg-[#0d131f] border border-slate-800/90 rounded-2xl p-4 sm:p-5 relative overflow-hidden transition-all hover:border-slate-700 shadow-lg ${colorStyles.glow}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${colorStyles.bg} ${colorStyles.text} border ${colorStyles.border}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">{value}</span>
        {trend && (
          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
            {trend}
          </span>
        )}
      </div>

      {subtitle && <p className="text-xs text-slate-400 mt-1 font-medium">{subtitle}</p>}
    </div>
  )
}
