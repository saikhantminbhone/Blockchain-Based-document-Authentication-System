// src/pages/VerifyEmailPage.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { verifyEmailToken, resendVerificationEmail } from '../services/api';
import { showSuccessToast, showErrorToast } from '../components/Notifications';
import Loader from '../components/Loader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function VerifyEmailPage() {
    const { token } = useParams();
    const navigate = useNavigate();
    const { login } = useAuth();
    const [status, setStatus] = useState('verifying');
    const [errorMessage, setErrorMessage] = useState('');
    const [resendEmail, setResendEmail] = useState('');
    const [isResending, setIsResending] = useState(false);
    const verificationAttempted = useRef(false);

    useEffect(() => {
        if (token && !verificationAttempted.current) {
            verificationAttempted.current = true;
            verifyEmailToken(token)
                .then(response => {
                    if (response.token && response.landlord) {
                        login(response.token, response.landlord);
                        setStatus('success');
                        setTimeout(() => navigate('/kyc'), 2000);
                    } else {
                        setStatus('info');
                        setErrorMessage(response.message);
                    }
                })
                .catch(err => {
                    setErrorMessage(err.response?.data?.message || 'Verification failed.');
                    setStatus('error');
                });
        }
    }, [token, login, navigate]);

    const handleResend = async (e) => {
        e.preventDefault();
        setIsResending(true);
        try {
            const result = await resendVerificationEmail(resendEmail);
            showSuccessToast(result.message);
            setErrorMessage("A new link has been sent. Please check your new email and close this tab.");
        } catch (err) {
            showErrorToast(err.response?.data?.message || 'Failed to send new link.');
        } finally {
            setIsResending(false);
        }
    };

    if (status === 'verifying') {
        return <div className="flex flex-col items-center justify-center h-[80vh]"><Loader /><p className="mt-4">Verifying your email...</p></div>;
    }

    if (status === 'error' || status === 'info') {
        return (
            <Card className="text-center p-8 max-w-lg mx-auto">
                <XCircle className="w-16 h-16 mx-auto text-error mb-4" />
                <h1 className="text-2xl font-bold text-error">Verification Failed</h1>
                <p className="text-text-secondary mt-2">{errorMessage}</p>
                
                <form onSubmit={handleResend} className="mt-6 space-y-3">
                    <p className="text-sm text-text-secondary">Your link may have expired. Enter your email to receive a new one.</p>
                    <input type="email" placeholder="Enter your registration email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} required className="w-full px-4 py-2 border rounded-md" />
                    <Button type="submit" isLoading={isResending}>Resend Verification Email</Button>
                </form>
            </Card>
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