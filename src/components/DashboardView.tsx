import React, { useState, useMemo, useEffect } from 'react';
import { Sale, Agreement, Payment, Customer, CashMovement, CashDay, Product, WriteOff, OverrideLog } from '../types';
import { getCustomerExposure, checkCustomerOverdue, loadDBList, saveDBList, generateUid } from '../utils/database';
import { 
  TrendingUp, Scale, AlertOctagon, Users, Calendar, 
  Wallet, RefreshCw, CreditCard, ShoppingBag, ArrowUpRight,
  PackageOpen, Info, ShieldAlert, Key, CheckCircle, AlertTriangle, BookOpen, MessageCircle
} from 'lucide-react';
import {
  calculateCashOnHand,
  calculateBankBalance,
  calculateInventoryCost,
  calculateLoanPortfolio,
  calculateCreditIssued,
  calculateCustomerPayments,
  calculateAvailableCash,
  calculateRealTimeProfit,
  calculateCapitalReconciliation,
  calculateCompanyFinancialState
} from '../utils/financialEngine';

interface DashboardViewProps {
  sales: Sale[];
  agreements: Agreement[];
  payments: Payment[];
  customers: Customer[];
  onNavigate: (page: string) => void;
  activeDay: any;
  currentUser: any;
}

interface FraudAlert {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  date: string;
  category: string;
}

