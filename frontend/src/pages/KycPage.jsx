// src/pages/KycPage.jsx (Full & Final Code for Veriff)

import React, { useState } from 'react';
import { createVeriffSession } from '../services/api';
import Button from '../components/ui/Button'; // Assuming you have a reusable Button component
import Card from '../components/ui/Card';   // Assuming a reusable Card component

export default function KycPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const startKyc = async () => {
    setIsLoading(true);
    setError('');
    try {
      // 1. Call your backend to create a secure Veriff session for personal KYC.
      const { sessionUrl } = await createVeriffSession('kyc');
      
      // 2. Redirect the user's browser to the unique Veriff URL.
      // Veriff handles the rest of the flow from here.
      window.location.href = sessionUrl;

    } catch (err) {
      // 3. If the backend fails to create a session, show an error.
      setError(err.response?.data?.message || 'Could not start the verification process. Please try again later.');
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex items-center justify-center py-12 px-4">
      <Card className="max-w-lg text-center">
        <h1 className="text-2xl font-bold text-text-primary">Identity Verification Required</h1>
        <p className="mt-2 mb-6 text-text-secondary">
          To activate your account and secure your profile, we need to verify your identity.
          You will be redirected to our secure partner, Veriff, to complete a quick identity scan with your government-issued ID and a selfie.
        </p>
        
        {error && (
            <p className="mb-4 text-sm text-center text-error bg-error/10 p-3 rounded-md">
                {error}
            </p>
        )}
      
        <Button 
            onClick={startKyc} 
            isLoading={isLoading}
            className="w-full bg-accent hover:bg-hover-teal"
        >
            Start Secure Verification
        </Button>

        <p className="mt-4 text-xs text-text-muted">
            You will need a valid passport, national ID card, or driver's license.
        </p>
      </Card>
    </div>
  );
}