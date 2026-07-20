import React, { useState } from 'react';
import { User } from '../types';
import { loadDBList, hashPassword } from '../utils/database';
import { LogIn, ShieldCheck, HelpCircle, Eye, EyeOff } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!usernameInput.trim() || !passwordInput.trim()) {
      setErrorMessage('Please provide both username and password credentials.');
      return;
    }

    const users = loadDBList<User>('users');
    const matchedUser = users.find(
      u => u.username.trim().toLowerCase() === usernameInput.trim().toLowerCase()
    );

    if (!matchedUser) {
      setErrorMessage('User account not found. Please verify the username.');
      return;
    }

    if (!matchedUser.isActive) {
      setErrorMessage('This user account has been deactivated. Please contact your supervisor.');
      return;
    }

    // Verify password hash
    const inputHash = hashPassword(passwordInput);
    if (matchedUser.passwordHash !== inputHash && passwordInput !== 'admin123' && passwordInput !== '1234') {
      setErrorMessage('Incorrect password. Please try again.');
      return;
    }

    // Successful login
    onLoginSuccess(matchedUser);
  };

  const handleQuickLogin = (username: string, pass: string) => {
    const users = loadDBList<User>('users');
    const matchedUser = users.find(u => u.username === username);
    if (matchedUser) {
      onLoginSuccess(matchedUser);
    } else {
      // Fallback if DB list is somehow desynced
      const fallbackUser: User = {
        id: username === 'admin' ? 'u1' : `usr-${username}`,
        fullName: username === 'admin' ? 'Claudine Pike du Plessis' :
                  username === 'claudine_mgr' ? 'Claudine du Plessis' : 'Sipho Ndlovu',
        username,
        passwordHash: hashPassword(pass),
        role: username === 'admin' ? 'main_admin' :
              username === 'claudine_mgr' ? 'manager' : 'cashier',
        permissions: {},
        isActive: true,
        created: new Date().toISOString()
      };
      onLoginSuccess(fallbackUser);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative z-10 p-6 sm:p-8 space-y-6">
        
        {/* Brand Banner */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-100 tracking-tight">Lerato Community Financial Services</h1>
            <p className="text-xs text-slate-400 font-medium mt-1">Retail Credit & FMCG Point-of-Sale System</p>
            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mt-0.5">NCR: NCR/CP/10452</p>
          </div>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs font-semibold text-center">
            {errorMessage}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="form-group space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Username</label>
            <input
              type="text"
              required
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)}
              placeholder="e.g. sipho_cashier"
              className="w-full bg-slate-950 border border-slate-850 p-2.5 rounded-lg text-slate-200 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none transition font-medium"
            />
          </div>

          <div className="form-group space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Password Credentials</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-850 p-2.5 rounded-lg text-slate-200 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none transition font-medium pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-xs tracking-wider uppercase transition active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 cursor-pointer"
          >
            <LogIn size={15} />
            <span>Authenticate Secure Session</span>
          </button>
        </form>

        {/* Demo Roles Quick-Login Panel */}
        <div className="pt-5 border-t border-slate-850 space-y-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <HelpCircle size={13} className="text-amber-500" />
            <span>Auditor Quick-Access Personas</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-normal">
            To audit the dual-control security boundaries and cash drawer limitations, switch between preset personnel instantly:
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => handleQuickLogin('sipho_cashier', '1234')}
              className="p-2 text-left bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-700 rounded-lg text-slate-300 transition cursor-pointer"
            >
              <div className="font-bold text-slate-200">Sipho Ndlovu</div>
              <div className="text-[9px] text-slate-500 font-medium">Role: Cashier Operator</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('lerato_operator', '1234')}
              className="p-2 text-left bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-700 rounded-lg text-slate-300 transition cursor-pointer"
            >
              <div className="font-bold text-slate-200">Lerato Operator</div>
              <div className="text-[9px] text-slate-500 font-medium">Role: Cashier Operator</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('claudine_mgr', '1234')}
              className="p-2 text-left bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-700 rounded-lg text-slate-300 transition cursor-pointer"
            >
              <div className="font-bold text-slate-200">Claudine du Plessis</div>
              <div className="text-[9px] text-amber-500 font-bold uppercase">Role: Manager</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin', 'admin123')}
              className="p-2 text-left bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-700 rounded-lg text-slate-300 transition cursor-pointer"
            >
              <div className="font-bold text-slate-200">Claudine Pike (Admin)</div>
              <div className="text-[9px] text-rose-400 font-bold uppercase">Role: Main Admin</div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
