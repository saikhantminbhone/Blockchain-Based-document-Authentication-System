// src/components/Header.jsx

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { showSuccessToast } from '../components/Notifications';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    showSuccessToast('Logout Successful!');
    setIsOpen(false);
    navigate('/');
  };

  return (
    <header className="bg-background border-b border-gray-200 dark:border-slate-700">
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 py-4 lg:px-6" aria-label="Global">
        {/* Logo */}
        <div className="flex items-center">
          <NavLink to="/" className="flex items-center gap-2">
            <img
              className="h-10 w-10"
              src={`/assests/logo.png`}
              alt="Block Lease Logo"
            />
            <span className="text-primary font-bold text-xl">Block Lease</span>
          </NavLink>
        </div>

        {/* Mobile Buttons & Menu Toggle */}
        <div className="flex items-center gap-2 lg:hidden">
          {/* Show Register button if logged out */}
          {!isAuthenticated && (
            <NavLink
              to="/register"
              className="bg-primary text-white text-sm font-semibold rounded-xl px-6 py-2.5 hover:bg-hover-blue transition-colors duration-200 shadow-md hover:shadow-lg"
            >
             Register
            </NavLink>
          )}

          {/* --- NEW: Show Logout button if logged in --- */}
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="bg-primary text-white text-sm font-semibold rounded-xl px-6 py-2.5 hover:bg-hover-blue transition-colors duration-200 shadow-md hover:shadow-lg"
            >
              Logout
            </button>
          )}
          
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-primary hover:text-hoverBlue"
            onClick={() => setIsOpen(!isOpen)}
          >
            <span className="sr-only">Open main menu</span>
            <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
              {isOpen ? (
                <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Desktop Menu */}
        <div className="hidden lg:flex lg:items-center lg:gap-8">
          <NavLink to="/product" className="text-sm font-medium text-text-primary hover:text-hover-blue">Product</NavLink>
          <NavLink to="/blog" className="text-sm font-medium text-text-primary hover:text-hover-blue">Blog</NavLink>
          <NavLink to="/about" className="text-sm font-medium text-text-primary hover:text-hover-blue">About Us</NavLink>
        </div>

        {/* Desktop Right Side */}
        <div className="hidden lg:flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-text-secondary">Welcome, {user?.name.split(' ')[0]}</span>
              <NavLink to="/dashboard" className="text-sm font-medium text-primary hover:text-hover-blue">
                Dashboard
              </NavLink>
              <button
                onClick={handleLogout}
                className="bg-primary text-white text-sm font-semibold rounded-xl px-4 py-2 hover:bg-hover-blue transition-colors duration-200 shadow-md hover:shadow-lg"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="text-sm font-medium text-primary hover:text-hover-blue">
                Landlord Login
              </NavLink>
              <NavLink
                to="/register"
                className="bg-primary text-white text-sm font-semibold rounded-xl px-4 py-2 hover:bg-hover-blue transition-colors duration-200 shadow-md hover:shadow-lg"
              >
                Landlord Register 
              </NavLink>
            </>
          )}
        </div>
      </nav>

      {/* Mobile Slide Down Menu */}
      {isOpen && (
        <div className="lg:hidden bg-background px-4 pt-4 pb-6 space-y-4 shadow-md border-t border-gray-200">
          <NavLink to="/product" onClick={() => setIsOpen(false)} className="block text-text-primary hover:text-hover-blue">Product</NavLink>
          <NavLink to="/blog" onClick={() => setIsOpen(false)} className="block text-text-primary hover:text-hover-blue">Blog</NavLink>
          <NavLink to="/about" onClick={() => setIsOpen(false)} className="block text-text-primary hover:text-hover-blue">About Us</NavLink>
          <hr className="border-gray-300" />

          {isAuthenticated ? (
            <>
              <NavLink to="/dashboard" onClick={() => setIsOpen(false)} className="block text-primary hover:text-hover-blue font-semibold">
                Go to Dashboard
              </NavLink>
              <button
                onClick={handleLogout}
                className="w-full text-left block text-error font-semibold"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" onClick={() => setIsOpen(false)} className="block text-primary hover:text-hover-blue">
                Landlord Login
              </NavLink>
              <NavLink
                to="/register"
                onClick={() => setIsOpen(false)}
                className="block text-center bg-primary text-white text-sm font-semibold rounded-xl px-4 py-2 hover:bg-hover-blue transition-colors duration-200 shadow-md hover:shadow-lg"
              >
                Landlord Register 
              </NavLink>
            </>
          )}
        </div>
      )}
    </header>
  );
}