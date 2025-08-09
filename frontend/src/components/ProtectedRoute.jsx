// src/components/ProtectedRoute.jsx (Final version for the prop-based pattern)

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import Loader from './Loader';

/**
 * This component now wraps around another component (its 'children').
 * It accepts a 'kycStatusRequired' prop to apply specific rules.
 * @param {object} props
 * @param {React.ReactNode} props.children - The page component to render (e.g., <KycPage />).
 * @param {string} [props.kycStatusRequired] - Optional status ('pending' or 'approved').
 */
const ProtectedRoute = ({ children, kycStatusRequired }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  // 1. Handle loading state first
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader />
      </div>
    );
  }

  // 2. Handle unauthenticated state
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 3. Handle KYC status requirement if the prop is provided
  // This is the new logic that uses the prop directly.
  if (kycStatusRequired && user.kycStatus !== kycStatusRequired) {
    // If the user's status does not match what's required for this route,
    // redirect them. A 'pending' user trying to access an 'approved' page
    // will be sent to '/kyc'. An 'approved' user trying to access the '/kyc'
    // page will be sent to '/dashboard'.
    const redirectTo = user.kycStatus === 'pending' ? '/kyc' : '/dashboard';
    return <Navigate to={redirectTo} replace />;
  }

  // 4. If all checks pass, render the child component
  return children;
};

export default ProtectedRoute;