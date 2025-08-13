// src/App.jsx (Corrected)

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import CreateContractPage from './pages/CreateContractPage';
import LandlordDashboardPage from './pages/LandlordDashboardPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import KycPage from './pages/KycPage';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';
import Footer from './components/Footer.jsx';
import VerificationPage from './pages/VerificationPage.jsx';
import ProductPage from './pages/ProductPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import BlogPage from './pages/BlogPage.jsx';
import ContactPage from './pages/ContactPage.jsx';


function App() {
  return (
    <AuthProvider>
      <Router>
       <Toaster position="top-right" />
        {/* This is the main grid container */}
        <div className="grid grid-rows-[auto_1fr_auto] min-h-screen bg-background">
          <Header />
          <main className="container mx-auto px-4 py-6">
            <Routes>
              {/* --- Public Routes --- */}
              <Route path="/" element={<HomePage />} />
              <Route path="/product" element={<ProductPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/verify/:docHash" element={<VerificationPage />} />
              
              {/* --- Protected Routes --- */}
              <Route 
                path="/kyc" 
                element={
                  <ProtectedRoute kycStatusRequired="pending">
                    <KycPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute kycStatusRequired="approved">
                    <LandlordDashboardPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/approve" 
                element={
                  <ProtectedRoute kycStatusRequired="approved">
                    <CreateContractPage />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </main>
        
          <Footer />


        </div>
      </Router>
    </AuthProvider>
  );
}
export default App;