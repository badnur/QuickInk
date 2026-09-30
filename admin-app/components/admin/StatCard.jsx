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
    blue: 'text-blue-500 dark:text-blue-400',
    amber: 'text-amber-500 dark:text-amber-400',
    black: 'text-slate-900 dark:text-slate-100',
    purple: 'text-slate-900 dark:text-slate-100', // alias to neutral black/white per user instruction
  }[color] || 'text-[#00bf63]'

  return (
    <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-colors shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide uppercase text-[11px]">{title}</span>
        {Icon && (
          <div className={`p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</span>
          {trend && (
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
              {trend}
            </span>
          )}
        </div>

        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-normal">{subtitle}</p>}
      </div>
    </div>
  )
}
