'use client'

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'green',
}) {
  const iconColor = {
    green: 'text-[#00bf63]',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
  }[color] || 'text-[#00bf63]'

  return (
    <div className="bg-[#0d131f] border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase text-[11px]">{title}</span>
        {Icon && (
          <div className={`p-2 rounded-lg bg-slate-900 border border-slate-800 ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{value}</span>
          {trend && (
            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
              {trend}
            </span>
          )}
        </div>

        {subtitle && <p className="text-xs text-slate-400 mt-1 font-normal">{subtitle}</p>}
      </div>
    </div>
  )
}
