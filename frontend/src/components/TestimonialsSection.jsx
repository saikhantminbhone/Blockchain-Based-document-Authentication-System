// src/components/TestimonialsSection.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import Card from './ui/Card';
import Button from './ui/Button';
import { ShieldCheck } from 'lucide-react';

const testimonials = [
  {
    quote: "As a landlord with multiple properties in Bangkok, Block Lease has been a game-changer. The AI verification for title deeds gave me peace of mind, and having a permanent blockchain record of every contract has eliminated disputes. It's incredibly professional.",
    name: "Khun Somchai",
    title: "Property Owner, Sukhumvit",
    avatar: "https://i.pravatar.cc/150?u=somchai"
  },
  {
    quote: "Getting my rental agreement verified on the blockchain was surprisingly easy. When I applied for a personal loan, the bank was able to instantly confirm my proof of residence through the platform. This is the future.",
    name: "Malee",
    title: "Tenant, Sathorn",
    avatar: "https://i.pravatar.cc/150?u=malee"
  },
  {
    quote: "Our verification process for loan applicants used to take days. With Block Lease, we can validate a rental contract's authenticity in seconds. The security of the blockchain hash is undeniable. It's a huge step forward for due diligence.",
    name: "Loan Officer",
    title: "Major Thai Bank",
    avatar: "https://i.pravatar.cc/150?u=bank"
  },
  {
    quote: "I was initially skeptical about blockchain, but Block Lease made it so simple. Knowing my rental agreement is securely recorded gives me much more confidence as a tenant in Ladprao.",
    name: "Adisorn",
    title: "Tenant, Ladprao",
    avatar: "https://i.pravatar.cc/150?u=adisorn"
  },
];

export default function TestimonialsSection() {
  return (
    <section className="bg-background py-10 px-4 sm:px-8 lg:px-16">
      <div className="max-w-7xl mx-auto">
        
        {/* --- 1. CALL TO ACTION (MOVED TO THE TOP) --- */}
        <div className="relative bg-card p-8 sm:p-12 rounded-2xl shadow-xl border border-text-muted/10 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            
            {/* Left Column: Text */}
            <div className="text-center lg:text-left">
              <h3 className="text-3xl font-bold text-text-primary mb-4">
                Ready to Secure Your Agreements?
              </h3>
              <p className="text-lg text-text-secondary">
                Create a free account to get started. Verify your identity, add your properties, and bring immutable trust to your rental contracts today.
              </p>
            </div>

            {/* Right Column: Button & Decorative Icon */}
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
        
        {/* --- 2. SECTION HEADER (MOVED HERE) --- */}
        <div className="text-center mt-24 mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-text-primary mb-4">
            Trusted in Bangkok
          </h2>
          <p className="text-text-secondary max-w-3xl mx-auto text-lg">
            Hear from landlords, tenants, and businesses who already benefit from the security of Block Lease.
          </p>
        </div>

        {/* --- 3. TESTIMONIALS (MOVED TO THE BOTTOM) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:flex lg:overflow-x-auto lg:space-x-8 gap-8 pb-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="flex flex-col lg:flex-shrink-0 lg:w-[450px]">
              <div className="flex-grow mb-4">
                <blockquote className="text-text-secondary italic">
                  <p>"{testimonial.quote}"</p>
                </blockquote>
              </div>
              <footer className="mt-4 flex items-center gap-4">
                <img className="h-12 w-12 rounded-full object-cover" src={testimonial.avatar} alt={testimonial.name} />
                <div>
                  <div className="font-semibold text-text-primary">{testimonial.name}</div>
                  <div className="text-text-secondary text-sm">{testimonial.title}</div>
                </div>
              </footer>
            </Card>
          ))}
        </div>
        
      </div>
    </section>
  );
}