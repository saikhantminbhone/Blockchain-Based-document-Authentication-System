// src/components/ui/Button.jsx (JSX version)

import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';
import React from 'react';

export default function Button({
  children,
  className,
  variant = 'primary',
  isLoading = false,
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none';

  const variantStyles = {
    primary: 'bg-primary text-white hover:bg-hover-blue focus:ring-primary',
    secondary:
      'bg-card text-text-secondary border border-text-muted hover:bg-background focus:ring-text-secondary dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 dark:border-slate-600',
    accent: 'bg-accent text-white hover:bg-hover-teal focus:ring-accent',
  };

  return (
    <button
      className={clsx(baseStyles, variantStyles[variant], 'px-4 py-2', className)}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
