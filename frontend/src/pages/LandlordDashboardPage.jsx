import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getLandlordDashboard, getPresignedUrl } from '../services/api';
import { toast } from 'react-hot-toast';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import AddUnitModal from '../components/AddUnitModal';
import UnitListItem from '../components/UnitListItem';
import VerifyDeedModal from '../components/VerifyDeedModal';
import PendingContractItem from '../components/PendingContractItem';
import ConfirmationModal from '../components/ConfirmationModal';
import Loader from '../components/Loader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { showSuccessToast, showErrorToast } from '../components/Notifications';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import ShareModal from '../components/ShareModal';


export default function LandlordDashboardPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [unitToVerify, setUnitToVerify] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewFileUrl, setPreviewFileUrl] = useState('');
  const [shareableDocHash, setShareableDocHash] = useState(null);
  const [confirmationState, setConfirmationState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirm',
    isLoading: false,
  });

  const fetchData = useCallback(async () => {
    // Show main loader only on the very first fetch
    if (!data) setIsLoading(true);
    setError('');

    try {
      const dashboardData = await getLandlordDashboard();
      setData(dashboardData);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, [data]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRequestConfirmation = (title, message, onConfirmAction, confirmText) => {
    setConfirmationState({
      isOpen: true,
      title,
      message,
      confirmText,
      onConfirm: async () => {
        setConfirmationState(prev => ({ ...prev, isLoading: true }));
        await onConfirmAction();
        setConfirmationState({ isOpen: false, isLoading: false }); // Close and reset
      },
    });
  };

  const handleCloseConfirmation = () => {
    setConfirmationState({ isOpen: false, title: '', message: '', onConfirm: null });
  };

  const handleOpenPreview = async (s3Key) => {
      //console.log(s3Key)
    if (!s3Key) {
        showErrorToast("No document is available for preview.");
        return;
    }
    const toastId = toast.loading('Loading preview...');
    try {
        const url = await getPresignedUrl(s3Key);
        console.log(url)
        setPreviewFileUrl(url);
        setIsPreviewModalOpen(true);
        toast.dismiss(toastId);
    } catch (error) {
        toast.error("Could not retrieve document preview.", { id: toastId });
    }
  };

  const handleStartVerification = (unit) => setUnitToVerify(unit);
  const handleCloseVerifyModal = () => setUnitToVerify(null);
  const handleOpenShareModal = (docHash) => setShareableDocHash(docHash);
  const handleCloseShareModal = () => setShareableDocHash(null);

  if (isLoading) return <div className="flex justify-center items-center h-[80vh]"><Loader /></div>;
  if (error) return <div className="p-4 text-center text-error bg-error/10 rounded-lg">{error}</div>;
  if (!data) return <div className="text-center p-4">No data found.</div>;

  const { landlord, units, pendingContracts, approvedContracts } = data;
  const activeUnits = units.filter(u => u.status !== 'archived');
  const archivedUnits = units.filter(u => u.status === 'archived');

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* --- Header --- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Welcome, {landlord.name}</h1>
          <p className="text-text-secondary">{landlord.email}</p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button onClick={fetchData} variant="secondary" className="p-2" title="Refresh Data"><RefreshCw className="w-4 h-4" /></Button>
            {landlord.kycStatus === 'approved' && (<Button onClick={() => setIsAddModalOpen(true)}>+ Add New Property</Button>)}
        </div>
      </div>

      {/* --- Analytics Section --- */}
      {landlord.kycStatus === 'approved' && (
        <AnalyticsDashboard units={activeUnits} approvedContracts={approvedContracts} />
      )}

      {/* --- KYC Status Alert --- */}
      {landlord.kycStatus !== 'approved' && (
        <Card className="bg-warning/10 border border-warning/50">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-warning mr-4" />
            <div>
              <h3 className="font-bold text-warning">Action Required</h3>
              <p className="text-sm text-text-secondary">Your account is not fully active. Please complete your identity verification to add properties and approve contracts.</p>
              <Link to="/kyc">
                <Button variant="secondary" className="mt-2">Go to Verification</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* --- Pending Contracts Section --- */}
      {pendingContracts && pendingContracts.length > 0 && (
        <Card>
          <h2 className="text-xl font-bold mb-4">Pending Contracts for Approval ({pendingContracts.length})</h2>
          <div className="space-y-4">
            {pendingContracts.map(contract => {
              const unitForContract = units.find(u => u._id === contract.unitId);
              return (
                <PendingContractItem 
                  key={contract.docHash} 
                  contract={contract} 
                  unit={unitForContract}
                  onUpdate={fetchData} 
                   onPreviewClick={handleOpenPreview}
                  onVerifyClick={handleStartVerification}
                  onRequestConfirmation={handleRequestConfirmation}
                />
              );
            })}
          </div>
        </Card>
      )}
      
      {/* --- Properties (Units) Section --- */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
            <h2 className="text-xl font-bold">Your Properties ({showArchived ? archivedUnits.length : activeUnits.length})</h2>
            <label className="flex items-center cursor-pointer self-end sm:self-center">
                <span className="text-sm mr-2 text-text-secondary">Show Archived</span>
                <input type="checkbox" checked={showArchived} onChange={() => setShowArchived(!showArchived)} className="toggle toggle-sm" />
            </label>
        </div>
        <div className="space-y-4">
          {(showArchived ? archivedUnits : activeUnits).length > 0 ? (
            (showArchived ? archivedUnits : activeUnits).map(unit => {
              const contractsForUnit = approvedContracts ? approvedContracts.filter(
                c => c.unitId && c.unitId.toString() === unit._id.toString()
              ) : [];
              
              return (
                <UnitListItem 
                  key={unit._id} 
                  unit={unit}
                  contracts={contractsForUnit}
                  onVerifyClick={handleStartVerification}
                  onUpdate={fetchData} 
                  onRequestConfirmation={handleRequestConfirmation}
                  onPreviewClick={handleOpenPreview}
                  onShareClick={handleOpenShareModal}
                />
              );
            })
          ) : (
            <p className="text-center text-text-secondary py-4">{showArchived ? 'No archived properties.' : "You haven't added any properties yet."}</p>
          )}
        </div>
      </Card>

      {/* --- Modals --- */}
      <AddUnitModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onUnitAdded={fetchData}
      />
      <VerifyDeedModal
        unit={unitToVerify}
        isOpen={!!unitToVerify}
        onClose={handleCloseVerifyModal}
        onUnitVerified={fetchData}
      />

      <DocumentPreviewModal
      isOpen={isPreviewModalOpen}
      onClose={() => setIsPreviewModalOpen(false)}
      fileUrl={previewFileUrl}
      />


      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        onClose={handleCloseConfirmation}
        onConfirm={confirmationState.onConfirm}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmText={confirmationState.confirmText}
        isLoading={confirmationState.isLoading}
      />

      <ShareModal
        isOpen={!!shareableDocHash}
        onClose={handleCloseShareModal}
        docHash={shareableDocHash}
      />
    </div>
  );
}