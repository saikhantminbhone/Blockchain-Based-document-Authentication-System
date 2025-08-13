// src/pages/ProductPage.jsx

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { UserCheck, KeyRound, Banknote, ShieldCheck, Bot, DatabaseZap } from 'lucide-react';

// Data for the tabbed content with updated, accurate features
const solutions = {
  landlords: {
    icon: <UserCheck className="w-8 h-8 text-primary" />,
    title: "For Landlords: A Complete Trust & Management Platform",
    description: "Our platform provides the tools you need to manage your properties with confidence, backed by a powerful verification engine and the security of the blockchain.",
    features: [
      "Secure Onboarding: Verify your identity once with our professional KYC partner, Veriff.",
      "Multi-Document AI Verification: Instantly authenticate properties by cross-referencing the Title Deed and a Utility Bill with our custom Gemini AI.",
      "Smart Contract Approval: Approve tenant-submitted contracts and immutably seal them on the blockchain with a single, gasless transaction.",
      "Centralized Dashboard: Manage all your properties, view active leases, and handle pending contracts in one secure place.",
    ],
    image: "https://images.unsplash.com/photo-1634733329491-2a1212c53446?q=80&w=2070&auto=format&fit=crop"
  },
  tenants: {
    icon: <KeyRound className="w-8 h-8 text-primary" />,
    title: "For Tenants: Rent with Absolute Confidence",
    description: "Enter into agreements knowing your landlord and their property ownership are legitimate. Your verified contract becomes a powerful, sharable asset.",
    features: [
      "Rent with Confidence: Know that your landlord has passed a formal identity check and their property ownership has been verified by our AI.",
      "Receive Verifiable Proof: Get a permanent, sharable link and QR code to your approved contract via email the moment it's approved.",
      "Build Your Rental History: Use your verified contract as trusted proof of residence for loans, visa applications, or future landlords.",
      "Intelligent Matching: Our AI smartly matches your contract to the correct property, preventing clerical errors and disputes.",
    ],
    image: "https://i.imgur.com/gYf0g3M.png" // Using an image of your actual verification page
  },
  verifiers: {
    icon: <Banknote className="w-8 h-8 text-primary" />,
    title: "For Verifiers: Instant, Tamper-Proof Due Diligence",
    description: "For banks, financial institutions, and employers, Block Lease eliminates the friction, uncertainty, and delays of document verification.",
    features: [
      "One-Step Verification: Instantly validate a document's authenticity and its key details by using its public verification link or QR code.",
      "Canonical Data: Our 'Canonical Fingerprint' system ensures the data on the blockchain is cross-referenced with the landlord's official records for maximum accuracy.",
      "Cryptographic Certainty: Trust in the immutable record of the blockchain, not on easily forged paper or PDF files.",
      "Drastically Reduce Fraud Risk: Eliminate the possibility of altered documents and streamline your due diligence process.",
    ],
    image: "https://images.unsplash.com/photo-1556740758-90de374c12ad?q=80&w=2070&auto=format&fit=crop"
  }
};

// Data for the new Technology Stack section
const techStack = [
    { name: "Veriff", description: "For professional, biometric landlord KYC.", icon: <UserCheck/> },
    { name: "Google Gemini", description: "For advanced AI document analysis and data extraction.", icon: <Bot/> },
    { name: "Polygon Blockchain", description: "For fast, low-cost, and permanent transaction records.", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256"><path fill="currentColor" d="m188.43 42.1a32 32 0 0 0-32.22-4.43L68.3 75.45a32 32 0 0 0-16.12 28.18v48.74a32 32 0 0 0 16.12 28.18l87.91 37.78a32 32 0 0 0 32.22-4.43a31.68 31.68 0 0 0 15.57-27.57V69.67a31.68 31.68 0 0 0-15.57-27.57ZM168 152.83a8 8 0 0 1-13.66 4L128 140.15l-26.34 16.64a8 8 0 0 1-10.34-11.66l31.14-49.12a8 8 0 0 1 13.12 0l31.14 49.12a8 8 0 0 1-1.34 11.68Z"/></svg> },
    { name: "AWS S3 & MongoDB", description: "For secure, encrypted off-chain file and data storage.", icon: <DatabaseZap/> },
];

export default function ProductPage() {
  const [activeTab, setActiveTab] = useState('landlords');
  const tabContent = solutions[activeTab];

  return (
    <div className="space-y-24 md:space-y-32">
      {/* --- Hero Section --- */}
      <section className="text-center pt-10 pb-16">
        <h1 className="text-4xl md:text-6xl font-extrabold text-text-primary mb-4">
          The Platform for Verifiable Agreements
        </h1>
        <p className="max-w-3xl mx-auto text-lg text-text-secondary">
          Block Lease provides a seamless, secure, and transparent ecosystem for the entire rental lifecycle, powered by AI and sealed on the blockchain.
        </p>
      </section>

      {/* --- Solutions (Tabs) Section --- */}
      <section className="max-w-7xl mx-auto">
        <div className="flex justify-center border-b border-text-muted/20 mb-12">
          {Object.keys(solutions).map(key => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-4 sm:px-6 py-3 font-semibold text-sm sm:text-base capitalize transition-colors ${activeTab === key ? 'border-b-2 border-primary text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
              For {key}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
          >
            <div className="text-center lg:text-left">
              <div className="flex justify-center lg:justify-start items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">{tabContent.icon}</div>
                <h2 className="text-2xl md:text-3xl font-bold text-text-primary">{tabContent.title}</h2>
              </div>
              <p className="text-lg text-text-secondary mb-6">{tabContent.description}</p>
              <ul className="space-y-3 text-left">
                {tabContent.features.map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <ShieldCheck className="w-5 h-5 text-success mr-3 mt-1 flex-shrink-0" />
                    <span className="text-text-secondary">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-center p-4 sm:p-8 bg-primary/5 rounded-2xl">
                <img src={tabContent.image} alt={`${activeTab} mockup`} className="rounded-lg shadow-2xl w-full" />
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* --- NEW Technology Stack Section --- */}
      <section className="max-w-5xl mx-auto text-center">
         <h2 className="text-3xl font-bold text-text-primary mb-12">Powered by a Modern, Secure Stack</h2>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {techStack.map(tech => (
                <div key={tech.name} className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center text-primary bg-primary/10 rounded-xl">{tech.icon}</div>
                    <h4 className="font-bold text-text-primary">{tech.name}</h4>
                    <p className="text-xs text-text-secondary">{tech.description}</p>
                </div>
            ))}
         </div>
      </section>

      {/* --- Final CTA Section --- */}
      <div className="relative mt-24 bg-card p-8 sm:p-12 rounded-2xl shadow-xl border border-text-muted/10 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="text-center lg:text-left">
              <h3 className="text-3xl font-bold text-text-primary mb-4">Ready to Secure Your Agreements?</h3>
              <p className="text-lg text-text-secondary">Create a free account to get started. Verify your identity, add your properties, and bring immutable trust to your rental contracts today.</p>
            </div>
            <div className="relative flex items-center justify-center p-6">
              <ShieldCheck className="absolute w-48 h-48 text-primary opacity-5 -rotate-12" />
              <Link to="/register" className="relative z-10">
                <Button variant="primary" className="bg-primary hover:bg-hover-blue text-white px-10 py-4 text-lg shadow-lg shadow-primary/30">
                  Get Started for Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
    </div>
  );
}