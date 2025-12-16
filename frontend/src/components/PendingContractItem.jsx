import React, { useState } from 'react';
import { approveContract } from '../services/api'; 
import Button from './ui/Button';
import { FileText, ExternalLink, AlertTriangle, FileCheck } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '../components/Notifications';

export default function PendingContractItem({ 
  contract, 
  unit, 
  onUpdate, 
  onVerifyClick, 
  onPreviewClick, 
  onAddUnitClick 
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Parse Fingerprint first so we can use it in the title
  // We check all possible fingerprint fields to be safe
  const fingerprintRaw = contract.fingerprintDisplay || contract.fingerprintCanonical || contract.fingerprint || '';
  
  const contractDetails = fingerprintRaw.split('|').reduce((acc, part) => {
    const [key, value] = part.split(':');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});

  // 2. LOGIC: Best Possible Title Display
  // Priority 1: The real Unit Number (if matched)
  // Priority 2: The "Unit" field from the AI Fingerprint (Cleanest)
  // Priority 3: The raw identifier from the database (Fallback)
  // Priority 4: "New Property" (Last resort)
  const displayTitle = unit?.unitNumber 
    ? `Unit ${unit.unitNumber}` 
    : (contractDetails.Unit || contract.unmatchedUnitIdentifier || "New Property");

  // --- Standard Approve ---
  const handleStandardApprove = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await approveContract(contract.docHash);
      showSuccessToast(result.message);
      onUpdate();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to approve contract.';
      showErrorToast(message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-card shadow-sm border-border space-y-3">
      {/* Header: Shows the Smart Address */}
      <div className="flex items-center text-sm font-semibold text-text-primary">
        <FileText className="w-4 h-4 mr-2 text-primary" />
        <span>Contract for: <span className="text-primary ml-1 font-bold break-all">{displayTitle}</span></span>
      </div>

      {/* Contract Details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm text-text-secondary bg-background/50 p-3 rounded-md">
        <p><strong>Tenant:</strong> {contractDetails.Tenant || 'N/A'}</p>
        <p><strong>Rent:</strong> {contractDetails.Rent || 'N/A'}</p>
        <p><strong>From:</strong> {contractDetails.From || 'N/A'}</p>
        <p><strong>To:</strong> {contractDetails.To || 'N/A'}</p>
      </div>
      
      {/* Warning for New/Unmatched Unit */}
      {contract.unitStatus === 'unmatched' && (
        <div className="flex items-start text-sm text-info bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-3 rounded-md border border-blue-100 dark:border-blue-800">
            <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
            <span>
              <strong>New Property Detected:</strong> The address "<em>{contractDetails.Unit || contract.unmatchedUnitIdentifier}</em>" is not in your portfolio. 
              Click "Add Unit & Approve" to create it.
            </span>
        </div>
      )}

      {error && <p className="text-sm text-center text-error pt-2">{error}</p>}
    
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button onClick={() => onPreviewClick(contract.contractS3Key)} variant="secondary" className="text-xs h-9">
          <ExternalLink size={14} className="mr-1"/> Preview
        </Button>
        
        {contract.unitStatus === 'unmatched' ? (
          // CASE 1: Unmatched -> Call Parent's Handler
          <Button onClick={() => onAddUnitClick(contract)} className="bg-accent hover:bg-hover-teal">
              Add Unit & Approve
          </Button>
        ) : (
          // CASE 2: Matched -> Verify or Approve
          (unit && unit.isVerified) ? (
              <Button onClick={handleStandardApprove} isLoading={isLoading}>
                  Review & Approve
              </Button>
          ) : (
              <Button 
                  onClick={() => unit && onVerifyClick(unit)} 
                  disabled={!unit} 
                  variant="secondary"
                  className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200"
              >
                  <FileCheck size={14} className="mr-1" />
                  {unit ? 'Verify Deed' : 'Unit Data Missing'}
              </Button>
          )
        )}
      </div>
    </div>
  );
}