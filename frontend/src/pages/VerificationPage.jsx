// src/pages/VerificationPage.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPublicVerificationData } from '../services/api';
import Loader from '../components/Loader';
import Button from '../components/ui/Button';
import { CheckCircle, XCircle, FileText, Copy, Eye, Share2, ExternalLink, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { showSuccessToast } from '../components/Notifications';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import ShareModal from '../components/ShareModal';

const DetailItem = ({ label, value, className = '' }) => (
    <div className={className}>
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{label}</p>
        <p className="text-lg text-text-primary font-medium break-words">{value}</p>
    </div>
);

export default function VerificationPage() {
    const { docHash } = useParams();
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    useEffect(() => {
        if (docHash) {
            getPublicVerificationData(docHash)
                .then(setData)
                .catch(err => setError(err.response?.data?.message || 'Failed to verify document.'))
                .finally(() => setIsLoading(false));
        }
    }, [docHash]);

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        showSuccessToast("Copied to clipboard!");
    };

    if (isLoading) return <div className="flex justify-center items-center h-[80vh]"><Loader /></div>;

    if (error) {
        return (
            <div className="text-center p-8 max-w-lg mx-auto bg-card rounded-2xl shadow-xl border border-error/20">
                <XCircle className="w-16 h-16 mx-auto text-error mb-4" />
                <h1 className="text-2xl font-bold text-error">Verification Failed</h1>
                <p className="text-text-secondary mt-2">{error}</p>
                <Link to="/" className="text-primary hover:underline mt-6 inline-block">Return to Homepage</Link>
            </div>
        );
    }

    if (!data) return <div className="text-center p-4">No data found.</div>;
    
    const fingerprintDetails = data.fingerprint.split('|').reduce((acc, part) => {
        const delimiterIndex = part.indexOf(':');
        if (delimiterIndex !== -1) {
            const key = part.substring(0, delimiterIndex).trim();
            const value = part.substring(delimiterIndex + 1).trim();
            acc[key] = value;
        }
        return acc;
    }, {});

    const isTerminated = data.contractStatus === 'terminated';

    return (
        <>
            <div className={`relative w-full max-w-4xl mx-auto bg-card rounded-2xl shadow-2xl border border-text-muted/10 overflow-hidden ${isTerminated && 'opacity-70'}`}>
                <img src="/assests/logo.png" alt="Watermark" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 opacity-5 pointer-events-none" />
                <div className="relative z-10 p-8 sm:p-12 space-y-8">
                    {/* --- 1. The Verdict Header --- */}
                    <div className="text-center border-b border-text-muted/10 pb-8">
                        {isTerminated ? (
                            <>
                                <AlertTriangle className="w-16 h-16 mx-auto text-warning mb-4" />
                                <h1 className="text-4xl font-extrabold text-warning tracking-wider uppercase">Contract Terminated</h1>
                                <p className="text-text-secondary mt-2">This contract was authentic but is no longer active. The original record remains on the blockchain.</p>
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-16 h-16 mx-auto text-success mb-4" />
                                <h1 className="text-4xl font-extrabold text-success tracking-wider uppercase">Verified</h1>
                                <p className="text-text-secondary mt-2">This document's integrity is confirmed on the Polygon Blockchain.</p>
                            </>
                        )}
                    </div>

                    {/* --- 2. The On-Chain Details Grid --- */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        {Object.entries(fingerprintDetails).map(([key, value]) => (
                            <DetailItem key={key} label={key} value={value} className={key === 'Unit' ? 'sm:col-span-2' : ''} />
                        ))}
                        <DetailItem label="Verified On (Timestamp)" value={new Date(data.onChainDetails.verifiedOn).toLocaleString()} />
                    </div>

                    {/* --- 3. Action Buttons --- */}
                    {!isTerminated && (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button onClick={() => setIsPreviewOpen(true)} className="inline-flex items-center gap-2 w-full sm:w-auto">
                            <Eye className="w-5 h-5" /> View Original Document
                        </Button>
                        <Button onClick={() => setIsShareModalOpen(true)} variant="secondary" className="inline-flex items-center gap-2 w-full sm:w-auto">
                            <Share2 className="w-5 h-5" /> Share Verification
                        </Button>
                    </div>
                        )}
                    


                    {/* --- 4. The Blockchain Seal --- */}
                    <div className="mt-4 p-4 bg-background rounded-lg">
                        {/* ... Blockchain Proof Section (Unchanged) ... */}
                    </div>
                </div>
            </div>

            <DocumentPreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} fileUrl={data.documentUrl} />
            <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} docHash={docHash} />
        </>
    );
}