import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

export default function Modal({ isOpen, onClose, title, children, size = 'default' }) {
  

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    if (isOpen) {
      const originalOverflow = window.getComputedStyle(document.body).overflow;
      const originalPaddingRight = window.getComputedStyle(document.body).paddingRight;

      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset'; // Use unset for better compatibility
      document.body.style.paddingRight = '0px';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);


  const sizeStyles = {
    default: 'max-w-xl max-h-[90vh]',
    screen: 'w-full h-[95vh] max-w-7xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-background/80 backdrop-blur-lg flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            onClick={(e) => e.stopPropagation()}
            className={clsx(
              "relative bg-card text-text-primary rounded-2xl border border-text-muted/20 w-full flex flex-col",
              sizeStyles[size]
            )}
          >
            {/* Modal Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-text-muted/10">
              <h3 className="text-lg font-bold">{title}</h3>
              <button
                onClick={onClose}
                className="p-1 rounded-full text-text-secondary hover:bg-background transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8 flex-1 min-h-0 overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}