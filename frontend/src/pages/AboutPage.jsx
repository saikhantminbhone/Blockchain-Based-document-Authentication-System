// src/pages/AboutPage.jsx

import React from 'react';
import { ShieldCheck, Cpu, Box } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="bg-background text-text-primary animate-fade-in">
      {/* --- Hero Section --- */}
      <div className="relative h-[50vh] flex items-center justify-center text-center text-white">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/assets/about-hero.jpg')" }} // Replace with a high-quality image
        >
          <div className="absolute inset-0 bg-primary/80"></div>
        </div>
        <div className="relative z-10 p-4">
          <h1 className="text-4xl md:text-6xl font-extrabold">Our Mission</h1>
          <p className="mt-4 text-xl max-w-3xl mx-auto text-white/90">
            To bring absolute trust and transparency to the rental market through elegant, user-friendly technology.
          </p>
        </div>
      </div>

      {/* --- Main Content Section --- */}
      <div className="max-w-4xl mx-auto py-16 px-4 space-y-20">
        {/* The Problem Section */}
        <section className="text-center">
          <h2 className="text-3xl font-bold text-text-primary">The Challenge of Trust in Rentals</h2>
          <p className="mt-4 text-lg text-text-secondary">
            In a fast-paced market like Bangkok, document fraud is a persistent risk. Forged contracts and questionable ownership documents create uncertainty for landlords, tenants, and financial institutions alike, leading to disputes and significant financial loss.
          </p>
        </section>

        {/* Our Solution Section */}
        <section className="grid md:grid-cols-2 gap-12 items-center">
          <div className="text-center md:text-left">
            <span className="text-sm font-bold text-accent uppercase">Our Solution</span>
            <h2 className="text-3xl font-bold text-text-primary mt-2">Where AI Meets Immutability</h2>
            <p className="mt-4 text-text-secondary">
              Block Lease tackles this problem head-on by creating a powerful "chain of trust." We don't just verify a document; we verify the participants and the assets first, then seal the final agreement on the blockchain.
            </p>
            <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3"><ShieldCheck className="w-6 h-6 text-success flex-shrink-0 mt-1" /><div><h4 className="font-semibold">Verified Participants</h4><p className="text-sm text-text-secondary">We partner with industry-leader Veriff to ensure every landlord is who they say they are through professional KYC.</p></div></div>
                <div className="flex items-start gap-3"><Cpu className="w-6 h-6 text-info flex-shrink-0 mt-1" /><div><h4 className="font-semibold">AI-Authenticated Assets</h4><p className="text-sm text-text-secondary">Our custom AI, powered by Google Gemini, analyzes ownership documents like title deeds to confirm their authenticity.</p></div></div>
                <div className="flex items-start gap-3"><Box className="w-6 h-6 text-primary flex-shrink-0 mt-1" /><div><h4 className="font-semibold">Immutable Agreements</h4><p className="text-sm text-text-secondary">Finally, the approved rental contract is given a unique fingerprint and recorded on the blockchain, creating a permanent, tamper-proof record.</p></div></div>
            </div>
          </div>
          <div>
            <img src="/assets/solution-graphic.png" alt="Visual of the system flow" className="rounded-2xl shadow-xl" />
          </div>
        </section>

        {/* The Founder Section */}
        <section className="text-center pt-12 border-t border-text-muted/10">
            <h2 className="text-3xl font-bold text-text-primary">About the Founder</h2>
            <div className="mt-8 flex flex-col items-center">
                <img src="https://i.pravatar.cc/150?u=founder" alt="Founder" className="w-24 h-24 rounded-full mb-4" />
                <h4 className="text-xl font-semibold text-text-primary">Sai Khant Min Bhone</h4>
                <p className="text-accent">Lead Developer & Blockchain Architect</p>
                <p className="mt-4 text-text-secondary max-w-xl">
                    As a final year student passionate about emerging technologies, I created Block Lease to explore a practical, real-world application for AI and blockchain that solves a tangible problem. This project is the culmination of my studies in software engineering and decentralized systems.
                </p>
            </div>
        </section>
      </div>
    </div>
  );
}