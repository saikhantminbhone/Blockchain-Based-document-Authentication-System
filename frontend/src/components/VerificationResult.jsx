// src/components/VerificationResult.jsx

import { CheckCircle2, XCircle, FileText } from 'lucide-react';

export default function VerificationResult({ result }) {
  const { verified, message, fingerprint, details } = result;

  return (
    <div className={`p-6 rounded-lg border-l-4 ${verified ? 'bg-success/10 border-success' : 'bg-error/10 border-error'}`}>
      <div className="flex items-start">
        {verified ? 
          <CheckCircle2 className="w-6 h-6 text-success mr-4 flex-shrink-0" /> : 
          <XCircle className="w-6 h-6 text-error mr-4 flex-shrink-0" />
        }
        <div className="w-full">
          <h3 className={`text-lg font-bold ${verified ? 'text-success' : 'text-error'}`}>{message}</h3>
          
          {/* This section is now updated to display the new details */}
          {details && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-text-secondary">
              {/* <p><strong>Landlord Name:</strong> <span className="font-semibold">{details.landlordName}</span></p>
              <p><strong>Tenant Name:</strong> <span className="font-semibold">{details.tenantName}</span></p>
              <p><strong>Unit Info:</strong> <span className="font-semibold">{details.unitInfo}</span></p>
              <p><strong>Rental Period:</strong> <span className="font-semibold">{details.from} to {details.to}</span></p> */}
              <p className="sm:col-span-2"><strong>Verified On:</strong> {new Date(details.verifiedOn).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}</p>
            </div>
          )}

          {fingerprint && (
            <div className="mt-4 p-3 bg-background dark:bg-slate-800 rounded-md">
              <div className="flex items-center text-sm font-semibold mb-2 text-text-primary">
                <FileText className="w-4 h-4 mr-2" />
                <span>Document Fingerprint</span>
              </div>
              <p className="font-mono text-xs text-text-muted break-all">{fingerprint}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}