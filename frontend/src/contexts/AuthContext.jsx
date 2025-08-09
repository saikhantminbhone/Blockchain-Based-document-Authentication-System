// src/contexts/AuthContext.jsx (Corrected Full Code)

import React, { createContext, useState, useContext, useEffect } from 'react';
import { api, setAuthToken, getMyLandlordProfile } from '../services/api';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  
  // --- The Fix: Add an explicit isAuthenticated state ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        setAuthToken(storedToken);
        try {
          const userData = await getMyLandlordProfile();
          setUser(userData.landlord);
          setIsAuthenticated(true); // Set authenticated to true on successful load
        } catch (error) {
          console.error("Token invalid, logging out:", error);
          // Clear everything on failure
          localStorage.removeItem('token');
          setAuthToken(null);
          setUser(null);
          setToken(null);
          setIsAuthenticated(false); // Explicitly set to false
        }
      }
      setIsLoading(false);
    };
    loadUser();
  }, []);

const login = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    setAuthToken(newToken);
    setIsAuthenticated(true);
   
};

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setAuthToken(null);
    setIsAuthenticated(false); // --- IMPORTANT: Set this on logout ---
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};