import React, { useState } from 'react';
import { terminateContract, archiveUnit, restoreUnit } from '../services/api';
import { showSuccessToast, showErrorToast } from '../components/Notifications';
import Button from './ui/Button';
import { Share2, BadgeCheck, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, Trash2, FileX2, Undo2 } from 'lucide-react';

export default function UnitListItem({ 
  unit, 
  contracts, 
  onVerifyClick, 
  onPreviewClick, 
  onUpdate, 
  onRequestConfirmation,
  onShareClick // <--- Ensure this prop is passed from Parent
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const sortedContracts = contracts ? [...contracts].sort((a, b) => new Date(b.approvedOn) - new Date(a.approvedOn)) : [];
    const latestContract = sortedContracts.length > 0 ? sortedContracts[0] : null;

    const getContractDetails = (fingerprint) => {
        if (!fingerprint) return {};
        return fingerprint.split('|').reduce((acc, part) => {
            const [key, value] = part.split(':');
            if(key && value) acc[key.trim()] = value.trim();
            return acc;
        }, {});
    };

    const handleTerminate = async (docHash) => {
        setIsLoading(true);
        try {
            const result = await terminateContract(docHash);
            showSuccessToast(result.message);
            onUpdate();
        } catch (err) {
            showErrorToast(err.response?.data?.message || 'Failed to terminate contract.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleArchive = async (unitId) => {
        setIsLoading(true);
        try {
            const result = await archiveUnit(unitId);
            showSuccessToast(result.message);
            onUpdate();
        } catch (err) {
            showErrorToast(err.response?.data?.message || 'Failed to archive unit.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleRestore = async (unitId) => {
        setIsLoading(true);
        try {
            const result = await restoreUnit(unitId);
            showSuccessToast(result.message);
            onUpdate();
        } catch (err) {
            showErrorToast(err.response?.data?.message || 'Failed to restore unit.');
        } finally {
            setIsLoading(false);
        }
    };

    const fullAddress = unit.address ? `${unit.address.streetAddress}, ${unit.address.district}, ${unit.address.province}` : "Address pending";

    return (
        <div className={`p-4 border rounded-lg bg-background transition-all ${unit.status === 'archived' ? 'opacity-60 bg-gray-50' : 'hover:shadow-sm'}`}>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div>
                    <div className="flex items-center gap-2">
                         <p className="font-bold text-lg text-text-primary">{unit.unitNumber}</p>
                         {unit.status === 'archived' && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">ARCHIVED</span>}
                    </div>
                    <p className="text-sm text-text-secondary">{fullAddress}</p>
                    
                    {unit.isVerified ? (
                        <div className="flex items-center text-sm text-success mt-1 font-medium">
                            <BadgeCheck className="w-4 h-4 mr-1" /> Verified Property
                        </div>
                    ) : (
                        <div className="flex items-center text-sm text-warning mt-1 font-medium">
                            <AlertTriangle className="w-4 h-4 mr-1" /> Verification Required
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-2 self-start sm:self-center flex-shrink-0">
                    {/* View Deed Button */}
                    {unit.titleDeedS3Key && (
                        <Button onClick={() => onPreviewClick(unit.titleDeedS3Key)} variant="secondary" size="sm">
                            View Deed
                        </Button>
                    )}

                    {/* Verify Button (Only if not verified) */}
                    {!unit.isVerified && (
                        <Button onClick={() => onVerifyClick(unit)} className="bg-accent hover:bg-hover-teal text-white" size="sm">
                            Verify Now
                        </Button>
                    )}

                    {/* Archive/Restore Actions */}
                    {unit.status === 'archived' ? (
                        <Button onClick={() => onRequestConfirmation('Restore Unit?', `Are you sure you want to restore unit ${unit.unitNumber}?`, () => handleRestore(unit._id), 'Yes, Restore')} variant="secondary" size="sm" className="text-info border-info/20 hover:bg-info/10">
                            <Undo2 className="w-4 h-4" />
                        </Button>
                    ) : (
                        <Button onClick={() => onRequestConfirmation('Archive Unit?', `Are you sure you want to archive unit ${unit.unitNumber}?`, () => handleArchive(unit._id), 'Yes, Archive')} variant="secondary" size="sm" className="text-error border-error/20 hover:bg-error/10">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Contracts List (Expandable) */}
            {latestContract && (
                <div className="mt-4 border-t border-border pt-3">
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)} 
                        className="flex items-center text-xs font-semibold text-primary w-full text-left hover:text-primary-dark transition-colors"
                    >
                       {isExpanded ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                       {isExpanded ? 'Hide Contracts' : `Show ${contracts.length} Associated Contract(s)`}
                    </button>
                    
                    {isExpanded && (
                        <div className="space-y-3 mt-3 animate-in slide-in-from-top-2 duration-200">
                            {sortedContracts.map(contract => {
                                // Fix: Get details specific to THIS contract
                                const details = getContractDetails(contract.fingerprint);
                                
                                return (
                                    <div key={contract.docHash} className="pl-4 border-l-2 border-primary/20 hover:border-primary/50 transition-colors">
                                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                            <div>
                                                <p className="font-semibold text-text-primary text-sm">
                                                    Tenant: {details.Tenant || 'Unknown'}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className={`capitalize font-medium ${contract.status === 'terminated' ? 'text-error' : 'text-success'}`}>
                                                        {contract.status || 'active'}
                                                    </span>
                                                    <span className="text-text-muted">|</span>
                                                    <span className="text-text-muted">{details.From} - {details.To}</span>
                                                </div>
                                            </div>
                                            
                                            {contract.status !== 'terminated' && (
                                                <Button 
                                                    onClick={() => onRequestConfirmation('Terminate Contract?', 'This action cannot be undone.', () => handleTerminate(contract.docHash), 'Yes, Terminate')} 
                                                    isLoading={isLoading} 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    className="text-xs text-error hover:bg-error/10 border-error/20 h-8"
                                                >
                                                    <FileX2 className="w-3 h-3 mr-1"/> Terminate
                                                </Button>
                                            )}
                                        </div>

                                        {/* Action Links */}
                                        <div className="flex items-center gap-4 mt-2 text-xs font-medium">
                                            <button onClick={() => onPreviewClick(contract.contractS3Key)} className="text-primary hover:underline flex items-center gap-1">
                                                <ExternalLink size={12} /> View Document
                                            </button>
                                            
                                            <a href={`https://amoy.polygonscan.com/tx/${contract.txHash}`} target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-primary hover:underline">
                                                Blockchain Record
                                            </a>
                                            
                                            {/* Share Button */}
                                            <button 
                                                onClick={() => {
                                                    if (onShareClick) {
                                                        onShareClick(contract.docHash);
                                                    } else {
                                                        console.error("onShareClick prop is missing!");
                                                    }
                                                }} 
                                                className="text-accent hover:text-accent-dark hover:underline inline-flex items-center gap-1"
                                            >
                                                <Share2 size={12} /> Share
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}