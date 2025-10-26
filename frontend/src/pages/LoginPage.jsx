import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { loginLandlord, loginWithGoogle, resendVerificationEmail } from '../services/api';
import Button from '../components/ui/Button';
import { showSuccessToast, showErrorToast } from '../components/Notifications'; 
import { GoogleLogin } from '@react-oauth/google';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState({ message: '', showResend: false });
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError({ message: '', showResend: false });

        try {
            const response = await loginLandlord(email, password);
            login(response.token, response.landlord);
            showSuccessToast('You have been logged in successfully!', 'Welcome Back!');
            
            if (response.landlord.kycStatus === 'pending') {
                navigate('/kyc');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Login failed.';
            if (err.response?.data?.errorCode === 'EMAIL_NOT_VERIFIED') {
                setError({ message: errorMessage, showResend: true });
            } else {
                showErrorToast(errorMessage, 'Login Failed');
            }
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        setIsLoading(true);
        try {
            const { token, landlord, isNewUser } = await loginWithGoogle(credentialResponse.credential);
            login(token, landlord);
            showSuccessToast('Google Sign-In Successful!');
            if (isNewUser || landlord.kycStatus === 'pending') {
                navigate('/kyc');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            const message = err.response?.data?.message || 'Google Sign-In failed.';
            showErrorToast(message, 'Google Sign-In Failed');
            setIsLoading(false);
        }
    };
    
    const handleResend = async () => {
        if (!email) {
            showErrorToast("Please enter your email address in the field above.", "Email Required");
            return;
        }
        try {
            const result = await resendVerificationEmail(email);
            showSuccessToast(result.message);
            setError({ message: '', showResend: false });
        } catch (err) {
            showErrorToast(err.response?.data?.message || 'Failed to send new link.');
        }
    };

    return (
        <div className="flex items-center justify-center pt-10">
            <div className="w-full max-w-md p-8 space-y-4 bg-card rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-center">Welcome Back</h2>
                
                <form onSubmit={handleEmailSubmit} className="space-y-3">
                    <input
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full px-4 py-2 border rounded-md"
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-4 py-2 border rounded-md"
                    />
                    
                    {error.message && (
                        <div className="text-sm text-error text-center">
                            {error.message}
                            {error.showResend && (
                                <button type="button" onClick={handleResend} className="ml-1 font-semibold underline hover:text-error/80">
                                    Resend verification email?
                                </button>
                            )}
                        </div>
                    )}

                    <Button type="submit" isLoading={isLoading} className="w-full px-6 py-3">Log In with Email</Button>
                </form>

                <div className="relative my-4 flex items-center">
                    <div className="flex-grow border-t border-text-muted"></div>
                    <span className="mx-4 flex-shrink text-sm text-text-secondary">OR</span>
                    <div className="flex-grow border-t border-text-muted"></div>
                </div>

                <div className="flex flex-col items-center gap-4">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => showErrorToast('Google login failed.')}
                        theme="outline"
                        size="large"
                        shape="pill"
                    />
                </div>

                <p className="text-center text-sm mt-6">Don't have an account? <Link to="/register" className="font-medium text-primary hover:underline">Register here</Link></p>
            </div>
        </div>
    );
}