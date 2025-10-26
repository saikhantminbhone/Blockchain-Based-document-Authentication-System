import { useState } from 'react';
import { approveContract } from '../services/api';
import FileUploader from '../components/FileUploader';
import Loader from '../components/Loader';
import Button from '../components/ui/Button';

export default function CreateContractPage() {
  const [landlordId, setLandlordId] = useState('');
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !landlordId) {
      setError('Please provide both a Landlord ID and a contract file.');
      return;
    }
    setIsLoading(true);
    setResult(null);
    setError('');
    try {
      const data = await approveContract(landlordId, file);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve contract.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setLandlordId('');
    setFile(null);
    setResult(null);
    setError('');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold mb-2">Create & Approve New Contract</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Upload a contract and provide the Landlord&apos;s ID to record it on-chain.
        </p>

        {isLoading && <Loader />}

        {result ? (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
            <h3 className="font-bold text-green-700 dark:text-green-300">✅ Contract Approved!</h3>
            <p className="text-sm mt-2 font-mono break-all">TX Hash: {result.txHash}</p>
            <Button onClick={resetForm} variant="secondary" className="mt-4">
              Approve another contract
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="landlordId" className="block text-sm font-medium mb-1">
                Landlord ID
              </label>
              <input
                id="landlordId"
                type="text"
                value={landlordId}
                onChange={(e) => setLandlordId(e.target.value)}
                placeholder="Enter the registered Landlord ID"
                className="w-full px-4 py-2 border bg-white dark:bg-slate-700 border-gray-300 dark:border-gray-600 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contract Document</label>
              {file ? (
                <div className="flex justify-between items-center p-2 bg-slate-100 dark:bg-slate-700 rounded-md">
                  <span className="text-sm">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-sm text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <FileUploader onFileSelect={setFile} title="Upload the contract PDF or image" />
              )}
            </div>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={isLoading || !file || !landlordId}
              className="w-full py-3"
            >
              Approve Contract
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
