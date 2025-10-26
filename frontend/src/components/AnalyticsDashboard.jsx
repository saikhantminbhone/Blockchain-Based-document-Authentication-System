import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { parse, isAfter, differenceInDays } from 'date-fns';
import Card from './ui/Card';
import { DollarSign, Home, User, Clock, AlertTriangle, BadgeCheck, Info } from 'lucide-react';
import { clsx } from 'clsx';

// A custom, styled tooltip for the bar chart
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 bg-card border rounded-lg shadow-lg">
        <p className="font-bold">{`Unit: ${label}`}</p>
        <p className="text-sm text-success">Income: ฿{payload[0].value.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

export default function AnalyticsDashboard({ units = [], approvedContracts = [] }) {
  // --- 1. Accurate Data Processing ---
  const now = new Date();

  const parseFingerprint = (fingerprint) => {
    const details = (fingerprint || '').split('|').reduce((acc, part) => {
      const delimiterIndex = part.indexOf(':');
      if (delimiterIndex !== -1) {
        const key = part.substring(0, delimiterIndex).trim().toLowerCase();
        const value = part.substring(delimiterIndex + 1).trim();
        acc[key] = value;
      }
      return acc;
    }, {});
    return {
        rent: parseInt(details.rent, 10) || 0,
        from: details.from || null,
        to: details.to || null,
        tenant: details.tenant || 'N/A'
    };
  };

  // Find contracts that are not terminated AND not yet expired
  const activeContracts = approvedContracts.filter(c => {
    if (c.status === 'terminated') return false;
    const details = parseFingerprint(c.fingerprint);
    if (!details.to) return false;
    try {
        const endDate = parse(details.to, 'dd/MM/yyyy', new Date());
        return isAfter(endDate, now);
    } catch (e) { return false; }
  });

  // FIX: Ensure all calculations default to 0
  const totalMonthlyIncome = activeContracts.reduce((sum, c) => sum + parseFingerprint(c.fingerprint).rent, 0);
  const totalProperties = units.length;
  
  const expiringContracts = activeContracts
    .map(c => {
        const details = parseFingerprint(c.fingerprint);
        const endDate = parse(details.to, 'dd/MM/yyyy', new Date());
        const daysLeft = differenceInDays(endDate, now);
        return { ...c, details, daysLeft };
    })
    .filter(c => c.daysLeft <= 90)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const incomeByUnit = units.map(unit => {
      const contractForUnit = activeContracts.find(c => c.unitId && c.unitId.toString() === unit._id.toString());
      return {
          name: unit.unitNumber,
          income: contractForUnit ? parseFingerprint(contractForUnit.fingerprint).rent : 0
      }
  }).filter(item => item.income > 0);

  return (
    <div className="space-y-6">
      {/* --- KPI Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="flex items-center p-6"><div className="p-3 bg-success/10 rounded-lg mr-4"><DollarSign className="w-6 h-6 text-success" /></div><div><h3 className="text-text-secondary">Active Monthly Income</h3><p className="text-3xl font-bold">฿{totalMonthlyIncome.toLocaleString()}</p></div></Card>
        <Card className="flex items-center p-6"><div className="p-3 bg-primary/10 rounded-lg mr-4"><Home className="w-6 h-6 text-primary" /></div><div><h3 className="text-text-secondary">Total Properties</h3><p className="text-3xl font-bold">{totalProperties}</p></div></Card>
        <Card className="flex items-center p-6"><div className="p-3 bg-accent/10 rounded-lg mr-4"><User className="w-6 h-6 text-accent" /></div><div><h3 className="text-text-secondary">Active Leases</h3><p className="text-3xl font-bold">{activeContracts.length}</p></div></Card>
      </div>

      {/* --- Chart & Timeline Section --- */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 h-96 flex flex-col">
          <h3 className="font-bold text-lg mb-4">Monthly Income by Property</h3>
          {/* FIX: Show an "empty state" message if there is no data */}
          {incomeByUnit.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeByUnit} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(value) => `฿${value/1000}k`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(20, 184, 166, 0.1)' }} />
                <Bar dataKey="income" fill="#14B8A6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-center text-text-secondary">
                <Info className="w-8 h-8 mb-2" />
                <p>No active rental income to display.</p>
                <p className="text-xs mt-1">Contracts will appear here once they are approved.</p>
            </div>
          )}
        </Card>
        
        <Card className="lg:col-span-2 h-96 flex flex-col">
          <h3 className="font-bold text-lg mb-4">Upcoming Lease Expirations</h3>
          <div className="flex-grow overflow-y-auto space-y-3 pr-2">
            {/* FIX: Show an "empty state" message if there is no data */}
            {expiringContracts.length > 0 ? (
                expiringContracts.map(c => {
                    const unit = units.find(u => u._id.toString() === c.unitId.toString());
                    const badgeColor = c.daysLeft < 30 ? 'bg-error/10 text-error' : c.daysLeft < 60 ? 'bg-warning/10 text-warning' : 'bg-info/10 text-info';
                    return (
                        <div key={c._id} className="flex items-center justify-between text-sm p-2 rounded-md bg-background">
                            <div>
                                <p className="font-semibold text-text-primary">{c.details.tenant} <span className="font-normal text-text-secondary">({unit?.unitNumber})</span></p>
                                <p className="text-xs text-text-muted">{c.details.to}</p>
                            </div>
                            <span className={clsx('px-2 py-1 text-xs font-bold rounded-full', badgeColor)}>
                                {c.daysLeft} days left
                            </span>
                        </div>
                    )
                })
            ) : (
                 <div className="flex flex-col items-center justify-center h-full text-center text-text-secondary">
                    <BadgeCheck className="w-8 h-8 mb-2" />
                    <p>No leases expiring in the next 90 days.</p>
                </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}