// src/pages/ProductPage.jsx

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import TestimonialsSection from '../components/TestimonialsSection';
import { UserCheck, KeyRound, Landmark, ShieldCheck } from 'lucide-react';

// Data for the tabbed content
const solutions = {
  landlords: {
    icon: <UserCheck className="w-8 h-8 text-primary" />,
    title: "For Landlords: Effortless Management, Absolute Security",
    description: "Our platform provides the tools you need to manage your properties with confidence, backed by the immutable security of the blockchain.",
    features: [
      "Verify your identity just once with our professional KYC partner, Veriff.",
      "Instantly authenticate your property's title deed using our advanced custom AI.",
      "Approve tenant-submitted contracts and seal them on the blockchain with a single click.",
      "Maintain a complete, verifiable digital history of all your rental agreements in one dashboard.",
    ],
    image: "/assets/landlord-dashboard-mockup.png" // Replace with a mockup screenshot
  },
  tenants: {
    icon: <KeyRound className="w-8 h-8 text-primary" />,
    title: "For Tenants: Your Proof of Authenticity",
    description: "Rent with the assurance that your landlord and their property are legitimate. Your verified contract becomes a powerful tool for your financial life.",
    features: [
      "Rent with confidence, knowing your landlord and their property ownership have been verified.",
      "Receive a permanent, sharable, and verifiable link to your approved contract via email.",
      "Easily prove your residency and rental history to banks, agencies, or future landlords.",
      "Eliminate the risk of fraudulent contracts or disputes over terms.",
    ],
    image: "/assets/verification-certificate-mockup.png" // Replace with a mockup screenshot
  },
  verifiers: {
    icon: <Landmark className="w-8 h-8 text-primary" />,
    title: "For Verifiers: Instant, Tamper-Proof Verification",
    description: "For banks, financial institutions, and employers, Block Lease eliminates the friction and uncertainty of document verification.",
    features: [
      "Instantly validate a tenant's proof of residence or a landlord's rental income in seconds.",
      "Drastically reduce due diligence time by eliminating manual follow-ups and paperwork.",
      "Trust in the cryptographic certainty of the blockchain, not on easily forged paper or PDFs.",
      "Access a public, immutable record to confirm a contract's details anytime via a secure link.",
    ],
    image: "/assets/public-verifier-mockup.png" // Replace with a mockup screenshot
  }
};


export default function ProductPage() {
  const [activeTab, setActiveTab] = useState('landlords');

  const tabContent = solutions[activeTab];

  return (
    <div className="space-y-20 md:space-y-28 animate-fade-in">
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
        {/* Tab Buttons */}
        <div className="flex justify-center border-b border-text-muted/20 mb-12">
          {Object.keys(solutions).map(key => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 sm:px-6 py-3 font-semibold text-sm sm:text-base capitalize transition-colors
                ${activeTab === key
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              For {key}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
          >
            {/* Left Column: Text Content */}
            <div className="text-center lg:text-left">
              <div className="flex justify-center lg:justify-start items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
                  {tabContent.icon}
                </div>
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

            {/* Right Column: Image */}
            <div className="flex items-center justify-center p-4 sm:p-8 bg-primary/5 rounded-2xl">
                <img src={tabContent.image} alt={`${activeTab} mockup`} className="rounded-lg shadow-2xl w-full" />
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* --- Final CTA Section --- */}
      <div className="relative mt-24 bg-card p-8 sm:p-12 rounded-2xl shadow-xl border border-text-muted/10 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="text-center lg:text-left">
              <h3 className="text-3xl font-bold text-text-primary mb-4">
                Ready to Secure Your Agreements?
              </h3>
              <p className="text-lg text-text-secondary">
                Create a free account to get started. Verify your identity, add your properties, and bring immutable trust to your rental contracts today.
              </p>
            </div>
            <div className="relative flex items-center justify-center p-6">
              <ShieldCheck className="absolute w-48 h-48 text-primary opacity-5 -rotate-12" />
              <Link to="/register" className="relative z-10">
                <Button 
                  variant="primary" 
                  className="bg-primary hover:bg-hover-blue text-white px-10 py-4 text-lg shadow-lg shadow-primary/30"
                >
                  Get Started for Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
    </div>
  );
}