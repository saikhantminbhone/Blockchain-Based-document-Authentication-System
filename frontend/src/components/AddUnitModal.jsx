// src/components/AddUnitModal.jsx

import React, { useState } from 'react';
import { createUnit } from '../services/api';
import Modal from './Modal';
import Button from './ui/Button';
import FileUploader from './FileUploader';
import { showSuccessToast, showErrorToast } from '../components/Notifications';

export default function AddUnitModal({ isOpen, onClose, onUnitAdded }) {
  const [view, setView] = useState('form'); 
  const [formData, setFormData] = useState({
      unitNumber: '',
      streetAddress: '',
      city: '',
      province: '',
      zipCode: '',
      country: 'Thailand',
  });
  const [titleDeedFile, setTitleDeedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [utilityBillFile, setUtilityBillFile] = useState(null);
  const [mismatchData, setMismatchData] = useState(null);

  const handleClose = () => {
    // Reset all states when closing the modal
    setView('form');
    setMismatchData(null);
    setFormData({ unitNumber: '', streetAddress: '', city: '', province: '', zipCode: '', country: 'Thailand' });
    setTitleDeedFile(null);
    setIsLoading(false);
    onClose();
  };
  
  const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e, confirmedData = null) => {
    e.preventDefault();
    if (!titleDeedFile || !utilityBillFile) {
      showErrorToast("Both a title deed and a utility bill are required.");
      return;
    }
    setIsLoading(true);

    try {
      const submissionData = new FormData();
      // Use the externally provided 'confirmedData' if it exists, otherwise use component's state
      const dataToSubmit = confirmedData || formData;
      Object.keys(dataToSubmit).forEach(key => submissionData.append(key, dataToSubmit[key]));
      submissionData.append('titleDeed', titleDeedFile);
      submissionData.append('utilityBill', utilityBillFile);

      // If this is the second submission (confirming the AI's suggestion), add a flag.
      if (confirmedData) {
        submissionData.append('isConfirmed', 'true');
      }

      const response = await createUnit(submissionData);

      console.log

      // Check for the special 'address_mismatch' status from the backend
      if (result.message && result.message.includes("Mismatch")) {
        setMismatchData(response);
        setView('confirm'); // Switch to the confirmation view
      } else {
        // Otherwise, it was a success
        showSuccessToast(response.message);
        onUnitAdded(); // Refresh the dashboard
        handleClose(); // Close the modal
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create unit.';
      showErrorToast(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAiAddress = (e) => {
    const parts = mismatchData.aiSuggestedAddress.split(',').map(p => p.trim());
    if (parts.length < 4) {
        showErrorToast("AI address format is incorrect, please edit manually.");
        setView('form');
        return;
    }
    const [street, city, province, zipAndCountry] = parts;
    const [zipCode, country] = zipAndCountry ? zipAndCountry.split(' ') : ['', ''];

    const confirmedFormData = { 
        ...formData, 
        streetAddress: street || '', 
        city: city || '', 
        province: province || '', 
        zipCode: zipCode || '', 
        country: country || 'Thailand'
    };
    
    handleSubmit(e, confirmedFormData);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={view === 'form' ? "Add & Verify New Property" : "Confirm Property Address"}>
      
      {/* View 1: The Initial Form */}
      {view === 'form' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Unit / Room Number</label>
            <input name="unitNumber" placeholder="e.g., A-1205" value={formData.unitNumber} onChange={handleChange} required className="w-full p-2 border rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Street Address</label>
            <input name="streetAddress" placeholder="e.g., 123 Sukhumvit Road" value={formData.streetAddress} onChange={handleChange} required className="w-full p-2 border rounded-md" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">City / District</label>
                  <input name="city" placeholder="e.g., Khlong Toei" value={formData.city} onChange={handleChange} required className="w-full p-2 border rounded-md" />
              </div>
              <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Province</label>
                  <input name="province" placeholder="e.g., Bangkok" value={formData.province} onChange={handleChange} required className="w-full p-2 border rounded-md" />
              </div>
          </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Postal Code</label>
                  <input name="zipCode" placeholder="e.g., 10110" value={formData.zipCode} onChange={handleChange} required className="w-full p-2 border rounded-md" />
              </div>
              <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Country</label>
                  <input name="country" value={formData.country} onChange={handleChange} required className="w-full p-2 border rounded-md bg-gray-100" />
              </div>
          </div>
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
          <Button type="submit" isLoading={isLoading} className="w-full bg-accent hover:bg-hover-teal">
            {isLoading ? 'Verifying with AI...' : 'Save & Verify Unit'}
          </Button>
        </form>
      )}
      
      {/* View 2: The Confirmation Screen */}
      {view === 'confirm' && mismatchData && (
        <div className="space-y-4">
            <div className="p-4 bg-warning/10 rounded-lg text-center">
                <h4 className="font-bold text-warning">Address Mismatch Detected</h4>
                <p className="text-sm text-text-secondary">{mismatchData.message}</p>
            </div>
            <div>
                <p className="text-sm font-semibold text-text-primary">Your Input:</p>
                <p className="text-sm p-2 bg-background rounded">{mismatchData.userInputAddress}</p>
            </div>
            <div>
                <p className="text-sm font-semibold text-text-primary">AI Suggestion from Deed:</p>
                <p className="text-sm p-2 bg-background rounded">{mismatchData.aiSuggestedAddress}</p>
            </div>
            <Button onClick={handleConfirmAiAddress} isLoading={isLoading} className="w-full bg-accent hover:bg-hover-teal">
                Use AI Suggestion & Save
            </Button>
            <Button onClick={() => setView('form')} variant="secondary" className="w-full">
                Go Back & Edit My Input
            </Button>
        </div>
      )}
    </Modal>
  );
}