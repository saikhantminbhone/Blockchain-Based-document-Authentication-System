// src/components/PendingContractItem.jsx

import React, { useState } from 'react';
import { approveContract, approveAndCreateUnit } from '../services/api';
import Button from './ui/Button';
import { FileText, ExternalLink, AlertTriangle,FileCheck } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '../components/Notifications'; 

export default function PendingContractItem({ contract, unit, onApproved, onVerifyClick, onPreviewClick }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const isUnitVerified = unit && unit.isVerified;

  const contractDetails = contract.fingerprint.split('|').reduce((acc, part) => {
    const [key, value] = part.split(':');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});

  const handleApprove = async () => {
    setIsLoading(true);
    setError('');
    try {
      let result;
      if (contract.unitStatus === 'unmatched') {
        result = await approveAndCreateUnit(contract.docHash);
      } else {
        result = await approveContract(contract.docHash);
      }
      showSuccessToast(result.message);
      onApproved();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to approve contract.';
      showErrorToast(message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-3 border rounded-lg bg-background space-y-3">
      <div className="flex items-center text-sm font-semibold text-text-primary">
        <FileText className="w-4 h-4 mr-2" />
        <span>Contract Details for Unit: {unit?.unitNumber || contract.unmatchedUnitIdentifier}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm text-text-secondary">
        <p><strong>Tenant:</strong> {contractDetails.Tenant || 'N/A'}</p>
        <p><strong>Rent:</strong> {contractDetails.Rent || 'N/A'}</p>
        <p><strong>From:</strong> {contractDetails.From || 'N/A'}</p>
        <p><strong>To:</strong> {contractDetails.To || 'N/A'}</p>
        
      </div>
      
      {contract.unitStatus === 'unmatched' && !unit && (
        <div className="flex items-center text-sm text-info bg-info/10 p-2 rounded-md">
            <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
            <span>This contract is for a new unit: <strong>{contract.unmatchedUnitIdentifier}</strong>. Approving will add it to your portfolio.</span>
        </div>
      )}

      {error && <p className="text-sm text-center text-error pt-2">{error}</p>}
     

      <div className="flex items-center justify-end gap-3 pt-2">
       {!isUnitVerified && <p className="text-xs text-warning text-right">Verify unit's deed to enable approval</p>}
        <Button onClick={() => onPreviewClick(contract.contractS3Key)} variant="secondary" className="inline-flex items-center gap-1">
          <ExternalLink size={14} /> Preview
        </Button>
        
         
        {isUnitVerified || contract.unitStatus === 'unmatched' ? (
          <Button onClick={handleApprove} isLoading={isLoading} className="bg-accent hover:bg-hover-teal">
            {contract.unitStatus === 'unmatched' ? 'Add Unit & Approve' : 'Review & Approve'}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button onClick={() => onVerifyClick(unit)} variant="secondary" className="inline-flex items-center gap-1">
                <FileCheck size={14} /> Verify
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}