// src/pages/HomePage.jsx

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import FileUploader from '../components/FileUploader';
import Loader from '../components/Loader.jsx';
import VerificationResult from '../components/VerificationResult';
import Modal from '../components/Modal.jsx';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ServicesSection from '../components/ServiceSection';
import BlockchainWorkSection from '../components/BlockchainWorkSection.jsx';
import TestimonialsSection from '../components/TestimonialsSection.jsx';
import { showSuccessToast, showErrorToast } from '../components/Notifications';
import { toast } from 'react-hot-toast';
import { initiateContract, sendInvitation, verifyDocument } from '../services/api';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'; // Import XCircle

export default function HomePage() {
  const [step, setStep] = useState('upload');
  const [result, setResult] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [docHashForInvite, setDocHashForInvite] = useState('');
  const [landlordEmail, setLandlordEmail] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [modalError, setModalError] = useState('');
  const navigate = useNavigate();

  const handleReset = () => {
    setStep('upload');
    setResult(null);
    setUploadedFile(null);
    setDocHashForInvite('');
    setLandlordEmail('');
    setTenantEmail('');
    setModalError('');
  };

  const handleFileSelect = async (file) => {
    if (!file) {
      handleReset();
      return;
    }
    setUploadedFile(file);
    setStep('verifying');
    setResult(null);
    const toastId = toast.loading('Verifying document...');

    try {
      const verificationData = await verifyDocument(file);
      toast.dismiss(toastId);
      
      if (verificationData.verified) {
        showSuccessToast("Document verified successfully!");
        navigate(`/verify/${verificationData.docHash}`);
      } else {
        setResult(verificationData);
        setStep('result');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'An unexpected error occurred.';
      showErrorToast(errorMessage);
      setResult({ isError: true, message: errorMessage });
      setStep('result');
      toast.dismiss(toastId);
    }
  };

  const handleInitiateContract = async () => {
    if (!uploadedFile || !tenantEmail) {
        showErrorToast("Please enter the tenant's email address to register the contract.");
        return;
    }
    setStep('initiating');
    const toastId = toast.loading('Registering contract...');
    try {
      const initiationData = await initiateContract(uploadedFile, tenantEmail);
      toast.dismiss(toastId);
      
      if (initiationData.status === 'landlord_not_found') {
        setDocHashForInvite(initiationData.docHash);
        setStep('invite');
      } else if (initiationData.status === 'already_approved') {
        showSuccessToast(initiationData.message);
        navigate(`/verify/${initiationData.docHash}`);
      } else {
        setResult(initiationData); 
        setStep('result');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to initiate registration.';
      showErrorToast(errorMessage);
      setResult({ isError: true, message: errorMessage });
      setStep('result');
    }
  };

  const handleSendInvitation = async (e) => {
    e.preventDefault();
    setStep('initiating');
    setModalError('');

    try {
      const inviteResult = await sendInvitation(docHashForInvite, landlordEmail);
      showSuccessToast(inviteResult.message);
      handleReset();
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to send invitation.';
      setModalError(errorMessage);
      setStep('invite');
    }
  };

  const renderVerifier = () => {
    switch (step) {
      case 'verifying':
      case 'initiating':
        return <div className="py-20"><Loader /></div>;

      case 'result':
        if (!result) return null;

        // --- THIS IS THE FIX: A new, dedicated view for AI validation errors ---
        if (result.isError) {
            return (
                <div className="text-center p-6 space-y-4">
                    <XCircle className="w-12 h-12 mx-auto text-error" />
                    <h3 className="text-xl font-bold text-error">Validation Failed</h3>
                    <p className="text-text-secondary">{result.message}</p>
                    <Button onClick={handleReset} variant="secondary">Try Again</Button>
                </div>
            );
        }
        
        if (result.status === 'pending_approval' || result.status === 'already_pending') {
          return (
            <div className="text-center p-4 space-y-4">
                <CheckCircle2 className="w-12 h-12 mx-auto text-success" />
                <h3 className="text-xl font-bold text-text-primary">Request Sent</h3>
                <p className="text-text-secondary">{result.message}</p>
                <Button onClick={handleReset}>Verify Another Document</Button>
            </div>
          );
        }
        
        if (!result.verified) {
          return (
            <div className="text-center space-y-4 p-4">
              <VerificationResult result={result} />
              <p className="text-sm text-text-secondary">
                This document is not yet registered. Please provide the tenant's email to proceed.
              </p>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1 text-left">Tenant's Email Address *</label>
                <input
                    type="email"
                    placeholder="Enter tenant's email for notifications"
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2 border rounded-md"
                />
              </div>
              <div className="flex justify-center items-center gap-4">
                <Button onClick={handleReset} variant="secondary">Cancel</Button>
                <Button onClick={handleInitiateContract} className="bg-primary hover:bg-hover-blue">
                  Register This Contract
                </Button>
              </div>
            </div>
          );
        }
        
        return null;

      case 'upload':
      default:
        return <FileUploader onFileSelect={handleFileSelect} title="Drag & drop a document, or click to select" />;
    }
  };

  return (
    <div className="space-y-24 md:space-y-32">
      <section className="text-center pt-10 pb-20">
        <h1 className="text-4xl md:text-6xl font-extrabold text-text-primary mb-4">
          Immutable Trust for Every Document
        </h1>
        <p className="max-w-3xl mx-auto text-lg text-text-secondary mb-10">
          Instantly verify rental agreements on the blockchain. Eliminate fraud and uncertainty with a permanent, tamper-proof record.
        </p>
        <Card className="w-full max-w-2xl mx-auto">
          {renderVerifier()}
        </Card>
      </section>

      <Modal isOpen={step === 'invite'} onClose={handleReset} title="Invite Landlord">
        <form onSubmit={handleSendInvitation} className="space-y-4">
          <p className="text-sm text-text-secondary">The landlord for this contract isn't in our system. Please enter their email to send an invitation.</p>
          <input type="email" placeholder="Landlord's email address" value={landlordEmail} onChange={(e) => {
              setLandlordEmail(e.target.value);
              setModalError('');
          }} required className="w-full px-4 py-2 border rounded-md" />
          {modalError && <p className="text-sm text-error text-center">{modalError}</p>}
          <Button type="submit" isLoading={step === 'initiating'} className="w-full">Send Invitation</Button>
        </form>
      </Modal>

      <ServicesSection />
      <BlockchainWorkSection />
      <TestimonialsSection />
    </div>
  );
}