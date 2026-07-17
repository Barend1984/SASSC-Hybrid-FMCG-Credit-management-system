import React, { useState, useEffect } from 'react';
import { 
  Payment, Agreement, Customer, CollectionNote, Product, 
  BusinessSettings, User, CashDay, CashMovement, Sale, RecipeIngredient,
  StockTake, WriteOff, StockTakeItem
} from '../types';
import { 
  loadDBList, saveDBList, generateUid, getCustomerExposure, 
  checkCustomerOverdue, getPermissionList, getRolePermissions, 
  calcNcaFees, hashPassword, seedSampleData, loadDBObj, saveDBObj,
  clearAllProductionData
} from '../utils/database';
import {
  calculateCashOnHand,
  calculateBankBalance,
  calculateInventoryCost,
  calculateCapitalReconciliation,
  calculateLoanPortfolio,
  calculateCreditIssued,
  calculateCustomerPayments,
  calculateExpenseLedger
} from '../utils/financialEngine';
import { 
  AlertTriangle, CreditCard, Calendar, BarChart3, Database, 
  Trash2, ShieldCheck, Key, Lock, Plus, Users, PlusCircle, CheckCircle, Save,
  ChefHat, Utensils, BookOpen, Info, ClipboardList, FileSpreadsheet, RefreshCw, 
  DollarSign, History, Trash, AlertCircle, TrendingUp, Eye, Download, Edit
} from 'lucide-react';
import DocumentPreviewModal from './DocumentPreviewModal';

/* ======================================================
   1. PAYMENTS VIEW
   ====================================================== */
