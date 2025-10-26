// src/components/DocumentPreviewModal.jsx

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useSpring } from 'framer-motion';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import Button from './ui/Button';

// This is the final, self-contained, high-end preview modal.
export default function DocumentPreviewModal({ isOpen, onClose, fileUrl }) {
  const [isDragging, setIsDragging] = useState(false);

  // Use Framer Motion's spring animations for all transformations for a fluid feel
  const scale = useSpring(1, { stiffness: 400, damping: 40 });
  const x = useSpring(0, { stiffness: 400, damping: 40 });
  const y = useSpring(0, { stiffness: 400, damping: 40 });
  
  const imageRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const pinchDistRef = useRef(0);
  
  // This useEffect handles all event listeners and scroll locking
  useEffect(() => {
    const node = imageRef.current;
    
    // Lock background scroll when the modal is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      return; // Don't add listeners if not open
    }

    const handleWheel = (e) => {
      e.preventDefault();
      const newScale = scale.get() - e.deltaY / 800;
      scale.set(Math.max(0.5, Math.min(newScale, 4)));
    };
    const handleMouseDown = (e) => {
      e.preventDefault();
      setIsDragging(true);
      startPosRef.current = { x: e.clientX - x.get(), y: e.clientY - y.get() };
      node.style.cursor = 'grabbing';
    };
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      x.set(e.clientX - startPosRef.current.x);
      y.set(e.clientY - startPosRef.current.y);
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      node.style.cursor = 'grab';
    };
    const handleTouchStart = (e) => {
        if (e.touches.length === 1) handleMouseDown(e.touches[0]);
        if (e.touches.length === 2) {
            initialPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        }
    }
    const handleTouchMove = (e) => {
        if (e.touches.length === 1) handleMouseMove(e.touches[0]);
        if (e.touches.length === 2) {
            const newDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            const newScale = (newDist / pinchDistRef.current) * scale.get();
            scale.set(Math.max(0.5, Math.min(newScale, 4)));
        }
    }
    const handleTouchEnd = () => setIsDragging(false);

    if (node) {
      node.addEventListener('wheel', handleWheel, { passive: false });
      node.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      node.addEventListener('touchstart', handleTouchStart, { passive: false });
      node.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }
    
    // Cleanup function to remove listeners and restore scroll
    return () => {
      document.body.style.overflow = 'unset';
      if (node) {
        node.removeEventListener('wheel', handleWheel);
        node.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        node.removeEventListener('touchstart', handleTouchStart);
        node.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [isOpen, isDragging, scale, x, y]);

  const handleClose = () => {
    scale.set(1);
    x.set(0);
    y.set(0);
    onClose();
  };

  const handleZoomIn = () => scale.set(Math.min(scale.get() + 0.5, 4));
  const handleZoomOut = () => scale.set(Math.max(scale.get() - 0.5, 0.5));
  const handleReset = () => { scale.set(1); x.set(0); y.set(0); };
  
  if (!fileUrl) return null;
  const isPdf = fileUrl.toLowerCase().includes('.pdf');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center"
        >
          {/* Main Content Area */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="w-full h-full"
          >
            {isPdf ? (
              <iframe src={fileUrl} title="Document Preview" className="w-full h-full border-0" />
            ) : (
              <motion.div
                ref={imageRef}
                className="w-full h-full"
                style={{
                  x, y, scale,
                  touchAction: 'none',
                  cursor: scale.get() > 1.01 ? (isDragging ? 'grabbing' : 'grab') : 'auto',
                }}
              >
                <img src={fileUrl} alt="Document Preview" className="w-full h-full object-contain" />
              </motion.div>
            )}
          </motion.div>
          
          {/* Floating UI Controls */}
          <motion.button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 bg-black/30 rounded-full text-white/70 hover:text-white hover:bg-black/50 transition-colors"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1, transition: { delay: 0.2 } }}
            exit={{ opacity: 0, scale: 0.5 }}
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </motion.button>
          
          {!isPdf && (
            <motion.div
              className="absolute bottom-6 bg-black/30 backdrop-blur-sm p-1 rounded-full flex items-center gap-1 z-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
              exit={{ opacity: 0, y: 20 }}
            >
              <Button onClick={handleZoomOut} variant="secondary" className="p-2 rounded-full !bg-transparent !border-0 text-white hover:!bg-white/20"><ZoomOut className="w-5 h-5" /></Button>
              <Button onClick={handleReset} variant="secondary" className="p-2 rounded-full !bg-transparent !border-0 text-white hover:!bg-white/20"><RotateCcw className="w-4 h-4" /></Button>
              <Button onClick={handleZoomIn} variant="secondary" className="p-2 rounded-full !bg-transparent !border-0 text-white hover:!bg-white/20"><ZoomIn className="w-5 h-5" /></Button>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}