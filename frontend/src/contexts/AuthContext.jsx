
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { api, setAuthToken, getMyLandlordProfile } from '../services/api';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  
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
          setIsAuthenticated(true); 
        } catch (error) {
          console.error("Token invalid, logging out:", error);
          localStorage.removeItem('token');
          setAuthToken(null);
          setUser(null);
          setToken(null);
          setIsAuthenticated(false); 
        }
      }
      setIsLoading(false);
    };
    loadUser();
  }, []);

    const login = useCallback((token, userData) => {
        localStorage.setItem('token', token);
        setAuthToken(token);
        setUser(userData);
        setIsAuthenticated(true);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setAuthToken(null);
        setUser(null);
        setIsAuthenticated(false);
    }, []);

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