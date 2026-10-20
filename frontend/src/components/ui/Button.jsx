import React from "react";

export function Button({ children, variant = "primary", className = "", ...props }) {
  const base = "px-3 py-1.5 rounded text-xs font-medium transition-all select-none ";
  const variants = {
    primary: "bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60",
    danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-sm",
    ghost: "text-slate-400 hover:text-white hover:bg-slate-800/40",
  };
  return (
    <button className={`${base} ${variants[variant] || variants.primary} ${className}`} {...props}>
      {children}
    </button>
  );
}
