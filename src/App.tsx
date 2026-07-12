import React, { useState, useEffect } from 'react';
import { 
  Customer, Agreement, Sale, Payment, CollectionNote, CashDay, User 
} from './types';
import { 
  seedSampleData, loadDBList, saveDBList, generateUid, syncWithFirestore 
} from './utils/database';

// Views
import DashboardView from './components/DashboardView';
import PosCashView from './components/PosCashView';
import CreditWizardView from './components/CreditWizardView';
import CustomersView from './components/CustomersView';
import AgreementsView from './components/AgreementsView';
import AccountingPeriodView from './components/AccountingPeriodView';
import { 
  PaymentsView, OverdueView, CollectionsView, StockView, 
  ReportsView, CashControlView, CalculatorView, SettingsView 
} from './components/Views';

// Icons
import { 
  LayoutDashboard, ShoppingCart, ShieldCheck, Users, FileText, 
  DollarSign, AlertCircle, PhoneCall, PackageOpen, ClipboardList, 
  SlidersHorizontal, Landmark, ShieldCheck as ShieldIcon, UserX, Menu, X, LogIn,
  MessageCircle, BookOpen
} from 'lucide-react';

export default function App() {
  // DB States
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [collectionNotes, setCollectionNotes] = useState<CollectionNote[]>([]);
  const [cashDays, setCashDays] = useState<CashDay[]>([]);
  
  // Navigation
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Authentication & Session
  const [currentUser, setCurrentUser] = useState<any>({
    id: 'usr-admin-1',
    fullName: 'Claudine Pike du Plessis',
    username: 'admin',
    role: 'main_admin'
  });

  // Daily cash register
  const [activeDay, setActiveDay] = useState<CashDay | null>(null);

  // Collection modal log state
  const [noteCustId, setNoteCustId] = useState('');
  const [noteAgrId, setNoteAgrId] = useState('');
  const [noteType, setNoteType] = useState<'phone_call' | 'sms' | 'site_visit' | 'legal_notice'>('phone_call');
  const [notePledge, setNotePledge] = useState('');
  const [notePledgeDate, setNotePledgeDate] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isNoteOpen, setIsNoteOpen] = useState(false);

  const syncDatabase = () => {
    // Seed sample data if database is empty
    const list = localStorage.getItem('sassc2_customers') || localStorage.getItem('sassc_customers');
    if (!list) {
      seedSampleData();
    }

    const deduplicate = <T extends { id: string }>(items: T[]): T[] => {
      const seen = new Set<string>();
      return items.filter(item => {
        if (!item || !item.id) return true;
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    };

    const custs = deduplicate(loadDBList<Customer>('customers'));
    const agrs = deduplicate(loadDBList<Agreement>('agreements'));
    const sls = deduplicate(loadDBList<Sale>('sales'));
    const pays = deduplicate(loadDBList<Payment>('payments'));
    const notes = deduplicate(loadDBList<CollectionNote>('collection_notes'));
    const days = deduplicate(loadDBList<CashDay>('cashDays'));

    // Save cleaned lists back to avoid future load issues and clean up duplicate records
    saveDBList('customers', custs);
    saveDBList('agreements', agrs);
    saveDBList('sales', sls);
    saveDBList('payments', pays);
    saveDBList('collection_notes', notes);
    saveDBList('cashDays', days);

    setCustomers(custs);
    setAgreements(agrs);
    setSales(sls);
    setPayments(pays);
    setCollectionNotes(notes);
    setCashDays(days);

    // Scan for open cash registers
    const openDay = days.find(d => d.status === 'open') || null;
    setActiveDay(openDay);
  };

  useEffect(() => {
    syncDatabase();
    syncWithFirestore()
      .then(() => {
        syncDatabase();
      })
      .catch(err => {
        console.error("Firestore sync error:", err);
      });
  }, []);

  const handleRefresh = () => {
    syncDatabase();
  };

  const handleOpenLogNoteModal = (custId: string, agrId: string) => {
    setNoteCustId(custId);
    setNoteAgrId(agrId);
    setNoteType('phone_call');
    setNotePledge('');
    setNotePledgeDate('');
    setNoteContent('');
    setIsNoteOpen(true);
  };

  const handleSaveCollectionNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteCustId) return;

    const notesList = loadDBList<CollectionNote>('collection_notes');
    const pledgeAmt = parseFloat(notePledge) || 0;

    const mappedType: 'call' | 'promise' | 'visit' | 'arrangement' | 'other' = 
      noteType === 'phone_call' || noteType === 'sms' ? 'call' :
      noteType === 'site_visit' ? 'visit' : 'other';

    const noteObj: CollectionNote = {
      id: generateUid(),
      customerId: noteCustId,
      agrId: noteAgrId,
      date: new Date().toISOString().split('T')[0],
      type: pledgeAmt > 0 ? 'promise' : mappedType,
      note: noteContent,
      promiseAmount: pledgeAmt,
      promiseDate: pledgeAmt > 0 ? notePledgeDate : '',
      printable: false,
      createdBy: currentUser?.fullName || 'Operator',
      createdAt: new Date().toISOString()
    };

    notesList.push(noteObj);
    saveDBList('collection_notes', notesList);
    setCollectionNotes(notesList);
    setIsNoteOpen(false);
    alert('Contact call note captured.');
  };

  // Nav mapping list
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'Retail POS Cash', icon: ShoppingCart },
    { id: 'wizard', label: 'Credit Affordability', icon: ShieldCheck },
    { id: 'agreements', label: 'Agreements Ledger', icon: FileText },
    { id: 'customers', label: 'Client Profiles', icon: Users },
    { id: 'payments', label: 'Repayments Log', icon: DollarSign },
    { id: 'collections', label: 'Collections CRM', icon: PhoneCall },
    { id: 'stock', label: 'Stock Catalog', icon: PackageOpen },
    { id: 'reports', label: 'Financial Reports', icon: ClipboardList },
    { id: 'cash_control', label: 'Cash Control Day', icon: Landmark },
    { id: 'accounting', label: 'Accounting & Audits', icon: BookOpen },
    { id: 'calculator', label: 'NCA Fee Calculator', icon: SlidersHorizontal },
    { id: 'settings', label: 'System Settings', icon: SlidersHorizontal },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Top Banner & Mobile Nav Bar */}
      <header className="lg:hidden bg-slate-900 border-b border-slate-800 py-3 px-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-amber-500 rounded text-slate-950 font-black text-xs">SASSC</span>
          <span className="text-sm font-bold tracking-tight text-slate-100">Phoenix Financial</span>
        </div>
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-slate-400 hover:text-white transition"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      <div className="flex flex-1 relative">
        
        {/* Sidebar Left panel */}
        <aside className={`
          fixed lg:sticky top-0 bottom-0 left-0 z-40 
          w-64 bg-slate-900 border-r border-slate-800 
          flex flex-col justify-between transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          h-screen
        `}>
          
          <div className="flex flex-col flex-1 min-h-0">
            {/* Header logo */}
            <div className="hidden lg:flex items-center gap-2.5 px-6 py-5 border-b border-slate-850">
              <span className="px-2 py-1 bg-amber-500 rounded text-slate-950 font-black text-sm tracking-tighter">SASSC</span>
              <div>
                <span className="text-sm font-bold block tracking-tight text-slate-100 leading-none">Phoenix Financial</span>
                <span className="text-[9px] text-slate-500 font-bold tracking-widest uppercase mt-0.5 block">NCA Reg: NCR/CP/10452</span>
              </div>
            </div>

            {/* Cash Day status indicators */}
            <div className="mx-4 my-4 p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold tracking-wider uppercase text-slate-500">
                <span>DAILY CASH CONTROL</span>
                {activeDay ? (
                  <span className="text-emerald-400 flex items-center gap-0.5">● OPEN</span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-0.5">● CLOSED</span>
                )}
              </div>
              <div className="text-[11px] text-slate-300 font-medium">
                {activeDay ? `Day Started: ${activeDay.date}` : 'Register Closed today'}
              </div>
            </div>

            {/* Sidebar nav lists */}
            <nav className="flex-1 overflow-y-auto px-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition
                      ${isActive 
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10' 
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/20'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* WhatsApp Channel Link */}
          <div className="px-4 py-3 mx-3 mb-2 bg-emerald-950/20 border border-emerald-900/30 rounded-xl space-y-1.5">
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider block">Official Broadcasts</span>
            <a 
              href="https://whatsapp.com/channel/0029VbBuS4XDzgTAGE2EaO0Z" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <MessageCircle className="h-4 w-4 shrink-0 text-white" />
              <span>Join WhatsApp Channel</span>
            </a>
          </div>

          {/* Connected User details footer */}
          <div className="p-4 border-t border-slate-850 bg-slate-950/40 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-500">
                BP
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-200 block truncate">{currentUser?.fullName}</span>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Administrator</span>
              </div>
            </div>
          </div>

        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 flex flex-col overflow-y-auto bg-slate-950">
          
          <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
            
            {/* Conditional Views Router */}
            {activeTab === 'dashboard' && (
              <DashboardView 
                sales={sales}
                agreements={agreements}
                payments={payments}
                customers={customers}
                onNavigate={(t) => setActiveTab(t)}
                activeDay={activeDay}
              />
            )}

            {activeTab === 'pos' && (
              <PosCashView 
                customers={customers}
                currentUser={currentUser}
                activeDay={activeDay}
                onRefreshStats={handleRefresh}
                agreements={agreements}
                onCompleteSale={(sale) => {
                  handleRefresh();
                }}
              />
            )}

            {activeTab === 'wizard' && (
              <CreditWizardView 
                customers={customers}
                agreements={agreements}
                activeDay={activeDay}
                onRefreshDB={handleRefresh}
                onNavigate={(t) => setActiveTab(t)}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'agreements' && (
              <AgreementsView 
                agreements={agreements}
                customers={customers}
                onRefreshDB={handleRefresh}
                onNavigate={(t) => setActiveTab(t)}
                activeDay={activeDay}
              />
            )}

            {activeTab === 'customers' && (
              <CustomersView 
                customers={customers}
                agreements={agreements}
                payments={payments}
                collectionNotes={collectionNotes}
                currentUser={currentUser}
                onRefreshDB={handleRefresh}
                onAddCollectionNote={handleOpenLogNoteModal}
              />
            )}

            {activeTab === 'payments' && (
              <PaymentsView 
                payments={payments}
                customers={customers}
                currentUser={currentUser}
                onRefreshDB={handleRefresh}
              />
            )}

            {activeTab === 'overdue' && (
              <OverdueView 
                agreements={agreements}
                customers={customers}
                onNavigate={(t) => setActiveTab(t)}
              />
            )}

            {activeTab === 'collections' && (
              <CollectionsView 
                collectionNotes={collectionNotes}
                customers={customers}
                agreements={agreements}
                onAddNote={handleOpenLogNoteModal}
              />
            )}

            {activeTab === 'stock' && (
              <StockView currentUser={currentUser} />
            )}

            {activeTab === 'reports' && (
              <ReportsView />
            )}

            {activeTab === 'cash_control' && (
              <CashControlView 
                activeDay={activeDay}
                onRefreshDB={handleRefresh}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'accounting' && (
              <AccountingPeriodView />
            )}

            {activeTab === 'calculator' && (
              <CalculatorView />
            )}

            {activeTab === 'settings' && (
              <SettingsView 
                onRefreshDB={handleRefresh}
              />
            )}

          </div>

        </main>

      </div>

      {/* GLOBAL COLLECTION LOG NOTE MODAL */}
      {isNoteOpen && (
        <div className="modal-overlay open" onClick={() => setIsNoteOpen(false)}>
          <div className="modal max-w-sm bg-slate-900 border border-slate-800 text-slate-100" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleSaveCollectionNote}>
              <div className="modal-header">
                <h3>Log Collections Communication</h3>
                <button type="button" className="close-btn" onClick={() => setIsNoteOpen(false)}>×</button>
              </div>
              <div className="modal-body p-5 space-y-4 text-xs">
                
                <div className="form-group">
                  <label>Contact Type</label>
                  <select
                    value={noteType}
                    onChange={e => setNoteType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs"
                  >
                    <option value="phone_call">Phone Call (Inbound/Outbound)</option>
                    <option value="sms">SMS Text Alert Dispatch</option>
                    <option value="site_visit">Physical field Site Visit</option>
                    <option value="legal_notice">Section 129 Legal Letter</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Promise to Pay (Pledge) Sum (ZAR)</label>
                  <input
                    type="number"
                    value={notePledge}
                    placeholder="0.00"
                    onChange={e => setNotePledge(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs"
                  />
                </div>

                {notePledge && parseFloat(notePledge) > 0 && (
                  <div className="form-group">
                    <label>Promise Date</label>
                    <input
                      type="date"
                      value={notePledgeDate}
                      required
                      onChange={e => setNotePledgeDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-1.5 rounded text-xs"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Conversation Notes *</label>
                  <textarea
                    value={noteContent}
                    required
                    onChange={e => setNoteContent(e.target.value)}
                    rows={4}
                    placeholder="Write details of the response received..."
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2 rounded text-xs resize-none"
                  />
                </div>

              </div>
              <div className="modal-footer p-4 bg-slate-950 rounded-b-xl border-t border-slate-850">
                <button type="button" className="btn btn-secondary text-xs" onClick={() => setIsNoteOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary text-xs font-bold">Log Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
