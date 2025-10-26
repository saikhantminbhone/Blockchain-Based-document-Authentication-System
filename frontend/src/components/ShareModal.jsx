// src/components/ShareModal.jsx

import React from 'react';
import Modal from './Modal';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check } from 'lucide-react';
import { showSuccessToast } from '../components/Notifications';

export default function ShareModal({ isOpen, onClose, docHash }) {
  const shareUrl = `${window.location.origin}/verify/${docHash}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    showSuccessToast("Link copied to clipboard!");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Verifiable Link">
      <div className="text-center space-y-6">
        <p className="text-text-secondary">Anyone with this link or QR code can instantly verify the authenticity of this document.</p>
        <div className="flex items-center justify-center">
            <QRCodeSVG value={shareUrl} size={192} bgColor="#ffffff" fgColor="#111827" />
        </div>
        <div className="flex items-center border rounded-md p-2 bg-background">
          <input type="text" readOnly value={shareUrl} className="flex-1 bg-transparent text-sm text-text-muted outline-none" />
          <button onClick={copyToClipboard} className="p-2 rounded-md hover:bg-gray-200">
            <Copy className="w-5 h-5 text-primary" />
          </button>
        </div>
      </div>
    </Modal>
  );
}