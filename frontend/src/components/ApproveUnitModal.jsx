import React, { useState, useEffect } from 'react';
import Button from './ui/Button';
import { X, Home, AlertCircle } from 'lucide-react';

export default function ApproveUnitModal({ isOpen, onClose, onConfirm, pendingContract }) {
  // Initialize form state
  const [formData, setFormData] = useState({
    unitNumber: '',
    floor: '',
    streetAddress: '',
    subdistrict: '',
    district: '',
    province: '',
    zipCode: ''
  });

  // Helper: Extract the cleanest possible address string to show the user
  const getDetectedAddress = () => {
    if (!pendingContract) return '';
    
    // 1. Try to get "Unit:" from the fingerprint (Cleanest)
    const fingerprint = pendingContract.fingerprintDisplay || pendingContract.fingerprint || '';
    const parts = fingerprint.split('|');
    const unitPart = parts.find(p => p.trim().startsWith('Unit:'));
    
    if (unitPart) {
      return unitPart.split(':')[1].trim();
    }

    // 2. Fallback to the raw identifier from the database
    return pendingContract.unmatchedUnitIdentifier || 'Unknown Address';
  };

  const detectedAddress = getDetectedAddress();

  // Pre-fill logic
  useEffect(() => {
    if (pendingContract && isOpen) {
      // Example: "22/7, Condo One, Sukhumvit 71"
      const rawString = pendingContract.unmatchedUnitIdentifier || '';
      const parts = rawString.split(',');
      
      setFormData({
        unitNumber: parts[0]?.trim() || '', // Guess the first part is Unit #
        floor: '',
        streetAddress: parts.slice(1).join(', ').trim() || rawString, // Put the rest in Street
        subdistrict: '',
        district: '',
        province: '', 
        zipCode: ''
      });
    }
  }, [pendingContract, isOpen]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-background/50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
               <Home size={20} />
            </div>
            <div>
                <h2 className="text-lg font-bold text-text-primary leading-tight">Add New Unit</h2>
                <p className="text-xs text-text-secondary">Create a unit profile to approve this contract.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-1 hover:bg-background rounded-md">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-6">
            
            {/* --- DETECTED ADDRESS BOX --- */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="font-semibold text-blue-800 dark:text-blue-200 mb-1">
                        Detected from Contract:
                    </p>
                    <p className="font-mono bg-white dark:bg-black/20 px-2 py-1 rounded border border-blue-200 dark:border-blue-800 text-text-primary break-all">
                        {detectedAddress}
                    </p>
                    <p className="mt-2 text-blue-600 dark:text-blue-300 text-xs">
                        Please split this address into the fields below. Correct details are required for legal verification.
                    </p>
                </div>
            </div>

            {/* Form */}
            <form id="create-unit-form" onSubmit={handleSubmit} className="space-y-4">
            
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-muted mb-1.5">Unit Number *</label>
                  <input required name="unitNumber" value={formData.unitNumber} onChange={handleChange} className="w-full p-2.5 text-sm border border-input rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" placeholder="e.g. 88/1" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-muted mb-1.5">Floor</label>
                  <input name="floor" value={formData.floor} onChange={handleChange} className="w-full p-2.5 text-sm border border-input rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" placeholder="e.g. 12" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-text-muted mb-1.5">Street Address / Building *</label>
                <input required name="streetAddress" value={formData.streetAddress} onChange={handleChange} className="w-full p-2.5 text-sm border border-input rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-muted mb-1.5">Subdistrict</label>
                  <input name="subdistrict" value={formData.subdistrict} onChange={handleChange} className="w-full p-2.5 text-sm border border-input rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-muted mb-1.5">District *</label>
                  <input required name="district" value={formData.district} onChange={handleChange} className="w-full p-2.5 text-sm border border-input rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-muted mb-1.5">Province *</label>
                  <input required name="province" value={formData.province} onChange={handleChange} className="w-full p-2.5 text-sm border border-input rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-text-muted mb-1.5">Zip Code *</label>
                  <input required name="zipCode" value={formData.zipCode} onChange={handleChange} className="w-full p-2.5 text-sm border border-input rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                </div>
              </div>
            </form>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border bg-background/50 rounded-b-xl flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" form="create-unit-form">Confirm & Create</Button>
        </div>

      </div>
    </div>
  );
}