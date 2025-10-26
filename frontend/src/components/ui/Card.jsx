import { clsx } from 'clsx';
import React from 'react';

export default function Card({ children, className, ...props }) {
  return (
    <div
      className={clsx(
        'bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-lg p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
