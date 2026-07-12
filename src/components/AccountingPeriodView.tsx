import React, { useState, useEffect } from 'react';
import { 
  loadDBList, 
  saveDBList, 
  generateUid 
} from '../utils/database';
import { 
  Customer, 
  Agreement, 
  Sale, 
  Payment, 
  CashDay, 
  CashMovement, 
  Product, 
  WriteOff, 
  AccountingPeriod, 
  AccountingAuditLog,
  BarcodeMapping,
  StockAdjustmentEntry
} from '../types';
import {
  calculateSystemTotalValue,
  runAuditReconciliation,
  enhancedCloseAccountingPeriod,
  createBarcodeMapping,
  findProductByBarcode,
  createStockAdjustment,
  calculateStockCostWithAdjustments,
  calculateStockVariance
} from '../utils/auditControlEngine';
import {
  openAccountingPeriod,
  reopenAccountingPeriod,
  validatePeriod
} from '../utils/accountingPeriodEngine';
import { 
  BookOpen, Calendar, Clock, ShieldCheck, AlertTriangle, HelpCircle, 
  Plus, Database, CheckCircle, RefreshCw, Layers, SlidersHorizontal, 
  DollarSign, FileSpreadsheet, Eye, Save, Trash2, ArrowRightLeft, Search, ScanLine
} from 'lucide-react';

