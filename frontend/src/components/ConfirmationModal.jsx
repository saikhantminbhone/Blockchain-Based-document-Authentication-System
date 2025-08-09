// src/components/ConfirmationModal.jsx

import React from 'react';
import Modal from './Modal';
import Button from './ui/Button';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  isLoading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 mx-auto text-error mb-4" />
        <p className="text-text-secondary mb-6">{message}</p>
        <div className="flex justify-center items-center gap-4">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button onClick={onConfirm} isLoading={isLoading} className="bg-error hover:bg-error/80">
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}