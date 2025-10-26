// src/components/BlockchainWorkSection.jsx

import React from 'react';
import { FileText, Fingerprint, LockKeyhole, Link, Search } from 'lucide-react';
import Card from './ui/Card'; // Assuming your Card component is reusable

export default function BlockchainWorkSection() {
  return (
    <section className="bg-background py-20 px-4 sm:px-8 lg:px-16" id="blockchain">
      <div className="max-w-7xl mx-auto">
        {/* --- Section Header --- */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-text-primary mb-4">
            How a Document is Sealed on the Blockchain
          </h2>
          <p className="text-text-secondary max-w-3xl mx-auto text-lg">
            Our system doesn't store your sensitive documents on the blockchain. Instead, we use a more secure and elegant process to create an immutable, verifiable proof of your contract's integrity.
          </p>
        </div>

        {/* --- Central Visual Flow --- */}
        <div className="relative">
          {/* Background Gradient & Grid */}
          <div className="absolute inset-0 max-w-4xl mx-auto h-full bg-gradient-to-br from-primary/20 via-transparent to-accent/20 blur-3xl opacity-50"></div>
          <div className="absolute inset-0 max-w-4xl mx-auto h-full bg-[url('/path-to-your-grid-background.svg')] bg-repeat opacity-5"></div>

          <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* --- Step 1: The Fingerprint --- */}
            <Card className="bg-card/80 backdrop-blur-lg border border-text-muted/10 p-8 text-center">
              <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-2xl bg-primary text-white mb-6">
                <FileText size={32} />
              </div>
              <h3 className="text-xl font-bold text-text-primary">1. AI Fingerprinting</h3>
              <p className="mt-2 text-text-secondary">
                When a rental contract is uploaded, our AI reads it and extracts the most critical data into a unique text string, or "fingerprint."
              </p>
              <div className="mt-4 text-left bg-background p-3 rounded-md text-xs text-text-muted font-mono">
                "Landlord: Niran... | Tenant: Malee... | Rent: 20000 THB..."
              </div>
            </Card>

            {/* --- Step 2: Hashing --- */}
            <Card className="bg-card/80 backdrop-blur-lg border border-text-muted/10 p-8 text-center mt-0 lg:mt-12">
              <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-2xl bg-primary text-white mb-6">
                <Fingerprint size={32} />
              </div>
              <h3 className="text-xl font-bold text-text-primary">2. Cryptographic Hashing</h3>
              <p className="mt-2 text-text-secondary">
                This fingerprint is passed through the irreversible SHA-256 hashing algorithm, creating a unique, fixed-length digital signature.
              </p>
              <div className="mt-4 text-left bg-background p-3 rounded-md text-xs text-text-muted font-mono break-all">
                0x1a2b3c...
              </div>
            </Card>

            {/* --- Step 3: Blockchain Record --- */}
            <Card className="bg-card/80 backdrop-blur-lg border border-text-muted/10 p-8 text-center">
              <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-2xl bg-primary text-white mb-6">
                <LockKeyhole size={32} />
              </div>
              <h3 className="text-xl font-bold text-text-primary">3. Immutable Record</h3>
              <p className="mt-2 text-text-secondary">
                This unique hash—and only the hash—is permanently recorded on the blockchain in a transaction that cannot be altered or deleted.
              </p>
              <div className="mt-4 text-left bg-background p-3 rounded-md text-xs text-text-secondary">
                <p><strong className="text-text-primary">Status:</strong> ✅ Confirmed</p>
                <p><strong className="text-text-primary">Timestamp:</strong> July 31, 2025</p>
              </div>
            </Card>

          </div>

          {/* --- Verification Part --- */}
          <div className="text-center mt-16">
            <Search className="w-12 h-12 mx-auto text-accent mb-4"/>
            <h3 className="text-2xl font-bold text-text-primary">The Result: Verifiable Proof</h3>
            <p className="text-text-secondary max-w-2xl mx-auto mt-2">
              Later, when anyone uploads a document for verification, we repeat the same process. If the generated hash matches the one on the blockchain, the document is 100% authentic. If even a single character was changed, the hashes will not match.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}