export default function DashboardView({ 
  sales, 
  agreements, 
  payments, 
  customers, 
  onNavigate, 
  activeDay,
  currentUser
}: DashboardViewProps) {
  
  const [supervisorPasscode, setSupervisorPasscode] = useState('');
  const [isSupervisorMode, setIsSupervisorMode] = useState(false);
  const [supervisorStatusMessage, setSupervisorStatusMessage] = useState('');
  const [overrideReasonInput, setOverrideReasonInput] = useState('');
  const [selectedCustForOverride, setSelectedCustForOverride] = useState('');
  
  const formatCurrency = (amount: number): string => {
    return 'R ' + (amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Daily statistics
  const todaySales = sales.filter(s => s.date === todayStr);
  const todayPayments = payments.filter(p => p.date === todayStr);
  
  const todayCashSalesAmt = todaySales
    .filter(s => ['cash', 'card', 'eft'].includes(s.method))
    .reduce((sum, s) => sum + s.total, 0);
  const todayCreditIssuedAmt = calculateCreditIssued(todaySales);
  const todayPaymentsAmt = calculateCustomerPayments(todayPayments);

  // Active ledger stats
  const activeAgreements = agreements.filter(a => a.status !== 'paid');
  const overdueAgreements = agreements.filter(a => a.status === 'overdue');

  const loanPortfolio = calculateLoanPortfolio(agreements, payments);
  const totalBookExposure = loanPortfolio.totalBookValue;

  // Load database slices for exact financial reconciliation
  const cashMovements = useMemo(() => loadDBList<CashMovement>('cashMovements'), [sales, payments]);
  const cashDays = useMemo(() => loadDBList<CashDay>('cashDays'), [sales, payments]);
  const currentStock = useMemo(() => loadDBList<Product>('stock'), [sales, payments]);
  const writeOffs = useMemo(() => loadDBList<WriteOff>('writeOffs'), [sales, payments]);
  const [overrideLogs, setOverrideLogs] = useState<OverrideLog[]>(() => loadDBList<OverrideLog>('override_logs'));
  
  const [clearedAlerts, setClearedAlerts] = useState<string[]>(() => loadDBList<string>('sassc_cleared_alerts_ids'));
  const [discrepancyLogs, setDiscrepancyLogs] = useState<any[]>(() => loadDBList<any>('discrepancy_logs'));
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    setOverrideLogs(loadDBList<OverrideLog>('override_logs'));
    setClearedAlerts(loadDBList<string>('sassc_cleared_alerts_ids'));
    setDiscrepancyLogs(loadDBList<any>('discrepancy_logs'));
  }, [sales, payments]);

  // Compute Cash on Hand & Bank Cash via Financial Engine
  const cashOnHand = useMemo(() => {
    return calculateCashOnHand(sales, payments, cashMovements, cashDays);
  }, [sales, payments, cashMovements, cashDays]);

  const cashInBank = useMemo(() => {
    return calculateBankBalance(sales, payments, cashMovements);
  }, [sales, payments, cashMovements]);

  const totalCash = cashOnHand + cashInBank;

  // Complete Unified Financial State Analysis using Integer Cents
  const companyFinancials = useMemo(() => {
    const state = calculateCapitalReconciliation(
      sales,
      payments,
      cashMovements,
      cashDays,
      agreements,
      currentStock,
      writeOffs
    );
    
    // Profit Ledger metrics (realized margins, accrued interest, fees, expenses, write-offs)
    const netProfitValue = calculateRealTimeProfit(
      sales,
      cashMovements,
      writeOffs,
      agreements,
      currentStock
    );
    
    return {
      ...state,
      netProfit: netProfitValue,
      totalBusinessValue: state.capitalUnderManagement + netProfitValue
    };
  }, [sales, payments, cashMovements, cashDays, agreements, currentStock, writeOffs]);

  // Extract variables with precision
  const capitalUnderManagement = companyFinancials.capitalUnderManagement;
  const netProfit = companyFinancials.netProfit;
  const totalBusinessValue = companyFinancials.totalBusinessValue;

  const stateDetails = useMemo(() => {
    return calculateCompanyFinancialState(
      sales,
      payments,
      cashMovements,
      cashDays,
      agreements,
      currentStock,
      writeOffs
    );
  }, [sales, payments, cashMovements, cashDays, agreements, currentStock, writeOffs]);

  // Capital vs Profit Split Analysis
  const displayedProfit = Math.max(0, netProfit);
  const displayedCapital = Math.max(0, capitalUnderManagement);
  const totalSplitSum = displayedCapital + displayedProfit;
  const capitalPercentage = totalSplitSum > 0 ? (displayedCapital / totalSplitSum) * 100 : 100;
  const profitPercentage = totalSplitSum > 0 ? (displayedProfit / totalSplitSum) * 100 : 0;

  // DYNAMIC RISK & FRAUD DETECTOR
  const dynamicFraudAlerts = useMemo((): FraudAlert[] => {
    const alerts: FraudAlert[] = [];

    // Rule 1: Negative Margin Retail Sales (Item sold under cost price)
    sales.forEach(sale => {
      if (sale.items) {
        sale.items.forEach(item => {
          const matchedProd = currentStock.find(p => p.id === item.stockId);
          if (matchedProd && matchedProd.buyPrice && item.price < matchedProd.buyPrice) {
            alerts.push({
              id: `fraud-margin-${sale.id}`,
              severity: 'medium',
              title: 'Negative Margin Transaction',
              description: `Product ${item.name} sold below purchase cost in invoice ${sale.id}. Sold: R ${item.price.toFixed(2)}, Cost: R ${matchedProd.buyPrice.toFixed(2)}`,
              date: sale.date,
              category: 'Pricing'
            });
          }
        });
      }
    });

    // Rule 2: High Customer Credit Exposure (> R5,000 without collateral)
    customers.forEach(cust => {
      const exposure = getCustomerExposure(cust.id, agreements);
      if (exposure > 5000) {
        alerts.push({
          id: `fraud-exposure-${cust.id}`,
          severity: 'high',
          title: 'Extreme Exposure Risk',
          description: `Customer ${cust.name} (${cust.surname || ''}) active exposure exceeds limit: ${formatCurrency(exposure)}. No secured assets logged.`,
          date: todayStr,
          category: 'Credit Limits'
        });
      }
    });

    // Rule 3: Unlogged or massive physical cash day variance
    cashDays.forEach(day => {
      if (day.status === 'closed' && day.expectedCash && day.actualCash) {
        const variance = Math.abs(day.expectedCash - day.actualCash);
        if (variance > 150) {
          alerts.push({
            id: `fraud-variance-${day.id}`,
            severity: 'high',
            title: 'Critical Teller Cash Variance',
            description: `Cash Day on ${day.date} closed with physical cash variance of R ${variance.toFixed(2)}. Expected: R ${day.expectedCash.toFixed(2)}, Actual counted: R ${day.actualCash.toFixed(2)}.`,
            date: day.date,
            category: 'Cash Control'
          });
        }
      }
    });

    // Rule 4: Suspicious stock write-offs (theft or damage values > R1,000)
    writeOffs.forEach(w => {
      if (w.lossValue > 1000) {
        alerts.push({
          id: `fraud-writeoff-${w.id}`,
          severity: 'medium',
          title: 'High-Value Stock Write-Off',
          description: `Inventory write-off logged for ${w.name} (SKU: ${w.sku}) worth ${formatCurrency(w.lossValue)}. Reason stated: ${w.reason}`,
          date: w.date.split('T')[0],
          category: 'Inventory Loss'
        });
      }
    });

    // Rule 5: Non-Agreement Payments (Repayments processed with no active credit accounts)
    payments.forEach(p => {
      const activeCustAgreements = agreements.filter(a => a.customerId === p.customerId && a.status !== 'paid');
      if (activeCustAgreements.length === 0) {
        alerts.push({
          id: `fraud-payment-${p.id}`,
          severity: 'low',
          title: 'Suspicious Payment Routing',
          description: `Repayment received (R ${p.amount.toFixed(2)}) from Customer ID ${p.customerId.substring(0,6)} but no active outstanding credit agreement was located.`,
          date: p.date,
          category: 'Repayments'
        });
      }
    });

    return alerts.sort((a, b) => {
      const rank = { high: 3, medium: 2, low: 1 };
      return rank[b.severity] - rank[a.severity];
    });
  }, [sales, customers, agreements, payments, cashDays, writeOffs, currentStock]);

  const recentTimelineActivity = useMemo(() => {
    return [
      ...sales.map(s => ({
        id: s.id,
        date: s.date,
        type: 'Sale',
        desc: `${s.method === 'credit' ? 'Credit Sale' : 'Retail Sale'} — ${s.customerName}`,
        amount: s.total,
        color: s.method === 'credit' ? 'text-amber-500' : 'text-slate-300',
        time: s.created
      })),
      ...payments.map(p => {
        const match = customers.find(c => c.id === p.customerId);
        return {
          id: p.id,
          date: p.date,
          type: 'Payment',
          desc: `Repayment received — ${match ? match.name : 'Client'}`,
          amount: p.amount,
          color: 'text-emerald-400',
          time: p.created
        };
      })
    ]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 8);
  }, [sales, payments, customers]);

  // Handle Supervisor Unlock action
  const handleSupervisorUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (supervisorPasscode === 'LERATO-SUPERVISOR-2026' || supervisorPasscode === '1234') {
      setIsSupervisorMode(true);
      setSupervisorStatusMessage('Supervisor authorization authenticated. System overrides active.');
      setSupervisorPasscode('');
    } else {
      setIsSupervisorMode(false);
      setSupervisorStatusMessage('Authentication failed. Invalid override code.');
    }
  };

  // Register manual supervisor bypass override log
  const handleCreateManualOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustForOverride || !overrideReasonInput.trim()) {
      alert('Please select a customer and specify a valid regulatory override reason.');
      return;
    }

    const matchedCust = customers.find(c => c.id === selectedCustForOverride);
    if (!matchedCust) return;

    const newLog: OverrideLog = {
      id: 'ovr-' + generateUid(),
      customerId: matchedCust.id,
      customerName: `${matchedCust.firstNames || ''} ${matchedCust.surname || ''}`.trim() || matchedCust.name,
      fileNo: matchedCust.id.substring(0, 8),
      date: todayStr,
      type: 'credit_wizard_override',
      overriddenBy: 'usr-admin-1',
      overriddenByName: 'Claudine Pike du Plessis',
      reason: overrideReasonInput,
      outstandingBalance: getCustomerExposure(matchedCust.id, agreements),
      created: new Date().toISOString()
    };

    const updatedLogs = [...overrideLogs, newLog];
    saveDBList('override_logs', updatedLogs);
    setOverrideLogs(updatedLogs);
    setOverrideReasonInput('');
    setSelectedCustForOverride('');
    alert('Administrative override log registered permanently to system audit trail.');
  };

  return (
    <div className="space-y-6">
      
      {/* Date and Location Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100">
            Welcome Back, Principal
          </h2>
          <p className="text-xs text-slate-400">
            Lerato Core Management Console · Lerato Community Financial Services
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="https://whatsapp.com/channel/0029VbBuS4XDzgTAGE2EaO0Z"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-950/30 hover:bg-emerald-950/50 border border-emerald-900/50 rounded-lg px-3 py-1.5 font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp Channel
          </a>
          <span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 font-medium flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-amber-500" />
            {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Real-time Total Financial State Summary Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Capital Preservation & Management
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-100 tracking-tight">
              Capital Under Management
            </h3>
            <p className="text-xs text-slate-400 max-w-xl">
              The primary ledger tracking absolute capital preservation, representing physical register float, digital bank balances, and stock inventory cost.
            </p>
            {currentUser?.role !== 'cashier' ? (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 pt-1 flex-wrap">
                <Info className="h-3.5 w-3.5 text-amber-500/70 shrink-0" />
                Formula: <span className="text-slate-200">Cash on Hand (R {stateDetails.grossCashOnHand.toFixed(2)})</span> + <span className="text-slate-200">Stock @ Cost (R {stateDetails.stockCost.toFixed(2)})</span> + <span className="text-slate-200">Principal (R {stateDetails.outstandingPrincipal.toFixed(2)})</span> + <span className="text-slate-200">Bank (R {stateDetails.bankAccountValue.toFixed(2)})</span> + <span className="text-slate-200">Expense Ledger (R {stateDetails.cashPaidOut.toFixed(2)})</span> - <span className="text-emerald-400">Net Profit (R {netProfit.toFixed(2)})</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 pt-1">
                <Info className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                <span>Formula detail masked for Cashier Operator reconciliation checks.</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-center min-w-[200px]">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Capital Under Management</span>
              <div className="text-2xl font-black text-amber-500 font-mono mt-1">
                {currentUser?.role !== 'cashier' ? formatCurrency(capitalUnderManagement) : 'R ••••••'}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 flex-1 sm:flex-initial">
              <div className="bg-slate-950/60 border border-slate-850 p-2 rounded-lg text-center min-w-[90px]">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Total Cash</span>
                <span className="text-[11px] font-bold text-slate-300 font-mono mt-0.5 block">
                  {currentUser?.role !== 'cashier' ? `R ${stateDetails.grossCashOnHand.toFixed(2)}` : 'R ••••'}
                </span>
              </div>
              <div className="bg-slate-950/60 border border-slate-850 p-2 rounded-lg text-center min-w-[90px]">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Stock Cost</span>
                <span className="text-[11px] font-bold text-slate-300 font-mono mt-0.5 block">
                  {currentUser?.role !== 'cashier' ? `R ${stateDetails.stockCost.toFixed(2)}` : 'R ••••'}
                </span>
              </div>
              <div className="bg-slate-950/60 border border-slate-850 p-2 rounded-lg text-center min-w-[90px]">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Depth Principal</span>
                <span className="text-[11px] font-bold text-rose-450 font-mono mt-0.5 block">
                  {currentUser?.role !== 'cashier' ? `R ${stateDetails.outstandingPrincipal.toFixed(2)}` : 'R ••••'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-amber-500/30 transition">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Cash Sales</span>
              <span className="p-1 rounded bg-amber-500/10 text-amber-400"><TrendingUp size={14} /></span>
            </div>
            <div className="text-2xl font-bold text-amber-500 mt-2 font-mono">
              {formatCurrency(todayCashSalesAmt)}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-850">
            From {todaySales.filter(s => ['cash', 'card', 'eft'].includes(s.method)).length} retail transactions
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-amber-500/30 transition">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Credit Issued</span>
              <span className="p-1 rounded bg-amber-500/10 text-amber-400"><ArrowUpRight size={14} /></span>
            </div>
            <div className="text-2xl font-bold text-amber-500 mt-2 font-mono">
              {formatCurrency(todayCreditIssuedAmt)}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-850">
            Across {todaySales.filter(s => s.method === 'credit').length} credit agreements
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-emerald-500/30 transition">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payments Recovered</span>
              <span className="p-1 rounded bg-emerald-500/10 text-emerald-400"><Wallet size={14} /></span>
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-2 font-mono">
              {formatCurrency(todayPaymentsAmt)}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-850">
            From {todayPayments.length} installment credits
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-amber-500/30 transition">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Book Value</span>
              <span className="p-1 rounded bg-amber-500/10 text-amber-400"><Scale size={14} /></span>
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-2 font-mono">
              {currentUser?.role !== 'cashier' ? formatCurrency(totalBookExposure) : 'R ••••••'}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-850">
            {currentUser?.role !== 'cashier' ? `Active exposure in ${activeAgreements.length} contracts` : 'Masked for Cashier'}
          </div>
        </div>

      </div>

      {/* Capital vs Profit Split View Section - Redacted for Cashiers */}
      {currentUser?.role !== 'cashier' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Scale size={16} className="text-amber-500" />
                Capital vs Profit Allocation Ledger
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Visualizes business liquidity capital structure compared to net profit contributions.
              </p>
            </div>
            <div className="text-right text-xs">
              <span className="text-slate-500 font-semibold block">Total Aggregated Capital Base</span>
              <span className="text-amber-500 font-extrabold font-mono">{formatCurrency(totalSplitSum)}</span>
            </div>
          </div>

          {/* Multi-Segment Horizontal Progress bar */}
          <div className="h-6 w-full rounded-lg overflow-hidden flex bg-slate-950 p-1 border border-slate-850">
            <div 
              style={{ width: `${capitalPercentage}%` }} 
              className="h-full bg-amber-500 rounded-l transition-all duration-500 flex items-center justify-center text-[9px] font-black text-slate-950 font-mono"
              title={`Capital: ${capitalPercentage.toFixed(1)}%`}
            >
              {capitalPercentage > 15 ? `Capital Base ${capitalPercentage.toFixed(0)}%` : ''}
            </div>
            <div 
              style={{ width: `${profitPercentage}%` }} 
              className="h-full bg-emerald-500 rounded-r transition-all duration-500 flex items-center justify-center text-[9px] font-black text-slate-950 font-mono"
              title={`Net Profit: ${profitPercentage.toFixed(1)}%`}
            >
              {profitPercentage > 15 ? `Net Profit ${profitPercentage.toFixed(0)}%` : ''}
            </div>
          </div>

          {/* Detailed Split Table Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-850">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block border-b border-slate-850 pb-1.5 mb-2">Liquidity Capital Structure</span>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Cash-on-Hand (Register Float):</span>
                  <span className="font-mono text-slate-200">{formatCurrency(cashOnHand)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cash-in-Bank (Digital Settlement):</span>
                  <span className="font-mono text-slate-200">{formatCurrency(cashInBank)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Inventory Asset Valuation @ Cost:</span>
                  <span className="font-mono text-slate-200">{formatCurrency(stateDetails.stockCost)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-850/60 pt-1 font-bold text-slate-100">
                  <span>Total Asset capital:</span>
                  <span className="font-mono text-amber-500">{formatCurrency(cashOnHand + cashInBank + stateDetails.stockCost)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-850">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block border-b border-slate-850 pb-1.5 mb-2">Operating Profitability Contribution</span>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Retail Sales Profit (Markup):</span>
                  <span className="font-mono text-slate-200">
                    {formatCurrency(sales.reduce((sum, s) => sum + (s.total || 0), 0) - (sales.reduce((sum, s) => sum + (s.items?.reduce((subSum, item) => subSum + (item.qty * (currentStock.find(p => p.id === item.stockId)?.buyPrice || 0)), 0) || 0), 0)))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Operating Expenses & Cash Outs:</span>
                  <span className="font-mono text-rose-400">-{formatCurrency(cashMovements.filter(m => ['expense', 'stock_purchase', 'cash_out'].includes(m.type)).reduce((sum, m) => sum + m.amount, 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Stock Write-Off Asset Losses:</span>
                  <span className="font-mono text-rose-400">-{formatCurrency(writeOffs.reduce((sum, w) => sum + w.lossValue, 0))}</span>
                </div>
                <div className="flex justify-between border-t border-slate-850/60 pt-1 font-bold text-slate-100">
                  <span>Net Business Operating Profit:</span>
                  <span className="font-mono text-emerald-400">{formatCurrency(netProfit)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Core Widgets Dashboard Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Dynamic Fraud Alerts UI & Transaction Timeline */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* FRAUD ALERTS PANEL - Admin/Supervisor Only */}
          {currentUser?.role !== 'cashier' && (() => {
            const visibleAlerts = dynamicFraudAlerts.filter(alert => !clearedAlerts.includes(alert.id));
            return (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <ShieldAlert className="text-rose-500 h-5 w-5" />
                      Security Monitoring & Fraud Alerts ({visibleAlerts.length})
                    </h3>
                    <span className="text-[10px] text-rose-400 bg-rose-950/30 border border-rose-900/50 px-2.5 py-1 rounded font-bold uppercase">
                      Real-Time Risk Analysis
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {visibleAlerts.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        All transactions and accounts passed strict financial regulatory checkmarks. No anomalies detected.
                      </div>
                    ) : (
                      visibleAlerts.map(alert => (
                        <div key={alert.id} className="p-3 bg-slate-950 border border-slate-850 rounded-lg flex flex-col gap-2.5 text-xs hover:border-rose-500/20 transition">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 shrink-0">
                              {alert.severity === 'high' ? (
                                <AlertOctagon className="text-rose-500 h-4.5 w-4.5" />
                              ) : alert.severity === 'medium' ? (
                                <AlertTriangle className="text-amber-500 h-4.5 w-4.5" />
                              ) : (
                                <Info className="text-slate-400 h-4.5 w-4.5" />
                              )}
                            </div>
                            <div className="flex-1 space-y-1 min-w-0">
                              <div className="flex justify-between items-start gap-2 flex-wrap">
                                <span className="font-bold text-slate-100">{alert.title}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-850 font-bold uppercase">{alert.category}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                    alert.severity === 'high' ? 'bg-rose-500/10 text-rose-400' :
                                    alert.severity === 'medium' ? 'bg-amber-500/10 text-amber-500' :
                                    'bg-slate-800 text-slate-300'
                                  }`}>
                                    {alert.severity}
                                  </span>
                                </div>
                              </div>
                              <p className="text-slate-400 text-[11px] leading-relaxed break-words">{alert.description}</p>
                              <div className="text-[9px] text-slate-500 font-mono">Occurred/Logged: {alert.date}</div>
                            </div>
                          </div>

                          {/* ACTION PANEL */}
                          <div className="pt-2 border-t border-slate-900/60 flex flex-col gap-2">
                            {resolvingAlertId !== alert.id ? (
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResolvingAlertId(alert.id);
                                    setResolutionNotes('');
                                  }}
                                  className="px-2.5 py-1 bg-slate-900 hover:bg-rose-500/10 hover:text-rose-400 border border-slate-850 rounded text-[10px] font-bold text-slate-400 transition cursor-pointer"
                                >
                                  Investigate & Clear Alert
                                </button>
                              </div>
                            ) : (
                              <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2">
                                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Supervisor Resolution notes</label>
                                <textarea
                                  value={resolutionNotes}
                                  onChange={e => setResolutionNotes(e.target.value)}
                                  placeholder="Describe investigations, findings, or corrections applied..."
                                  rows={2}
                                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 p-1.5 rounded text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none font-medium resize-none"
                                />
                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setResolvingAlertId(null);
                                      setResolutionNotes('');
                                    }}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-400 rounded text-[10px] font-bold cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!resolutionNotes.trim()) {
                                        alert('Resolution notes are required.');
                                        return;
                                      }
                                      const logEntry = {
                                        id: generateUid(),
                                        alertId: alert.id,
                                        title: alert.title,
                                        description: alert.description,
                                        category: alert.category,
                                        severity: alert.severity,
                                        date: alert.date,
                                        resolvedBy: currentUser?.fullName || 'Supervisor',
                                        resolvedAt: new Date().toISOString(),
                                        message: resolutionNotes
                                      };
                                      const updatedLogs = [logEntry, ...discrepancyLogs];
                                      const updatedClearedIds = [...clearedAlerts, alert.id];
                                      
                                      saveDBList('discrepancy_logs', updatedLogs);
                                      saveDBList('sassc_cleared_alerts_ids', updatedClearedIds);
                                      
                                      setDiscrepancyLogs(updatedLogs);
                                      setClearedAlerts(updatedClearedIds);
                                      
                                      setResolvingAlertId(null);
                                      setResolutionNotes('');
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded text-[10px] cursor-pointer"
                                  >
                                    Acknowledge & Dismiss Alert
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* HISTORICAL RESOLUTION LOG */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <BookOpen className="text-emerald-500 h-5 w-5" />
                      Supervisor Discrepancies Log ({discrepancyLogs.length})
                    </h3>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 px-2.5 py-1 rounded font-bold uppercase">
                      Audit Records
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                    {discrepancyLogs.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No resolved historical discrepancies found. All clearances are tracked here for audit trails.
                      </div>
                    ) : (
                      discrepancyLogs.map(log => (
                        <div key={log.id} className="p-3 bg-slate-950 border border-slate-850 rounded-lg space-y-2 text-xs">
                          <div className="flex justify-between items-start gap-2 flex-wrap">
                            <div>
                              <span className="font-bold text-slate-100">{log.title}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">Alert Description: {log.description}</span>
                            </div>
                            <span className="text-[9px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-850 font-bold uppercase shrink-0">
                              {log.category}
                            </span>
                          </div>
                          
                          <div className="p-2.5 bg-slate-900/50 border border-slate-850/50 rounded text-[11px] text-slate-300">
                            <strong className="text-[9px] text-amber-500 uppercase tracking-wider block mb-1">Supervisor Resolution Notes:</strong>
                            {log.message}
                          </div>

                          <div className="flex justify-between items-center text-[9px] text-slate-500 pt-1 font-mono">
                            <span>Auditor: <strong className="text-slate-400">{log.resolvedBy}</strong></span>
                            <span>Cleared: {new Date(log.resolvedAt).toLocaleString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* REAL TIME TRANSACTION TIMELINE */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Real-Time Transactions Timeline
              </h3>
              <span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 border border-slate-850 rounded">Live feed</span>
            </div>

            <div className="overflow-hidden border border-slate-850 rounded-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/40 text-slate-400 uppercase text-[9px] font-bold border-b border-slate-800">
                      <th className="p-3">Date</th>
                      <th className="p-3">Event Type</th>
                      <th className="p-3">Reference / Description</th>
                      <th className="p-3 text-right">Sum (ZAR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {recentTimelineActivity.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-500">
                          No financial movements registered yet. Complete sales or capture credits to populate.
                        </td>
                      </tr>
                    ) : (
                      recentTimelineActivity.map((act) => (
                        <tr key={act.id} className="hover:bg-slate-800/10">
                          <td className="p-3 text-slate-500 whitespace-nowrap">{formatDate(act.date)}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              act.type === 'Sale' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                            }`}>
                              {act.type}
                            </span>
                          </td>
                          <td className="p-3 font-medium truncate max-w-[200px] sm:max-w-none">{act.desc}</td>
                          <td className={`p-3 text-right font-bold ${act.color}`}>
                            {formatCurrency(act.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* Right Side: Quick Action & Exposure Risks & Override Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* SUPERVISOR OVERRIDE CONTROLS */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Key size={16} className="text-amber-500 animate-pulse" />
              Supervisor Override Center
            </h3>
            
            <form onSubmit={handleSupervisorUnlock} className="space-y-2 text-xs">
              <label className="text-slate-400 font-semibold mb-1 block">Authentication Pin / Code</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={supervisorPasscode}
                  onChange={e => setSupervisorPasscode(e.target.value)}
                  placeholder="Enter Pin/Passphrase..."
                  className="flex-1 bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs font-mono"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-500 font-bold rounded-lg text-xs"
                >
                  Verify
                </button>
              </div>
              {supervisorStatusMessage && (
                <div className={`p-2 rounded text-[10px] font-bold ${isSupervisorMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {supervisorStatusMessage}
                </div>
              )}
            </form>

            {isSupervisorMode && (
              <div className="border-t border-slate-850 pt-3 space-y-3">
                <div className="bg-slate-950 p-2.5 border border-amber-500/25 rounded-lg text-[10px] text-amber-400 leading-relaxed font-semibold">
                  AUDITOR STATE ACTIVE. You are authorized to manually record exposure exceptions and approve locked credit files.
                </div>
                
                <form onSubmit={handleCreateManualOverride} className="space-y-2 text-xs">
                  <div className="form-group">
                    <label className="text-slate-400 mb-0.5 block font-semibold">Target Client Profile</label>
                    <select
                      value={selectedCustForOverride}
                      onChange={e => setSelectedCustForOverride(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-1.5 rounded text-xs"
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.surname || ''} (ID: {c.id.substring(0, 6)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="text-slate-400 mb-0.5 block font-semibold">Override Reason / Justification</label>
                    <input
                      type="text"
                      value={overrideReasonInput}
                      onChange={e => setOverrideReasonInput(e.target.value)}
                      required
                      placeholder="e.g. Discretionary asset approval..."
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-1.5 rounded text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded text-xs transition active:scale-95"
                  >
                    Bypass limit & Log Override
                  </button>
                </form>
              </div>
            )}

            {/* RECENT OVERRIDE AUDIT LOGS */}
            <div className="space-y-2 border-t border-slate-850 pt-3 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bypass Log Timeline</span>
              {overrideLogs.length === 0 ? (
                <div className="text-[11px] text-slate-500">No regulatory overrides logged.</div>
              ) : (
                <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                  {overrideLogs.slice().reverse().map(log => (
                    <div key={log.id} className="p-2 bg-slate-950 border border-slate-850 rounded text-[11px]">
                      <div className="flex justify-between font-bold text-slate-200">
                        <span>{log.customerName}</span>
                        <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1 rounded uppercase">OVERRIDE</span>
                      </div>
                      <p className="text-[10px] text-slate-400 italic mt-0.5">"{log.reason}"</p>
                      <span className="text-[9px] text-slate-500 block text-right mt-1 font-mono">{log.date} · Claudine P.</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* MONTH-END CLOSE QUICK STATUS WIDGET */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex justify-between items-center text-xs">
              <h3 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1 text-amber-500">
                <BookOpen className="h-4 w-4" /> Month-End Book Close
              </h3>
              <button 
                onClick={() => onNavigate('accounting')} 
                className="text-[10px] text-amber-500 hover:underline uppercase tracking-wide font-bold"
              >
                Books
              </button>
            </div>
            
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Current active ledger period:</span>
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded font-bold text-[10px] uppercase">OPEN</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Reconciliation audits unfreezes when closing books. Make sure all physical drawer counts are balanced prior to month-end.
              </p>
              <button
                onClick={() => onNavigate('accounting')}
                className="w-full py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/30 text-slate-300 hover:text-white font-bold rounded text-[11px] transition"
              >
                Go to Period closing wizard
              </button>
            </div>
          </div>

          {/* Overdue Accounts Alarm */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center text-xs">
              <h3 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1 text-rose-400">
                <AlertOctagon className="h-4 w-4" /> Overdue Risks ({overdueAgreements.length})
              </h3>
              <button 
                onClick={() => onNavigate('overdue')} 
                className="text-[10px] text-amber-500 hover:underline uppercase tracking-wide font-bold"
              >
                Alerts
              </button>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {overdueAgreements.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  ✓ Ledger is clean! No accounts are in arrears.
                </div>
              ) : (
                overdueAgreements.slice(0, 4).map(a => {
                  const match = customers.find(c => c.id === a.customerId);
                  return (
                    <div key={a.id} className="p-2.5 bg-slate-950 border border-slate-850 rounded-lg flex items-center justify-between text-xs hover:border-rose-500/30 transition">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-200 truncate">{match ? match.name : 'Unknown Client'}</div>
                        <div className="text-[10px] text-slate-500">Agr No: {a.agrNumber}</div>
                      </div>
                      <div className="text-right ml-3">
                        <span className="font-bold text-rose-400 block">{formatCurrency(a.balance)}</span>
                        <span className="text-[9px] text-slate-500 bg-rose-500/10 px-1 py-0.5 rounded text-rose-400/80 uppercase font-semibold">Overdue</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
