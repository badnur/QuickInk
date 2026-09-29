import * as React from 'react'

export function Label({ className = '', children, ...props }) {
  return (
    <label
      className={`text-xs font-semibold text-slate-700 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
      {...props}
    >
      {children}
    </label>
  )
}
