import React from 'react';
import { Sale, Agreement, Payment, Customer } from '../types';
import { getCustomerExposure, checkCustomerOverdue } from '../utils/database';
import { 
  TrendingUp, Scale, AlertOctagon, Users, Calendar, 
  Wallet, RefreshCw, CreditCard, ShoppingBag, ArrowUpRight 
} from 'lucide-react';

interface DashboardViewProps {
  sales: Sale[];
  agreements: Agreement[];
  payments: Payment[];
  customers: Customer[];
  onNavigate: (page: string) => void;
  activeDay: any;
}

export default function DashboardView({ 
  sales, 
  agreements, 
  payments, 
  customers, 
  onNavigate, 
  activeDay 
}: DashboardViewProps) {
  
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

  const todayCreditIssuedAmt = todaySales
    .filter(s => s.method === 'credit')
    .reduce((sum, s) => sum + s.total, 0);

  const todayPaymentsAmt = todayPayments.reduce((sum, p) => sum + p.amount, 0);

  // Active ledger stats
  const activeAgreements = agreements.filter(a => a.status !== 'paid');
  const overdueAgreements = agreements.filter(a => a.status === 'overdue');

  const totalBookExposure = activeAgreements.reduce((sum, a) => sum + a.balance, 0);
  const totalOverdueExposure = overdueAgreements.reduce((sum, a) => sum + a.balance, 0);

  // Recent timeline transactions
  const combinedActivity = [
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
  .slice(0, 10);

  return (
    <div className="space-y-6">
      
      {/* Dynamic Date Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100">
            Welcome Back 👋
          </h2>
          <p className="text-xs text-slate-400">
            SASSC Core Management Console · Phoenix Financial Services
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 font-medium flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-amber-500" />
            {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Cash sales */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-amber-500/30 transition">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Cash Sales</span>
              <span className="p-1 rounded bg-amber-500/10 text-amber-400"><TrendingUp size={14} /></span>
            </div>
            <div className="text-2xl font-bold text-amber-500 mt-2">
              {formatCurrency(todayCashSalesAmt)}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-850">
            From {todaySales.filter(s => ['cash', 'card', 'eft'].includes(s.method)).length} retail transactions
          </div>
        </div>

        {/* Credit issued */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-amber-500/30 transition">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Credit Issued</span>
              <span className="p-1 rounded bg-amber-500/10 text-amber-400"><ArrowUpRight size={14} /></span>
            </div>
            <div className="text-2xl font-bold text-amber-500 mt-2">
              {formatCurrency(todayCreditIssuedAmt)}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-850">
            Across {todaySales.filter(s => s.method === 'credit').length} credit agreements
          </div>
        </div>

        {/* Collections */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-emerald-500/30 transition">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payments Recovered</span>
              <span className="p-1 rounded bg-emerald-500/10 text-emerald-400"><Wallet size={14} /></span>
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-2">
              {formatCurrency(todayPaymentsAmt)}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-850">
            From {todayPayments.length} installment credits
          </div>
        </div>

        {/* Ledger size */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-amber-500/30 transition">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Book Value</span>
              <span className="p-1 rounded bg-amber-500/10 text-amber-400"><Scale size={14} /></span>
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-2">
              {formatCurrency(totalBookExposure)}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-850">
            Active exposure in {activeAgreements.length} contracts
          </div>
        </div>

      </div>

      {/* Main Core Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Recent Activity Timeline */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              🕒 Real-Time Transactions Timeline
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
                  {combinedActivity.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">
                        No financial movements registered yet. Complete sales or capture credits to populate.
                      </td>
                    </tr>
                  ) : (
                    combinedActivity.map((act) => (
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

        {/* Right Side: Quick Action & Exposure Risks */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Quick Actions Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              ⚡ Action Shortcuts
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => onNavigate('pos')}
                className="p-3 bg-slate-950 hover:bg-slate-950/80 border border-slate-850 hover:border-amber-500/40 rounded-xl text-center flex flex-col items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <ShoppingBag className="text-amber-500 h-5 w-5" />
                <span className="text-xs font-semibold text-slate-200">Retail Sale</span>
              </button>
              
              <button 
                onClick={() => onNavigate('wizard')}
                className="p-3 bg-slate-950 hover:bg-slate-950/80 border border-slate-850 hover:border-amber-500/40 rounded-xl text-center flex flex-col items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Scale className="text-amber-500 h-5 w-5" />
                <span className="text-xs font-semibold text-slate-200">New Credit</span>
              </button>

              <button 
                onClick={() => onNavigate('payments')}
                className="p-3 bg-slate-950 hover:bg-slate-950/80 border border-slate-850 hover:border-emerald-500/40 rounded-xl text-center flex flex-col items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <CreditCard className="text-emerald-400 h-5 w-5" />
                <span className="text-xs font-semibold text-slate-200">Payment In</span>
              </button>

              <button 
                onClick={() => onNavigate('customers')}
                className="p-3 bg-slate-950 hover:bg-slate-950/80 border border-slate-850 hover:border-amber-500/40 rounded-xl text-center flex flex-col items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Users className="text-amber-500 h-5 w-5" />
                <span className="text-xs font-semibold text-slate-200">Add Customer</span>
              </button>
            </div>
          </div>

          {/* Overdue Accounts Alarm */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex-1">
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
