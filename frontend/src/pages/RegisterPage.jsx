// src/pages/RegisterPage.jsx (Full Code with Social Login)
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { registerLandlord, loginWithGoogle } from '../services/api';
import Button from '../components/ui/Button';
import { GoogleLogin } from '@react-oauth/google';
import { showSuccessToast, showErrorToast } from '../components/Notifications';

export default function RegisterPage() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [view, setView] = useState('form');

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await registerLandlord(formData.name, formData.email, formData.password, formData.phone);
            setView('check_email');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed.');
            showErrorToast(err.response?.data?.message);
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        setIsLoading(true);
        try {
            const { token, landlord, isNewUser } = await loginWithGoogle(credentialResponse.credential);
            login(token, landlord);
            if (isNewUser) {
                navigate('/kyc');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Google Sign-Up failed.');
            setIsLoading(false);
        }
    };


        if (view === 'check_email') {
        return (
            <div className="text-center p-8 max-w-md mx-auto bg-card rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-success">Registration Successful!</h2>
                <p className="mt-4 text-text-secondary">We've sent a verification link to **{formData.email}**. Please check your inbox and click the link to activate your account.</p>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center h-full pt-10">
            <div className="w-full max-w-md p-8 space-y-4 bg-card rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-center">Create Your Account</h2>



                {error && <p className="text-sm text-error text-center">{error}</p>}

                <form onSubmit={handleEmailSubmit} className="space-y-3">
                    {/* --- INPUT FIELDS ADDED BACK --- */}
                    <input
                        type="text"
                        name="name"
                        placeholder="Full Name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border rounded-md dark:bg-background dark:border-text-secondary focus:outline-none focus:ring focus:ring-info text-primary"
                    />
                    <input
                        type="email"
                        name="email"
                        placeholder="Email Address"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border rounded-md dark:bg-background dark:border-text-secondary focus:outline-none focus:ring focus:ring-info text-primary"
                    />
                    <input
                        type="password"
                        name="password"
                        placeholder="Password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border rounded-md dark:bg-background dark:border-text-secondary focus:outline-none focus:ring focus:ring-info text-primary"
                    />
                    <input
                        type="tel"
                        name="phone"
                        placeholder="Phone Number (Optional)"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border rounded-md dark:bg-background dark:border-text-secondary focus:outline-none focus:ring focus:ring-info text-primary"
                    />
                    {/* --- END OF ADDED FIELDS --- */}

                    <Button type="submit" isLoading={isLoading} className="w-full px-6 py-3">Create Account with Email</Button>
                </form>
                <div className="relative my-4 flex items-center">
                    <div className="flex-grow border-t border-text-muted"></div>
                    <span className="mx-4 flex-shrink text-sm text-text-secondary">OR</span>
                    <div className="flex-grow border-t border-text-muted"></div>
                </div>
                <div className="flex flex-col items-center gap-4">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError('Google login failed.')}
                        size="large"
                    />
                </div>
                <p className="text-center text-sm mt-6">Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Log in</Link></p>
            </div>
        </div>
    );
}