interface PaymentsViewProps {
  payments: Payment[];
  customers: Customer[];
  currentUser: any;
  onRefreshDB: () => void;
}
export function PaymentsView({ payments, customers, currentUser, onRefreshDB }: PaymentsViewProps) {
  const getCustName = (id: string) => customers.find(c => c.id === id)?.name || '—';

  // State for editing payment
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editMethod, setEditMethod] = useState<'cash' | 'card' | 'eft'>('cash');
  const [editRef, setEditRef] = useState('');
  const [editNote, setEditNote] = useState('');

  const handleStartEdit = (p: Payment) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = p.date === todayStr;

    if (!isToday && currentUser?.role !== 'main_admin') {
      alert("⛔ Access Denied: Payments received on a previous date can only be edited by an Administrator.");
      return;
    }

    setEditingPayment(p);
    setEditDate(p.date);
    setEditAmount(p.amount.toString());
    setEditMethod(p.method);
    setEditRef(p.reference || '');
    setEditNote(p.note || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;

    const newAmount = parseFloat(editAmount) || 0;
    if (newAmount <= 0) {
      alert("Please enter a valid positive payment sum.");
      return;
    }

    // Load lists
    const allAgreements = loadDBList<Agreement>('agreements');
    const allPayments = loadDBList<Payment>('payments');

    // Find targets
    const matchPayment = allPayments.find(py => py.id === editingPayment.id);
    if (!matchPayment) {
      alert("Payment not found.");
      return;
    }

    const matchAgreement = allAgreements.find(ag => ag.id === editingPayment.agrId);
    if (matchAgreement) {
      const oldAmount = editingPayment.amount;
      const diff = newAmount - oldAmount;

      // Adjust contract paid balance
      matchAgreement.paid = Math.round((matchAgreement.paid + diff) * 100) / 100;
      matchAgreement.balance = Math.max(0, Math.round((matchAgreement.totalAmount - matchAgreement.paid) * 100) / 100);

      // Adjust contract status based on new balance
      if (matchAgreement.balance <= 0) {
        matchAgreement.status = 'paid';
      } else {
        const todayStr = new Date().toISOString().split('T')[0];
        matchAgreement.status = matchAgreement.dueDate < todayStr ? 'overdue' : 'active';
      }
      matchAgreement.updated = new Date().toISOString();
    }

    // Update payment
    matchPayment.date = editDate;
    matchPayment.amount = newAmount;
    matchPayment.method = editMethod;
    matchPayment.reference = editRef;
    matchPayment.note = editNote;

    // Save
    saveDBList('payments', allPayments);
    saveDBList('agreements', allAgreements);

    alert("Payment allocation successfully updated and contract accounts balanced.");
    setEditingPayment(null);
    onRefreshDB();
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-1.5"><CreditCard className="text-emerald-400" /> Repayments History Log</h2>
        <p className="text-xs text-slate-400">Review all captured installments and allocations applied to agreements</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/40 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                <th className="p-3.5">Repayment Date</th>
                <th className="p-3.5">Customer Name</th>
                <th className="p-3.5">Allocated Contract</th>
                <th className="p-3.5">Method</th>
                <th className="p-3.5">Bank Reference</th>
                <th className="p-3.5">Auditing Note</th>
                <th className="p-3.5 text-right">Sum (ZAR)</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">No installments recorded. Allocations will appear here.</td>
                </tr>
              ) : (
                payments.slice().reverse().map(p => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isToday = p.date === todayStr;
                  const canEdit = isToday || currentUser?.role === 'main_admin';
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/10">
                      <td className="p-3.5 text-slate-500">{p.date}</td>
                      <td className="p-3.5 font-semibold text-slate-200">{getCustName(p.customerId)}</td>
                      <td className="p-3.5 font-bold text-amber-500">{p.agrNumber}</td>
                      <td className="p-3.5 capitalize text-slate-400">{p.method}</td>
                      <td className="p-3.5 text-slate-500 font-mono">{p.reference || '—'}</td>
                      <td className="p-3.5 text-slate-400 max-w-xs truncate">{p.note || '—'}</td>
                      <td className="p-3.5 text-right text-emerald-400 font-black">R {p.amount.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleStartEdit(p)}
                          className={`px-2 py-1 rounded font-bold text-[10px] transition flex items-center justify-center gap-1 mx-auto ${
                            canEdit
                              ? 'bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 cursor-pointer'
                              : 'bg-slate-950 text-slate-600 cursor-not-allowed'
                          }`}
                          title={canEdit ? 'Edit Repayment Record' : 'Previous date record (Admin required)'}
                        >
                          {canEdit ? <Edit size={10} /> : <Lock size={10} />}
                          <span>{canEdit ? 'Edit' : 'Locked'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Edit Modal */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-850 flex items-center justify-between">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Edit className="text-amber-500 h-4.5 w-4.5" />
                <span>Edit Repayment Allocation</span>
              </h3>
              <button 
                onClick={() => setEditingPayment(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="p-6 space-y-4">
                <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Agreement:</span>
                    <span className="font-bold text-amber-500">{editingPayment.agrNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span className="font-bold text-slate-200">{getCustName(editingPayment.customerId)}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Repayment Date
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg text-slate-200 p-2.5 text-xs focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Payment Amount (ZAR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg text-slate-200 p-2.5 text-xs focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Payment Method
                  </label>
                  <select
                    value={editMethod}
                    onChange={(e) => setEditMethod(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg text-slate-200 p-2.5 text-xs focus:outline-none focus:border-amber-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="eft">EFT Bank Transfer</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    EFT / Bank Reference
                  </label>
                  <input
                    type="text"
                    value={editRef}
                    onChange={(e) => setEditRef(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg text-slate-200 p-2.5 text-xs focus:outline-none focus:border-amber-500"
                    placeholder="Reference number"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Auditing Note
                  </label>
                  <textarea
                    rows={2}
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg text-slate-200 p-2.5 text-xs focus:outline-none focus:border-amber-500"
                    placeholder="Note for audit logs"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-950/40 border-t border-slate-850 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Save size={14} /> Save Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================================================
   2. OVERDUE VIEW
   ====================================================== */
interface OverdueViewProps {
  agreements: Agreement[];
  customers: Customer[];
  onNavigate: (page: string) => void;
}
export function OverdueView({ agreements, customers, onNavigate }: OverdueViewProps) {
  const getCust = (id: string) => customers.find(c => c.id === id);
  const overdueAgrs = agreements.filter(a => a.status === 'overdue');

  const daysOverdue = (dueStr: string): number => {
    const diff = new Date().getTime() - new Date(dueStr).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 3600 * 24)));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-1.5 text-rose-400"><AlertTriangle /> Arrears & Exposure Alerts</h2>
        <p className="text-xs text-slate-400">National Credit Act (NCA) compliance and default collections tracking</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center gap-4 text-rose-400 bg-rose-500/5">
        <AlertTriangle className="h-10 w-10 flex-shrink-0" />
        <div className="text-xs space-y-1">
          <h4 className="font-bold uppercase tracking-wider text-[10px]">Arrears exposure block</h4>
          <p className="leading-relaxed text-slate-300">
            SASSC credit policy dictates that any client with an outstanding balance that has exceeded its payday due date will be marked as <strong>BLOCKED</strong>. No additional groceries credit or loan capital can be compositions on their account until the overdue ledger is fully repaid.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/40 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                <th className="p-3.5">Agreement</th>
                <th className="p-3.5">Customer Name</th>
                <th className="p-3.5">SA Cell Phone</th>
                <th className="p-3.5 text-right">Repayable Total</th>
                <th className="p-3.5 text-right">Paid</th>
                <th className="p-3.5 text-right">Balance In Arrears</th>
                <th className="p-3.5">Payday Due</th>
                <th className="p-3.5">Overdue Days</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {overdueAgrs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">Excellent! No agreements are currently overdue in the ledger.</td>
                </tr>
              ) : (
                overdueAgrs.map(a => {
                  const cust = getCust(a.customerId);
                  return (
                    <tr key={a.id} className="hover:bg-slate-800/10">
                      <td className="p-3.5 font-bold text-slate-200">{a.agrNumber}</td>
                      <td className="p-3.5 font-medium">{cust ? cust.name : '—'}</td>
                      <td className="p-3.5 text-slate-400">{cust ? cust.phone : '—'}</td>
                      <td className="p-3.5 text-right">{a.totalAmount.toFixed(2)}</td>
                      <td className="p-3.5 text-right text-emerald-400">{a.paid.toFixed(2)}</td>
                      <td className="p-3.5 text-right text-rose-400 font-black">R {a.balance.toFixed(2)}</td>
                      <td className="p-3.5 text-rose-400 font-medium">{a.dueDate}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400">
                          {daysOverdue(a.dueDate)} days
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          onClick={() => onNavigate('agreements')}
                          className="px-2.5 py-1.5 bg-amber-500 text-slate-950 rounded font-semibold text-[10px] hover:brightness-105"
                        >
                          Repay
                        </button>
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
  );
}

/* ======================================================
   3. COLLECTIONS VIEW
   ====================================================== */
interface CollectionsViewProps {
  collectionNotes: CollectionNote[];
  customers: Customer[];
  agreements: Agreement[];
  onAddNote: (custId: string, agrId: string) => void;
}
export function CollectionsView({ collectionNotes, customers, agreements, onAddNote }: CollectionsViewProps) {
  const [search, setSearch] = useState('');
  
  const getCustName = (id: string) => customers.find(c => c.id === id)?.name || '—';
  const getCustPhone = (id: string) => customers.find(c => c.id === id)?.phone || '—';

  const cases = customers.filter(c => {
    const hasOverdue = checkCustomerOverdue(c.id, agreements);
    const hasNotes = collectionNotes.some(n => n.customerId === c.id);
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    return (hasOverdue || hasNotes) && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-1.5"><AlertTriangle className="text-amber-500" /> Collections CRM Cases</h2>
          <p className="text-xs text-slate-400">Track communication logs, promise-to-pay pledges, and field enforcement visits</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              // Print report
              const win = window.open('', '_blank');
              if (win) {
                const html = `
                  <html><head><title>Collections Printable Register</title><style>body{font-family:sans-serif;font-size:12px;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px}th{background:#eee}</style></head>
                  <body><h2>SASSC Collections Call Logs</h2>
                  <table><thead><tr><th>Date</th><th>Client Name</th><th>Log Type</th><th>Pledge Amount</th><th>Promise Date</th><th>Call Note Summary</th></tr></thead><tbody>
                  ${collectionNotes.map(n => {
                    const cName = customers.find(c => c.id === n.customerId)?.name || 'Unknown';
                    return `<tr><td>${n.date}</td><td>${cName}</td><td>${n.type}</td><td>R ${n.promiseAmount.toFixed(2)}</td><td>${n.promiseDate || '—'}</td><td>${n.note}</td></tr>`;
                  }).join('')}
                  </tbody></table></body></html>
                `;
                win.document.write(html);
                win.print();
              }
            }}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-200 rounded text-xs font-semibold hover:border-slate-700"
          >
            🖨️ Print Call Log Register
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <input
          type="text"
          placeholder="Filter collection cases by customer name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-950 border border-slate-850 rounded py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
        />
      </div>

      <div className="space-y-4">
        {cases.length === 0 ? (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500 text-xs">
            No active collections cases or logging history.
          </div>
        ) : (
          cases.map(c => {
            const exposure = getCustomerExposure(c.id, agreements);
            const notes = collectionNotes.filter(n => n.customerId === c.id);
            const hasOverdue = checkCustomerOverdue(c.id, agreements);

            return (
              <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div>
                    <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                      {c.name} <span className="text-xs text-slate-500">#{c.fileNo} | Cell: {c.phone}</span>
                    </h3>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Employer: {c.employer || 'None / Pension'} | Bank: {c.bank?.name || '—'}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">Overdue Debt</span>
                      <span className={`font-black ${exposure > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        R {exposure.toFixed(2)}
                      </span>
                    </div>
                    <button
                      onClick={() => onAddNote(c.id, '')}
                      className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold rounded text-xs"
                    >
                      + Log Call / Note
                    </button>
                  </div>
                </div>

                {notes.length > 0 && (
                  <div className="border-t border-slate-800 pt-3 space-y-2">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Contact Diary Entries</div>
                    <div className="space-y-2 max-h-[160px] overflow-y-auto">
                      {notes.slice().reverse().map(note => (
                        <div key={note.id} className="p-3 bg-slate-950 rounded-lg border border-slate-850/50 text-xs space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>{note.date} — {note.type.replace('_',' ')}</span>
                            <span>Logged by: {note.createdBy}</span>
                          </div>
                          <p className="text-slate-300 leading-normal">{note.note}</p>
                          {note.promiseAmount > 0 && (
                            <div className="text-[10px] text-amber-500 font-semibold bg-amber-500/5 px-2 py-1 rounded inline-block border border-amber-500/10">
                              Pledged repayment of R {note.promiseAmount.toFixed(2)} on or before {note.promiseDate}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ======================================================
   4. STOCK VIEW
   ====================================================== */
export function StockView({ currentUser }: { currentUser?: any }) {
  const [stock, setStock] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Tabs toggle
  const [activeStockTab, setActiveStockTab] = useState<'catalog' | 'stock_take' | 'write_offs'>('catalog');

  // New features list states
  const [stockTakes, setStockTakes] = useState<StockTake[]>([]);
  const [writeOffs, setWriteOffs] = useState<WriteOff[]>([]);
  const [activeStockTake, setActiveStockTake] = useState<StockTake | null>(null);
  const [stockTakeInputs, setStockTakeInputs] = useState<Record<string, string>>({});

  // Write-off modal states
  const [isWriteOffModalOpen, setIsWriteOffModalOpen] = useState(false);
  const [writeOffProductId, setWriteOffProductId] = useState('');
  const [writeOffQty, setWriteOffQty] = useState('');
  const [writeOffReason, setWriteOffReason] = useState('Damaged');

  // PIN Override Authentication (for testing & Cashier accounts)
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [isAdminOverride, setIsAdminOverride] = useState(false);

  // Quick adjust states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustPrice, setAdjustPrice] = useState('');

  // Interactive Add Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [prodType, setProdType] = useState<'standard' | 'prepared'>('standard');
  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodCategory, setProdCategory] = useState('General');
  const [prodBuyPrice, setProdBuyPrice] = useState('0');
  const [prodSellPrice, setProdSellPrice] = useState('0');
  const [prodQty, setProdQty] = useState('0');
  const [prodLowAt, setProdLowAt] = useState('5');
  const [prodUnit, setProdUnit] = useState('each');

  // Recipe ingredients builder
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [selectedIngId, setSelectedIngId] = useState('');
  const [ingQtyUsed, setIngQtyUsed] = useState('0');
  const [ingUnitUsed, setIngUnitUsed] = useState('g');

  // Recipe view modal
  const [viewingRecipeProduct, setViewingRecipeProduct] = useState<Product | null>(null);

  const loadStock = () => {
    setStock(loadDBList<Product>('stock'));
    setStockTakes(loadDBList<StockTake>('stockTakes'));
    setWriteOffs(loadDBList<WriteOff>('writeOffs'));
  };

  useEffect(() => {
    loadStock();
  }, []);

  // Sync prepared dish cost when ingredients list changes
  useEffect(() => {
    if (prodType === 'prepared') {
      const totalCost = recipeIngredients.reduce((sum, ing) => sum + ing.costCalculated, 0);
      setProdBuyPrice(totalCost.toFixed(2));
    }
  }, [recipeIngredients, prodType]);

  const handleOpenAdjust = (item: Product) => {
    setSelectedItem(item);
    setAdjustQty(String(item.qty));
    setAdjustPrice(String(item.sellPrice));
    setIsModalOpen(true);
  };

  const handleSaveAdjustment = () => {
    if (!selectedItem) return;
    if (!isUserAdmin()) {
      setIsAdminAuthOpen(true);
      return;
    }
    const nQty = parseInt(adjustQty);
    const nPrice = parseFloat(adjustPrice);

    if (isNaN(nQty) || nQty < 0 || isNaN(nPrice) || nPrice < 0) {
      alert('Please enter valid positive numbers.');
      return;
    }

    const updated = stock.map(s => {
      if (s.id === selectedItem.id) {
        return { ...s, qty: nQty, sellPrice: nPrice };
      }
      return s;
    });

    saveDBList('stock', updated);
    setStock(updated);
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  // Recipe calculations
  const calculateIngredientCost = (ingProduct: Product, qty: number, unit: string): number => {
    const basePrice = ingProduct.buyPrice || 0;
    const baseUnit = (ingProduct.unit || 'each').toLowerCase();
    const targetUnit = unit.toLowerCase();

    if (baseUnit === targetUnit) {
      return qty * basePrice;
    }

    // Weight conversions: base is kg, target is g
    if (baseUnit === 'kg' && targetUnit === 'g') {
      return (qty / 1000) * basePrice;
    }
    if (baseUnit === 'g' && targetUnit === 'kg') {
      return qty * 1000 * basePrice;
    }

    // Volume conversions: base is l, target is ml
    if ((baseUnit === 'l' || baseUnit === 'litre') && targetUnit === 'ml') {
      return (qty / 1000) * basePrice;
    }
    if (baseUnit === 'ml' && (targetUnit === 'l' || targetUnit === 'litre')) {
      return qty * 1000 * basePrice;
    }

    return qty * basePrice;
  };

  const handleIngProductChange = (id: string) => {
    setSelectedIngId(id);
    const ingProduct = stock.find(p => p.id === id);
    if (ingProduct) {
      const baseUnit = (ingProduct.unit || 'each').toLowerCase();
      if (baseUnit === 'kg') setIngUnitUsed('g');
      else if (baseUnit === 'l') setIngUnitUsed('ml');
      else setIngUnitUsed(baseUnit);
    }
  };

  const getAvailableUnitsForBase = (baseUnit: string) => {
    const clean = (baseUnit || 'each').toLowerCase();
    if (clean === 'kg' || clean === 'g') return ['g', 'kg'];
    if (clean === 'l' || clean === 'ml') return ['ml', 'l'];
    return ['each', 'portion'];
  };

  const handleAddIngredient = () => {
    const ingProduct = stock.find(p => p.id === selectedIngId);
    if (!ingProduct) {
      alert('Please select a valid raw ingredient.');
      return;
    }
    const qty = parseFloat(ingQtyUsed);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }

    if (recipeIngredients.some(ing => ing.productId === selectedIngId)) {
      alert('This ingredient is already in the recipe list. Please remove it first to adjust portions.');
      return;
    }

    const cost = calculateIngredientCost(ingProduct, qty, ingUnitUsed);

    const newIng: RecipeIngredient = {
      productId: selectedIngId,
      name: ingProduct.name,
      quantityUsed: qty,
      unitUsed: ingUnitUsed,
      costCalculated: parseFloat(cost.toFixed(2))
    };

    setRecipeIngredients([...recipeIngredients, newIng]);
    setSelectedIngId('');
    setIngQtyUsed('0');
  };

  const handleSaveNewProduct = () => {
    if (!prodName.trim()) {
      alert('Please enter a product name.');
      return;
    }

    const buy = parseFloat(prodBuyPrice);
    const sell = parseFloat(prodSellPrice);
    const qty = parseInt(prodQty);
    const lowAt = parseInt(prodLowAt);

    if (isNaN(buy) || buy < 0) {
      alert('Please enter a valid Cost Purchase Price.');
      return;
    }
    if (isNaN(sell) || sell < 0) {
      alert('Please enter a valid Retail Selling Price.');
      return;
    }
    if (isNaN(qty) || qty < 0) {
      alert('Please enter a valid stock level quantity.');
      return;
    }

    const sku = prodSku.trim() || prodName.replace(/\s+/g, '').toUpperCase();

    const newProduct: Product = {
      id: generateUid(),
      name: prodName.trim(),
      sku,
      category: prodCategory,
      buyPrice: buy,
      sellPrice: sell,
      qty,
      lowAt: isNaN(lowAt) ? 5 : lowAt,
      unit: prodUnit,
      created: new Date().toISOString().split('T')[0],
      isPreparedFood: prodType === 'prepared',
      ingredients: prodType === 'prepared' ? recipeIngredients : undefined
    };

    const list = [...stock, newProduct];
    saveDBList('stock', list);
    setStock(list);
    
    setIsAddModalOpen(false);
    resetAddForm();
  };

  const resetAddForm = () => {
    setProdType('standard');
    setProdName('');
    setProdSku('');
    setProdCategory('General');
    setProdBuyPrice('0');
    setProdSellPrice('0');
    setProdQty('0');
    setProdLowAt('5');
    setProdUnit('each');
    setRecipeIngredients([]);
    setSelectedIngId('');
    setIngQtyUsed('0');
  };

  // ADMIN ROLE AND AUTHENTICATION CHECKERS
  const isUserAdmin = () => {
    return currentUser?.role === 'main_admin' || isAdminOverride;
  };

  const handleVerifyAdminPIN = () => {
    if (adminPinInput === 'admin123' || adminPinInput === '1234') {
      setIsAdminOverride(true);
      setIsAdminAuthOpen(false);
      setAdminPinInput('');
      alert('Admin authentication successful!');
    } else {
      alert('Invalid admin PIN. Default test code is admin123 or 1234.');
    }
  };

  // COMPANY FINANCIAL STATE CALCULATOR
  const calculateCompanyFinancials = () => {
    // Load fresh data sets from DB
    const salesList = loadDBList<Sale>('sales');
    const paysList = loadDBList<Payment>('payments');
    const cashMovements = loadDBList<CashMovement>('cashMovements');
    const cashDays = loadDBList<CashDay>('cashDays');
    const agreements = loadDBList<Agreement>('agreements');
    const currentStock = loadDBList<Product>('stock');
    const currentWriteOffs = loadDBList<WriteOff>('writeOffs');

    return calculateCapitalReconciliation(
      salesList,
      paysList,
      cashMovements,
      cashDays,
      agreements,
      currentStock,
      currentWriteOffs
    );
  };

  // STOCK TAKE HANDLERS
  const handleStartNewStockTake = () => {
    const freshStock = loadDBList<Product>('stock');
    if (freshStock.length === 0) {
      alert('The stock catalog is currently empty. Add raw ingredients or products first.');
      return;
    }

    // Build the template
    const inputs: Record<string, string> = {};
    const items: StockTakeItem[] = freshStock.map(p => {
      inputs[p.id] = String(p.qty); // default counted to current level
      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        expectedQty: p.qty,
        countedQty: p.qty,
        variance: 0,
        buyPrice: p.buyPrice,
        varianceCostValue: 0
      };
    });

    const currentFinancials = calculateCompanyFinancials();

    const newSession: StockTake = {
      id: generateUid(),
      date: new Date().toISOString(),
      capturedBy: currentUser?.id || 'admin',
      capturedByName: currentUser?.fullName || 'Operator',
      items,
      applied: false,
      financialState: currentFinancials
    };

    setActiveStockTake(newSession);
    setStockTakeInputs(inputs);
  };

  const handleUpdateCountedQty = (productId: string, valStr: string) => {
    setStockTakeInputs(prev => ({ ...prev, [productId]: valStr }));
    if (!activeStockTake) return;

    const counted = parseInt(valStr) || 0;
    const updatedItems = activeStockTake.items.map(item => {
      if (item.productId === productId) {
        const variance = counted - item.expectedQty;
        return {
          ...item,
          countedQty: counted,
          variance,
          varianceCostValue: variance * item.buyPrice
        };
      }
      return item;
    });

    setActiveStockTake({
      ...activeStockTake,
      items: updatedItems
    });
  };

  const handleSaveStockTakeSession = () => {
    if (!activeStockTake) return;

    // Build finalized items
    const finalItems = activeStockTake.items.map(item => {
      const inputVal = parseInt(stockTakeInputs[item.productId]) || 0;
      const variance = inputVal - item.expectedQty;
      return {
        ...item,
        countedQty: inputVal,
        variance,
        varianceCostValue: parseFloat((variance * item.buyPrice).toFixed(2))
      };
    });

    // Record formal company financial state at this point
    const financialState = calculateCompanyFinancials();

    const finalizedStockTake: StockTake = {
      ...activeStockTake,
      items: finalItems,
      financialState,
      date: new Date().toISOString()
    };

    const list = [finalizedStockTake, ...stockTakes];
    saveDBList('stockTakes', list);
    setStockTakes(list);
    setActiveStockTake(null);
    alert('Stock take levels successfully captured and financial state snapshotted!');
  };

  const handleApplyStockTakeToCatalog = (stId: string) => {
    if (!isUserAdmin()) {
      // Trigger authentication PIN dialog
      setIsAdminAuthOpen(true);
      return;
    }

    const st = stockTakes.find(t => t.id === stId);
    if (!st) return;

    if (st.applied) {
      alert('This stock take has already been applied to the live catalog.');
      return;
    }

    const confirmApply = window.confirm('Are you sure you want to overwrite live catalog quantities with this physical count? This action is irreversible.');
    if (!confirmApply) return;

    // 1. Update live catalog level quantities
    const catalog = loadDBList<Product>('stock');
    const writeOffList = loadDBList<WriteOff>('writeOffs');
    const newWriteOffs: WriteOff[] = [];

    const updatedCatalog = catalog.map(prod => {
      const match = st.items.find(item => item.productId === prod.id);
      if (match) {
        // If counted < expected, generate automated write-off
        if (match.countedQty < match.expectedQty) {
          const writeOffQty = match.expectedQty - match.countedQty;
          const lossValue = writeOffQty * prod.buyPrice;
          
          const autoWriteOff: WriteOff = {
            id: generateUid(),
            productId: prod.id,
            name: prod.name,
            sku: prod.sku,
            qty: writeOffQty,
            buyPrice: prod.buyPrice,
            lossValue: parseFloat(lossValue.toFixed(2)),
            reason: 'Stock Take Shrinkage Variance',
            date: new Date().toISOString(),
            recordedBy: currentUser?.id || 'admin',
            recordedByName: currentUser?.fullName || 'Administrator'
          };
          newWriteOffs.push(autoWriteOff);
        }
        return { ...prod, qty: match.countedQty };
      }
      return prod;
    });

    // Save live stock level
    saveDBList('stock', updatedCatalog);
    setStock(updatedCatalog);

    // Save write-offs if any
    if (newWriteOffs.length > 0) {
      const combinedWriteOffs = [...newWriteOffs, ...writeOffList];
      saveDBList('writeOffs', combinedWriteOffs);
      setWriteOffs(combinedWriteOffs);
    }

    // 2. Mark stock take as applied
    const updatedStockTakes = stockTakes.map(t => {
      if (t.id === stId) {
        return {
          ...t,
          applied: true,
          appliedBy: currentUser?.id || 'admin',
          appliedByName: currentUser?.fullName || 'Administrator',
          appliedDate: new Date().toISOString()
        };
      }
      return t;
    });

    saveDBList('stockTakes', updatedStockTakes);
    setStockTakes(updatedStockTakes);
    alert('Live catalog levels successfully updated! Automated write-off records registered for negative shrinkage variances.');
  };

  const handleManualWriteOffSubmit = () => {
    if (!isUserAdmin()) {
      setIsAdminAuthOpen(true);
      return;
    }

    const prod = stock.find(p => p.id === writeOffProductId);
    if (!prod) {
      alert('Please select a valid product.');
      return;
    }

    const qty = parseInt(writeOffQty);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid write-off quantity.');
      return;
    }

    if (qty > prod.qty) {
      alert(`Cannot write off ${qty} units. Only ${prod.qty} units physically exist in stock.`);
      return;
    }

    const lossValue = qty * prod.buyPrice;

    const newWriteOff: WriteOff = {
      id: generateUid(),
      productId: prod.id,
      name: prod.name,
      sku: prod.sku,
      qty,
      buyPrice: prod.buyPrice,
      lossValue: parseFloat(lossValue.toFixed(2)),
      reason: writeOffReason,
      date: new Date().toISOString(),
      recordedBy: currentUser?.id || 'admin',
      recordedByName: currentUser?.fullName || 'Administrator'
    };

    // 1. Reduce catalog levels
    const updatedCatalog = stock.map(p => {
      if (p.id === prod.id) {
        return { ...p, qty: p.qty - qty };
      }
      return p;
    });

    // 2. Add write-off logs
    const combinedWriteOffs = [newWriteOff, ...writeOffs];

    saveDBList('stock', updatedCatalog);
    setStock(updatedCatalog);

    saveDBList('writeOffs', combinedWriteOffs);
    setWriteOffs(combinedWriteOffs);

    setIsWriteOffModalOpen(false);
    setWriteOffProductId('');
    setWriteOffQty('');
    setWriteOffReason('Damaged');

    alert(`Successfully wrote off ${qty} x ${prod.name}. R ${lossValue.toFixed(2)} write-off loss deducted from company stock asset value.`);
  };

  const handleResetStockTakeAndWriteOffs = () => {
    const confirmClear = window.confirm('Are you sure you want to delete all historic stock takes and write-off records? This resets financial history logs.');
    if (!confirmClear) return;
    saveDBList('stockTakes', []);
    saveDBList('writeOffs', []);
    setStockTakes([]);
    setWriteOffs([]);
    alert('Logs cleared successfully.');
  };

  const filtered = stock.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.sku.toLowerCase().includes(searchTerm.toLowerCase()));

  const liveFin = calculateCompanyFinancials();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-1.5">📦 Stock Inventory & Margins</h2>
          <p className="text-xs text-slate-400 font-sans">Establish cost values, pricing structures, and track physical recipe cost calculations</p>
        </div>
        <div className="flex gap-2">
          {activeStockTab === 'catalog' && (
            <button
              onClick={() => {
                resetAddForm();
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs hover:brightness-110 active:scale-98 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[3]" /> Add New Product
            </button>
          )}
          {activeStockTab === 'write_offs' && (
            <button
              onClick={() => {
                if (stock.length === 0) {
                  alert('No items in catalog to write off.');
                  return;
                }
                setWriteOffProductId(stock[0].id);
                setIsWriteOffModalOpen(true);
              }}
              className="px-4 py-2 bg-rose-500 text-white font-bold rounded-lg text-xs hover:brightness-110 active:scale-98 transition flex items-center gap-1.5 cursor-pointer"
            >
              <AlertTriangle className="h-4 w-4" /> Record Write-Off
            </button>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-800 space-x-1">
        <button
          onClick={() => setActiveStockTab('catalog')}
          className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-1.5 border-b-2 cursor-pointer ${
            activeStockTab === 'catalog'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="h-4 w-4" /> Stock Catalog & Recipes
        </button>
        <button
          onClick={() => setActiveStockTab('stock_take')}
          className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-1.5 border-b-2 cursor-pointer ${
            activeStockTab === 'stock_take'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ClipboardList className="h-4 w-4" /> Stock Take & Financials
        </button>
        <button
          onClick={() => setActiveStockTab('write_offs')}
          className={`px-4 py-2.5 text-xs font-bold transition flex items-center gap-1.5 border-b-2 cursor-pointer ${
            activeStockTab === 'write_offs'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertCircle className="h-4 w-4" /> Written-off Logs
        </button>
      </div>

      {/* 1. STOCK CATALOG TAB */}
      {activeStockTab === 'catalog' && (
        <>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <input
              type="text"
              placeholder="Filter catalog inventory..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/40 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <th className="p-3.5">SKU Code</th>
                    <th className="p-3.5">Product Description</th>
                    <th className="p-3.5 text-right">Cost Price</th>
                    <th className="p-3.5 text-right">Retail Sell</th>
                    <th className="p-3.5 text-right">Markup Margin</th>
                    <th className="p-3.5 text-center">In Stock</th>
                    <th className="p-3.5">Alert Level</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filtered.map(s => {
                    const markup = s.buyPrice > 0 ? (((s.sellPrice - s.buyPrice) / s.buyPrice) * 100).toFixed(0) : '0';
                    const isLow = s.qty <= s.lowAt;
                    
                    return (
                      <tr key={s.id} className="hover:bg-slate-800/10">
                        <td className="p-3.5 text-slate-500 font-mono font-semibold">{s.sku}</td>
                        <td className="p-3.5 font-bold text-slate-200">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {s.isPreparedFood && (
                                <span className="inline-flex items-center gap-0.5 bg-amber-500/15 text-amber-500 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-amber-500/20">
                                  <ChefHat className="h-2.5 w-2.5" /> Prepared Plate
                                </span>
                              )}
                              <span>{s.name}</span>
                            </div>
                            {s.isPreparedFood && s.ingredients && s.ingredients.length > 0 && (
                              <div className="text-[10px] text-slate-500 font-sans italic">
                                Recipe: {s.ingredients.map(ing => ing.name).join(', ')}
                              </div>
                            )}
                          </div>
                        </td>
                    <td className="p-3.5 text-right text-slate-400">R {s.buyPrice.toFixed(2)}</td>
                    <td className="p-3.5 text-right text-amber-500 font-bold">R {s.sellPrice.toFixed(2)}</td>
                    <td className="p-3.5 text-right text-slate-400">{markup}% Markup</td>
                    <td className="p-3.5 text-center font-bold">
                      <span className={`px-2 py-0.5 rounded font-mono ${
                        s.qty <= 0 
                          ? 'bg-rose-500/15 text-rose-400' 
                          : isLow 
                          ? 'bg-amber-500/15 text-amber-400 font-bold' 
                          : 'text-slate-200'
                      }`}>
                        {s.qty} {s.unit}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500">Below {s.lowAt} units</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {s.isPreparedFood && s.ingredients && s.ingredients.length > 0 && (
                          <button
                            onClick={() => setViewingRecipeProduct(s)}
                            className="px-2 py-1 bg-slate-950 border border-slate-850 rounded text-amber-500 hover:text-amber-400 text-[10px] hover:border-slate-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Utensils className="h-3 w-3" /> Recipe Cost
                          </button>
                        )}
                        <button 
                          onClick={() => handleOpenAdjust(s)}
                          className="px-2 py-1 bg-slate-950 border border-slate-850 rounded text-slate-300 text-[10px] hover:border-slate-700 cursor-pointer"
                        >
                          Adjust Levels
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
    )}

      {/* 2. STOCK TAKE TAB */}
      {activeStockTab === 'stock_take' && (
        <div className="space-y-6">
          {/* Current Financial State Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-emerald-400" /> Current Company Financial Position
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                <span className="text-[10px] text-slate-500 block uppercase font-sans">Cash on Hand</span>
                <span className="text-sm font-black text-slate-200 font-mono font-bold">R {liveFin.cashOnHand.toFixed(2)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                <span className="text-[10px] text-slate-500 block uppercase font-sans">Stock Cost</span>
                <span className="text-sm font-black text-slate-200 font-mono font-bold">R {liveFin.stockCost.toFixed(2)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                <span className="text-[10px] text-slate-500 block uppercase font-sans">Credit Accounts</span>
                <span className="text-sm font-black text-slate-200 font-mono font-bold">R {liveFin.accountsCredit.toFixed(2)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                <span className="text-[10px] text-slate-500 block uppercase font-sans">Cash in Bank</span>
                <span className="text-sm font-black text-slate-200 font-mono font-bold">R {liveFin.cashInBank.toFixed(2)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                <span className="text-[10px] text-slate-500 block uppercase font-sans">Cash Out</span>
                <span className="text-sm font-black text-rose-400 font-mono font-bold">R {liveFin.cashOut.toFixed(2)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                <span className="text-[10px] text-slate-500 block uppercase font-sans">Write-Off Loss</span>
                <span className="text-sm font-black text-rose-500 font-mono font-bold">R {liveFin.totalWriteOffLoss.toFixed(2)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <span className="text-[10px] text-amber-500 font-bold block uppercase font-sans">Net Capital</span>
                <span className="text-base font-black text-amber-400 font-mono font-bold">R {liveFin.totalFinancialState.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-3 leading-relaxed font-sans">
              <strong>Formula:</strong> (Cash on Hand + Stock Cost + Credit Accounts + Cash in Bank) - Cash Out - Write-Off Loss = <strong>Total Financial State</strong>
            </p>
          </div>

          {activeStockTake ? (
            /* Active stock take worksheet */
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden space-y-4 p-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 font-sans">
                    <ClipboardList className="h-4 w-4 text-amber-500 animate-pulse" /> Physical Inventory Count Worksheet
                  </h3>
                  <p className="text-[11px] text-slate-500 font-sans">Compare physical counts to computer recorded stock to find +/- shrinkage variances.</p>
                </div>
                <div className="flex gap-2 font-sans">
                  <button
                    onClick={() => {
                      if (window.confirm('Discard current count worksheet? All progress will be lost.')) {
                        setActiveStockTake(null);
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-400 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancel Count
                  </button>
                  <button
                    onClick={handleSaveStockTakeSession}
                    className="px-4 py-1.5 bg-amber-500 text-slate-950 hover:brightness-110 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" /> Capture Stock Count
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <th className="p-3">SKU Barcode</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3 text-right">Expected Qty</th>
                      <th className="p-3 text-center w-32">Physical Count</th>
                      <th className="p-3 text-right">Variance Qty</th>
                      <th className="p-3 text-right">Cost Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-300 font-mono">
                    {activeStockTake.items.map(item => {
                      const inputVal = stockTakeInputs[item.productId] ?? '';
                      const variance = item.variance;
                      return (
                        <tr key={item.productId} className="hover:bg-slate-850/20">
                          <td className="p-3 text-slate-500 font-semibold">{item.sku}</td>
                          <td className="p-3 font-bold font-sans text-slate-200">{item.name}</td>
                          <td className="p-3 text-right text-slate-400">{item.expectedQty}</td>
                          <td className="p-3 text-center">
                            <input
                              type="number"
                              min="0"
                              value={inputVal}
                              onChange={e => handleUpdateCountedQty(item.productId, e.target.value)}
                              className="w-20 bg-slate-950 border border-slate-800 p-1 rounded text-center text-xs text-amber-500 font-bold focus:outline-none focus:border-amber-500"
                            />
                          </td>
                          <td className={`p-3 text-right font-bold ${variance === 0 ? 'text-slate-500' : variance > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {variance > 0 ? `+${variance}` : variance}
                          </td>
                          <td className={`p-3 text-right font-bold ${variance === 0 ? 'text-slate-500' : variance > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            R {item.varianceCostValue.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Historic stock takes log */
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-850">
                <div>
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans">Start a Stock Take Session</h3>
                  <p className="text-[10px] text-slate-500 font-sans">You can retake physical inventory counts as many times as needed to resolve shrinkage.</p>
                </div>
                <button
                  onClick={handleStartNewStockTake}
                  className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs hover:brightness-110 active:scale-98 transition flex items-center gap-1.5 cursor-pointer font-sans"
                >
                  <ClipboardList className="h-4 w-4" /> Start Physical Stock Take
                </button>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-sans">
                <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <History className="h-4 w-4 text-slate-500" /> Historic Stock Take Logs
                  </h4>
                  {stockTakes.length > 0 && (
                    <button
                      onClick={handleResetStockTakeAndWriteOffs}
                      className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold bg-slate-900 px-2 py-1 rounded border border-slate-800 hover:border-slate-700"
                    >
                      <Trash className="h-3 w-3" /> Reset History
                    </button>
                  )}
                </div>

                {stockTakes.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs italic">
                    No historic stock takes captured yet. Click "Start Physical Stock Take" above.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-850">
                    {stockTakes.map(st => {
                      const totalVarianceCost = st.items.reduce((sum, i) => sum + i.varianceCostValue, 0);
                      return (
                        <div key={st.id} className="p-4 space-y-4 hover:bg-slate-850/5 transition">
                          <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-200">{new Date(st.date).toLocaleString()}</span>
                                {st.applied ? (
                                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold uppercase rounded border border-emerald-500/20 font-sans">
                                    Applied & Catalog Adjusted
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[9px] font-bold uppercase rounded border border-amber-500/20 font-sans">
                                    Captured - Pending Admin Apply
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 font-sans">
                                Captured by: <strong>{st.capturedByName}</strong> | Items Counted: <strong>{st.items.length} Products</strong>
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <div className="text-right">
                                <span className="text-[9px] text-slate-500 uppercase block">Count Variance Cost</span>
                                <span className={`text-xs font-black font-mono font-bold ${totalVarianceCost === 0 ? 'text-slate-400' : totalVarianceCost > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  R {totalVarianceCost.toFixed(2)}
                                </span>
                              </div>

                              {!st.applied ? (
                                <button
                                  onClick={() => handleApplyStockTakeToCatalog(st.id)}
                                  className="px-3 py-1.5 bg-emerald-500 text-slate-950 hover:brightness-110 font-bold rounded text-xs transition cursor-pointer flex items-center gap-1"
                                >
                                  <CheckCircle className="h-3 w-3" /> Apply Count to Catalog
                                </button>
                              ) : (
                                <div className="text-[10px] text-slate-500 italic text-right bg-slate-950 px-2 py-1.5 rounded border border-slate-850 leading-relaxed font-mono">
                                  Applied by {st.appliedByName} <br /> {st.appliedDate ? new Date(st.appliedDate).toLocaleDateString() : ''}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Recorded Financial State Breakdown */}
                          <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center text-[11px] font-mono font-semibold">
                            <div className="border-r border-slate-850/60 font-sans">
                              <span className="text-[9px] text-slate-500 block font-sans">Cash on Hand</span>
                              <span className="font-bold text-slate-300 font-mono">R {st.financialState?.cashOnHand?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div className="border-r border-slate-850/60 font-sans">
                              <span className="text-[9px] text-slate-500 block font-sans">Stock Cost</span>
                              <span className="font-bold text-slate-300 font-mono">R {st.financialState?.stockCost?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div className="border-r border-slate-850/60 font-sans">
                              <span className="text-[9px] text-slate-500 block font-sans">Credit Accounts</span>
                              <span className="font-bold text-slate-300 font-mono">R {st.financialState?.accountsCredit?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div className="border-r border-slate-850/60 font-sans">
                              <span className="text-[9px] text-slate-500 block font-sans">Cash in Bank</span>
                              <span className="font-bold text-slate-300 font-mono">R {st.financialState?.cashInBank?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div className="border-r border-slate-850/60 font-sans">
                              <span className="text-[9px] text-slate-500 block font-sans">Cash Out</span>
                              <span className="font-bold text-slate-300 font-mono">R {st.financialState?.cashOut?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div className="border-r border-slate-850/60 font-sans">
                              <span className="text-[9px] text-slate-500 block font-sans">Write-Off Loss</span>
                              <span className="font-bold text-rose-400 font-mono">R {st.financialState?.totalWriteOffLoss?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div className="font-sans">
                              <span className="text-[9px] text-amber-500 font-bold block">Financial State</span>
                              <span className="font-black text-amber-400 font-mono">R {st.financialState?.totalFinancialState?.toFixed(2) || '0.00'}</span>
                            </div>
                          </div>

                          {/* Mini Variance List */}
                          <div className="bg-slate-950/40 p-2.5 rounded border border-slate-900 text-[10px] space-y-1.5 font-sans">
                            <span className="text-[9px] text-slate-500 block uppercase font-bold tracking-wider">Count Variances:</span>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-400">
                              {st.items.map(i => {
                                if (i.variance === 0) return null;
                                return (
                                  <div key={i.productId} className="flex items-center gap-1 font-mono">
                                    <span className="font-sans text-slate-300">{i.name}:</span>
                                    <span className={i.variance > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                      {i.variance > 0 ? `+${i.variance}` : i.variance}
                                    </span>
                                  </div>
                                );
                              })}
                              {st.items.every(i => i.variance === 0) && (
                                <span className="italic text-slate-600">Perfect match! No physical variances detected.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. WRITTEN-OFF LOGS TAB */}
      {activeStockTab === 'write_offs' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 font-sans">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-200">Total Written-off Loss</h3>
              <p className="text-[11px] text-slate-500">Every recorded write-off (wastage, damage, physical counts shrinkage) directly reduces the company's financial state.</p>
            </div>
            <div className="bg-slate-950 px-4 py-2.5 rounded-lg border border-rose-500/20 text-right">
              <span className="text-[9px] text-rose-400 font-bold uppercase block">Accumulated Loss Balance</span>
              <span className="text-xl font-black text-rose-500 font-mono font-bold">R {writeOffs.reduce((sum, w) => sum + w.lossValue, 0).toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden font-sans">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <th className="p-3">Logged Date</th>
                    <th className="p-3">SKU Barcode</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Write-Off Reason / Description</th>
                    <th className="p-3 text-right">Qty Loss</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right text-rose-400">Loss Value</th>
                    <th className="p-3">Authorized By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-slate-300 font-mono">
                  {writeOffs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 text-xs italic font-sans">
                        No write-offs or shrinkage logs registered.
                      </td>
                    </tr>
                  ) : (
                    writeOffs.map(w => (
                      <tr key={w.id} className="hover:bg-slate-850/20">
                        <td className="p-3 text-slate-500 font-sans">{new Date(w.date).toLocaleDateString()} {new Date(w.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                        <td className="p-3 text-slate-400">{w.sku}</td>
                        <td className="p-3 font-bold font-sans text-slate-200">{w.name}</td>
                        <td className="p-3 font-sans">
                          <span className="inline-flex items-center gap-1 text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20">
                            {w.reason}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold">{w.qty}</td>
                        <td className="p-3 text-right text-slate-400 font-mono">R {w.buyPrice.toFixed(2)}</td>
                        <td className="p-3 text-right font-black text-rose-500 font-mono font-bold font-semibold">R {w.lossValue.toFixed(2)}</td>
                        <td className="p-3 font-sans text-slate-400">{w.recordedByName}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Manual Write-Off Modal */}
      {isWriteOffModalOpen && (
        <div className="modal-overlay open">
          <div className="modal max-w-xs bg-slate-900 border border-slate-800 text-slate-100 font-sans">
            <div className="modal-header">
              <h3>Record Loss Write-Off</h3>
              <button className="close-btn" onClick={() => setIsWriteOffModalOpen(false)}>×</button>
            </div>
            <div className="modal-body p-5 space-y-4 text-xs">
              <div className="form-group">
                <label>Select Product / Raw Ingredient</label>
                <select
                  value={writeOffProductId}
                  onChange={e => setWriteOffProductId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 p-2 rounded text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {stock.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku}) — {p.qty} in stock</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Quantity to Write-Off</label>
                <input
                  type="number"
                  min="1"
                  value={writeOffQty}
                  onChange={e => setWriteOffQty(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full bg-slate-950 border border-slate-850 p-2 rounded text-slate-200 focus:outline-none focus:border-amber-500 font-mono font-bold text-amber-500"
                />
              </div>
              <div className="form-group">
                <label>Reason for Write-Off</label>
                <select
                  value={writeOffReason}
                  onChange={e => setWriteOffReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 p-2 rounded text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="Damaged / Broken">Damaged / Broken</option>
                  <option value="Expired / Spoiled">Expired / Spoiled</option>
                  <option value="Stolen / Missing">Stolen / Missing</option>
                  <option value="Theft">Theft</option>
                  <option value="Wastage / Scrap">Wastage / Scrap</option>
                </select>
              </div>
            </div>
            <div className="modal-footer p-4 bg-slate-950 border-t border-slate-850 flex justify-end gap-2">
              <button className="px-3 py-1.5 bg-slate-850 border border-slate-800 text-slate-300 rounded text-xs" onClick={() => setIsWriteOffModalOpen(false)}>Cancel</button>
              <button className="px-4 py-1.5 bg-rose-500 text-white hover:brightness-110 text-xs font-bold rounded" onClick={handleManualWriteOffSubmit}>Confirm Write-Off</button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Authorization Overrides PIN Modal */}
      {isAdminAuthOpen && (
        <div className="modal-overlay open">
          <div className="modal max-w-xs bg-slate-950 border border-slate-800 text-slate-100 font-sans">
            <div className="modal-header bg-slate-900">
              <h3 className="text-xs font-bold text-rose-400 flex items-center gap-1 uppercase"><Lock className="h-4 w-4" /> Admin Adjustment Required</h3>
              <button className="close-btn" onClick={() => setIsAdminAuthOpen(false)}>×</button>
            </div>
            <div className="modal-body p-5 space-y-4 text-xs text-center">
              <p className="text-slate-400">Only corporate administrators can adjust levels, approve physical counts or write off stock.</p>
              <div className="form-group">
                <label className="text-left block text-[10px] uppercase font-bold text-slate-500 mb-1">Enter Admin PIN Override</label>
                <input
                  type="password"
                  value={adminPinInput}
                  onChange={e => setAdminPinInput(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-slate-900 border border-slate-850 p-2.5 rounded text-center text-lg font-black tracking-widest text-amber-500 focus:outline-none focus:border-amber-500 font-mono"
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleVerifyAdminPIN();
                  }}
                />
                <span className="text-[10px] text-slate-500 block mt-1">Hint: Try 'admin123' or '1234' for corporate bypass.</span>
              </div>
            </div>
            <div className="modal-footer p-4 bg-slate-900 border-t border-slate-850 flex justify-between">
              <button className="px-3 py-1.5 bg-slate-850 border border-slate-800 rounded text-slate-400 text-xs font-semibold" onClick={() => setIsAdminAuthOpen(false)}>Cancel</button>
              <button className="px-4 py-1.5 bg-rose-500 hover:brightness-110 font-bold rounded text-xs text-white" onClick={handleVerifyAdminPIN}>Verify & Override</button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Qty Modal */}
      {isModalOpen && selectedItem && (
        <div className="modal-overlay open">
          <div className="modal max-w-xs bg-slate-900 border border-slate-800 text-slate-100">
            <div className="modal-header">
              <h3>Adjust Stock — {selectedItem.name}</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <div className="modal-body p-5 space-y-4 text-xs">
              <div className="form-group">
                <label>Physical Inventory Qty</label>
                <input
                  type="number"
                  value={adjustQty}
                  onChange={e => setAdjustQty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 p-2 rounded text-slate-200"
                />
              </div>
              <div className="form-group">
                <label>Retail Selling Price (R)</label>
                <input
                  type="number"
                  step="0.01"
                  value={adjustPrice}
                  onChange={e => setAdjustPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 p-2 rounded text-slate-200"
                />
              </div>
            </div>
            <div className="modal-footer p-4 bg-slate-950 border-t border-slate-850">
              <button className="btn btn-secondary text-xs" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary text-xs" onClick={handleSaveAdjustment}>Save changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Add Product Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay open">
          <div className="modal max-w-2xl bg-slate-900 border border-slate-800 text-slate-100 p-0 overflow-hidden">
            <div className="modal-header bg-slate-950 px-5 py-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
                <PlusCircle className="text-amber-500 h-4.5 w-4.5" /> Capture New Stock Item
              </h3>
              <button className="text-slate-400 hover:text-slate-200 text-lg font-bold" onClick={() => { setIsAddModalOpen(false); resetAddForm(); }}>×</button>
            </div>

            <div className="modal-body p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              {/* Product Type Toggle */}
              <div className="grid grid-cols-2 gap-3 p-1 bg-slate-950 rounded-lg border border-slate-850">
                <button
                  type="button"
                  onClick={() => {
                    setProdType('standard');
                    setProdCategory('General');
                    setProdUnit('each');
                  }}
                  className={`py-2 px-3 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    prodType === 'standard'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Database className="h-4 w-4" /> Standard Item
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProdType('prepared');
                    setProdCategory('Prepared Food');
                    setProdUnit('plate');
                  }}
                  className={`py-2 px-3 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    prodType === 'prepared'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ChefHat className="h-4 w-4" /> Prepared Food / Recipe Plate
                </button>
              </div>

              {/* General Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 font-semibold mb-1 block">Product Description Name *</label>
                  <input
                    type="text"
                    value={prodName}
                    onChange={e => setProdName(e.target.value)}
                    placeholder={prodType === 'prepared' ? "e.g. Maize Meal + Salad + Steak Plate" : "e.g. Can of Coke 330ml"}
                    className="w-full bg-slate-950 border border-slate-850 p-2 rounded text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold mb-1 block">SKU / Barcode Code (Optional)</label>
                  <input
                    type="text"
                    value={prodSku}
                    onChange={e => setProdSku(e.target.value)}
                    placeholder="Auto-generated if empty"
                    className="w-full bg-slate-950 border border-slate-850 p-2 rounded text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-slate-400 font-semibold mb-1 block">Category</label>
                  <select
                    value={prodCategory}
                    onChange={e => setProdCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 p-2 rounded text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="General">General</option>
                    <option value="Prepared Food">Prepared Food</option>
                    <option value="Raw Ingredients">Raw Ingredients</option>
                    <option value="Groceries">Groceries</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Snacks">Snacks</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold mb-1 block">Standard Unit of Sale</label>
                  <select
                    value={prodUnit}
                    onChange={e => setProdUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 p-2 rounded text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="each">each (per item)</option>
                    <option value="plate">plate (prepared)</option>
                    <option value="portion">portion (prepared)</option>
                    <option value="kg">kg (weight)</option>
                    <option value="g">g (weight)</option>
                    <option value="l">l (volume)</option>
                    <option value="ml">ml (volume)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold mb-1 block">Re-order Alert Threshold</label>
                  <input
                    type="number"
                    value={prodLowAt}
                    onChange={e => setProdLowAt(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 p-2 rounded text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Prepared Food Section: Recipe Ingredient Builder */}
              {prodType === 'prepared' && (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-850 space-y-4">
                  <h4 className="font-bold text-amber-500 flex items-center gap-1.5 uppercase text-[10px] tracking-wider border-b border-slate-900 pb-2">
                    <Utensils className="h-3.5 w-3.5" /> Plate Recipe Ingredients Cost Calculator
                  </h4>

                  {/* Selector Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-5">
                      <label className="text-slate-500 block mb-1 font-semibold text-[10px] uppercase">Select Raw Stock Item</label>
                      <select
                        value={selectedIngId}
                        onChange={e => handleIngProductChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-slate-200 focus:outline-none text-xs cursor-pointer"
                      >
                        <option value="">-- Choose ingredient product --</option>
                        {stock
                          .filter(p => !p.isPreparedFood) // Raw ingredients only
                          .map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Cost: R {p.buyPrice.toFixed(2)} / {p.unit})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-slate-500 block mb-1 font-semibold text-[10px] uppercase">Quantity Used</label>
                      <input
                        type="number"
                        step="any"
                        value={ingQtyUsed}
                        onChange={e => setIngQtyUsed(e.target.value)}
                        placeholder="e.g. 150"
                        className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-slate-200 focus:outline-none text-xs font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-slate-500 block mb-1 font-semibold text-[10px] uppercase">Portion Unit</label>
                      <select
                        value={ingUnitUsed}
                        onChange={e => setIngUnitUsed(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-slate-200 focus:outline-none text-xs cursor-pointer"
                      >
                        {selectedIngId ? (
                          getAvailableUnitsForBase(stock.find(p => p.id === selectedIngId)?.unit || 'each').map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))
                        ) : (
                          <option value="g">g</option>
                        )}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddIngredient}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 text-amber-500 font-bold rounded text-xs transition cursor-pointer"
                      >
                        + Add Line
                      </button>
                    </div>
                  </div>

                  {/* Active Recipe Table */}
                  <div className="bg-slate-900/60 rounded-lg overflow-hidden border border-slate-900">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-950 text-slate-500 font-bold uppercase text-[9px] tracking-wider border-b border-slate-850">
                          <th className="p-2.5">Ingredient Name</th>
                          <th className="p-2.5">Portion Size</th>
                          <th className="p-2.5 text-right">Calculated Cost</th>
                          <th className="p-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 text-slate-300 font-mono">
                        {recipeIngredients.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-slate-500 font-sans italic">
                              No recipe components added yet. Compose a list above to calculate ingredients receiving cost.
                            </td>
                          </tr>
                        ) : (
                          recipeIngredients.map(ing => (
                            <tr key={ing.productId} className="hover:bg-slate-850/40">
                              <td className="p-2.5 font-semibold text-slate-200 font-sans">{ing.name}</td>
                              <td className="p-2.5 text-slate-400">{ing.quantityUsed} {ing.unitUsed}</td>
                              <td className="p-2.5 text-right text-emerald-400 font-bold">R {ing.costCalculated.toFixed(2)}</td>
                              <td className="p-2.5 text-center font-sans">
                                <button
                                  type="button"
                                  onClick={() => setRecipeIngredients(recipeIngredients.filter(item => item.productId !== ing.productId))}
                                  className="text-rose-400 hover:text-rose-300 font-bold text-xs"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pricing structure & Margins calculator */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">
                  <h4 className="font-bold text-slate-200 uppercase text-[10px] tracking-wider border-b border-slate-900 pb-2">Financial Pricing Structure</h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-500 block mb-1 font-semibold">Cost Buy Price (R) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={prodBuyPrice}
                        onChange={e => setProdBuyPrice(e.target.value)}
                        disabled={prodType === 'prepared'}
                        className={`w-full p-2 rounded text-slate-200 font-mono focus:outline-none border ${
                          prodType === 'prepared'
                            ? 'bg-slate-900 border-slate-850 text-emerald-400 font-bold cursor-not-allowed'
                            : 'bg-slate-950 border-slate-850 focus:border-amber-500'
                        }`}
                      />
                      {prodType === 'prepared' && (
                        <span className="text-[9px] text-emerald-400 font-semibold block mt-1">✓ Recipe Cost Sum</span>
                      )}
                    </div>

                    <div>
                      <label className="text-slate-500 block mb-1 font-semibold">Retail Sell Price (R) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={prodSellPrice}
                        onChange={e => setProdSellPrice(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 p-2 rounded text-amber-500 font-bold font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-500 block mb-1 font-semibold">Opening Physical Stock Level</label>
                    <input
                      type="number"
                      value={prodQty}
                      onChange={e => setProdQty(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 p-2 rounded text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Dynamic Margins visualizer */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
                  <h4 className="font-bold text-slate-200 uppercase text-[10px] tracking-wider border-b border-slate-900 pb-2">Plate Margin & Mark-Up Indicator</h4>
                  
                  {(() => {
                    const buy = parseFloat(prodBuyPrice) || 0;
                    const sell = parseFloat(prodSellPrice) || 0;
                    const profit = sell - buy;
                    const markup = buy > 0 ? (profit / buy) * 100 : 0;
                    const gpMargin = sell > 0 ? (profit / sell) * 100 : 0;

                    return (
                      <div className="space-y-3 text-xs font-sans">
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="bg-slate-900/60 p-2 rounded border border-slate-850">
                            <span className="text-slate-500 block text-[9px] uppercase font-bold">Mark-Up %</span>
                            <span className={`text-base font-black font-mono ${profit >= 0 ? 'text-amber-500' : 'text-rose-400'}`}>
                              {markup.toFixed(1)}%
                            </span>
                          </div>
                          <div className="bg-slate-900/60 p-2 rounded border border-slate-850">
                            <span className="text-slate-500 block text-[9px] uppercase font-bold">Gross Profit Margin %</span>
                            <span className={`text-base font-black font-mono ${gpMargin >= 35 ? 'text-emerald-400' : gpMargin > 0 ? 'text-amber-500' : 'text-rose-400'}`}>
                              {gpMargin.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-900/40 p-2.5 rounded border border-slate-900 flex justify-between items-center font-mono text-[11px]">
                          <span className="text-slate-400 font-sans">Net Profit Contribution:</span>
                          <span className={`text-sm font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            R {profit.toFixed(2)} / {prodUnit}
                          </span>
                        </div>

                        {sell > 0 && gpMargin < 35 && (
                          <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded text-rose-400 text-[10px] flex items-start gap-1.5 leading-snug">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span><strong>Caution: Low Profit Margin!</strong> The gross profit margin ({gpMargin.toFixed(0)}%) is below standard restaurant industry threshold (normally 35% - 70%). Consider revising selling price.</span>
                          </div>
                        )}

                        {sell > 0 && gpMargin >= 35 && (
                          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 text-[10px] flex items-center gap-1.5 leading-snug">
                            <CheckCircle className="h-4 w-4 shrink-0" />
                            <span><strong>Healthy Food Margin!</strong> Gross profit margin is within optimal restaurant targets.</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

            </div>

            <div className="modal-footer p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
              <button 
                type="button"
                className="px-4 py-2 bg-slate-900 text-slate-300 hover:text-slate-200 border border-slate-850 hover:border-slate-800 rounded-lg text-xs" 
                onClick={() => { setIsAddModalOpen(false); resetAddForm(); }}
              >
                Cancel Capture
              </button>
              <button 
                type="button"
                className="px-5 py-2 bg-amber-500 text-slate-950 hover:brightness-110 font-bold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer" 
                onClick={handleSaveNewProduct}
              >
                <Save className="h-3.5 w-3.5" /> Save Product Level
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewing Recipe Details Modal */}
      {viewingRecipeProduct && (
        <div className="modal-overlay open">
          <div className="modal max-w-lg bg-slate-900 border border-slate-800 text-slate-100 p-0 overflow-hidden">
            <div className="modal-header bg-slate-950 px-5 py-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
                <ChefHat className="text-amber-500 h-4.5 w-4.5" /> Recipe Ingredients Breakdown
              </h3>
              <button className="text-slate-400 hover:text-slate-200 text-lg font-bold" onClick={() => setViewingRecipeProduct(null)}>×</button>
            </div>

            <div className="modal-body p-5 space-y-4 text-xs">
              <div>
                <div className="text-[10px] text-slate-500 font-semibold uppercase">Product Plate Name</div>
                <div className="text-base font-black text-slate-200">{viewingRecipeProduct.name}</div>
                <div className="text-[11px] text-slate-400 font-mono mt-1">SKU Barcode: {viewingRecipeProduct.sku} | Unit of Sale: {viewingRecipeProduct.unit}</div>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850 flex justify-between text-xs">
                <div>
                  <span className="text-slate-500 block">Total Ingredients Cost</span>
                  <span className="text-emerald-400 font-black text-sm">R {viewingRecipeProduct.buyPrice.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Retail Sale Price</span>
                  <span className="text-amber-500 font-black text-sm">R {viewingRecipeProduct.sellPrice.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Markup Percentage</span>
                  <span className="text-slate-200 font-black text-sm">
                    {viewingRecipeProduct.buyPrice > 0 ? (((viewingRecipeProduct.sellPrice - viewingRecipeProduct.buyPrice) / viewingRecipeProduct.buyPrice) * 100).toFixed(0) : '0'}% Mark-Up
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ingredients Contribution List</div>
                
                <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-850">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-900 text-slate-500 font-bold uppercase text-[9px] tracking-wider border-b border-slate-850">
                        <th className="p-2.5">Raw Ingredient</th>
                        <th className="p-2.5">Quantity / Portion</th>
                        <th className="p-2.5 text-right">Cost Contribution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 font-mono text-slate-300">
                      {viewingRecipeProduct.ingredients && viewingRecipeProduct.ingredients.length > 0 ? (
                        viewingRecipeProduct.ingredients.map((ing, i) => {
                          const percentage = viewingRecipeProduct.buyPrice > 0 ? ((ing.costCalculated / viewingRecipeProduct.buyPrice) * 100).toFixed(0) : '0';
                          return (
                            <tr key={i} className="hover:bg-slate-900/40">
                              <td className="p-2.5 font-sans font-semibold text-slate-200">{ing.name}</td>
                              <td className="p-2.5 text-slate-400">{ing.quantityUsed} {ing.unitUsed}</td>
                              <td className="p-2.5 text-right text-emerald-400 font-bold">
                                R {ing.costCalculated.toFixed(2)} <span className="text-[10px] text-slate-500 font-normal">({percentage}%)</span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-slate-500 italic">No ingredient lines recorded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="modal-footer p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button className="px-4 py-2 bg-slate-900 text-slate-300 hover:text-slate-200 border border-slate-850 rounded-lg text-xs" onClick={() => setViewingRecipeProduct(null)}>Close Costing View</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ======================================================
   5. REPORTS VIEW
   ====================================================== */
export function ReportsView() {
  const [reportType, setReportType] = useState('cash_sales');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Loaded DB stats
  const [sales, setSales] = useState<Sale[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // CSV Preview modal states
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewCsvData, setPreviewCsvData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');

  useEffect(() => {
    setSales(loadDBList<Sale>('sales'));
    setAgreements(loadDBList<Agreement>('agreements'));
    setPayments(loadDBList<Payment>('payments'));
  }, []);

  const getCsvDetails = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let fileName = `report_${reportType}_${dateFrom}_to_${dateTo}.csv`;

    if (reportType === 'cash_sales') {
      const filtered = sales.filter(s => s.date >= dateFrom && s.date <= dateTo && ['cash','card','eft'].includes(s.method));
      headers = ['Date', 'Customer Name', 'Payment Method', 'Subtotal', 'Discount', 'Total'];
      rows = filtered.map(s => [
        s.date,
        s.customerName,
        s.method,
        s.subtotal.toString(),
        s.discount.toString(),
        s.total.toString()
      ]);
    } else if (reportType === 'agreements') {
      headers = ['Agreement No', 'Date', 'Capital Owed', 'Initiation Fee', 'Service Fee', 'Total', 'Repaid', 'Balance', 'Due Date', 'Status'];
      const filtered = agreements.filter(a => a.date >= dateFrom && a.date <= dateTo);
      rows = filtered.map(a => [
        a.agrNumber,
        a.date,
        (a.goods || 0).toString(),
        (a.initiationFee || 0).toString(),
        (a.serviceFee || 0).toString(),
        (a.totalAmount || 0).toString(),
        (a.paid || 0).toString(),
        (a.balance || 0).toString(),
        a.dueDate,
        a.status
      ]);
    } else if (reportType === 'payments') {
      headers = ['Repayment Date', 'Agreement Allocated', 'Method', 'Reference', 'Sum Received'];
      const filtered = payments.filter(p => p.date >= dateFrom && p.date <= dateTo);
      rows = filtered.map(p => [
        p.date,
        p.agrNumber,
        p.method,
        p.reference || '',
        p.amount.toString()
      ]);
    } else if (reportType === 'accounts_due') {
      headers = ['Due Date', 'Customer Name', 'Capital Owed', 'Initiation Fee', 'Service Fee', 'Total Owed', 'Paid to Date', 'Balance Due'];
      const filtered = agreements.filter(a => a.dueDate >= dateFrom && a.dueDate <= dateTo && a.balance > 0);
      
      const customers = loadDBList<Customer>('customers');
      const getCustomerName = (customerId: string, snapshot: any) => {
        const c = customers.find(cust => cust.id === customerId);
        if (c) {
          return `${c.firstNames || ''} ${c.surname || ''}`.trim() || c.name;
        }
        if (snapshot) {
          return `${snapshot.firstNames || ''} ${snapshot.surname || ''}`.trim() || snapshot.name;
        }
        return 'Unknown Customer';
      };

      const grouped: { [key: string]: {
        dueDate: string;
        customerId: string;
        customerName: string;
        capital: number;
        initiationFee: number;
        serviceFee: number;
        totalAmount: number;
        paid: number;
        balance: number;
      } } = {};

      filtered.forEach(a => {
        const name = getCustomerName(a.customerId, a.customerSnapshot);
        const key = `${a.dueDate}_${a.customerId}`;
        if (!grouped[key]) {
          grouped[key] = {
            dueDate: a.dueDate,
            customerId: a.customerId,
            customerName: name,
            capital: 0,
            initiationFee: 0,
            serviceFee: 0,
            totalAmount: 0,
            paid: 0,
            balance: 0
          };
        }
        
        grouped[key].capital += (a.goods || 0) + (a.loan || 0);
        grouped[key].initiationFee += (a.initiationFee || 0);
        grouped[key].serviceFee += (a.serviceFee || 0);
        grouped[key].totalAmount += (a.totalAmount || 0);
        grouped[key].paid += (a.paid || 0);
        grouped[key].balance += (a.balance || 0);
      });

      const rowsList = Object.values(grouped);
      rowsList.sort((a, b) => {
        const dateA = new Date(a.dueDate).getTime();
        const dateB = new Date(b.dueDate).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.customerName.localeCompare(b.customerName);
      });

      rows = rowsList.map(r => [
        r.dueDate,
        r.customerName,
        r.capital.toFixed(2),
        r.initiationFee.toFixed(2),
        r.serviceFee.toFixed(2),
        r.totalAmount.toFixed(2),
        r.paid.toFixed(2),
        r.balance.toFixed(2)
      ]);

      let totalCapital = 0;
      let totalInit = 0;
      let totalServ = 0;
      let totalOwed = 0;
      let totalPaid = 0;
      let totalBal = 0;

      rowsList.forEach(r => {
        totalCapital += r.capital;
        totalInit += r.initiationFee;
        totalServ += r.serviceFee;
        totalOwed += r.totalAmount;
        totalPaid += r.paid;
        totalBal += r.balance;
      });

      if (rowsList.length > 0) {
        rows.push([
          'TOTALS',
          `For period ${dateFrom} to ${dateTo}`,
          totalCapital.toFixed(2),
          totalInit.toFixed(2),
          totalServ.toFixed(2),
          totalOwed.toFixed(2),
          totalPaid.toFixed(2),
          totalBal.toFixed(2)
        ]);
      }
    } else if (reportType === 'override_logs') {
      const overrides = loadDBList<any>('override_logs');
      const filtered = overrides.filter(o => o.date >= dateFrom && o.date <= dateTo);
      headers = ['Date', 'Customer Name', 'File No', 'Type', 'Overridden By', 'Arrears Balance (ZAR)', 'Compulsory Note'];
      rows = filtered.map(o => [
        o.date,
        o.customerName,
        o.fileNo || '—',
        o.type === 'pos_override' ? 'POS Retail Override' : 'Credit Wizard Override',
        o.overriddenByName || o.overriddenBy || 'Admin',
        (o.outstandingBalance || 0).toFixed(2),
        o.reason || '—'
      ]);
    }

    return { headers, rows, fileName };
  };

  const handleExportCSV = () => {
    const { headers, rows, fileName } = getCsvDetails();
    let csv = headers.join(',') + '\r\n';
    rows.forEach(row => {
      csv += row.map(cell => {
        const str = (cell || '').replace(/"/g, '""');
        return str.includes(',') ? `"${str}"` : str;
      }).join(',') + '\r\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreviewCSV = () => {
    const { headers, rows } = getCsvDetails();
    setPreviewCsvData({ headers, rows });
    setPreviewTitle(`Report Preview: ${reportType.replace('_', ' ').toUpperCase()}`);
    setPreviewOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-1.5"><BarChart3 className="text-amber-500" /> Financial Reporting Console</h2>
          <p className="text-xs text-slate-400">Extract high-fidelity ledger data and perform CSV spreadsheet exports</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePreviewCSV}
            className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-100 border border-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition active:scale-95 animate-fade-in"
          >
            <Eye size={14} className="text-amber-500" /> View Report
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer transition active:scale-95 shadow-lg shadow-amber-500/10"
          >
            <Download size={14} /> Download CSV
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap gap-4 items-end">
        <div className="form-group flex-1 min-w-[150px]">
          <label className="text-[10px] text-slate-500 font-bold uppercase">Report Category</label>
          <select value={reportType} onChange={e => setReportType(e.target.value)} className="bg-slate-950 border border-slate-850 p-2 rounded text-xs text-slate-200 w-full">
            <option value="cash_sales">Instant POS Retail Sales</option>
            <option value="agreements">Unified Credit Agreements Issued</option>
            <option value="payments">Repayments & Installments Received</option>
            <option value="accounts_due">Accounts Due / Repayments Ledger</option>
            <option value="override_logs">Compulsory Administrative Override Logs</option>
          </select>
        </div>
        <div className="form-group">
          <label className="text-[10px] text-slate-500 font-bold uppercase">Date From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-slate-950 border border-slate-850 p-1.5 rounded text-xs text-slate-200" />
        </div>
        <div className="form-group">
          <label className="text-[10px] text-slate-500 font-bold uppercase">To Date</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-slate-950 border border-slate-850 p-1.5 rounded text-xs text-slate-200" />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center text-slate-500 text-xs">
        {reportType === 'cash_sales' && (
          <div>
            <div className="text-sm font-semibold text-slate-300 mb-2">Retail Sales Statistics</div>
            <p>Ready for download. Total sales transactions matching filters: <strong>{sales.filter(s => s.date >= dateFrom && s.date <= dateTo && ['cash','card','eft'].includes(s.method)).length}</strong></p>
          </div>
        )}
        {reportType === 'agreements' && (
          <div>
            <div className="text-sm font-semibold text-slate-300 mb-2">Issued Agreements Statistics</div>
            <p>Ready for download. Total credit contracts matching filters: <strong>{agreements.filter(a => a.date >= dateFrom && a.date <= dateTo).length}</strong></p>
          </div>
        )}
        {reportType === 'payments' && (
          <div>
            <div className="text-sm font-semibold text-slate-300 mb-2">Instalment Allocations Statistics</div>
            <p>Ready for download. Total payments matching filters: <strong>{payments.filter(p => p.date >= dateFrom && p.date <= dateTo).length}</strong></p>
          </div>
        )}
        {reportType === 'accounts_due' && (
          <div>
            <div className="text-sm font-semibold text-slate-300 mb-2">Accounts Due Ledger Statistics</div>
            <p>Ready for download. Total active/overdue credit balances due in selected dates: <strong>{agreements.filter(a => a.dueDate >= dateFrom && a.dueDate <= dateTo && a.balance > 0).length}</strong></p>
          </div>
        )}
        {reportType === 'override_logs' && (
          <div>
            <div className="text-sm font-semibold text-slate-300 mb-2">Administrative Override Audit Statistics</div>
            <p>Ready for download. Total audited override exceptions logged: <strong>{loadDBList<any>('override_logs').filter(o => o.date >= dateFrom && o.date <= dateTo).length}</strong></p>
          </div>
        )}
      </div>

      {/* Report Preview Modal */}
      <DocumentPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={previewTitle}
        type="csv"
        csvData={previewCsvData}
        onDownload={handleExportCSV}
      />

    </div>
  );
}

/* ======================================================
   6. CASH CONTROL VIEW
   ====================================================== */
interface CashControlViewProps {
  activeDay: CashDay | null;
  onRefreshDB: () => void;
  currentUser: any;
}
export function CashControlView({ activeDay, onRefreshDB, currentUser }: CashControlViewProps) {
  const [openingFloat, setOpeningFloat] = useState('');
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [dayHistory, setDayHistory] = useState<CashDay[]>([]);
  
  // Create movement states
  const [moveType, setMoveType] = useState<'cash_in' | 'cash_out' | 'expense' | 'stock_purchase' | 'bank_deposit'>('cash_in');
  const [moveAmt, setMoveAmt] = useState('');
  const [moveRef, setMoveRef] = useState('');
  const [moveNote, setMoveNote] = useState('');

  // Close Register states
  const [countedCash, setCountedCash] = useState('');
  const [closeNote, setCloseNote] = useState('');

  const loadData = () => {
    setDayHistory(loadDBList<CashDay>('cashDays'));
    if (activeDay) {
      const moves = loadDBList<CashMovement>('cashMovements');
      setCashMovements(moves.filter(m => m.cashDayId === activeDay.id));
    }
  };

  useEffect(() => {
    loadData();
  }, [activeDay]);

  const handleOpenRegister = () => {
    const float = parseFloat(openingFloat) || 0;
    const date = new Date().toISOString().split('T')[0];
    const days = loadDBList<CashDay>('cashDays');

    if (days.some(d => d.date === date && d.status === 'open')) {
      alert('Register already open for today.');
      return;
    }

    const nextDay: CashDay = {
      id: generateUid(),
      date,
      openingCash: float,
      status: 'open',
      openedBy: currentUser?.id || 'admin',
      openedByName: currentUser?.fullName || 'Administrator',
      openedAt: new Date().toISOString(),
      notes: 'Day starting Float'
    };

    days.push(nextDay);
    saveDBList('cashDays', days);
    setOpeningFloat('');
    onRefreshDB();
  };

  const handleRecordMovement = () => {
    if (!activeDay) return;
    const amt = parseFloat(moveAmt) || 0;
    if (amt <= 0) {
      alert('Please enter a valid positive number.');
      return;
    }

    const movement: CashMovement = {
      id: generateUid(),
      cashDayId: activeDay.id,
      date: activeDay.date,
      type: moveType,
      amount: amt,
      reference: moveRef,
      note: moveNote,
      createdBy: currentUser?.id || 'admin',
      createdByName: currentUser?.fullName || 'Administrator',
      createdAt: new Date().toISOString()
    };

    const all = loadDBList<CashMovement>('cashMovements');
    all.push(movement);
    saveDBList('cashMovements', all);

    setMoveAmt('');
    setMoveRef('');
    setMoveNote('');
    loadData();
    onRefreshDB();
  };

  const handleCloseRegister = () => {
    if (!activeDay) return;
    const counted = parseFloat(countedCash);
    if (isNaN(counted)) {
      alert('Please enter counted cash in register.');
      return;
    }

    // Calculations via centralized Financial Engine
    const expected = calculateCashOnHand(
      loadDBList<Sale>('sales').filter(s => s.date === activeDay.date),
      loadDBList<Payment>('payments').filter(p => p.date === activeDay.date),
      loadDBList<CashMovement>('cashMovements').filter(m => m.cashDayId === activeDay.id),
      [activeDay]
    );

    const days = loadDBList<CashDay>('cashDays');
    const idx = days.findIndex(d => d.id === activeDay.id);
    if (idx >= 0) {
      days[idx] = {
        ...days[idx],
        status: 'closed',
        expectedClosing: expected,
        closingCash: counted,
        difference: counted - expected,
        closeNote: closeNote,
        closedBy: currentUser?.id || 'admin',
        closedByName: currentUser?.fullName || 'Administrator',
        closedAt: new Date().toISOString()
      };
      saveDBList('cashDays', days);
    }

    setCountedCash('');
    setCloseNote('');
    onRefreshDB();
  };

  // Inline calculation for active day expected cash on hand via centralized Financial Engine
  const getExpectedOnHand = () => {
    if (!activeDay) return 0;
    const salesList = loadDBList<Sale>('sales');
    const paysList = loadDBList<Payment>('payments');

    return calculateCashOnHand(
      salesList.filter(s => s.date === activeDay.date),
      paysList.filter(p => p.date === activeDay.date),
      cashMovements.filter(m => m.cashDayId === activeDay.id),
      [activeDay]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-1.5"><Calendar className="text-amber-500" /> Cash Control Register</h2>
        <p className="text-xs text-slate-400">Open/close cash floats daily and monitor discrepancies securely</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Register or Start Float Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Day register status</h3>
          
          {!activeDay ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-850 text-slate-500 text-xs">
                Register is currently closed. Enter starting float to unlock POS sales and Repayment logs.
              </div>
              <div className="form-group">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Opening Float Cash (R)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={openingFloat}
                  onChange={e => setOpeningFloat(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded p-2 text-slate-200 text-xs focus:outline-none"
                />
              </div>
              <button
                onClick={handleOpenRegister}
                className="w-full py-2 bg-amber-500 text-slate-950 font-bold rounded text-xs"
              >
                ☀️ Start Daily Register Float
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-2 text-slate-400">
                <div className="flex justify-between"><span>Status:</span><span className="text-emerald-400 font-bold uppercase">Open</span></div>
                <div className="flex justify-between"><span>Opened By:</span><span className="text-slate-300 font-medium">{activeDay.openedByName}</span></div>
                <div className="flex justify-between"><span>Opened Float:</span><span className="text-slate-300">R {activeDay.openingCash.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm font-bold text-slate-200 border-t border-slate-900 pt-2 mt-2">
                  <span>Expected On Hand:</span>
                  <span className="text-emerald-400 font-black">R {getExpectedOnHand().toFixed(2)}</span>
                </div>
              </div>

              {/* Close float composer */}
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div className="text-[10px] font-bold uppercase text-slate-400">End Float Reconciliation</div>
                <div className="form-group">
                  <label className="text-[10px] text-slate-500">Physical counted Cash in register (R)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={countedCash}
                    onChange={e => setCountedCash(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded p-1.5 text-slate-200 text-xs"
                  />
                </div>
                <div className="form-group">
                  <label className="text-[10px] text-slate-500">Closing notes</label>
                  <input
                    type="text"
                    placeholder="E.g. variance due to change shortage"
                    value={closeNote}
                    onChange={e => setCloseNote(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded p-1.5 text-slate-200 text-xs"
                  />
                </div>
                <button
                  onClick={handleCloseRegister}
                  className="w-full py-2 bg-rose-500 text-white font-bold rounded text-xs hover:bg-rose-600 transition"
                >
                  🌙 Close Daily Register & Reconciliation
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Float Manual Movements Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Log Cash Movement</h3>
          
          {!activeDay ? (
            <div className="text-center py-12 text-slate-500 text-xs">Daily Register closed. Open Day to record manual adjustments.</div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="text-[10px] text-slate-500">Movement Category</label>
                  <select value={moveType} onChange={e => setMoveType(e.target.value as any)} className="bg-slate-950 border border-slate-850 p-2 rounded text-slate-200 w-full">
                    <option value="cash_in">Float Top-Up (In)</option>
                    <option value="cash_out">Float Out (Advance)</option>
                    <option value="expense">Petty Expense (Out)</option>
                    <option value="bank_deposit">Banking Deposit (Out)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="text-[10px] text-slate-500">Amount (R)</label>
                  <input type="number" value={moveAmt} onChange={e => setMoveAmt(e.target.value)} className="bg-slate-950 border border-slate-850 p-2 rounded text-slate-200" />
                </div>
              </div>
              <div className="form-group">
                <label className="text-[10px] text-slate-500">EFT/Bank Reference</label>
                <input type="text" value={moveRef} onChange={e => setMoveRef(e.target.value)} placeholder="INV-204" className="bg-slate-950 border border-slate-850 p-1.5 rounded text-slate-200" />
              </div>
              <div className="form-group">
                <label className="text-[10px] text-slate-500">Operational description</label>
                <input type="text" value={moveNote} onChange={e => setMoveNote(e.target.value)} placeholder="Authorised fuel refund" className="bg-slate-950 border border-slate-850 p-1.5 rounded text-slate-200" />
              </div>
              <button
                onClick={handleRecordMovement}
                className="w-full py-2 bg-amber-500 text-slate-950 font-bold rounded text-xs"
              >
                + Record Register Entry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   7. CALCULATOR VIEW
   ====================================================== */
export function CalculatorView() {
  const [goods, setGoods] = useState('');
  const [loan, setLoan] = useState('');

  const goodsVal = parseFloat(goods) || 0;
  const loanVal = parseFloat(loan) || 0;
  const capital = goodsVal + loanVal;
  const fees = calcNcaFees(capital);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-1.5"><BarChart3 className="text-amber-500" /> NCA Underwriting Calculator Sandbox</h2>
        <p className="text-xs text-slate-400">Calculate initiation costs, service fees, and total contract balances instantly</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Parameters Entry</h3>
          <div className="form-group text-xs">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Groceries / Goods cost (R)</label>
            <input type="number" value={goods} onChange={e => setGoods(e.target.value)} placeholder="0.00" className="w-full bg-slate-950 border border-slate-850 p-2 text-slate-200 rounded mt-1" />
          </div>
          <div className="form-group text-xs">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Cash advance / Payday Loan (R)</label>
            <input type="number" value={loan} onChange={e => setLoan(e.target.value)} placeholder="0.00" className="w-full bg-slate-950 border border-slate-850 p-2 text-slate-200 rounded mt-1" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Calculated Breakdown</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-slate-400"><span>Goods Capital</span><span>R {goodsVal.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-400"><span>Advance Capital</span><span>R {loanVal.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-slate-300 border-t border-slate-850/60 pt-2"><span>Combined Capital</span><span>R {capital.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-400"><span>NCA Initiation Fee (10%)</span><span>R {fees.initiation.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-400"><span>Monthly Service Fee</span><span>R {fees.service.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-100 font-bold text-base border-t border-slate-800 pt-2.5 mt-2">
                <span>Contract Total</span>
                <span className="text-amber-500">R {fees.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   8. SETTINGS VIEW
   ====================================================== */
interface SettingsViewProps {
  onRefreshDB: () => void;
}
export function SettingsView({ onRefreshDB }: SettingsViewProps) {
  const [bizName, setBizName] = useState('');
  const [tradingAs, setTradingAs] = useState('');
  const [owner, setOwner] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [ncr, setNcr] = useState('');

  const [users, setUsers] = useState<User[]>([]);
  const [uName, setUName] = useState('');
  const [uUsername, setUUsername] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uRole, setURole] = useState<'main_admin' | 'manager' | 'cashier'>('cashier');

  const loadSettings = () => {
    const s = loadDBObj<BusinessSettings>('settings', {
      bizName: 'Phoenix Financial Services',
      tradingAs: 'SASSC',
      owner: 'Claudine Pike du Plessis',
      phone: '086 100 2472',
      address: '50A Von Weilligh Street, Rustenburg, 0300',
      ncr: 'NCR/CP/10452'
    });
    setBizName(s.bizName);
    setTradingAs(s.tradingAs);
    setOwner(s.owner);
    setPhone(s.phone);
    setAddress(s.address);
    setNcr(s.ncr);

    setUsers(loadDBList<User>('users'));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveSettings = () => {
    const s: BusinessSettings = { bizName, tradingAs, owner, phone, address, ncr };
    saveDBObj('settings', s);
    alert('Business settings successfully updated.');
    onRefreshDB();
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uName || !uUsername || !uPassword) {
      alert('All fields are required.');
      return;
    }

    const newUser: User = {
      id: generateUid(),
      fullName: uName,
      username: uUsername,
      passwordHash: hashPassword(uPassword),
      role: uRole,
      permissions: getRolePermissions(uRole),
      isActive: true,
      created: new Date().toISOString(),
      lastLoginAt: ''
    };

    const list = [...users, newUser];
    saveDBList('users', list);
    setUsers(list);
    setUName('');
    setUUsername('');
    setUPassword('');
  };

  const handleEraseAllData = () => {
    if (!window.confirm('WARNING: This will completely ERASE all local transactions, client records, and inventory data, and seed clean sample details. Are you sure?')) return;
    localStorage.clear();
    seedSampleData();
    loadSettings();
    onRefreshDB();
    alert('Database successfully reset to initial seed data.');
  };

  const handleClearProductionData = () => {
    if (!window.confirm('WARNING: This will permanently DELETE all customers, agreements, payments, stock catalog items, sales, and registers to start with a blank database for production. This action cannot be undone. Are you sure?')) return;
    clearAllProductionData();
    loadSettings();
    onRefreshDB();
    alert('Database successfully cleared. All transaction history has been wiped. You are ready to start capturing real production information!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-1.5"><Lock /> Brand Config & User Security Profiles</h2>
        <p className="text-xs text-slate-400">Manage trading details, regulatory registrations, and local credentials</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Business details form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Business registration parameters</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="form-group col-span-2">
              <label className="text-[10px] text-slate-500">Corporate Name</label>
              <input type="text" value={bizName} onChange={e => setBizName(e.target.value)} className="bg-slate-950 border border-slate-850 p-2 rounded mt-1 text-slate-300 w-full" />
            </div>
            <div className="form-group">
              <label className="text-[10px] text-slate-500">Trading Name</label>
              <input type="text" value={tradingAs} onChange={e => setTradingAs(e.target.value)} className="bg-slate-950 border border-slate-850 p-2 rounded mt-1 text-slate-300 w-full" />
            </div>
            <div className="form-group">
              <label className="text-[10px] text-slate-500">NCR Registration #</label>
              <input type="text" value={ncr} onChange={e => setNcr(e.target.value)} className="bg-slate-950 border border-slate-850 p-2 rounded mt-1 text-slate-300 w-full" />
            </div>
            <div className="form-group">
              <label className="text-[10px] text-slate-500">Principal Owner</label>
              <input type="text" value={owner} onChange={e => setOwner(e.target.value)} className="bg-slate-950 border border-slate-850 p-2 rounded mt-1 text-slate-300 w-full" />
            </div>
            <div className="form-group">
              <label className="text-[10px] text-slate-500">Contact Number</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="bg-slate-950 border border-slate-850 p-2 rounded mt-1 text-slate-300 w-full" />
            </div>
            <div className="form-group col-span-2">
              <label className="text-[10px] text-slate-500">Operational Head Office</label>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="bg-slate-950 border border-slate-850 p-2 rounded mt-1 text-slate-300 w-full" />
            </div>
          </div>
          <button onClick={handleSaveSettings} className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded text-xs flex items-center gap-1">
            <Save size={14} /> Update settings
          </button>
        </div>

        {/* User creation and details */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Registered Personnel</h3>
          <div className="max-h-[140px] overflow-y-auto space-y-2 border border-slate-850 p-2.5 rounded-lg bg-slate-950/40 text-xs">
            {users.map(u => (
              <div key={u.id} className="flex justify-between items-center text-slate-300 py-1 border-b border-slate-900 last:border-0">
                <span>{u.fullName} <strong className="text-slate-500">({u.username})</strong></span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] uppercase font-bold">{u.role.replace('_',' ')}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddUser} className="pt-2 border-t border-slate-800 space-y-3 text-xs">
            <div className="text-[10px] font-bold uppercase text-slate-400">Add New Personnel Account</div>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" required value={uName} onChange={e => setUName(e.target.value)} placeholder="Display Full Name" className="bg-slate-950 border border-slate-850 p-1.5 rounded" />
              <input type="text" required value={uUsername} onChange={e => setUUsername(e.target.value)} placeholder="Username" className="bg-slate-950 border border-slate-850 p-1.5 rounded" />
              <input type="password" required value={uPassword} onChange={e => setUPassword(e.target.value)} placeholder="Password Credentials" className="bg-slate-950 border border-slate-850 p-1.5 rounded" />
              <select value={uRole} onChange={e => setURole(e.target.value as any)} className="bg-slate-950 border border-slate-850 p-1.5 rounded">
                <option value="cashier">Cashier Clerk</option>
                <option value="manager">Operational Manager</option>
                <option value="main_admin">Corporate Admin</option>
              </select>
            </div>
            <button type="submit" className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold rounded text-xs">
              + Save user profile
            </button>
          </form>
        </div>
      </div>

      <div className="p-5 border border-rose-500/20 bg-rose-500/5 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-rose-400 uppercase tracking-wider text-[10px]">Developer Utilities & Hard-Resets</h4>
            <p className="text-slate-400 leading-normal max-w-lg">Reset database back to standard factory settings with complete clean mock files. Useful for quick sandbox presentation audits.</p>
          </div>
          <button onClick={handleEraseAllData} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs w-full sm:w-auto">
            Hard-Reset Database (Demo Data)
          </button>
        </div>

        <div className="pt-4 border-t border-rose-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-amber-500 uppercase tracking-wider text-[10px]">Go-Live Production Preparation</h4>
            <p className="text-slate-400 leading-normal max-w-lg">Erase all mock transactions, client profiles, stock catalog items, and daily logs. Wipes local cache and Firestore to leave a blank, clean canvas ready for real commercial operations.</p>
          </div>
          <button onClick={handleClearProductionData} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs w-full sm:w-auto">
            Clear Database for Production (Start Fresh)
          </button>
        </div>
      </div>
    </div>
  );
}
