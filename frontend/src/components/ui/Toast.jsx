// src/components/ui/Toast.jsx

import React from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'; // Using Heroicons for a closer match
import { XMarkIcon } from '@heroicons/react/20/solid';
import { clsx } from 'clsx';

export default function Toast({ t, type = 'success', title, message }) {
  const isSuccess = type === 'success';

  // This structure and styling directly matches the Tailwind UI example.
  return (
    <div
      className={clsx(
        'w-full max-w-sm overflow-hidden bg-background dark:bg-slate-800/50 rounded-xl shadow-lg',
        t.visible ? 'animate-enter' : 'animate-leave' // react-hot-toast animation classes
      )}
    >
      <div className="p-3">
        <div className="flex items-start">
          {/* Column 1: Icon */}
          <div className="flex-shrink-0">
            {isSuccess ? (
              <CheckCircleIcon className="w-6 h-6 text-success" aria-hidden="true" />
            ) : (
              <XCircleIcon className="w-6 h-6 text-error" aria-hidden="true" />
            )}
          </div>

          {/* Column 2: Title and Message */}
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-gray-900">{title}</p>
            <p className="mt-1 text-sm text-gray-500">{message}</p>
          </div>

          {/* Column 3: Close Button */}
          <div className="flex flex-shrink-0 ml-4">
            <button
              type="button"
              className="inline-flex text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              onClick={() => toast.dismiss(t.id)}
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}