import React, { useState } from 'react';
import { Customer, Agreement, Payment, CollectionNote } from '../types';
import { 
  loadDBList, 
  saveDBList, 
  getCustomerExposure, 
  checkCustomerOverdue, 
  generateNextCustomerFileNo, 
  generateUid 
} from '../utils/database';
import { 
  generateAcknowledgementOfDebt, 
  generateAccountInvoice, 
  downloadRtfFile 
} from '../utils/rtfGenerator';
import DocumentPreviewModal from './DocumentPreviewModal';
import { printLegalAgreement, printAccountInvoice, printSalaryConsent, printAffordabilityDeclaration } from '../utils/printDoc';
import { 
  Search, User, Phone, Eye, Edit, Trash2, Calendar, 
  CreditCard, ShieldAlert, CheckCircle2, ChevronRight, FileSpreadsheet, PlusCircle, Printer, Download
} from 'lucide-react';

interface CustomersViewProps {
  customers: Customer[];
  agreements: Agreement[];
  payments: Payment[];
  collectionNotes: CollectionNote[];
  currentUser: any;
  onRefreshDB: () => void;
  onAddCollectionNote: (custId: string, agrId: string) => void;
}

export default function CustomersView({
  customers,
  agreements,
  payments,
  collectionNotes,
  currentUser,
  onRefreshDB,
  onAddCollectionNote
}: CustomersViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedAgreementId, setSelectedAgreementId] = useState<string | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<'profile' | 'agreements' | 'payments' | 'collections'>('profile');

  // Document preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewType, setPreviewType] = useState<'aod' | 'invoice' | 'csv'>('aod');
  const [previewAgreement, setPreviewAgreement] = useState<Agreement | null>(null);
  const [previewCustomer, setPreviewCustomer] = useState<Customer | null>(null);

  const handlePreviewDoc = (agreement: Agreement, customer: Customer, docType: 'aod' | 'invoice') => {
    setPreviewAgreement(agreement);
    setPreviewCustomer(customer);
    setPreviewType(docType);
    setPreviewTitle(docType === 'aod' ? 'Agreement (AoD) Preview' : 'Tax Invoice Preview');
    setPreviewOpen(true);
  };
  
  // Modal Edit state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [surname, setSurname] = useState('');
  const [firstNames, setFirstNames] = useState('');
  const [email, setEmail] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [employer, setEmployer] = useState('');
  const [workPhone, setWorkPhone] = useState('');
  const [workAddress, setWorkAddress] = useState('');
  const [salaryDay, setSalaryDay] = useState<number | string>(25);
  const [incomeSource, setIncomeSource] = useState('Salary');
  const [church, setChurch] = useState('');
  const [pastor, setPastor] = useState('');
  const [mandate, setMandate] = useState<'yes' | 'no'>('no');
  const [creditLimit, setCreditLimit] = useState<number>(3000);
  const [customerType, setCustomerType] = useState<'cash' | 'credit'>('credit');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [notes, setNotes] = useState('');

  // Statement Overlay state
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [statementCustId, setStatementCustId] = useState('');

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

  const openAddCustomer = () => {
    setEditId('');
    setName('');
    setPhone('');
    setSurname('');
    setFirstNames('');
    setEmail('');
    setIdNumber('');
    setAddress('');
    setEmployer('');
    setWorkPhone('');
    setWorkAddress('');
    setSalaryDay(25);
    setIncomeSource('Monthly Salary');
    setChurch('');
    setPastor('');
    setMandate('no');
    setCreditLimit(3000);
    setCustomerType('credit');
    setBankName('');
    setBankAccount('');
    setBankBranch('');
    setBankHolder('');
    setNotes('');
    setIsEditModalOpen(true);
  };

  const openEditCustomer = (c: Customer) => {
    setEditId(c.id);
    setName(c.name);
    setPhone(c.phone);
    setSurname(c.surname || '');
    setFirstNames(c.firstNames || '');
    setEmail(c.email || '');
    setIdNumber(c.idNumber || '');
    setAddress(c.address || '');
    setEmployer(c.employer || '');
    setWorkPhone(c.workPhone || '');
    setWorkAddress(c.workAddress || '');
    setSalaryDay(c.salaryDay || 25);
    setIncomeSource(c.incomeSource || '');
    setChurch(c.church || '');
    setPastor(c.pastor || '');
    setMandate(c.mandate || 'no');
    setCreditLimit(c.creditLimit || 0);
    setCustomerType(c.type || 'credit');
    setBankName(c.bank?.name || '');
    setBankAccount(c.bank?.accountNumber || '');
    setBankBranch(c.bank?.branchCode || '');
    setBankHolder(c.bank?.holder || '');
    setNotes(c.notes || '');
    setIsEditModalOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert('Name and Phone are required fields.');
      return;
    }

    const list = loadDBList<Customer>('customers');
    const existing = editId ? list.find(c => c.id === editId) : null;
    const parts = name.trim().split(/\s+/).filter(Boolean);

    const newCustomer: Customer = {
      id: editId || generateUid(),
      fileNo: existing?.fileNo || generateNextCustomerFileNo(list),
      name: name.trim(),
      phone: phone.trim(),
      surname: surname.trim() || (parts.length > 1 ? parts.slice(-1)[0] : ''),
      firstNames: firstNames.trim() || (parts.length > 1 ? parts.slice(0, -1).join(' ') : name.trim()),
      email: email.trim(),
      idNumber: idNumber.trim(),
      address: address.trim(),
      employer: employer.trim(),
      workPhone: workPhone.trim(),
      workAddress: workAddress.trim(),
      salaryDay: salaryDay,
      incomeSource: incomeSource.trim(),
      church: church.trim(),
      pastor: pastor.trim(),
      mandate: mandate,
      creditLimit: creditLimit,
      type: customerType,
      bank: {
        name: bankName.trim(),
        accountNumber: bankAccount.trim(),
        branchCode: bankBranch.trim(),
        holder: bankHolder.trim()
      },
      notes: notes.trim(),
      created: existing?.created || new Date().toISOString().split('T')[0],
      updated: new Date().toISOString()
    };

    if (editId) {
      const idx = list.findIndex(c => c.id === editId);
      if (idx >= 0) list[idx] = newCustomer;
    } else {
      list.push(newCustomer);
    }

    saveDBList('customers', list);
    setIsEditModalOpen(false);
    onRefreshDB();
  };

  const handleDeleteCustomer = (id: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this customer record? All ledger histories will remain connected but the profile will be discarded.')) return;
    const list = loadDBList<Customer>('customers');
    const filtered = list.filter(c => c.id !== id);
    saveDBList('customers', filtered);
    if (selectedCustomerId === id) setSelectedCustomerId(null);
    onRefreshDB();
  };

  const handleDownloadRtf = (agreement: Agreement, customer: Customer, docType: 'aod' | 'invoice') => {
    if (docType === 'aod') {
      const rtf = generateAcknowledgementOfDebt(agreement, customer);
      downloadRtfFile(`${agreement.agrNumber}_Acknowledgement_Of_Debt.rtf`, rtf);
    } else {
      const rtf = generateAccountInvoice(agreement, customer);
      downloadRtfFile(`${agreement.agrNumber}_Account_Invoice.rtf`, rtf);
    }
  };

  const triggerStatement = (custId: string) => {
    setStatementCustId(custId);
    setIsStatementOpen(true);
  };

  // Filters
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.phone.includes(searchTerm) ||
                          (c.idNumber && c.idNumber.includes(searchTerm)) ||
                          c.fileNo.includes(searchTerm);
    const matchesType = !typeFilter || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const activeCustomer = customers.find(c => c.id === selectedCustomerId) || null;
  const activeCustAgreements = activeCustomer ? agreements.filter(a => a.customerId === activeCustomer.id) : [];
  const activeCustPayments = activeCustomer ? payments.filter(p => p.customerId === activeCustomer.id) : [];
  const activeCustNotes = activeCustomer ? collectionNotes.filter(n => n.customerId === activeCustomer.id) : [];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <User className="text-amber-500" /> Customers File Directory
          </h2>
          <p className="text-sm text-slate-400">Review credit ratings, track outstanding balances, and download auto-filled RTF agreements</p>
        </div>
        <button
          onClick={openAddCustomer}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-lg shadow-amber-500/10"
        >
          <PlusCircle className="h-4 w-4" /> Add New Customer
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Side: Search & Table */}
        <div className={`${selectedCustomerId ? 'xl:col-span-7' : 'xl:col-span-12'} space-y-4`}>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search customers by name, file #, or SA ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500 transition"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg text-slate-200 py-2 px-3 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="">All Account Types</option>
              <option value="credit">Credit / Account</option>
              <option value="cash">Retail Cash Only</option>
            </select>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/40 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800">
                    <th className="p-3.5">Customer / File #</th>
                    <th className="p-3.5">Contact</th>
                    <th className="p-3.5">ID Number</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Debt Exposure</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No registered customers found. Click "Add New Customer" to record.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(c => {
                      const exposure = getCustomerExposure(c.id, agreements);
                      const isBlocked = checkCustomerOverdue(c.id, agreements);
                      const isSelected = selectedCustomerId === c.id;

                      return (
                        <tr 
                          key={c.id} 
                          onClick={() => setSelectedCustomerId(c.id)}
                          className={`cursor-pointer transition ${
                            isSelected 
                              ? 'bg-slate-800/30' 
                              : 'hover:bg-slate-800/10'
                          }`}
                        >
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-200">{c.name}</div>
                            <div className="text-[10px] text-slate-500">File No: {c.fileNo}</div>
                          </td>
                          <td className="p-3.5 text-slate-300">{c.phone}</td>
                          <td className="p-3.5 text-slate-400">{c.idNumber || '—'}</td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              c.type === 'credit' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {c.type}
                            </span>
                          </td>
                          <td className={`p-3.5 font-bold ${exposure > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {exposure > 0 ? formatCurrency(exposure) : 'Clear'}
                          </td>
                          <td className="p-3.5">
                            {isBlocked ? (
                              <span className="inline-flex items-center gap-1 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                <ShieldAlert className="h-3 w-3" /> BLOCKED
                              </span>
                            ) : (
                              <span className="status status-active">Active</span>
                            )}
                          </td>
                          <td className="p-3 td-actions" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-2">
                              <button className="btn btn-secondary btn-sm" title="Statement" onClick={() => triggerStatement(c.id)}>
                                <FileSpreadsheet size={14} />
                              </button>
                              <button className="btn btn-secondary btn-sm" title="Edit Profile" onClick={() => openEditCustomer(c)}>✏️</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCustomer(c.id)}>🗑️</button>
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
        </div>

    {/* CUSTOMER PROFILE DRAWER */}
    {selectedCustomerId && (() => {
      const c = customers.find(x => x.id === selectedCustomerId);
      if (!c) return null;
      const exposure = getCustomerExposure(c.id, agreements);
      const overdue = checkCustomerOverdue(c.id, agreements);
      const activeCustAgreements = agreements.filter(a => a.customerId === c.id);

      return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6 xl:col-span-5">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-slate-100 text-base">{c.name}</h3>
              <p className="text-xs text-slate-400">File No: #{c.fileNo}</p>
            </div>
            <button className="text-slate-400 hover:text-white text-lg font-bold" onClick={() => setSelectedCustomerId(null)}>×</button>
          </div>
          
          <div className="space-y-6">
            <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CREDIT STATUS</span>
                {overdue ? (
                  <span className="inline-flex items-center gap-1 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-bold">⛔ BLOCKED</span>
                ) : (
                  <span className="status status-active">ACTIVE / OK</span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Outstanding Exposure</span>
                <span className={`text-lg font-bold ${exposure > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{formatCurrency(exposure)}</span>
              </div>
              {c.creditLimit > 0 && (
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-900">
                  <span className="text-xs text-slate-400">Approved Limit</span>
                  <span className="font-semibold text-slate-200">{formatCurrency(c.creditLimit)}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Account Details</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-slate-500 block">ID Number</span><span className="text-slate-300 font-medium">{c.idNumber || '—'}</span></div>
                <div><span className="text-slate-500 block">Phone</span><span className="text-slate-300 font-medium">{c.phone}</span></div>
                <div><span className="text-slate-500 block">Email</span><span className="text-slate-300 font-medium truncate">{c.email || '—'}</span></div>
                <div><span className="text-slate-500 block">Salary / SASSA Day</span><span className="text-slate-300 font-medium">{c.salaryDay || '—'}</span></div>
                <div className="col-span-2"><span className="text-slate-500 block">Address</span><span className="text-slate-300 font-medium">{c.address || '—'}</span></div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Financial & Bank routing</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-slate-500 block">Bank Name</span><span className="text-slate-300 font-medium">{c.bank?.name || '—'}</span></div>
                <div><span className="text-slate-500 block">Account Number</span><span className="text-slate-300 font-medium">{c.bank?.accountNumber || '—'}</span></div>
                <div><span className="text-slate-500 block">Branch Code</span><span className="text-slate-300 font-medium">{c.bank?.branchCode || '—'}</span></div>
                <div><span className="text-slate-500 block">Account Holder</span><span className="text-slate-300 font-medium">{c.bank?.holder || '—'}</span></div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                <span>Active Agreements</span>
                <span className="text-[10px] text-slate-500">{activeCustAgreements.length} total</span>
              </h4>
              
              {activeCustAgreements.length === 0 ? (
                <div className="text-center p-4 bg-slate-950/40 rounded-lg text-xs text-slate-500 border border-slate-900">No active credit agreements.</div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {activeCustAgreements.map(a => (
                    <div key={a.id} className="bg-slate-950 border border-slate-850 p-2.5 rounded-lg flex flex-col gap-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-200">{a.agrNumber}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          a.status === 'overdue' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>{a.status}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Balance: {formatCurrency(a.balance)}</span>
                        <span>Due: {formatDate(a.dueDate)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 justify-end border-t border-slate-900/60 pt-2 mt-1">
                        <button 
                          onClick={() => setSelectedAgreementId(a.id)} 
                          className="px-2 py-1 bg-slate-900 border border-slate-800 text-[10px] rounded hover:border-slate-700 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <Eye size={11} className="text-amber-500" /> View
                        </button>
                        <button 
                          onClick={() => printLegalAgreement(a, c)} 
                          className="px-2 py-1 bg-slate-900 border border-slate-800 text-[10px] rounded hover:border-slate-700 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <Printer size={11} className="text-amber-500" /> Print Agr
                        </button>
                        <button 
                          onClick={() => printAccountInvoice(a, c)} 
                          className="px-2 py-1 bg-slate-900 border border-slate-800 text-[10px] rounded hover:border-slate-700 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <Printer size={11} className="text-amber-500" /> Print Inv
                        </button>
                        <button 
                          onClick={() => printSalaryConsent(a, c)} 
                          className="px-2 py-1 bg-slate-900 border border-slate-800 text-[10px] rounded hover:border-slate-700 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <Printer size={11} className="text-amber-500" /> Print Consent
                        </button>
                        <button 
                          onClick={() => printAffordabilityDeclaration(a, c)} 
                          className="px-2 py-1 bg-slate-900 border border-slate-800 text-[10px] rounded hover:border-slate-700 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <Printer size={11} className="text-amber-500" /> Print Afford
                        </button>
                        <button 
                          onClick={() => handlePreviewDoc(a, c, 'invoice')} 
                          className="px-1.5 py-1 text-[9px] text-amber-500 hover:text-amber-400 transition font-semibold"
                          title="View Invoice Preview"
                        >
                          View Inv
                        </button>
                        <button 
                          onClick={() => handleDownloadRtf(a, c, 'invoice')} 
                          className="px-1.5 py-1 text-[9px] text-slate-500 hover:text-slate-300 transition"
                          title="Backup Download Invoice (.rtf)"
                        >
                          Inv.RTF
                        </button>
                        <button 
                          onClick={() => handlePreviewDoc(a, c, 'aod')} 
                          className="px-1.5 py-1 text-[9px] text-amber-500 hover:text-amber-400 transition font-semibold"
                          title="View AoD Preview"
                        >
                          View AoD
                        </button>
                        <button 
                          onClick={() => handleDownloadRtf(a, c, 'aod')} 
                          className="px-1.5 py-1 text-[9px] text-slate-500 hover:text-slate-300 transition"
                          title="Backup Download AoD (.rtf)"
                        >
                          AoD.RTF
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                <span>Recent Collection Logs</span>
                <button onClick={() => onAddCollectionNote(c.id, '')} className="text-amber-500 hover:underline text-[10px]">+ Log Note</button>
              </h4>
              
              {activeCustNotes.length === 0 ? (
                <div className="text-center p-4 bg-slate-950/40 rounded-lg text-xs text-slate-500 border border-slate-900">No collection records captured.</div>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                  {activeCustNotes.slice().reverse().map(note => (
                    <div key={note.id} className="p-2.5 bg-slate-950 border border-slate-850 rounded-lg text-xs space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>{formatDate(note.date)} — {note.type}</span>
                        <span>by {note.createdBy}</span>
                      </div>
                      <p className="text-slate-300 leading-tight">{note.note}</p>
                      {note.promiseAmount > 0 && (
                        <div className="text-[10px] text-amber-500 font-medium">
                          Promise: {formatCurrency(note.promiseAmount)} by {formatDate(note.promiseDate)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    })()}
  </div>

  {/* STATEMENT MODAL PORTRAYAL */}
  {isStatementOpen && (
    <div className="modal-overlay open" onClick={() => setIsStatementOpen(false)}>
      <div className="modal max-w-3xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Consolidated Financial Statement</h3>
          <button className="close-btn" onClick={() => setIsStatementOpen(false)}>×</button>
        </div>
        <div className="modal-body max-h-[550px] overflow-y-auto bg-white text-slate-950 p-6 rounded-b-xl space-y-4">
          {(() => {
            const c = customers.find(x => x.id === statementCustId);
            if (!c) return <p>Loading...</p>;
            const custAgrs = agreements.filter(a => a.customerId === c.id);
            const custPays = payments.filter(p => p.customerId === c.id);
            const totalOutstanding = getCustomerExposure(c.id, agreements);
            const totalPaid = custPays.reduce((sum, p) => sum + p.amount, 0);

            return (
              <div className="space-y-6 text-slate-950 font-sans" id="printable-statement">
                {/* Brand Banner */}
                <div className="flex justify-between border-b-2 border-slate-900 pb-4">
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight">SASSC — South African Social Services</h2>
                    <p className="text-xs text-slate-600">Trading under Phoenix Financial Services (NCR Reg: NCR/CP/10452)</p>
                    <p className="text-xs text-slate-600">Rustenburg, NW</p>
                  </div>
                  <div className="text-right">
                    <h1 className="text-lg font-bold text-slate-800">CUSTOMER LEDGER</h1>
                    <p className="text-xs text-slate-600">Date: {formatDate(new Date().toISOString().split('T')[0])}</p>
                    <p className="text-xs text-slate-600">File No: #{c.fileNo}</p>
                  </div>
                </div>

                {/* Client Box */}
                <div className="bg-slate-100 p-4 rounded-lg border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Client Profile</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs mt-1 text-slate-800">
                    <div><strong>Full Name:</strong> {c.name}</div>
                    <div><strong>ID Number:</strong> {c.idNumber || '—'}</div>
                    <div><strong>Contact phone:</strong> {c.phone}</div>
                    <div><strong>Address:</strong> {c.address || '—'}</div>
                  </div>
                </div>

                {/* Aggregated Scorecard */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 border border-red-200 rounded-lg bg-red-50">
                    <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Total Outstanding</span>
                    <div className="text-lg font-bold text-red-700">{formatCurrency(totalOutstanding)}</div>
                  </div>
                  <div className="p-3 border border-emerald-200 rounded-lg bg-emerald-50">
                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Total Paid</span>
                    <div className="text-lg font-bold text-emerald-700">{formatCurrency(totalPaid)}</div>
                  </div>
                  <div className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Agreements Total</span>
                    <div className="text-lg font-bold text-slate-800">{custAgrs.length} Active</div>
                  </div>
                </div>

                {/* Agreements table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Agreements History</h4>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 uppercase font-semibold text-[10px] border-b border-slate-300">
                        <th className="p-2 border border-slate-200">Agreement No</th>
                        <th className="p-2 border border-slate-200">Date</th>
                        <th className="p-2 border border-slate-200 text-right">Capital</th>
                        <th className="p-2 border border-slate-200 text-right">Fees</th>
                        <th className="p-2 border border-slate-200 text-right">Total Owed</th>
                        <th className="p-2 border border-slate-200 text-right">Paid</th>
                        <th className="p-2 border border-slate-200 text-right">Balance</th>
                        <th className="p-2 border border-slate-200">Due</th>
                        <th className="p-2 border border-slate-200">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {custAgrs.map(a => (
                        <tr key={a.id} className="text-slate-800 hover:bg-slate-50/50">
                          <td className="p-2 border border-slate-200 font-semibold">{a.agrNumber}</td>
                          <td className="p-2 border border-slate-200">{formatDate(a.date)}</td>
                          <td className="p-2 border border-slate-200 text-right">{formatCurrency(a.capital)}</td>
                          <td className="p-2 border border-slate-200 text-right">{formatCurrency((a.initiationFee || 0) + (a.serviceFee || 0))}</td>
                          <td className="p-2 border border-slate-200 text-right font-semibold text-slate-900">{formatCurrency(a.totalAmount)}</td>
                          <td className="p-2 border border-slate-200 text-right text-emerald-700 font-medium">{formatCurrency(a.paid)}</td>
                          <td className="p-2 border border-slate-200 text-right text-red-600 font-bold">{formatCurrency(a.balance)}</td>
                          <td className="p-2 border border-slate-200">{formatDate(a.dueDate)}</td>
                          <td style={{ textTransform: 'uppercase' }} className="p-2 border border-slate-200">{a.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Payments history */}
                <div style={{ marginTop: '16px' }}>
                  <strong>Repayment Ledger</strong>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }} className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-semibold text-[10px] border-b border-slate-300">
                        <th className="p-2 border border-slate-200">Payment Date</th>
                        <th className="p-2 border border-slate-200">Allocated Agreement</th>
                        <th className="p-2 border border-slate-200">Receipt Ref</th>
                        <th className="p-2 border border-slate-200">Payment Method</th>
                        <th className="p-2 border border-slate-200 text-right">Amount Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {custPays.slice().reverse().map(p => (
                        <tr key={p.id} className="text-slate-800">
                          <td className="p-2 border border-slate-200">{formatDate(p.date)}</td>
                          <td className="p-2 border border-slate-200 font-mono font-semibold">{p.agrNumber}</td>
                          <td className="p-2 border border-slate-200">{p.reference || '—'}</td>
                          <td className="p-2 border border-slate-200 capitalize">{p.method}</td>
                          <td className="p-2 border border-slate-200 text-right text-emerald-700 font-bold">{formatCurrency(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
        <div className="modal-footer bg-slate-950 p-4 border-t border-slate-850 rounded-b-xl">
          <button className="btn btn-secondary text-xs" onClick={() => setIsStatementOpen(false)}>Close</button>
          <button className="btn btn-primary text-xs" onClick={() => window.print()}>🖨️ Print Statement</button>
        </div>
      </div>
    </div>
  )}

  {/* EDIT CUSTOMER MODAL */}
  {isEditModalOpen && (
    <div className="modal-overlay open">
      <div className="modal max-w-2xl bg-slate-900 border border-slate-800 text-slate-100">
        <form onSubmit={handleSaveCustomer}>
          <div className="modal-header">
            <h3>{editId ? 'Edit Customer Profile' : 'Add New Customer Record'}</h3>
            <button type="button" className="close-btn" onClick={() => setIsEditModalOpen(false)}>×</button>
          </div>
          <div className="modal-body max-h-[500px] overflow-y-auto p-6 space-y-4 text-xs">
            
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider text-[10px] pb-1 border-b border-slate-800">
              Personal Information
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label>Full Display Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded" />
              </div>
              <div className="form-group">
                <label>Cell Number (Phone) *</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded" />
              </div>
              <div className="form-group">
                <label>First Names (NCA detail)</label>
                <input type="text" value={firstNames} onChange={e => setFirstNames(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded" />
              </div>
              <div className="form-group">
                <label>Surname (NCA detail)</label>
                <input type="text" value={surname} onChange={e => setSurname(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded" />
              </div>
              <div className="form-group">
                <label>SA ID Number</label>
                <input type="text" value={idNumber} onChange={e => setIdNumber(e.target.value)} maxLength={13} className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded" />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded" />
              </div>
              <div className="form-group col-span-2">
                <label>Physical Residential Address</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded" />
              </div>
            </div>

            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider text-[10px] pb-1 border-b border-slate-800 pt-2">
              Income / Affordability Parameters
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label>Employment Source / Income</label>
                <input type="text" value={incomeSource} onChange={e => setIncomeSource(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded" />
              </div>
              <div className="form-group">
                <label>Employer / Company</label>
                <input type="text" value={employer} onChange={e => setEmployer(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded" />
              </div>
              <div className="form-group">
                <label>Salary Day (day of month)</label>
                <input type="number" min={1} max={31} value={salaryDay} onChange={e => setSalaryDay(parseInt(e.target.value) || 25)} className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded" />
              </div>
              <div className="form-group">
                <label>Approved Credit Limit (R)</label>
                <input type="number" value={creditLimit} onChange={e => setCreditLimit(parseFloat(e.target.value) || 0)} className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded" />
              </div>
              <div className="form-group">
                <label>Account Type</label>
                <select value={customerType} onChange={e => setCustomerType(e.target.value as any)} className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded">
                  <option value="credit">Credit / Loan Account</option>
                  <option value="cash">Retail Cash Only</option>
                </select>
              </div>
              <div className="form-group">
                <label>Mandate Signed</label>
                <select value={mandate} onChange={e => setMandate(e.target.value as any)} className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>

            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider text-[10px] pb-1 border-b border-slate-800 pt-2">
              SASSA Bank EFT details (Salary routing)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label>Bank Name</label>
                <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded" />
              </div>
              <div className="form-group">
                <label>Account Number</label>
                <input type="text" value={bankAccount} onChange={e => setBankAccount(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded" />
              </div>
              <div className="form-group">
                <label>Branch routing Code</label>
                <input type="text" value={bankBranch} onChange={e => setBankBranch(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded" />
              </div>
              <div className="form-group">
                <label>Account Holder Name</label>
                <input type="text" value={bankHolder} onChange={e => setBankHolder(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded" />
              </div>
            </div>
            
            <div className="form-group col-span-2">
              <label>Additional Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded w-full resize-none" />
            </div>

          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Profile</button>
          </div>
        </form>
      </div>
    </div>
  )}

  {/* AGREEMENT DETAIL MODAL */}
  {(() => {
    if (!selectedAgreementId) return null;
    const selectedAgreement = agreements.find(a => a.id === selectedAgreementId);
    if (!selectedAgreement) return null;
    const selectedAgreementCustomer = customers.find(c => c.id === selectedAgreement.customerId);
    if (!selectedAgreementCustomer) return null;

    return (
      <div className="modal-overlay open" onClick={() => setSelectedAgreementId(null)}>
        <div className="modal max-w-2xl bg-slate-900 border border-slate-800 text-slate-100" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Credit Agreement Details — {selectedAgreement.agrNumber}</h3>
            <button className="close-btn" onClick={() => setSelectedAgreementId(null)}>×</button>
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
                  <span className="text-slate-300 font-medium truncate">
                    {selectedAgreementCustomer.bank?.name || '—'} / {selectedAgreementCustomer.bank?.accountNumber || '—'}
                  </span>
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
                  {selectedAgreement.items.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex justify-between items-center text-slate-300">
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Direct Compliance Printing (Legal Printout)</div>
                <span className="text-[10px] text-amber-500 font-medium">Recommended for signing</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button
                  onClick={() => printLegalAgreement(selectedAgreement, selectedAgreementCustomer)}
                  className="py-2.5 px-2 bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-600 transition font-bold flex items-center justify-center gap-1 shadow-md shadow-amber-500/10 cursor-pointer text-xs"
                >
                  <Printer size={13} /> Agreement (AOD)
                </button>
                <button
                  onClick={() => printAccountInvoice(selectedAgreement, selectedAgreementCustomer)}
                  className="py-2.5 px-2 bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-600 transition font-bold flex items-center justify-center gap-1 shadow-md shadow-amber-500/10 cursor-pointer text-xs"
                >
                  <Printer size={13} /> Tax Invoice
                </button>
                <button
                  onClick={() => printSalaryConsent(selectedAgreement, selectedAgreementCustomer)}
                  className="py-2.5 px-2 bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-600 transition font-bold flex items-center justify-center gap-1 shadow-md shadow-amber-500/10 cursor-pointer text-xs"
                >
                  <Printer size={13} /> Salary Consent
                </button>
                <button
                  onClick={() => printAffordabilityDeclaration(selectedAgreement, selectedAgreementCustomer)}
                  className="py-2.5 px-2 bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-600 transition font-bold flex items-center justify-center gap-1 shadow-md shadow-amber-500/10 cursor-pointer text-xs"
                >
                  <Printer size={13} /> Affordability Dec
                </button>
              </div>

              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 pt-1">Backup Download & View Formats</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5 p-2 bg-slate-950 rounded-lg border border-slate-850">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block text-center">Tax Invoice Document</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePreviewDoc(selectedAgreement, selectedAgreementCustomer, 'invoice')}
                      className="flex-1 py-1.5 px-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                    >
                      <Eye size={12} className="text-amber-500" /> View Preview
                    </button>
                    <button
                      onClick={() => handleDownloadRtf(selectedAgreement, selectedAgreementCustomer, 'invoice')}
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
                      onClick={() => handlePreviewDoc(selectedAgreement, selectedAgreementCustomer, 'aod')}
                      className="flex-1 py-1.5 px-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                    >
                      <Eye size={12} className="text-amber-500" /> View Preview
                    </button>
                    <button
                      onClick={() => handleDownloadRtf(selectedAgreement, selectedAgreementCustomer, 'aod')}
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
            <button className="btn btn-secondary text-xs" onClick={() => setSelectedAgreementId(null)}>Close</button>
          </div>
        </div>
      </div>
    );
  })()}

  {/* Document Preview Modal */}
  <DocumentPreviewModal
    isOpen={previewOpen}
    onClose={() => setPreviewOpen(false)}
    title={previewTitle}
    type={previewType}
    agreement={previewAgreement}
    customer={previewCustomer}
    onDownload={() => {
      if (previewAgreement && previewCustomer) {
        handleDownloadRtf(previewAgreement, previewCustomer, previewType as 'aod' | 'invoice');
      }
    }}
  />

</div>
  );
}

// Simple internal helpers for clean React mapping
function activeAgrs(agrs: Agreement[], customerId: string) {
  return agrs.filter(a => a.customerId === customerId);
}
