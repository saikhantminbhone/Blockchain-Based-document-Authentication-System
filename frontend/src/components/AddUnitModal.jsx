import React, { useState } from 'react';
import { createUnit } from '../services/api';
import Modal from './Modal';
import Button from './ui/Button';
import { showSuccessToast, showErrorToast } from '../components/Notifications';
import { Home } from 'lucide-react';

export default function AddUnitModal({ isOpen, onClose, onUnitAdded }) {
  const [formData, setFormData] = useState({
      unitNumber: '',
      floor: '',
      streetAddress: '',
      subdistrict: '',
      district: '',
      province: '',
      zipCode: '',
      country: 'Thailand',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    setFormData({ 
      unitNumber: '', floor: '', streetAddress: '', subdistrict: '', 
      district: '', province: '', zipCode: '', country: 'Thailand' 
    });
    setIsLoading(false);
    onClose();
  };
  
  const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Send JSON data only (Files are handled in the Verify step now)
      const response = await createUnit(formData);
      
      showSuccessToast(response.message);
      onUnitAdded(); // Refresh dashboard
      handleClose();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create unit.';
      showErrorToast(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Property">
      <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm border border-blue-100">
         <Home size={20} />
         <p>Create a property profile first. You will verify it with the Title Deed in the next step.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Unit Number</label>
                <input name="unitNumber" placeholder="e.g. 88/1" value={formData.unitNumber} onChange={handleChange} required className="w-full p-2 border rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Floor (Optional)</label>
                <input name="floor" placeholder="e.g. 12" value={formData.floor} onChange={handleChange} className="w-full p-2 border rounded-md" />
            </div>
        </div>

        <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Street / Building</label>
            <input name="streetAddress" placeholder="e.g. The Base Condo, Sukhumvit 77" value={formData.streetAddress} onChange={handleChange} required className="w-full p-2 border rounded-md" />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Subdistrict</label>
                <input name="subdistrict" placeholder="e.g. Phra Khanong" value={formData.subdistrict} onChange={handleChange} required className="w-full p-2 border rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">District</label>
                <input name="district" placeholder="e.g. Watthana" value={formData.district} onChange={handleChange} required className="w-full p-2 border rounded-md" />
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Province</label>
                <input name="province" placeholder="e.g. Bangkok" value={formData.province} onChange={handleChange} required className="w-full p-2 border rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Postal Code</label>
                <input name="zipCode" placeholder="e.g. 10110" value={formData.zipCode} onChange={handleChange} required className="w-full p-2 border rounded-md" />
            </div>
        </div>

        <Button type="submit" isLoading={isLoading} className="w-full bg-primary hover:bg-primary-dark mt-2">
           Create Property Profile
        </Button>
      </form>
    </Modal>
  );
}