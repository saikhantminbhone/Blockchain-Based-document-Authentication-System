import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getLandlordDashboard, getPresignedUrl, approveAndCreateUnit } from '../services/api'; // Added approveAndCreateUnit
import { toast } from 'react-hot-toast';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import AddUnitModal from '../components/AddUnitModal';
import ApproveUnitModal from '../components/ApproveUnitModal'; // <--- NEW IMPORT
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
  
  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isApproveUnitModalOpen, setIsApproveUnitModalOpen] = useState(false); // <--- State for Approve Modal
  const [contractToApprove, setContractToApprove] = useState(null); // <--- Selected Contract
  
  const [unitToVerify, setUnitToVerify] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewFileUrl, setPreviewFileUrl] = useState('');
  const [shareableDocHash, setShareableDocHash] = useState(null);
  const [confirmationState, setConfirmationState] = useState({
    isOpen: false, title: '', message: '', onConfirm: null, confirmText: 'Confirm', isLoading: false,
  });
  const handleOpenShareModal = (docHash) => setShareableDocHash(docHash);
  const handleCloseShareModal = () => setShareableDocHash(null);

  const fetchData = useCallback(async () => {
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

  useEffect(() => { fetchData(); }, [fetchData]);

  // Helper: Expiration Check
  const isContractExpired = (contract) => {
    if (!contract || !contract.fingerprint) return false;
    try {
        const parts = contract.fingerprint.split('|');
        const toPart = parts.find(p => p.trim().startsWith('To:'));
        if (!toPart) return false;
        const [day, month, year] = toPart.split(':')[1].trim().split('/');
        return new Date(`${year}-${month}-${day}`) < new Date().setHours(0,0,0,0);
    } catch (e) { return false; }
  };

  // --- Handlers ---

  // 1. Open "Add Unit & Approve" Modal
  const handleOpenAddUnitModal = (contract) => {
    setContractToApprove(contract);
    setIsApproveUnitModalOpen(true);
  };

  // 2. Submit "Add Unit & Approve"
  const handleConfirmCreateUnit = async (addressDetails) => {
    try {
      const result = await approveAndCreateUnit(contractToApprove.docHash, addressDetails);
      showSuccessToast(result.message);
      setIsApproveUnitModalOpen(false);
      setContractToApprove(null);
      fetchData(); // Refresh Dashboard
    } catch (err) {
      showErrorToast(err.response?.data?.message || 'Failed to create unit.');
    }
  };

  const handleOpenPreview = async (s3Key) => {
    if (!s3Key) return showErrorToast("No document available.");
    const toastId = toast.loading('Loading preview...');
    try {
        const url = await getPresignedUrl(s3Key);
        setPreviewFileUrl(url);
        setIsPreviewModalOpen(true);
        toast.dismiss(toastId);
    } catch (error) {
        toast.error("Could not retrieve document.", { id: toastId });
    }
  };

  const handleStartVerification = (unit) => setUnitToVerify(unit);
  const handleCloseVerifyModal = () => setUnitToVerify(null);

  if (isLoading) return <div className="flex justify-center items-center h-[80vh]"><Loader /></div>;
  if (error) return <div className="p-4 text-center text-error bg-error/10 rounded-lg">{error}</div>;
  if (!data) return <div className="text-center p-4">No data found.</div>;

  const { landlord, units, pendingContracts, approvedContracts } = data;
  const activeUnits = units.filter(u => u.status !== 'archived');
  const archivedUnits = units.filter(u => u.status === 'archived');

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Welcome, {landlord.name}</h1>
          <p className="text-text-secondary">{landlord.email}</p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button onClick={fetchData} variant="secondary" className="p-2" title="Refresh"><RefreshCw className="w-4 h-4" /></Button>
            {landlord.kycStatus === 'approved' && (<Button onClick={() => setIsAddModalOpen(true)}>+ Add New Property</Button>)}
        </div>
      </div>

      {/* Analytics */}
      {landlord.kycStatus === 'approved' && (
        <AnalyticsDashboard units={activeUnits} approvedContracts={approvedContracts} />
      )}

      {/* Pending Contracts */}
      
      {pendingContracts && pendingContracts.length > 0 && (
        <Card>
          <h2 className="text-xl font-bold mb-4">Pending Contracts for Approval ({pendingContracts.length})</h2>
          <div className="space-y-4">
           
            {pendingContracts.map(contract => {
              // Robust ID Match
              const unitForContract = units.find(u => String(u._id) === String(contract.unitId));

              return (
                <PendingContractItem 
                  key={contract.docHash} 
                  contract={contract} 
                  unit={unitForContract}
                  onUpdate={fetchData} 
                  onPreviewClick={handleOpenPreview}
                  onVerifyClick={handleStartVerification}
                  onAddUnitClick={handleOpenAddUnitModal} // <--- Pass Handler
                />
              );
            })}
          </div>
        </Card>
      )}
      
      {/* Properties List */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
            <h2 className="text-xl font-bold">Your Properties ({showArchived ? archivedUnits.length : activeUnits.length})</h2>
            <label className="flex items-center cursor-pointer">
                <span className="text-sm mr-2 text-text-secondary">Show Archived</span>
                <input type="checkbox" checked={showArchived} onChange={() => setShowArchived(!showArchived)} className="toggle toggle-sm" />
            </label>
        </div>
        <div className="space-y-4">
          {(showArchived ? archivedUnits : activeUnits).length > 0 ? (
            (showArchived ? archivedUnits : activeUnits).map(unit => {
              const contractsForUnit = approvedContracts.filter(c => String(c.unitId) === String(unit._id));
              const hasExpiredContract = contractsForUnit.some(c => isContractExpired(c));
              return (
                <UnitListItem 
                  key={unit._id} unit={unit} contracts={contractsForUnit} hasExpiredContract={hasExpiredContract} 
                  onVerifyClick={handleStartVerification} onUpdate={fetchData} onPreviewClick={handleOpenPreview}
                 onShareClick={handleOpenShareModal}
                />
              );
            })
          ) : (
            <p className="text-center text-text-secondary py-4">No properties found.</p>
          )}
        </div>
      </Card>

      {/* --- ALL MODALS LIVE HERE --- */}
      
      <AddUnitModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onUnitAdded={fetchData} 
      />
      
      {/* The Approve & Create Unit Modal */}
      <ApproveUnitModal 
        isOpen={isApproveUnitModalOpen}
        onClose={() => setIsApproveUnitModalOpen(false)}
        onConfirm={handleConfirmCreateUnit}
        pendingContract={contractToApprove}
      />
      
      <VerifyDeedModal
        unit={unitToVerify}
        isOpen={!!unitToVerify}
        onClose={handleCloseVerifyModal}
       onVerifySuccess={() => {
        handleCloseVerifyModal(); 
        fetchData();              
    }}
      />

      <DocumentPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        fileUrl={previewFileUrl}
      />

      <ShareModal
        isOpen={!!shareableDocHash}
        onClose={handleCloseShareModal}
        docHash={shareableDocHash}
      />
    </div>
  );
}