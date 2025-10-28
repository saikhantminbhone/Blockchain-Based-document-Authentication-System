// src/pages/ForgotPasswordPage.jsx

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { showSuccessToast, showErrorToast } from '../components/Notifications';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage('');
        try {
            const response = await forgotPassword(email);
            showSuccessToast(response.message);
            setMessage(response.message); // Show success message on the page
        } catch (err) {
            showErrorToast(err.response?.data?.message || 'An error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center h-full pt-10 px-4">
            <Card className="w-full max-w-md p-8 space-y-6">
                <h2 className="text-3xl font-bold text-center">Forgot Your Password?</h2>
                <p className="text-center text-text-secondary">
                    No problem. Enter your email address below and we'll send you a link to reset it.
                </p>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full px-4 py-2 border rounded-md"
                    />
                    <Button type="submit" isLoading={isLoading} className="w-full">
                        Send Reset Link
                    </Button>
                </form>

                {message && (
                    <p className="text-center text-sm text-success">{message}</p>
                )}

                <p className="text-center text-sm mt-6">
                    Remembered your password?{' '}
                    <Link to="/login" className="font-medium text-primary hover:underline">
                        Log in here
                    </Link>
                </p>
            </Card>
        </div>
    );
}