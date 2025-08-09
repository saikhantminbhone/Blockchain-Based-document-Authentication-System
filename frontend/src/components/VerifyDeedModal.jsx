// src/components/VerifyDeedModal.jsx

import React, { useState } from 'react';
import { verifyUnitDeed } from '../services/api'; // We will add this to api.js
import Modal from './Modal';
import Button from './ui/Button';
import FileUploader from './FileUploader';
import { showSuccessToast } from './Notifications';

export default function VerifyDeedModal({ unit, isOpen, onClose, onUnitVerified }) {
  const [titleDeedFile, setTitleDeedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [utilityBillFile, setUtilityBillFile] = useState(null);

  const handleClose = () => {
    setTitleDeedFile(null);
    setUtilityBillFile(null); 
    setError('');
    setIsLoading(false);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!titleDeedFile || !utilityBillFile) {
      showErrorToast("Both a Title Deed and a Utility Bill are required.");
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('titleDeed', titleDeedFile);
      formData.append('utilityBill', utilityBillFile);
      
      await verifyUnitDeed(unit._id, formData);
      
      showSuccessToast('Documents submitted for verification!');
      onUnitVerified(); // Tell the dashboard to refresh
      handleClose();    // Close the modal
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!unit) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Verify Title Deed for ${unit.unitNumber}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-text-secondary">
          Upload a clear scan or photo of the title deed for this property. Our AI will verify its authenticity and ownership.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">1. Title Deed Scan</label>
                <FileUploader onFileSelect={setTitleDeedFile} title="Upload Title Deed" />
                {titleDeedFile && <p className="text-xs mt-1 text-text-muted">{titleDeedFile.name}</p>}
            </div>
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">2. Utility Bill Scan</label>
                <FileUploader onFileSelect={setUtilityBillFile} title="Upload Utility Bill" />
                {utilityBillFile && <p className="text-xs mt-1 text-text-muted">{utilityBillFile.name}</p>}
            </div>
        </div>

        
        {error && <p className="text-sm text-center text-error bg-error/10 p-2 rounded-md">{error}</p>}

        <Button type="submit" isLoading={isLoading} className="w-full bg-accent hover:bg-hover-teal">
          {isLoading ? 'Verifying with AI...' : 'Submit for Verification'}
        </Button>
      </form>
    </Modal>
  );
}