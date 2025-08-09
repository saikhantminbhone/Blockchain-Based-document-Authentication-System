// src/pages/LoginPage.jsx (Full Code with Social Login)
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { loginLandlord, loginWithGoogle } from '../services/api';
import Button from '../components/ui/Button';
import { showSuccessToast, showErrorToast } from '../components/Notifications'; 
import { GoogleLogin } from '@react-oauth/google';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const response = await loginLandlord(email, password);
            login(response.token, response.landlord);
            showSuccessToast('You have been logged in successfully!');
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed.');
            showErrorToast(err.response?.data?.message);
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        setIsLoading(true);
        try {
            const { token, landlord, isNewUser } = await loginWithGoogle(credentialResponse.credential);
            login(token, landlord);
            showSuccessToast('Google Sign-In Successful!');
            if (isNewUser) {
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

    return (
        <div className="flex items-center justify-center pt-10">
            <div className="w-full max-w-md p-8 space-y-4 bg-card rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-center">Welcome Back</h2>
                
 
                <form onSubmit={handleEmailSubmit} className="space-y-3">
                    {/* --- INPUT FIELDS ADDED BACK --- */}
                    <input
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full px-4 py-2 border rounded-md dark:bg-background dark:border-text-secondary focus:outline-none focus:ring focus:ring-info text-primary"
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-4 py-2 border rounded-md dark:bg-background dark:border-text-secondary focus:outline-none focus:ring focus:ring-info text-primary"
                    />
                    {/* --- END OF ADDED FIELDS --- */}

                    {error && <p className="text-sm text-error text-center">{error}</p>}
                    <Button type="submit" isLoading={isLoading} className="w-full px-6 py-3">Log In with Email</Button>
                </form>

                <div className="relative my-4 flex items-center">
                    <div className="flex-grow border-t border-text-muted"></div>
                    <span className="mx-4 flex-shrink text-sm text-text-secondary">OR</span>
                    <div className="flex-grow border-t border-text-muted"></div>
                </div>

                  <div className="flex flex-col items-center gap-4 pt-4">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError('Google login failed.')}
                        size="large"
                    />
                </div>


                

                <p className="text-center text-sm mt-6">Don't have an account? <Link to="/register" className="font-medium text-primary hover:underline">Register here</Link></p>
            </div>
        </div>
    );
}