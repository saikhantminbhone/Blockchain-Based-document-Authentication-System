// src/pages/RegisterPage.jsx
import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { registerLandlord, loginWithGoogle } from '../services/api';
import Button from '../components/ui/Button';
import { GoogleLogin } from '@react-oauth/google';
import { showSuccessToast, showErrorToast } from '../components/Notifications';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';

// --- Password helpers ---
const policyChecks = {
  length: (s) => s.length >= 8,
  upper: (s) => /[A-Z]/.test(s),
  lower: (s) => /[a-z]/.test(s),
  number: (s) => /[0-9]/.test(s),
  symbol: (s) => /[^A-Za-z0-9]/.test(s),
};

function validatePassword(pw) {
  const checks = {
    length: policyChecks.length(pw),
    upper: policyChecks.upper(pw),
    lower: policyChecks.lower(pw),
    number: policyChecks.number(pw),
    symbol: policyChecks.symbol(pw),
  };
  const allPassed = Object.values(checks).every(Boolean);
  return { checks, allPassed };
}

function strengthScore(pw) {
  // Score by how many requirements are met; cap at 5
  let score = 0;
  if (policyChecks.length(pw)) score++;
  if (policyChecks.upper(pw)) score++;
  if (policyChecks.lower(pw)) score++;
  if (policyChecks.number(pw)) score++;
  if (policyChecks.symbol(pw)) score++;
  return score; // 0..5
}

// A compact, policy-aligned meter
const PasswordStrengthMeter = ({ password }) => {
  const score = strengthScore(password);
  const levels = [
    { width: '0%',   color: 'bg-gray-200',         label: 'Too short' },
    { width: '20%',  color: 'bg-error',            label: 'Very weak' },
    { width: '40%',  color: 'bg-warning',          label: 'Weak' },
    { width: '60%',  color: 'bg-info',             label: 'Fair' },
    { width: '80%',  color: 'bg-success',          label: 'Strong' },
    { width: '100%', color: 'bg-success',          label: 'Very strong' },
  ];

  return (
    <div className="space-y-1">
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${levels[score].color}`}
          style={{ width: levels[score].width }}
        />
      </div>
      <p className="text-xs text-text-muted">{levels[score].label}</p>
    </div>
  );
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState('form');
  const [showPassword, setShowPassword] = useState(false);
  const [touchedPw, setTouchedPw] = useState(false);

  const { checks, allPassed } = useMemo(
    () => validatePassword(formData.password),
    [formData.password]
  );

  const handleChange = (e) => setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setTouchedPw(true);
    if (!allPassed) {
      showErrorToast('Password must be at least 8 chars and include uppercase, lowercase, number, and symbol.', 'Weak Password');
      return;
    }

    setIsLoading(true);
    try {
      await registerLandlord(formData.name, formData.email, formData.password, formData.phone);
      setView('check_email');
    } catch (err) {
      showErrorToast(err?.response?.data?.message || 'Registration failed.');
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setIsLoading(true);
      const idToken = credentialResponse?.credential;
      if (!idToken) throw new Error('Missing Google credential.');
      const data = await loginWithGoogle(idToken); // expects { token, landlord, isNewUser }
      if (!data?.token) throw new Error('Google login response missing token.');
      login(data.token, data.landlord); // your AuthContext login
      showSuccessToast('Welcome to Block Lease!');
      navigate('/dashboard');
    } catch (err) {
      showErrorToast(err?.response?.data?.message || 'Google login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  if (view === 'check_email') {
    return (
      <div className="flex items-center justify-center h-full pt-10 px-4">
        <div className="text-center p-8 max-w-md mx-auto bg-card rounded-xl shadow-lg">
          <CheckCircle2 className="w-16 h-16 mx-auto text-success mb-4" />
          <h2 className="text-2xl font-bold text-success">Registration Successful!</h2>
          <p className="mt-4 text-text-secondary">
            We've sent a verification link to <strong>{formData.email}</strong>. Please check your inbox and click the link to activate your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full px-4">
      <div className="w-full max-w-md p-8 space-y-4 bg-card rounded-xl shadow-lg">
        <h2 className="text-3xl font-bold text-center">Create Your Account</h2>

        <div className="relative my-4 flex items-center">
          <div className="flex-grow border-t border-text-muted" />
          <span className="mx-4 flex-shrink text-sm text-text-secondary">OR</span>
          <div className="flex-grow border-t border-text-muted" />
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

        <form onSubmit={handleEmailSubmit} className="space-y-4 pt-4" noValidate>
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-md"
            autoComplete="name"
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-md"
            autoComplete="email"
          />

          {/* Password with show/hide */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              onBlur={() => setTouchedPw(true)}
              required
              className={`w-full px-4 py-2 border rounded-md ${
                touchedPw && !allPassed ? 'border-error' : ''
              }`}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Strength meter */}
          {formData.password && <PasswordStrengthMeter password={formData.password} />}

          {/* Policy checklist */}
          <div className="grid grid-cols-1 gap-1 text-xs text-text-secondary">
            <Req ok={checks.length}>At least 8 characters</Req>
            <Req ok={checks.upper}>Contains an uppercase letter (A-Z)</Req>
            <Req ok={checks.lower}>Contains a lowercase letter (a-z)</Req>
            <Req ok={checks.number}>Contains a number (0-9)</Req>
            <Req ok={checks.symbol}>Contains a symbol (!@#$…)</Req>
          </div>

          <input
            type="tel"
            name="phone"
            placeholder="Phone Number (Optional)"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md"
            autoComplete="tel"
          />

          <Button
            type="submit"
            isLoading={isLoading}
            className="w-full px-6 py-3"
            disabled={!allPassed || isLoading}
            aria-disabled={!allPassed || isLoading}
            title={!allPassed ? 'Password does not meet the requirements' : undefined}
          >
            Create Account with Email
          </Button>
        </form>

        <p className="text-center text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
function Req({ ok, children }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          ok ? 'bg-success' : 'bg-gray-300'
        }`}
        aria-hidden="true"
      />
      <span className={ok ? 'text-text-muted' : ''}>{children}</span>
    </div>
  );
}
