// src/components/UnitListItem.jsx

import React, { useState } from 'react';
import { terminateContract, archiveUnit, restoreUnit } from '../services/api';
import { showSuccessToast, showErrorToast } from '../components/Notifications';
import Button from './ui/Button';
import ShareModal from './ShareModal'; 
import { Share2, BadgeCheck, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, Trash2, FileX2, Undo2 } from 'lucide-react';

export default function UnitListItem({ unit, contracts, onVerifyClick, onPreviewClick, onUpdate, onRequestConfirmation,onShareClick }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const sortedContracts = contracts ? [...contracts].sort((a, b) => new Date(b.approvedOn) - new Date(a.approvedOn)) : [];
    const latestContract = sortedContracts.length > 0 ? sortedContracts[0] : null;

    let latestContractDetails = null;
    if (latestContract) {
        latestContractDetails = latestContract.fingerprint.split('|').reduce((acc, part) => {
            const [key, value] = part.split(':');
            if(key && value) acc[key.trim()] = value.trim();
            return acc;
        }, {});
    }


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
        <>
            <div className={`p-4 border rounded-lg bg-background ${unit.status === 'archived' && 'opacity-50'}`}>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div>
                        <p className="font-bold text-text-primary">{unit.unitNumber}</p>
                        <p className="text-sm text-text-secondary">{fullAddress}</p>
                        {unit.isVerified ? (
                            <div className="flex items-center text-sm text-success mt-1"><BadgeCheck className="w-4 h-4 mr-1" /> Title Deed Verified</div>
                        ) : (
                            <div className="flex items-center text-sm text-warning mt-1"><AlertTriangle className="w-4 h-4 mr-1" /> Verification Required</div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-center flex-shrink-0">
                        {unit.titleDeedS3Key && <Button onClick={() => onPreviewClick(unit.titleDeedS3Key)} variant="secondary" size="sm">View Deed</Button>}
                        {!unit.isVerified && <Button onClick={() => onVerifyClick(unit)} variant="secondary" size="sm">Verify Deed</Button>}
                        {unit.status === 'archived' ? (
                            <Button onClick={() => onRequestConfirmation('Restore Unit?', `Are you sure you want to restore unit ${unit.unitNumber}?`, () => handleRestore(unit._id), 'Yes, Restore')} variant="secondary" size="sm" className="text-info"><Undo2 className="w-4 h-4" /></Button>
                        ) : (
                            <Button onClick={() => onRequestConfirmation('Archive Unit?', `Are you sure you want to archive unit ${unit.unitNumber}?`, () => handleArchive(unit._id), 'Yes, Archive')} variant="secondary" size="sm" className="text-error"><Trash2 className="w-4 h-4" /></Button>
                        )}
                    </div>
                </div>

                {latestContract && (
                    <div className="mt-4 border-t border-text-muted/20 pt-4">
                        <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center text-xs font-semibold text-primary w-full text-left">
                           {isExpanded ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                           Show {contracts.length} Associated Contract(s)
                        </button>
                        {isExpanded && sortedContracts.map(contract => (
                            <div key={contract.docHash} className="mt-3 pl-5 border-l-2">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-text-primary text-sm">{latestContractDetails.Tenant}</p>
                                        <p className="text-xs text-text-secondary">Status: <span className={contract.status === 'terminated' ? 'text-error font-semibold' : 'text-success font-semibold'}>{contract.status || 'active'}</span></p>
                                    </div>
                                    {contract.status !== 'terminated' && (
                                        <Button onClick={() => onRequestConfirmation('Terminate Contract?', 'This action cannot be undone.', () => handleTerminate(contract.docHash), 'Yes, Terminate')} isLoading={isLoading} variant="secondary" size="sm" className="text-xs text-error">
                                            <FileX2 className="w-4 h-4 mr-1"/> Terminate
                                        </Button>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-xs">
                                    <button onClick={() => onPreviewClick(contract.contractS3Key)} className="text-info hover:underline">View Document</button>
                                    <a href={`https://amoy.polygonscan.com/tx/${contract.txHash}`} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">View on Blockchain</a>
                                    <button onClick={() => onShareClick(contract.docHash)} className="text-info hover:underline inline-flex items-center gap-1">
                                    <Share2 size={12} /> Share
                                </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </>
    );
}