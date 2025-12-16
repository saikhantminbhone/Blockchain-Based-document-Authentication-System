// src/components/VerifyDeedModal.jsx
import React, { useState, useEffect } from 'react';
import Button from './ui/Button';
import { Upload, CheckCircle, AlertTriangle, X, FileSearch, ShieldCheck, Edit2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { verifyDeedAnalysis, confirmDeedVerification } from '../services/api'; 

export default function VerifyDeedModal({ isOpen, onClose, unit, onVerifySuccess }) {
  const [step, setStep] = useState('upload'); // 'upload' | 'analyzing' | 'review'
  const [file, setFile] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  
  // State for Editable Data
  const [editedData, setEditedData] = useState({
    ownerName: '',
    propertyAddress: ''
  });

  const handleFileChange = (e) => {
    if (e.target.files[0]) setFile(e.target.files[0]);
  };

  // STEP 1: AI Analysis
  const handleAnalyze = async () => {
    if (!file) return;
    setStep('analyzing');
    
    try {
      const result = await verifyDeedAnalysis(unit._id, file);
      setScanResult(result);
      // Pre-fill the editable form with what the AI found
      setEditedData({
        ownerName: result.extractedData.ownerName || '',
        propertyAddress: result.extractedData.propertyAddress || ''
      });
      setStep('review');
    } catch (err) {
      console.error(err);
      toast.error("AI Scan failed. Please upload a clearer image.");
      setStep('upload');
    }
  };

  // STEP 2: Human Confirmation
  const handleConfirm = async () => {
    try {
      // Send the EDITED data, not just the AI data
      await confirmDeedVerification(unit._id, editedData);
      toast.success("Property verified successfully!");
      onVerifySuccess(); 
    } catch (err) {
      toast.error("Failed to save verification status.");
    }
  };

  // Handle Input Changes
  const handleChange = (e) => {
    setEditedData({ ...editedData, [e.target.name]: e.target.value });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl border border-border p-6 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
            <div className="flex items-center gap-2">
                <ShieldCheck className="text-primary" size={24} />
                <div>
                    <h2 className="text-xl font-bold text-text-primary">Verify Title Deed</h2>
                    <p className="text-xs text-text-secondary">AI Scan + Human Review</p>
                </div>
            </div>
            <button onClick={onClose}><X size={20} className="text-text-muted hover:text-text-primary" /></button>
        </div>

        {/* LOADING STATE */}
        {step === 'analyzing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <div>
                    <h3 className="font-bold text-lg">AI is analyzing document...</h3>
                    <p className="text-sm text-text-muted">Extracting Owner Name and Property Address.</p>
                </div>
            </div>
        )}

        {/* UPLOAD STATE */}
        {step === 'upload' && (
            <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-background/50 hover:bg-background transition-colors">
                    <input type="file" onChange={handleFileChange} accept="image/*" className="hidden" id="deed-upload" />
                    <label htmlFor="deed-upload" className="cursor-pointer flex flex-col items-center gap-2">
                        <Upload size={32} className="text-primary" />
                        <span className="text-sm text-text-secondary">Click to upload Title Deed (Image/Scan)</span>
                    </label>
                    {file && <p className="mt-2 text-sm font-semibold text-primary bg-primary/10 px-2 py-1 rounded">{file.name}</p>}
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-3 rounded text-sm flex gap-2">
                    <FileSearch size={16} className="mt-0.5 flex-shrink-0" />
                    <span><strong>Note:</strong> Ensure the text is clear. Blurred images may result in errors.</span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleAnalyze} disabled={!file}>Scan Document</Button>
                </div>
            </div>
        )}

        {/* REVIEW STATE (Editable) */}
        {step === 'review' && scanResult && (
            <div className="space-y-5 overflow-y-auto px-1">
                
                {/* AI Verdict Badge */}
                <div className={`p-4 rounded-lg border flex items-start gap-3 ${
                    scanResult.aiAnalysis.isMatch 
                    ? 'bg-green-50 border-green-200 text-green-800' 
                    : 'bg-orange-50 border-orange-200 text-orange-800'
                }`}>
                    {scanResult.aiAnalysis.isMatch ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
                    <div>
                        <p className="font-bold text-lg">{scanResult.aiAnalysis.isMatch ? "Data Match Detected" : "Review Required"}</p>
                        <p className="text-sm opacity-90">{scanResult.aiAnalysis.reason}</p>
                    </div>
                </div>

                {/* Editable Form */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase text-text-muted">Verify & Edit Data</p>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded flex items-center gap-1">
                            <Edit2 size={10} /> Editable
                        </span>
                    </div>

                    <div className="space-y-3 border p-4 rounded-lg bg-background">
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">Owner Name (from Deed)</label>
                            <input 
                                name="ownerName"
                                value={editedData.ownerName}
                                onChange={handleChange}
                                className="w-full p-2 border rounded bg-white dark:bg-black/20 text-sm focus:ring-2 ring-primary/20 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-text-secondary mb-1">Property Address (from Deed)</label>
                            <textarea 
                                name="propertyAddress"
                                value={editedData.propertyAddress}
                                onChange={handleChange}
                                rows={2}
                                className="w-full p-2 border rounded bg-white dark:bg-black/20 text-sm focus:ring-2 ring-primary/20 outline-none resize-none"
                            />
                        </div>
                    </div>
                </div>

                <p className="text-xs text-center text-text-muted">
                    If the AI made a typo, please correct it above before confirming.
                </p>

                <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                    <Button variant="secondary" onClick={() => setStep('upload')}>Retry Upload</Button>
                    <Button onClick={handleConfirm}>Confirm & Verify</Button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}