export default function AccountingPeriodView() {
  const [activeSubTab, setActiveSubTab] = useState<'periods' | 'audits' | 'inventory'>('periods');

  // Core Data Lists
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [auditLogs, setAuditLogs] = useState<AccountingAuditLog[]>([]);
  const [barcodeMappings, setBarcodeMappings] = useState<BarcodeMapping[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustmentEntry[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [cashDays, setCashDays] = useState<CashDay[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [writeOffs, setWriteOffs] = useState<WriteOff[]>([]);

  // Period Form Modals & Fields
  const [isNewPeriodOpen, setIsNewPeriodOpen] = useState(false);
  const [periodName, setPeriodName] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [periodNotes, setPeriodNotes] = useState('');

  // Reopen Modal
  const [reopenPeriodId, setReopenPeriodId] = useState<string | null>(null);
  const [reopenReasonText, setReopenReasonText] = useState('');

  // Close Wizard / Modal
  const [closingPeriod, setClosingPeriod] = useState<AccountingPeriod | null>(null);
  const [actualCashOnHand, setActualCashOnHand] = useState<string>('');
  const [actualCashInBank, setActualCashInBank] = useState<string>('');
  const [actualStockValue, setActualStockValue] = useState<string>('');
  const [actualLoanPrincipal, setActualLoanPrincipal] = useState<string>('');
  const [actualExpenseLedger, setActualExpenseLedger] = useState<string>('');
  const [closureReason, setClosureReason] = useState<'Cash shortage' | 'Stock loss' | 'System correction' | 'Unknown (fraud risk flag)' | 'None'>('None');
  const [closeNotes, setCloseNotes] = useState<string>('');

  // Barcode / Stock Form
  const [selectedProdForMapping, setSelectedProdForMapping] = useState<string>('');
  const [mappingSku, setMappingSku] = useState<string>('');
  const [mappingBarcode, setMappingBarcode] = useState<string>('');
  const [mappingDesc, setMappingDesc] = useState<string>('');

  // Stock Adjustment Form
  const [selectedProdForAdj, setSelectedProdForAdj] = useState<string>('');
  const [adjType, setAdjType] = useState<'damage' | 'theft' | 'audit_correction' | 'initial_load' | 'manual_add'>('damage');
  const [adjQty, setAdjQty] = useState<string>('');
  const [adjReason, setAdjReason] = useState<string>('');

  // Barcode scanning search
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [scanResult, setScanResult] = useState<Product | null>(null);
  const [scanMessage, setScanMessage] = useState('');

  useEffect(() => {
    loadDatabase();
  }, []);

  const loadDatabase = () => {
    setPeriods(loadDBList<AccountingPeriod>('accountingPeriods'));
    setAuditLogs(loadDBList<AccountingAuditLog>('accountingAuditLogs'));
    setBarcodeMappings(loadDBList<BarcodeMapping>('barcodeMappings'));
    setStockAdjustments(loadDBList<StockAdjustmentEntry>('stockAdjustments'));
    setSales(loadDBList<Sale>('sales'));
    setPayments(loadDBList<Payment>('payments'));
    setCashMovements(loadDBList<CashMovement>('cashMovements'));
    setCashDays(loadDBList<CashDay>('cashDays'));
    setAgreements(loadDBList<Agreement>('agreements'));
    setProducts(loadDBList<Product>('stock'));
    setWriteOffs(loadDBList<WriteOff>('writeOffs'));
  };

  // 1. OPEN NEW PERIOD HANDLER
  const handleCreatePeriod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodName || !periodStart || !periodEnd) return;

    try {
      // Run validation for dates overlaps
      const overlapCheck = validatePeriod(periods, periodStart, periodEnd);
      if (!overlapCheck.valid) {
        alert(`Validation Error: ${overlapCheck.message}`);
        return;
      }

      const result = openAccountingPeriod(
        periods,
        periodName,
        periodStart,
        periodEnd,
        'Claudine Pike du Plessis', // Admin Role Authorizer
        periodNotes
      );

      const updatedPeriods = [...periods, result.period];
      const updatedLogs = [...auditLogs, result.auditLog];

      saveDBList('accountingPeriods', updatedPeriods);
      saveDBList('accountingAuditLogs', updatedLogs);

      setPeriods(updatedPeriods);
      setAuditLogs(updatedLogs);
      setIsNewPeriodOpen(false);

      // Reset form
      setPeriodName('');
      setPeriodStart('');
      setPeriodEnd('');
      setPeriodNotes('');

      alert(`Accounting period "${periodName}" opened successfully.`);
    } catch (err: any) {
      alert(`Error opening period: ${err.message}`);
    }
  };

  // 2. CLOSE BOOK WIZARD SUBMISSION
  const handleClosePeriodSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingPeriod) return;

    try {
      // Reconstruct actual values or fall back to expected system values
      const counts = {
        actualCashOnHand: actualCashOnHand !== '' ? parseFloat(actualCashOnHand) : undefined,
        actualCashInBank: actualCashInBank !== '' ? parseFloat(actualCashInBank) : undefined,
        actualStockValue: actualStockValue !== '' ? parseFloat(actualStockValue) : undefined,
        actualLoanPrincipal: actualLoanPrincipal !== '' ? parseFloat(actualLoanPrincipal) : undefined,
        actualExpenseLedger: actualExpenseLedger !== '' ? parseFloat(actualExpenseLedger) : undefined,
      };

      const result = enhancedCloseAccountingPeriod(
        periods,
        closingPeriod.id,
        'Claudine Pike du Plessis',
        sales,
        payments,
        cashMovements,
        cashDays,
        agreements,
        products,
        writeOffs,
        counts,
        closureReason,
        closeNotes
      );

      // Merge updated period into periods list
      const updatedPeriods = periods.map(p => p.id === result.period.id ? result.period : p);
      const updatedLogs = [...auditLogs, result.auditLog];

      saveDBList('accountingPeriods', updatedPeriods);
      saveDBList('accountingAuditLogs', updatedLogs);

      setPeriods(updatedPeriods);
      setAuditLogs(updatedLogs);
      setClosingPeriod(null);

      // Reset Close form inputs
      setActualCashOnHand('');
      setActualCashInBank('');
      setActualStockValue('');
      setActualLoanPrincipal('');
      setActualExpenseLedger('');
      setClosureReason('None');
      setCloseNotes('');

      alert(`Accounting period "${result.period.name}" closed with status ${result.period.status}.`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // 3. REOPEN PERIOD HANDLER
  const handleReopenPeriodSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenPeriodId || !reopenReasonText.trim()) {
      alert('Please state a valid reason for reopening this historical log.');
      return;
    }

    try {
      const result = reopenAccountingPeriod(
        periods,
        reopenPeriodId,
        'Claudine Pike du Plessis',
        reopenReasonText
      );

      const updatedPeriods = periods.map(p => p.id === result.period.id ? result.period : p);
      const updatedLogs = [...auditLogs, result.auditLog];

      saveDBList('accountingPeriods', updatedPeriods);
      saveDBList('accountingAuditLogs', updatedLogs);

      setPeriods(updatedPeriods);
      setAuditLogs(updatedLogs);
      setReopenPeriodId(null);
      setReopenReasonText('');

      alert(`Accounting period "${result.period.name}" reopened. Status reverted to OPEN.`);
    } catch (err: any) {
      alert(`Error reverting period: ${err.message}`);
    }
  };

  // 4. BARCODE MAPPING REGISTER
  const handleSaveBarcodeMapping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProdForMapping || !mappingSku || !mappingBarcode) {
      alert('Fill all fields to map barcode.');
      return;
    }

    const newMapping = createBarcodeMapping(
      selectedProdForMapping,
      mappingSku,
      mappingBarcode,
      mappingDesc
    );

    const updated = [...barcodeMappings, newMapping];
    saveDBList('barcodeMappings', updated);
    setBarcodeMappings(updated);

    // Reset Form
    setSelectedProdForMapping('');
    setMappingSku('');
    setMappingBarcode('');
    setMappingDesc('');
    alert('Barcode mapping registered successfully.');
  };

  // 5. BARCODE SCAN SEARCH SIMULATOR
  const handleBarcodeSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedBarcode.trim()) return;

    const matchedProd = findProductByBarcode(scannedBarcode, products, barcodeMappings);
    if (matchedProd) {
      setScanResult(matchedProd);
      setScanMessage(`Success: Match found for sku/barcode: "${scannedBarcode}"`);
    } else {
      setScanResult(null);
      setScanMessage(`Warning: No matching SKU or barcode found in database for "${scannedBarcode}".`);
    }
  };

  // 6. STOCK ADJUSTMENT REGISTER
  const handleSaveStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(adjQty);
    if (!selectedProdForAdj || !adjType || isNaN(qty) || qty === 0) {
      alert('Please fill out product, adjustment type, and a non-zero adjustment quantity.');
      return;
    }

    const prod = products.find(p => p.id === selectedProdForAdj);
    if (!prod) return;

    const newAdjustment = createStockAdjustment(
      selectedProdForAdj,
      prod.sku,
      adjType,
      qty,
      prod.buyPrice || 0,
      adjReason || 'Manual physical audit correction',
      'Claudine Pike du Plessis'
    );

    const updatedAdjs = [...stockAdjustments, newAdjustment];
    saveDBList('stockAdjustments', updatedAdjs);
    setStockAdjustments(updatedAdjs);

    // Adjust the local product quantity to keep physical catalog updated
    const updatedProducts = products.map(p => {
      if (p.id === selectedProdForAdj) {
        return {
          ...p,
          qty: (p.qty || 0) + qty,
          modifiedDate: new Date().toISOString()
        };
      }
      return p;
    });
    saveDBList('stock', updatedProducts);
    setProducts(updatedProducts);

    // Reset Form
    setSelectedProdForAdj('');
    setAdjQty('');
    setAdjReason('');
    alert(`Stock adjustment of ${qty} units registered for ${prod.name}. Catalog updated.`);
  };

  const deleteMapping = (id: string) => {
    if (confirm('Are you sure you want to delete this mapping?')) {
      const updated = barcodeMappings.filter(m => m.id !== id);
      saveDBList('barcodeMappings', updated);
      setBarcodeMappings(updated);
    }
  };

  // Close Wizard Live Variance Calculator
  const getLiveVariance = () => {
    if (!closingPeriod) return null;
    const counts = {
      actualCashOnHand: actualCashOnHand !== '' ? parseFloat(actualCashOnHand) : undefined,
      actualCashInBank: actualCashInBank !== '' ? parseFloat(actualCashInBank) : undefined,
      actualStockValue: actualStockValue !== '' ? parseFloat(actualStockValue) : undefined,
      actualLoanPrincipal: actualLoanPrincipal !== '' ? parseFloat(actualLoanPrincipal) : undefined,
      actualExpenseLedger: actualExpenseLedger !== '' ? parseFloat(actualExpenseLedger) : undefined,
    };

    return runAuditReconciliation(
      sales,
      payments,
      cashMovements,
      cashDays,
      agreements,
      products,
      writeOffs,
      counts,
      stockAdjustments
    );
  };

  const liveVariance = getLiveVariance();

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-850 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="text-amber-500 h-6 w-6" /> 
            Accounting Ledger & Audit Control
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Reconcile financial books, manage monthly closings, run automated audits, and register inventory adjustment logs.
          </p>
        </div>
        <div className="flex gap-2">
          {activeSubTab === 'periods' && (
            <button
              onClick={() => setIsNewPeriodOpen(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition active:scale-95 shadow-lg shadow-amber-500/10"
            >
              <Plus size={14} className="stroke-[3]" /> Open Financial Period
            </button>
          )}
          <button
            onClick={loadDatabase}
            className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-amber-500 transition active:rotate-180"
            title="Refresh database"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* SUB TAB MENU */}
      <div className="flex gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-850 max-w-md">
        <button
          onClick={() => setActiveSubTab('periods')}
          className={`flex-1 py-1.5 text-center text-xs font-bold rounded-md transition ${
            activeSubTab === 'periods'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          Accounting Periods
        </button>
        <button
          onClick={() => setActiveSubTab('audits')}
          className={`flex-1 py-1.5 text-center text-xs font-bold rounded-md transition ${
            activeSubTab === 'audits'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          Audit Logs
        </button>
        <button
          onClick={() => setActiveSubTab('inventory')}
          className={`flex-1 py-1.5 text-center text-xs font-bold rounded-md transition ${
            activeSubTab === 'inventory'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-100'
          }`}
        >
          Inventory & Barcode Mappings
        </button>
      </div>

      {/* -------------------- SUB TAB: ACCOUNTING PERIODS -------------------- */}
      {activeSubTab === 'periods' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-850 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Database size={14} className="text-amber-500" /> Historical Financial Periods List
              </h3>
            </div>
            
            {periods.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No financial periods have been registered in this database. Click "Open Financial Period" to initialize.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-850 text-slate-400 font-bold">
                      <th className="p-3">Period Name</th>
                      <th className="p-3">Date Boundaries</th>
                      <th className="p-3">Opening Capital</th>
                      <th className="p-3">Gross Revenue</th>
                      <th className="p-3">Operating Exp</th>
                      <th className="p-3">Net Profit</th>
                      <th className="p-3">Closing Capital</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Audit Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 font-medium text-slate-300">
                    {periods.map((p) => {
                      const netProfit = (p.grossProfit || 0) - (p.operationalExpenses || 0);
                      const isAuditException = p.status === 'AUDIT_EXCEPTION';
                      return (
                        <tr key={p.id} className="hover:bg-slate-850/20 transition">
                          <td className="p-3 font-bold text-slate-100">{p.name}</td>
                          <td className="p-3 text-slate-400 text-[11px]">{p.startDate} to {p.endDate}</td>
                          <td className="p-3 font-mono text-slate-200">ZAR {p.capitalOpeningBalance.toFixed(2)}</td>
                          <td className="p-3 font-mono text-emerald-400">+{(p.grossProfit || 0).toFixed(2)}</td>
                          <td className="p-3 font-mono text-rose-400">-{(p.operationalExpenses || 0).toFixed(2)}</td>
                          <td className="p-3 font-mono text-slate-100">ZAR {netProfit.toFixed(2)}</td>
                          <td className="p-3 font-mono font-bold text-slate-100">
                            ZAR {(p.capitalClosingBalance || p.capitalOpeningBalance).toFixed(2)}
                          </td>
                          <td className="p-3">
                            {p.status === 'OPEN' && (
                              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-full font-bold text-[10px]">OPEN</span>
                            )}
                            {p.status === 'CLOSED' && (
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full font-bold text-[10px]">CLOSED</span>
                            )}
                            {isAuditException && (
                              <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-full font-bold text-[10px]" title="Variance identified during reconciliation">AUDIT EXCEPTION</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {p.status === 'OPEN' ? (
                              <button
                                onClick={() => setClosingPeriod(p)}
                                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-[10px] cursor-pointer transition active:scale-95"
                              >
                                Close Books & Audit
                              </button>
                            ) : (
                              <button
                                onClick={() => setReopenPeriodId(p.id)}
                                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold rounded text-[10px] cursor-pointer transition active:scale-95"
                              >
                                Reopen Log
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* FINANCIAL METRIC SUMMARY CARD */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-lg">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Active Periods</span>
                <span className="text-xl font-extrabold text-slate-100">{periods.filter(p => p.status === 'OPEN').length} Open</span>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-lg">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Audit Exceptions</span>
                <span className="text-xl font-extrabold text-slate-100">{periods.filter(p => p.status === 'AUDIT_EXCEPTION').length} Unresolved</span>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Verified Reconciliations</span>
                <span className="text-xl font-extrabold text-slate-100">{periods.filter(p => p.status === 'CLOSED').length} Passed</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- SUB TAB: AUDIT LOGS -------------------- */}
      {activeSubTab === 'audits' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-850">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock size={14} className="text-amber-500" /> Historical Audit Logs & Verification Timeline
            </h3>
          </div>
          
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No audit logs recorded. Open, close, or reopen accounting periods to capture automated logs.
            </div>
          ) : (
            <div className="divide-y divide-slate-850 p-4 space-y-4">
              {auditLogs.slice().reverse().map((log) => {
                const isError = log.action.includes('REOPEN') || log.action.includes('REVERT') || log.reason?.includes('WARNING');
                return (
                  <div key={log.id} className="pt-4 first:pt-0 flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                          isError ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {log.action}
                        </span>
                        <span className="text-slate-400 text-[10px]">{log.timestamp}</span>
                      </div>
                      <p className="text-slate-200 font-semibold">{log.reason}</p>
                      <p className="text-[11px] text-slate-500 font-medium">Authorized by: <strong className="text-slate-400">{log.user}</strong></p>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 bg-slate-950 py-1 px-2.5 rounded border border-slate-850 self-start">
                      ID: {log.id}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* -------------------- SUB TAB: INVENTORY & STOCK CONTROL -------------------- */}
      {activeSubTab === 'inventory' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* LEFT COLUMN: STOCK ADJUSTMENT FORM */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                  <SlidersHorizontal size={14} className="text-amber-500" /> Register Stock Adjustment
                </h3>
                <p className="text-[11px] text-slate-400">Log manual inventory counts, theft, damaged items, or initial system load</p>
              </div>

              <form onSubmit={handleSaveStockAdjustment} className="space-y-4 text-xs">
                <div className="form-group">
                  <label className="text-slate-400 font-semibold mb-1 block">Target Product Catalog SKU</label>
                  <select
                    value={selectedProdForAdj}
                    onChange={e => setSelectedProdForAdj(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs"
                  >
                    <option value="">-- Choose Product SKU --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.sku} - {p.name} (Current Qty: {p.qty || 0})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="text-slate-400 font-semibold mb-1 block">Adjustment Type</label>
                    <select
                      value={adjType}
                      onChange={e => setAdjType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs"
                    >
                      <option value="damage">Damage Loss (-)</option>
                      <option value="theft">Theft Loss (-)</option>
                      <option value="audit_correction">Audit Physical Correction (+/-)</option>
                      <option value="initial_load">Initial Stock Load (+)</option>
                      <option value="manual_add">Manual Receipt Add (+)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="text-slate-400 font-semibold mb-1 block">Quantity Adjusted</label>
                    <input
                      type="number"
                      value={adjQty}
                      placeholder="e.g. -5 or 10"
                      required
                      onChange={e => setAdjQty(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="text-slate-400 font-semibold mb-1 block">Compulsory Note / Reason</label>
                  <textarea
                    value={adjReason}
                    required
                    onChange={e => setAdjReason(e.target.value)}
                    rows={3}
                    placeholder="Provide detailed explanation for this adjustment..."
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition active:scale-[0.98]"
                >
                  Save Stock Adjustment
                </button>
              </form>
            </div>

            {/* ADJSUTMENT HISTORY LOGS */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-850">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Adjustment Ledger History
                </h3>
              </div>
              
              {stockAdjustments.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">No manual stock adjustments logged yet.</div>
              ) : (
                <div className="divide-y divide-slate-850 max-h-64 overflow-y-auto">
                  {stockAdjustments.slice().reverse().map(adj => {
                    const isLoss = adj.quantityAdjusted < 0;
                    return (
                      <div key={adj.id} className="p-3 text-xs space-y-1">
                        <div className="flex justify-between font-bold">
                          <span className="text-slate-200">SKU: {adj.sku}</span>
                          <span className={isLoss ? 'text-rose-400' : 'text-emerald-400'}>
                            {adj.quantityAdjusted > 0 ? `+${adj.quantityAdjusted}` : adj.quantityAdjusted} Units
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px]">{adj.reason}</p>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>By: {adj.user}</span>
                          <span>Value: ZAR {(adj.costValueAdjusted || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: BARCODE MAPPINGS & SIMULATOR */}
          <div className="space-y-6">
            
            {/* SCANNING & LOOKUP SIMULATOR */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                  <ScanLine size={14} className="text-amber-500" /> Barcode Scanning Lookup
                </h3>
                <p className="text-[11px] text-slate-400">Simulate scanner input or search SKU variations</p>
              </div>

              <form onSubmit={handleBarcodeSearch} className="flex gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Scan or enter barcode/SKU..."
                  value={scannedBarcode}
                  onChange={e => setScannedBarcode(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs font-mono"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-lg text-xs flex items-center gap-1.5"
                >
                  <Search size={14} /> Find
                </button>
              </form>

              {scanMessage && (
                <div className={`p-3 rounded text-[11px] font-bold ${
                  scanMessage.startsWith('Success') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-500'
                }`}>
                  {scanMessage}
                </div>
              )}

              {scanResult && (
                <div className="bg-slate-950 p-4 border border-slate-850 rounded-lg space-y-2 text-xs">
                  <div className="flex justify-between font-bold text-slate-200">
                    <span>{scanResult.name}</span>
                    <span className="font-mono text-amber-500">ZAR {scanResult.price.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <div>SKU: <span className="font-mono text-slate-300">{scanResult.sku}</span></div>
                    <div>Stock Qty: <span className="text-slate-300">{scanResult.qty || 0}</span></div>
                    <div>Cost Price: <span className="font-mono text-slate-300">ZAR {(scanResult.buyPrice || 0).toFixed(2)}</span></div>
                    <div>Markup: <span className="text-slate-300">{Math.round((scanResult.price - (scanResult.buyPrice || 0)) / (scanResult.buyPrice || 1) * 100)}%</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* REGISTER BARCODE ASSOCIATION */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                  <Plus size={14} className="text-amber-500" /> Link Barcode Mapping
                </h3>
                <p className="text-[11px] text-slate-400">Associate an external barcode scan value back to a master Catalog SKU</p>
              </div>

              <form onSubmit={handleSaveBarcodeMapping} className="space-y-4 text-xs">
                <div className="form-group">
                  <label className="text-slate-400 font-semibold mb-1 block">Master Catalog Product</label>
                  <select
                    value={selectedProdForMapping}
                    onChange={e => setSelectedProdForMapping(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs"
                  >
                    <option value="">-- Select Master Product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (SKU: {p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="text-slate-400 font-semibold mb-1 block">SKU Code</label>
                    <input
                      type="text"
                      placeholder="e.g. BEV-COKE330"
                      value={mappingSku}
                      required
                      onChange={e => setMappingSku(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs font-mono"
                    />
                  </div>

                  <div className="form-group">
                    <label className="text-slate-400 font-semibold mb-1 block">Scanned Barcode</label>
                    <input
                      type="text"
                      placeholder="e.g. 6001108000012"
                      value={mappingBarcode}
                      required
                      onChange={e => setMappingBarcode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="text-slate-400 font-semibold mb-1 block">Description (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Coca-Cola 330ml Can Pack"
                    value={mappingDesc}
                    onChange={e => setMappingDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-500 font-bold rounded-lg text-xs transition active:scale-[0.98]"
                >
                  Map Barcode Association
                </button>
              </form>
            </div>

            {/* MAPPED BARCODES LIST */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-850">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Active Barcode Mappings Ledger
                </h3>
              </div>
              
              {barcodeMappings.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">No custom barcode mappings defined.</div>
              ) : (
                <div className="divide-y divide-slate-850 max-h-64 overflow-y-auto">
                  {barcodeMappings.map(mapping => {
                    const prod = products.find(p => p.id === mapping.productId);
                    return (
                      <div key={mapping.id} className="p-3 text-xs flex justify-between items-center hover:bg-slate-850/10">
                        <div>
                          <div className="font-bold text-slate-200">{prod?.name || 'Unknown Product'}</div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            SKU: <span className="font-mono text-slate-400">{mapping.sku}</span> | Barcode: <span className="font-mono text-slate-400">{mapping.barcode}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteMapping(mapping.id)}
                          className="p-1.5 bg-slate-950 hover:bg-rose-500/10 border border-slate-850 rounded text-slate-500 hover:text-rose-400 transition"
                          title="Delete Mapping"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ==================== MODAL: OPEN PERIOD FORM ==================== */}
      {isNewPeriodOpen && (
        <div className="modal-overlay open" onClick={() => setIsNewPeriodOpen(false)}>
          <div className="modal max-w-sm bg-slate-900 border border-slate-800 text-slate-100" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleCreatePeriod}>
              <div className="modal-header">
                <h3>Open New Accounting Period</h3>
                <button type="button" className="close-btn" onClick={() => setIsNewPeriodOpen(false)}>×</button>
              </div>
              
              <div className="modal-body p-5 space-y-4 text-xs">
                <div className="form-group">
                  <label className="text-slate-400 font-semibold mb-1 block">Period Designation Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. June 2026"
                    value={periodName}
                    onChange={e => setPeriodName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="text-slate-400 font-semibold mb-1 block">Start Date</label>
                    <input
                      type="date"
                      required
                      value={periodStart}
                      onChange={e => setPeriodStart(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-slate-400 font-semibold mb-1 block">End Date</label>
                    <input
                      type="date"
                      required
                      value={periodEnd}
                      onChange={e => setPeriodEnd(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="text-slate-400 font-semibold mb-1 block">Authorizer / Launch Notes</label>
                  <textarea
                    placeholder="Provide any comments or instructions for this financial period..."
                    value={periodNotes}
                    onChange={e => setPeriodNotes(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs resize-none"
                  />
                </div>
              </div>

              <div className="modal-footer p-4 bg-slate-950 rounded-b-xl border-t border-slate-850 flex justify-end gap-2">
                <button type="button" className="btn btn-secondary text-xs" onClick={() => setIsNewPeriodOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary text-xs font-bold">Open Period</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: MONTH-END CLOSE WIZARD ==================== */}
      {closingPeriod && (
        <div className="modal-overlay open" onClick={() => setClosingPeriod(null)}>
          <div className="modal max-w-lg bg-slate-900 border border-slate-800 text-slate-100" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleClosePeriodSubmit}>
              <div className="modal-header">
                <div>
                  <h3>Close Books & Verification Audit</h3>
                  <span className="text-[10px] text-slate-400 block font-semibold">Closing: {closingPeriod.name} ({closingPeriod.startDate} to {closingPeriod.endDate})</span>
                </div>
                <button type="button" className="close-btn" onClick={() => setClosingPeriod(null)}>×</button>
              </div>

              <div className="modal-body p-5 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
                
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-[11px] leading-relaxed">
                  <strong>SYSTEM SECURITY DIRECTIVE:</strong> Input actual physical asset counts below to run reconciliation. If variances are detected, a valid closure reason is strictly required to close the books. Silent write-offs are blocked.
                </div>

                <div className="grid grid-cols-2 gap-4">
                  
                  {/* INPUTS COL */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-200 border-b border-slate-800 pb-1 uppercase tracking-wider text-[10px]">Physical Audit Counts</h4>
                    
                    <div className="form-group">
                      <label className="text-slate-400 font-semibold mb-0.5 block">Actual Cash On Hand (ZAR)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Leave blank for auto-match"
                        value={actualCashOnHand}
                        onChange={e => setActualCashOnHand(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-1.5 rounded text-xs font-mono text-amber-500"
                      />
                    </div>

                    <div className="form-group">
                      <label className="text-slate-400 font-semibold mb-0.5 block">Actual Cash In Bank (ZAR)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Leave blank for auto-match"
                        value={actualCashInBank}
                        onChange={e => setActualCashInBank(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-1.5 rounded text-xs font-mono text-amber-500"
                      />
                    </div>

                    <div className="form-group">
                      <label className="text-slate-400 font-semibold mb-0.5 block">Actual Stock Value @ Cost (ZAR)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Leave blank for auto-match"
                        value={actualStockValue}
                        onChange={e => setActualStockValue(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-1.5 rounded text-xs font-mono text-amber-500"
                      />
                    </div>

                    <div className="form-group">
                      <label className="text-slate-400 font-semibold mb-0.5 block">Actual Outstanding Principal (ZAR)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Leave blank for auto-match"
                        value={actualLoanPrincipal}
                        onChange={e => setActualLoanPrincipal(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-1.5 rounded text-xs font-mono text-amber-500"
                      />
                    </div>
                  </div>

                  {/* COMPARATIVE SYSTEM PANEL */}
                  <div className="space-y-3 bg-slate-950 p-3 rounded-lg border border-slate-850">
                    <h4 className="font-bold text-slate-400 border-b border-slate-850 pb-1 uppercase tracking-wider text-[10px]">Expected System Ledger</h4>
                    
                    {liveVariance && (
                      <div className="space-y-2 text-[11px] font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Capital Ledger:</span>
                          <span className="text-slate-300">ZAR {liveVariance.expectedCapital.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Physical Snapshot:</span>
                          <span className="text-slate-300 font-bold">ZAR {liveVariance.actualSystemValue.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-850 pt-1.5 font-bold">
                          <span className="text-slate-400">Ledger Discrepancy:</span>
                          <span className={liveVariance.isMatched ? 'text-emerald-400' : 'text-rose-400'}>
                            ZAR {liveVariance.difference.toFixed(2)}
                          </span>
                        </div>

                        {!liveVariance.isMatched && (
                          <div className="space-y-1 pt-2 text-[10px] border-t border-dashed border-slate-800 text-slate-400 font-medium">
                            <div className="font-bold text-rose-400 mb-0.5 uppercase tracking-wide">Variance Exceptions:</div>
                            {liveVariance.exceptions.missingCash !== 0 && (
                              <div>● Cash Variance: ZAR {liveVariance.exceptions.missingCash.toFixed(2)}</div>
                            )}
                            {liveVariance.exceptions.stockVariance !== 0 && (
                              <div>● Stock Variance: ZAR {liveVariance.exceptions.stockVariance.toFixed(2)}</div>
                            )}
                            {liveVariance.exceptions.loanVariance !== 0 && (
                              <div>● Debt Ledger Variance: ZAR {liveVariance.exceptions.loanVariance.toFixed(2)}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>

                {/* CONDITIONAL CLOSURE REASON */}
                {liveVariance && !liveVariance.isMatched && (
                  <div className="space-y-3 pt-3 border-t border-slate-800">
                    <div className="form-group">
                      <label className="text-rose-400 font-bold mb-1 block">A variance of ZAR {liveVariance.difference} was identified. Select Closure Reason:</label>
                      <select
                        value={closureReason}
                        onChange={e => setClosureReason(e.target.value as any)}
                        required
                        className="w-full bg-slate-950 border border-rose-500/30 text-rose-300 p-2 rounded text-xs font-bold"
                      >
                        <option value="None">-- Select Reason to Force Closure --</option>
                        <option value="Cash shortage">Cash shortage (Physical teller variance)</option>
                        <option value="Stock loss">Stock loss (Theft or damage variance)</option>
                        <option value="System correction">System correction (Historical accounting correction)</option>
                        <option value="Unknown (fraud risk flag)">Unknown (Fraud risk flag - triggers auditor review)</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="form-group pt-3 border-t border-slate-800">
                  <label className="text-slate-400 font-semibold mb-1 block">Compulsory Closer Comments / Notes</label>
                  <textarea
                    placeholder="Describe audit adjustments, stock takes, or explanations..."
                    value={closeNotes}
                    required
                    onChange={e => setCloseNotes(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs resize-none"
                  />
                </div>

              </div>

              <div className="modal-footer p-4 bg-slate-950 rounded-b-xl border-t border-slate-850 flex justify-end gap-2">
                <button type="button" className="btn btn-secondary text-xs" onClick={() => setClosingPeriod(null)}>Cancel</button>
                <button 
                  type="submit" 
                  className={`btn text-xs font-extrabold ${
                    liveVariance && !liveVariance.isMatched ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'btn-primary'
                  }`}
                >
                  Verify Audit & Close Books
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: REOPEN REASON FORM ==================== */}
      {reopenPeriodId && (
        <div className="modal-overlay open" onClick={() => setReopenPeriodId(null)}>
          <div className="modal max-w-sm bg-slate-900 border border-slate-800 text-slate-100" onClick={e => e.stopPropagation()}>
            <form onSubmit={reopenPeriodId ? handleReopenPeriodSubmit : e => e.preventDefault()}>
              <div className="modal-header bg-rose-950/20">
                <h3 className="text-rose-400">Reopen Closed Period</h3>
                <button type="button" className="close-btn" onClick={() => setReopenPeriodId(null)}>×</button>
              </div>

              <div className="modal-body p-5 space-y-4 text-xs">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-[11px] leading-relaxed font-semibold">
                  WARNING: Reopening a closed period unfreezes historical financial balances. This action is logged permanently to the Audit Trail.
                </div>

                <div className="form-group">
                  <label className="text-slate-400 font-semibold mb-1 block">Reason for Reopening *</label>
                  <textarea
                    placeholder="Provide a mandatory detailed explanation for audit purposes..."
                    value={reopenReasonText}
                    required
                    onChange={e => setReopenReasonText(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs resize-none"
                  />
                </div>
              </div>

              <div className="modal-footer p-4 bg-slate-950 rounded-b-xl border-t border-slate-850 flex justify-end gap-2">
                <button type="button" className="btn btn-secondary text-xs" onClick={() => setReopenPeriodId(null)}>Cancel</button>
                <button type="submit" className="btn bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold">Unfreeze & Reopen</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
