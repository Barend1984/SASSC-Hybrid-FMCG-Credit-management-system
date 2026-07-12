import React, { useState } from 'react';
import { Agreement, Customer, Payment } from '../types';
import { loadDBList, saveDBList, generateUid } from '../utils/database';
import { generateAcknowledgementOfDebt, generateAccountInvoice, downloadRtfFile } from '../utils/rtfGenerator';
import { printLegalAgreement, printAccountInvoice, printSalaryConsent, printAffordabilityDeclaration, printFreedomOfChoiceMandate, printLossPayeeNominationMandate, printForm20Quotation } from '../utils/printDoc';
import { Search, FileText, Download, CreditCard, Calendar, CheckCircle2, AlertTriangle, Eye, Sparkles, Printer } from 'lucide-react';
import DocumentPreviewModal from './DocumentPreviewModal';

interface AgreementsViewProps {
  agreements: Agreement[];
  customers: Customer[];
  onRefreshDB: () => void;
  onNavigate: (page: string) => void;
  activeDay: any;
}

export default function AgreementsView({ agreements, customers, onRefreshDB, onNavigate, activeDay }: AgreementsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Detailed view modal
  const [selectedAgrId, setSelectedAgrId] = useState<string | null>(null);

  // Document preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewType, setPreviewType] = useState<'aod' | 'invoice' | 'csv' | 'salary_consent' | 'affordability_dec'>('aod');
  const [previewAgreement, setPreviewAgreement] = useState<Agreement | null>(null);
  const [previewCustomer, setPreviewCustomer] = useState<Customer | null>(null);

  const handlePreviewDoc = (agreement: Agreement, docType: 'aod' | 'invoice' | 'salary_consent' | 'affordability_dec') => {
    const cust = customers.find(c => c.id === agreement.customerId);
    if (!cust) {
      alert('Associated customer profile not found.');
      return;
    }
    setPreviewAgreement(agreement);
    setPreviewCustomer(cust);
    setPreviewType(docType);
    
    let titleStr = 'Document Preview';
    if (docType === 'aod') titleStr = 'Acknowledgement of Debt (AOD) Preview';
    else if (docType === 'invoice') titleStr = 'Tax Account Invoice Preview';
    else if (docType === 'salary_consent') titleStr = 'Salary Deduction Consent Preview';
    else if (docType === 'affordability_dec') titleStr = 'Necessary Expense Affordability Declaration Preview';
    
    setPreviewTitle(titleStr);
    setPreviewOpen(true);
  };
  
  // Payment modal state
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [payAgrId, setPayAgrId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'eft' | 'debicheck'>('cash');
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');

  const formatCurrency = (amount: number): string => {
    return 'R ' + (amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const handleDownloadRtf = (agreement: Agreement, docType: 'aod' | 'invoice') => {
    const cust = customers.find(c => c.id === agreement.customerId);
    if (!cust) {
      alert('Associated customer profile not found.');
      return;
    }

    if (docType === 'aod') {
      const rtf = generateAcknowledgementOfDebt(agreement, cust);
      downloadRtfFile(`${agreement.agrNumber}_Acknowledgement_Of_Debt.rtf`, rtf);
    } else {
      const rtf = generateAccountInvoice(agreement, cust);
      downloadRtfFile(`${agreement.agrNumber}_Account_Invoice.rtf`, rtf);
    }
  };

  const openPaymentModal = (agr: Agreement) => {
    if (!activeDay) {
      alert('⛔ Cannot register repayments while the cash day register is closed! Please open the daily register first.');
      return;
    }
    setPayAgrId(agr.id);
    setPayAmount(agr.balance.toFixed(2));
    setPayRef(agr.agrNumber);
    setPayNote('');
    setIsPaymentOpen(true);
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDay) {
      alert('⛔ Open the daily register first in Cash Control.');
      return;
    }

    const amt = parseFloat(payAmount) || 0;
    if (amt <= 0) {
      alert('Please enter a valid repayment sum.');
      return;
    }

    const list = loadDBList<Agreement>('agreements');
    const agr = list.find(a => a.id === payAgrId);
    if (!agr) return;

    if (amt > agr.balance) {
      if (!window.confirm(`Repayment exceeds outstanding agreement balance of R${agr.balance.toFixed(2)}. This will register a credit surplus. Continue?`)) return;
    }

    // Save payment
    const payment: Payment = {
      id: generateUid(),
      customerId: agr.customerId,
      agrId: agr.id,
      agrNumber: agr.agrNumber,
      date: new Date().toISOString().split('T')[0],
      amount: amt,
      method: payMethod,
      reference: payRef || agr.agrNumber,
      note: payNote,
      created: new Date().toISOString()
    };

    const allPayments = loadDBList<Payment>('payments');
    allPayments.push(payment);
    saveDBList('payments', allPayments);

    // Apply allocation to agreement
    agr.paid = Math.round((agr.paid + amt) * 100) / 100;
    agr.balance = Math.max(0, Math.round((agr.totalAmount - agr.paid) * 100) / 100);
    
    if (agr.balance <= 0) {
      agr.status = 'paid';
    }
    agr.updated = new Date().toISOString();

    saveDBList('agreements', list);
    setIsPaymentOpen(false);
    onRefreshDB();
    alert('Repayment of ' + formatCurrency(amt) + ' successfully recorded and allocated.');
  };

  // Filter agreements list
  const filteredAgreements = agreements.filter(a => {
    const cust = customers.find(c => c.id === a.customerId);
    const custName = cust ? cust.name.toLowerCase() : '';
    const fileNo = cust ? cust.fileNo.toLowerCase() : '';
    const matchesSearch = a.agrNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          custName.includes(searchTerm.toLowerCase()) ||
                          fileNo.includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || a.status === statusFilter;
    const matchesDates = (!dateFrom || a.date >= dateFrom) && (!dateTo || a.date <= dateTo);
    return matchesSearch && matchesStatus && matchesDates;
  }).reverse();

  const selectedAgreement = agreements.find(a => a.id === selectedAgrId) || null;
  const selectedAgreementCustomer = selectedAgreement ? customers.find(c => c.id === selectedAgreement.customerId) || null : null;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <FileText className="text-amber-500" /> Credit Agreements Ledger
          </h2>
          <p className="text-sm text-slate-400">Audit approved groceries and loan advances, issue direct payments, and export RTF files</p>
        </div>
        <button
          onClick={() => onNavigate('wizard')}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-lg shadow-amber-500/10"
        >
          <Sparkles className="h-4 w-4" /> Start New Application Wizard
        </button>
      </div>

      {/* Filter panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search agreement # or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg text-slate-200 py-2 px-3 text-xs focus:outline-none focus:border-amber-500"
        >
          <option value="">All Statuses</option>
          <option value="active">Active (Pending)</option>
          <option value="overdue">Arrears (Overdue)</option>
          <option value="paid">Paid (Settled)</option>
        </select>

        <div className="flex gap-2 items-center">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Date From:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg text-slate-200 py-1.5 px-2 text-xs focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex gap-2 items-center">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">To:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg text-slate-200 py-1.5 px-2 text-xs focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/40 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800">
                <th className="p-3.5">Agreement No</th>
                <th className="p-3.5">Customer Name</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5 text-right">Groceries</th>
                <th className="p-3.5 text-right">Loan Advance</th>
                <th className="p-3.5 text-right">Fees</th>
                <th className="p-3.5 text-right">Total Owed</th>
                <th className="p-3.5 text-right">Repaid</th>
                <th className="p-3.5 text-right">Balance</th>
                <th className="p-3.5">Payday Due</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs">
              {filteredAgreements.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-500">
                    No credit agreements recorded matching criteria.
                  </td>
                </tr>
              ) : (
                filteredAgreements.map(a => {
                  const cust = customers.find(c => c.id === a.customerId);
                  const isArrears = a.status === 'overdue';
                  const feesSum = (a.initiationFee || 0) + (a.serviceFee || 0);

                  return (
                    <tr key={a.id} className="hover:bg-slate-800/10">
                      <td className="p-3.5 font-bold text-slate-200">{a.agrNumber}</td>
                      <td className="p-3.5 font-medium text-slate-300">
                        {cust ? cust.name : '—'}
                        {cust && <span className="text-[10px] text-slate-500 block">File: {cust.fileNo}</span>}
                      </td>
                      <td className="p-3.5 text-slate-400">{formatDate(a.date)}</td>
                      <td className="p-3.5 text-right text-slate-400">{formatCurrency(a.goods)}</td>
                      <td className="p-3.5 text-right text-slate-400">{formatCurrency(a.loan)}</td>
                      <td className="p-3.5 text-right text-slate-500">{formatCurrency(feesSum)}</td>
                      <td className="p-3.5 text-right text-amber-500 font-bold">{formatCurrency(a.totalAmount)}</td>
                      <td className="p-3.5 text-right text-emerald-400 font-semibold">{formatCurrency(a.paid)}</td>
                      <td className={`p-3.5 text-right font-black ${a.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatCurrency(a.balance)}
                      </td>
                      <td className="p-3.5 text-slate-400 font-medium">{formatDate(a.dueDate)}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          a.status === 'paid' 
                            ? 'bg-emerald-500/15 text-emerald-400' 
                            : a.status === 'overdue' 
                            ? 'bg-rose-500/15 text-rose-400' 
                            : 'bg-amber-500/15 text-amber-400'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1.5 justify-end items-center">
                          {a.status !== 'paid' && (
                            <button
                              onClick={() => openPaymentModal(a)}
                              className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                              title="Capture Repayment"
                            >
                              <CreditCard size={11} /> Pay
                            </button>
                          )}

                          <button 
                            onClick={() => setSelectedAgrId(a.id)} 
                            className="px-2 py-1 bg-slate-900 border border-slate-800 text-[10px] rounded hover:border-slate-700 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                          >
                            <Eye size={11} className="text-amber-500" /> View
                          </button>
                          <button 
                            onClick={() => {
                              if (cust) printLegalAgreement(a, cust);
                              else alert('Associated customer profile not found.');
                            }}
                            className="px-2 py-1 bg-slate-900 border border-slate-800 text-[10px] rounded hover:border-slate-700 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                          >
                            <Printer size={11} className="text-amber-500" /> Print Agr
                          </button>
                          <button 
                            onClick={() => {
                              if (cust) printAccountInvoice(a, cust);
                              else alert('Associated customer profile not found.');
                            }}
                            className="px-2 py-1 bg-slate-900 border border-slate-800 text-[10px] rounded hover:border-slate-700 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                          >
                            <Printer size={11} className="text-amber-500" /> Print Inv
                          </button>
                          <button 
                            onClick={() => {
                              if (cust) printSalaryConsent(a, cust);
                              else alert('Associated customer profile not found.');
                            }}
                            className="px-2 py-1 bg-slate-900 border border-slate-800 text-[10px] rounded hover:border-slate-700 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                          >
                            <Printer size={11} className="text-amber-500" /> Print Consent
                          </button>
                          <button 
                            onClick={() => {
                              if (cust) printAffordabilityDeclaration(a, cust);
                              else alert('Associated customer profile not found.');
                            }}
                            className="px-2 py-1 bg-slate-900 border border-slate-800 text-[10px] rounded hover:border-slate-700 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                          >
                            <Printer size={11} className="text-amber-500" /> Print Afford
                          </button>
                          <button 
                            onClick={() => handlePreviewDoc(a, 'invoice')} 
                            className="px-1.5 py-1 text-[9px] text-amber-500 hover:text-amber-400 transition font-semibold cursor-pointer"
                            title="View Invoice Preview"
                          >
                            View Inv
                          </button>
                          <button 
                            onClick={() => handleDownloadRtf(a, 'invoice')} 
                            className="px-1.5 py-1 text-[9px] text-slate-500 hover:text-slate-300 transition cursor-pointer"
                            title="Backup Download Invoice (.rtf)"
                          >
                            Inv.RTF
                          </button>
                          <button 
                            onClick={() => handlePreviewDoc(a, 'aod')} 
                            className="px-1.5 py-1 text-[9px] text-amber-500 hover:text-amber-400 transition font-semibold cursor-pointer"
                            title="View AoD Preview"
                          >
                            View AoD
                          </button>
                          <button 
                            onClick={() => handleDownloadRtf(a, 'aod')} 
                            className="px-1.5 py-1 text-[9px] text-slate-500 hover:text-slate-300 transition cursor-pointer"
                            title="Backup Download AoD (.rtf)"
                          >
                            AoD.RTF
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AGREEMENT DETAIL MODAL */}
      {selectedAgreement && selectedAgreementCustomer && (
        <div className="modal-overlay open" onClick={() => setSelectedAgrId(null)}>
          <div className="modal max-w-2xl bg-slate-900 border border-slate-800 text-slate-100" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Credit Agreement Details — {selectedAgreement.agrNumber}</h3>
              <button className="close-btn" onClick={() => setSelectedAgrId(null)}>×</button>
            </div>
            
            <div className="modal-body max-h-[500px] overflow-y-auto p-6 space-y-6 text-xs">
              
              {/* Customer Profile Box */}
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-2">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Customer Contract Details</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block">Name</span>
                    <span className="text-slate-300 font-bold">{selectedAgreementCustomer.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">SA ID Number</span>
                    <span className="text-slate-300 font-medium">{selectedAgreementCustomer.idNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Phone</span>
                    <span className="text-slate-300 font-medium">{selectedAgreementCustomer.phone}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Address</span>
                    <span className="text-slate-300 font-medium">{selectedAgreementCustomer.address || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Bank Account</span>
                    <span className="text-slate-300 font-medium truncate">{selectedAgreementCustomer.bank?.name || '—'} / {selectedAgreementCustomer.bank?.accountNumber || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Composition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-2">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Financial Ledger</div>
                  <div className="space-y-1 text-slate-400">
                    <div className="flex justify-between"><span>Groceries Capital:</span><span>{formatCurrency(selectedAgreement.goods)}</span></div>
                    <div className="flex justify-between"><span>Cash Loan Capital:</span><span>{formatCurrency(selectedAgreement.loan)}</span></div>
                    <div className="flex justify-between"><span>Initiation Fee (10%):</span><span>{formatCurrency(selectedAgreement.initiationFee)}</span></div>
                    <div className="flex justify-between"><span>Monthly Service Fee:</span><span>{formatCurrency(selectedAgreement.serviceFee)}</span></div>
                    <div className="flex justify-between text-slate-100 font-bold border-t border-slate-900 pt-1.5 mt-1.5">
                      <span>Repayable Cost:</span>
                      <span className="text-amber-500">{formatCurrency(selectedAgreement.totalAmount)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-2">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Repayments Status</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-slate-400">
                      <span>Total Paid to Date:</span>
                      <span className="text-emerald-400 font-bold">{formatCurrency(selectedAgreement.paid)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Remaining Balance:</span>
                      <span className="text-rose-400 font-black text-sm">{formatCurrency(selectedAgreement.balance)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Agreement Status:</span>
                      <span className="font-bold text-slate-200 uppercase">{selectedAgreement.status}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchased items details */}
              {selectedAgreement.items && selectedAgreement.items.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Groceries Inventory Deduction Invoice</div>
                  <div className="bg-slate-950 rounded-xl border border-slate-850 overflow-hidden divide-y divide-slate-900">
                    {selectedAgreement.items.map((item, index) => (
                      <div key={index} className="p-2.5 flex justify-between items-center text-slate-300">
                        <span>{item.name} <strong className="text-slate-500 text-[10px]">x{item.qty}</strong></span>
                        <span className="font-semibold text-slate-400">{formatCurrency(item.price * item.qty)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Affordability assessment */}
              {selectedAgreement.affordability && (() => {
                const aff = selectedAgreement.affordability;
                const income = aff.income || 0;
                const otherLoans = aff.otherLoans || 0;
                const proposedDebt = otherLoans + selectedAgreement.totalAmount;
                const existingDti = income > 0 ? (otherLoans / income) * 100 : 0;
                const proposedDti = income > 0 ? (proposedDebt / income) * 100 : 0;
                
                let riskText = 'Low Risk';
                let riskColor = 'text-emerald-400';
                if (proposedDti > 50 || aff.afterAgreement < 0) {
                  riskText = 'Critical Risk';
                  riskColor = 'text-rose-400';
                } else if (proposedDti > 40) {
                  riskText = 'High Risk';
                  riskColor = 'text-orange-400';
                } else if (proposedDti > 30) {
                  riskText = 'Moderate Risk';
                  riskColor = 'text-yellow-400';
                }

                return (
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-3">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex justify-between">
                      <span>Affordability Audit Scorecard</span>
                      <span className={`font-bold ${riskColor}`}>{riskText}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-400">
                      <div className="flex justify-between"><span>Declared Income:</span><span className="text-slate-300">{formatCurrency(income)}</span></div>
                      <div className="flex justify-between"><span>Living Expenses:</span><span className="text-slate-300">{formatCurrency(aff.expensesTotal)}</span></div>
                      <div className="flex justify-between"><span>Surplus:</span><span className="text-slate-300">{formatCurrency(aff.disposable)}</span></div>
                      <div className="flex justify-between"><span>After Contract:</span><span className={aff.afterAgreement >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{formatCurrency(aff.afterAgreement)}</span></div>
                      <div className="flex justify-between"><span>Existing DTI:</span><span className="text-slate-300 font-mono">{existingDti.toFixed(1)}%</span></div>
                      <div className="flex justify-between"><span>Proposed DTI:</span><span className={`font-bold font-mono ${riskColor}`}>{proposedDti.toFixed(1)}%</span></div>
                    </div>
                  </div>
                );
              })()}

              {selectedAgreement.notes && (
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Agreement Notes</div>
                  <p className="bg-slate-950 border border-slate-850 p-3 rounded-lg text-slate-400 leading-relaxed italic">{selectedAgreement.notes}</p>
                </div>
              )}

              {/* Document Download & Print options */}
              <div className="space-y-3 border-t border-slate-850 pt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-900 pb-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-200 block">🖨️ Direct Compliance Printing (Legal Printout)</span>
                    <p className="text-[9px] text-slate-500">All 4 documents are recommended for physical signing. View or Print on demand.</p>
                  </div>
                  <span className="text-[9px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Recommended</span>
                </div>

                <div className="space-y-2.5">
                  {/* Document 1: Acknowledgement of Debt */}
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex flex-col md:flex-row justify-between md:items-center gap-2">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-300 block">1. Acknowledgement of Debt (AOD)</span>
                      <p className="text-[10px] text-slate-500">Main legal agreement detailing loans, goods, and credit repayment terms.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handlePreviewDoc(selectedAgreement, 'aod')}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 text-amber-400 border border-slate-800 hover:border-slate-700 rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Eye size={12} /> Quick View
                      </button>
                      <button
                        onClick={() => printLegalAgreement(selectedAgreement, selectedAgreementCustomer)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded font-bold flex items-center justify-center gap-1 cursor-pointer text-xs"
                      >
                        <Printer size={12} /> Print
                      </button>
                    </div>
                  </div>

                  {/* Document 2: Tax Invoice */}
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex flex-col md:flex-row justify-between md:items-center gap-2">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-300 block">2. Tax Account Invoice</span>
                      <p className="text-[10px] text-slate-500">Itemised statement detailing goods, payday loan, and fees breakdown.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handlePreviewDoc(selectedAgreement, 'invoice')}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 text-amber-400 border border-slate-800 hover:border-slate-700 rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Eye size={12} /> Quick View
                      </button>
                      <button
                        onClick={() => printAccountInvoice(selectedAgreement, selectedAgreementCustomer)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded font-bold flex items-center justify-center gap-1 cursor-pointer text-xs"
                      >
                        <Printer size={12} /> Print
                      </button>
                    </div>
                  </div>

                  {/* Document 3: Salary Deduction Consent */}
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex flex-col md:flex-row justify-between md:items-center gap-2">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-300 block">3. Salary Deduction Consent</span>
                      <p className="text-[10px] text-slate-500">Irrevocable payroll deduction mandate authorized under South African law.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handlePreviewDoc(selectedAgreement, 'salary_consent')}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 text-amber-400 border border-slate-800 hover:border-slate-700 rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Eye size={12} /> Quick View
                      </button>
                      <button
                        onClick={() => printSalaryConsent(selectedAgreement, selectedAgreementCustomer)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded font-bold flex items-center justify-center gap-1 cursor-pointer text-xs"
                      >
                        <Printer size={12} /> Print
                      </button>
                    </div>
                  </div>

                  {/* Document 4: Affordability Declaration */}
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex flex-col md:flex-row justify-between md:items-center gap-2">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-300 block">4. Affordability Declaration (NCA-81-1)</span>
                      <p className="text-[10px] text-slate-500">Living expenses, income, debt obligations scorecard proving affordability.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handlePreviewDoc(selectedAgreement, 'affordability_dec')}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 text-amber-400 border border-slate-800 hover:border-slate-700 rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Eye size={12} /> Quick View
                      </button>
                      <button
                        onClick={() => printAffordabilityDeclaration(selectedAgreement, selectedAgreementCustomer)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded font-bold flex items-center justify-center gap-1 cursor-pointer text-xs"
                      >
                        <Printer size={12} /> Print
                      </button>
                    </div>
                  </div>

                  {/* Document 5: Freedom of Choice Mandate */}
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex flex-col md:flex-row justify-between md:items-center gap-2">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-300 block">5. Freedom Of Choice Mandate (NCA Sec 106)</span>
                      <p className="text-[10px] text-slate-500">Statutory NCA Section 106(4) choice declaration signed by consumer.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => printFreedomOfChoiceMandate(selectedAgreement, selectedAgreementCustomer)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded font-bold flex items-center justify-center gap-1 cursor-pointer text-xs w-full sm:w-auto"
                      >
                        <Printer size={12} /> Print
                      </button>
                    </div>
                  </div>

                  {/* Document 6: Loss Payee Nomination Mandate */}
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex flex-col md:flex-row justify-between md:items-center gap-2">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-300 block">6. Loss Payee Nomination Mandate</span>
                      <p className="text-[10px] text-slate-500">External policy beneficiary instruction designating Phoenix as loss payee.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => printLossPayeeNominationMandate(selectedAgreement, selectedAgreementCustomer)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded font-bold flex items-center justify-center gap-1 cursor-pointer text-xs w-full sm:w-auto"
                      >
                        <Printer size={12} /> Print
                      </button>
                    </div>
                  </div>

                  {/* Document 7: Form 20 Statutory Quotation */}
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-850 flex flex-col md:flex-row justify-between md:items-center gap-2">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-300 block">7. Pre-Agreement Quote (Form 20)</span>
                      <p className="text-[10px] text-slate-500">NCR-compliant credit quotation statement outlining total cost of credit.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => printForm20Quotation(selectedAgreement, selectedAgreementCustomer)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded font-bold flex items-center justify-center gap-1 cursor-pointer text-xs w-full sm:w-auto"
                      >
                        <Printer size={12} /> Print
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 pt-1">Backup Download & View Formats</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5 p-2 bg-slate-950 rounded-lg border border-slate-850">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block text-center">Tax Invoice Document</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePreviewDoc(selectedAgreement, 'invoice')}
                        className="flex-1 py-1.5 px-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                      >
                        <Eye size={12} className="text-amber-500" /> View Preview
                      </button>
                      <button
                        onClick={() => handleDownloadRtf(selectedAgreement, 'invoice')}
                        className="flex-1 py-1.5 px-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                      >
                        <Download size={12} className="text-amber-500" /> Download RTF
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 p-2 bg-slate-950 rounded-lg border border-slate-850">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block text-center">Acknowledgement of Debt</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePreviewDoc(selectedAgreement, 'aod')}
                        className="flex-1 py-1.5 px-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                      >
                        <Eye size={12} className="text-amber-500" /> View Preview
                      </button>
                      <button
                        onClick={() => handleDownloadRtf(selectedAgreement, 'aod')}
                        className="flex-1 py-1.5 px-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                      >
                        <Download size={12} className="text-amber-500" /> Download RTF
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary text-xs" onClick={() => setSelectedAgrId(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT ALLOCATION MODAL */}
      {isPaymentOpen && (
        <div className="modal-overlay open" onClick={() => setIsPaymentOpen(false)}>
          <div className="modal max-w-sm bg-slate-900 border border-slate-800 text-slate-100" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleSavePayment}>
              <div className="modal-header">
                <h3>Record Agreement Installment</h3>
                <button type="button" className="close-btn" onClick={() => setIsPaymentOpen(false)}>×</button>
              </div>
              <div className="modal-body p-5 space-y-4 text-xs">
                
                <div className="form-group">
                  <label>Installment Sum (ZAR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2.5 rounded text-sm font-bold"
                  />
                </div>

                <div className="form-group">
                  <label>Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2.5 rounded text-xs"
                  >
                    <option value="cash">Cash (Manual Handover)</option>
                    <option value="eft">EFT Bank Transfer</option>
                    <option value="card">Card Reader Terminal</option>
                    <option value="debicheck">DebiCheck Debit Order</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>EFT / Bank Reference No</label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={e => setPayRef(e.target.value)}
                    placeholder="e.g. FNB-3929482"
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs"
                  />
                </div>

                <div className="form-group">
                  <label>Auditing Notes</label>
                  <input
                    type="text"
                    value={payNote}
                    onChange={e => setPayNote(e.target.value)}
                    placeholder="E.g. Paid in full on pension day"
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs"
                  />
                </div>

              </div>
              <div className="modal-footer p-4 bg-slate-950 rounded-b-xl border-t border-slate-850">
                <button type="button" className="btn btn-secondary text-xs" onClick={() => setIsPaymentOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary text-xs font-bold">Record Repayment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={previewTitle}
        type={previewType}
        agreement={previewAgreement}
        customer={previewCustomer}
        onDownload={() => {
          if (previewAgreement) {
            if (previewType === 'aod' || previewType === 'invoice') {
              handleDownloadRtf(previewAgreement, previewType);
            } else if (previewType === 'salary_consent' && previewCustomer) {
              printSalaryConsent(previewAgreement, previewCustomer);
            } else if (previewType === 'affordability_dec' && previewCustomer) {
              printAffordabilityDeclaration(previewAgreement, previewCustomer);
            }
          }
        }}
      />


    </div>
  );
}
