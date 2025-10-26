// src/components/ServicesSection.jsx

import React from "react";
import {
  UserCheck,
  FileUp,
  Signature,
  ShieldCheck,
  DatabaseZap,
  Fuel,
} from "lucide-react";

const services = [
  {
    title: "Landlord KYC Verification",
    description:
      "A fast, secure onboarding process for landlords using Veriff. Identity is confirmed with AI-powered checks, ensuring only legitimate users join the platform.",
    icon: <UserCheck className="w-6 h-6" />,
  },
  {
    title: "AI Title Deed Analysis",
    description:
      "Landlords' proof of ownership documents are scanned by our AI to verify authenticity and match ownership details, building a foundation of trust.",
    icon: <DatabaseZap className="w-6 h-6" />,
  },
  {
    title: "Tenant Contract Fingerprinting",
    description:
      "Rental agreements uploaded by tenants are scanned by AI to create a unique, tamper-proof 'fingerprint' of the key terms and conditions.",
    icon: <FileUp className="w-6 h-6" />,
  },
  {
    title: "Immutable Blockchain Signature",
    description:
      "Once a verified landlord approves a contract's fingerprint, a unique hash is generated and permanently recorded on the blockchain as a digital signature.",
    icon: <Signature className="w-6 h-6" />,
  },
  {
    title: "Instant Public Verification",
    description:
      "Anyone—banks, employers, or agencies—can upload a copy of a contract to instantly verify its authenticity against the immutable blockchain record.",
    icon: <ShieldCheck className="w-6 h-6" />,
  },
  {
    title: "Zero Gas Fee Experience",
    description:
      "We sponsor all blockchain transaction fees. Landlords, tenants, and verifiers can use the entire system without ever needing a crypto wallet or paying gas fees.",
    icon: <Fuel className="w-6 h-6" />,
  },
];

export default function ServicesSection() {
  return (
    <section className="bg-background py-10 px-4 sm:px-8 lg:px-16" id="services">
      <div className="max-w-7xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold text-text-primary mb-4">
          An End-to-End System for Digital Trust
        </h2>
        <p className="text-text-secondary max-w-3xl mx-auto mb-20 text-lg">
          From landlord verification to immutable contract signing, our platform provides a complete solution for secure document authentication.
        </p>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, idx) => (
            <div
              key={idx}
              // --- 1. Add 'group' to the card and remove the hover border ---
              className="group bg-card rounded-2xl p-8 text-left border border-text-muted/10 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10"
            >
              <div className="flex items-center gap-4">
                {/* --- 2. The icon's background and text color will now change on group-hover --- */}
                <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-white">
                  {service.icon}
                </div>
                {/* --- 3. The title's text color will now change on group-hover --- */}
                <h3 className="text-xl font-bold text-text-primary transition-colors duration-300 group-hover:text-accent">
                  {service.title}
                </h3>
              </div>
              <p className="text-text-secondary mt-4 text-sm leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}