// src/pages/VerifyEmailPage.jsx

import React, { useState, useEffect, useRef } from 'react'; // 1. Import useRef
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { verifyEmailToken } from '../services/api';
import Loader from '../components/Loader';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function VerifyEmailPage() {
    const { token } = useParams();
    const navigate = useNavigate();
    const { login } = useAuth();
    const [status, setStatus] = useState('verifying');
    const [errorMessage, setErrorMessage] = useState('');
    
    // 2. Create a ref to track if verification has been attempted
    const verificationAttempted = useRef(false);

    useEffect(() => {
        // 3. Add a check to ensure this effect runs only once
        if (token && !verificationAttempted.current) {
            // Immediately mark that we are attempting verification
            verificationAttempted.current = true;

            verifyEmailToken(token)
                .then(response => {
                    login(response.token, response.landlord);
                    setStatus('success');
                    setTimeout(() => navigate('/kyc'), 2000);
                })
                .catch(err => {
                    setErrorMessage(err.response?.data?.message || 'Verification failed.');
                    setStatus('error');
                });
        }
    }, [token, login, navigate]);

    if (status === 'verifying') {
        return <div className="flex flex-col items-center justify-center h-[80vh]"><Loader /><p className="mt-4">Verifying your email...</p></div>;
    }

    if (status === 'error') {
        return (
            <div className="text-center p-8 max-w-lg mx-auto">
                <XCircle className="w-16 h-16 mx-auto text-error mb-4" />
                <h1 className="text-2xl font-bold text-error">Verification Failed</h1>
                <p className="text-text-secondary mt-2">{errorMessage}</p>
                <Link to="/register" className="text-primary hover:underline mt-6 inline-block">Try registering again</Link>
            </div>
        );
    }

    return (
        <div className="text-center p-8 max-w-lg mx-auto">
            <CheckCircle2 className="w-16 h-16 mx-auto text-success mb-4" />
            <h1 className="text-2xl font-bold text-success">Email Verified!</h1>
            <p className="text-text-secondary mt-2">Your account is now active. Redirecting you to complete your profile...</p>
        </div>
    );
}