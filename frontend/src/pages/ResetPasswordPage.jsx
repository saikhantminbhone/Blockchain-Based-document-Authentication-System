// src/pages/ResetPasswordPage.jsx

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { resetPassword } from '../services/api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { showSuccessToast, showErrorToast } from '../components/Notifications';
import { Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { token } = useParams();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password.length < 8) {
            showErrorToast("Password must be at least 8 characters long.");
            return;
        }
        if (password !== confirmPassword) {
            showErrorToast("Passwords do not match.");
            return;
        }
        setIsLoading(true);
        try {
            const response = await resetPassword(token, password);
            showSuccessToast(response.message);
            navigate('/login');
        } catch (err) {
            showErrorToast(err.response?.data?.message || 'An error occurred.');
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center h-full pt-10 px-4">
            <Card className="w-full max-w-md p-8 space-y-6">
                <h2 className="text-3xl font-bold text-center">Set a New Password</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="New Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-2 border rounded-md"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                    <input
                        type="password"
                        placeholder="Confirm New Password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="w-full px-4 py-2 border rounded-md"
                    />
                    <Button type="submit" isLoading={isLoading} className="w-full">
                        Reset Password
                    </Button>
                </form>
            </Card>
        </div>
    );
}