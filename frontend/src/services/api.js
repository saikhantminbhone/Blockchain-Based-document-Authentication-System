// src/services/api.js (Full & Final Code)

import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_API_URL, 
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// --- AUTHENTICATION ---
export const registerLandlord = async (name, email, password, phone) => {
  const { data } = await api.post('/register-landlord', { name, email, password, phone });
  return data;
};

export const loginLandlord = async (email, password) => {
  const { data } = await api.post('/login-landlord', { email, password });
  return data;
};

export const loginWithGoogle = async (googleToken) => {
    const { data } = await api.post('/auth/google', { token: googleToken });
    return data;
};

// --- USER & DASHBOARD ---
export const getMyLandlordProfile = async () => {
    const { data } = await api.get('/landlord/me');
    return data;
};
export const getLandlordDashboard = async () => {
    const { data } = await api.get('/landlord/dashboard');
    return data;
};

// --- VERIFF KYC & DOCUMENT VERIFICATION ---
export const createVeriffSession = async (type, payload = {}) => {
    const { data } = await api.post('/veriff/create-session', { type, payload });
    return data; // Returns { message, sessionUrl }
};

// --- UNIT MANAGEMENT ---
export const createUnit = async (formData) => {
    // formData must be a FormData object because it includes a file
    const { data } = await api.post('/units', formData);
    return data;
};

// --- CONTRACTS & BLOCKCHAIN ---
export const initiateContract = async (file, tenantEmail) => {
  const formData = new FormData();
  formData.append('contract', file);
  formData.append('tenantEmail', tenantEmail); 
  const { data } = await api.post('/contracts/initiate', formData);
  return data;
};

export const approveContract = async (docHash) => {
    const { data } = await api.post('/approve-contract', { docHash });
    return data;
};

export const verifyDocument = async (file) => {
    const formData = new FormData();
    formData.append('contract', file);
    const { data } = await api.post('/verify-document', formData);
    return data;
};

export const verifyUnitDeed = async (unitId, formData) => {
    const { data } = await api.post(`/units/${unitId}/verify`, formData);
    return data;
};

export const terminateContract = async (docHash) => {
    const { data } = await api.post(`/contracts/${docHash}/terminate`);
    return data;
};

export const archiveUnit = async (unitId) => {
    const { data } = await api.delete(`/units/${unitId}/archive`);
    return data;
};

export const restoreUnit = async (unitId) => {
    const { data } = await api.post(`/units/${unitId}/restore`);
    return data;
};


export const approveAndCreateUnit = async (docHash) => {
    const { data } = await api.post('/approve-and-create-unit', { docHash });
    console.log(data)
    return data;
};

export const getPublicVerificationData = async (docHash) => {
    const { data } = await api.get(`/verify/${docHash}`);
    return data;
};

export const verifyEmailToken = async (token) => {
    const { data } = await api.post('/verify-email', { token });
    return data;
};

export const resendVerificationEmail = async (email) => {
    const { data } = await api.post('/resend-verification', { email });
    return data;
};


// --- UTILITY ---
export const getPresignedUrl = async (key) => {
    const { data } = await api.get(`/s3/presigned-url?key=${key}`);
    return data.url;
};

export const sendInvitation = async (docHash, landlordEmail) => {
  const { data } = await api.post('/invitations/send', { docHash, landlordEmail });
  return data;
};


