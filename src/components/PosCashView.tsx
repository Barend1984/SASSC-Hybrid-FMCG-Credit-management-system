import React, { useState, useEffect } from 'react';
import { Product, CartItem, Sale, Customer, CashDay, Agreement, OverrideLog } from '../types';
import { loadDBList, saveDBList, generateUid, checkCustomerOverdue, getCustomerExposure } from '../utils/database';
import { ShoppingBag, Search, Trash2, Plus, Minus, UserCheck, ReceiptText, Sparkles, Shield, ShieldCheck, ShieldAlert, Ban, Check } from 'lucide-react';

interface PosCashViewProps {
  activeDay: CashDay | null;
  onRefreshStats: () => void;
  customers: Customer[];
  currentUser: any;
  agreements: Agreement[];
  onCompleteSale: (sale: Sale) => void;
}

export default function PosCashView({ activeDay, onRefreshStats, customers, currentUser, agreements, onCompleteSale }: PosCashViewProps) {
  const [stock, setStock] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'eft'>('cash');
  const [retailCustomerName, setRetailCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  // Administrative Override States
  const [adminOverrideActive, setAdminOverrideActive] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  // Reset override states when customer changes
  useEffect(() => {
    setAdminOverrideActive(false);
    setOverrideReason('');
  }, [selectedCustomerId]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || null;
  const currentExposure = selectedCustomerId ? getCustomerExposure(selectedCustomerId, agreements) : 0;
  const isCustomerInDefaultOrHasBalance = selectedCustomerId ? (checkCustomerOverdue(selectedCustomerId, agreements) || currentExposure > 0) : false;
  const isBlocked = isCustomerInDefaultOrHasBalance && !adminOverrideActive;

  useEffect(() => {
    const list = loadDBList<Product>('stock');
    setStock(list);
    
    // Extract unique categories
    const cats = Array.from(new Set(list.map(s => s.category).filter(Boolean)));
    setCategories(cats);
  }, []);

  const handleAddToCart = (product: Product) => {
    if (product.qty <= 0) {
      alert('Out of stock!');
      return;
    }

    const existing = cart.find(item => item.stockId === product.id);
    if (existing) {
      if (existing.qty >= product.qty) {
        alert(`Cannot add more. Only ${product.qty} units available.`);
        return;
      }
      setCart(cart.map(item => item.stockId === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { stockId: product.id, name: product.name, price: product.sellPrice, qty: 1, unit: product.unit }]);
    }
  };

  const updateQty = (index: number, delta: number) => {
    const item = cart[index];
    const product = stock.find(s => s.id === item.stockId);
    if (!product) return;

    const newQty = item.qty + delta;
    if (newQty <= 0) {
      setCart(cart.filter((_, i) => i !== index));
    } else {
      if (newQty > product.qty) {
        alert(`Only ${product.qty} units available.`);
        return;
      }
      setCart(cart.map((c, i) => i === index ? { ...c, qty: newQty } : c));
    }
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
  };

  const getSubtotal = () => cart.reduce((sum, c) => sum + (c.price * c.qty), 0);
  const getTotal = () => Math.max(0, getSubtotal() - discount);

  const handleCompleteSale = () => {
    if (!activeDay) {
      alert('⛔ Retail cash sales are disabled because the cash day is closed! Please open the day in the Cash Control drawer first.');
      return;
    }
    if (cart.length === 0) {
      alert('Your cart is empty.');
      return;
    }
    if (isBlocked) {
      alert('⛔ POS checkout blocked! Selected customer has an outstanding balance or overdue agreement.');
      return;
    }

    const currentSubtotal = getSubtotal();
    const currentTotal = getTotal();

    // Determine final customer name
    let finalCustomerName = 'Walk-in Customer';
    if (selectedCustomerId) {
      const match = customers.find(c => c.id === selectedCustomerId);
      if (match) finalCustomerName = match.name;
    } else if (retailCustomerName.trim()) {
      finalCustomerName = retailCustomerName.trim();
    }

    const sale: Sale = {
      id: generateUid(),
      date: new Date().toISOString().split('T')[0],
      customerId: selectedCustomerId || null,
      customerName: finalCustomerName,
      items: [...cart],
      subtotal: currentSubtotal,
      total: currentTotal,
      method: paymentMethod,
      discount: discount,
      desc: 'POS Cash Sale (Retail)',
      created: new Date().toISOString()
    };

    // Save sale to DB
    const allSales = loadDBList<Sale>('sales');
    allSales.push(sale);
    saveDBList('sales', allSales);

    // Save override log if override active
    if (adminOverrideActive && selectedCustomer) {
      try {
        const overrideLog: OverrideLog = {
          id: generateUid(),
          customerId: selectedCustomerId,
          customerName: `${selectedCustomer.firstNames || ''} ${selectedCustomer.surname || ''}`.trim() || selectedCustomer.name,
          fileNo: selectedCustomer.fileNo,
          date: new Date().toISOString().split('T')[0],
          type: 'pos_override',
          overriddenBy: currentUser?.id || 'admin',
          overriddenByName: currentUser?.fullName || 'Administrator',
          reason: overrideReason,
          outstandingBalance: currentExposure,
          created: new Date().toISOString()
        };
        const allOverrides = loadDBList<OverrideLog>('override_logs');
        allOverrides.push(overrideLog);
        saveDBList('override_logs', allOverrides);
      } catch (err) {
        console.error('Error saving POS administrative override log:', err);
      }
    }

    // Update stock levels
    const updatedStock = stock.map(s => {
      const cartMatch = cart.find(c => c.stockId === s.id);
      if (cartMatch) {
        return { ...s, qty: Math.max(0, s.qty - cartMatch.qty) };
      }
      return s;
    });
    setStock(updatedStock);
    saveDBList('stock', updatedStock);

    // Alert / print receipt
    onCompleteSale(sale);
    
    // Clear state
    setCart([]);
    setDiscount(0);
    setRetailCustomerName('');
    setSelectedCustomerId('');
    onRefreshStats();
  };

  const filteredProducts = stock.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <ShoppingBag className="text-amber-500" /> POS Retail Sales (Cash / Card)
          </h2>
          <p className="text-sm text-slate-400">Manage instant over-the-counter payments for walk-in retail clients</p>
        </div>
        <div className="flex gap-2">
          {activeDay ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              ● Day Register Open
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
              ● Day Register Closed
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Product Picker */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search products by name or barcode SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg text-slate-200 py-2 px-3 text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-1 min-h-[400px]">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-1">
              Products Catalog <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400">{filteredProducts.length} items</span>
            </h3>
            
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <ShoppingBag className="h-12 w-12 stroke-1 mb-2 text-slate-700" />
                <p className="text-sm">No products found matching filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[550px] overflow-y-auto pr-1">
                {filteredProducts.map((p) => {
                  const isLow = p.qty <= p.lowAt;
                  const isOut = p.qty <= 0;
                  return (
                    <button
                      key={p.id}
                      disabled={isOut}
                      onClick={() => handleAddToCart(p)}
                      className={`group relative text-left p-3 rounded-xl border transition focus:outline-none flex flex-col justify-between ${
                        isOut
                          ? 'bg-slate-950 border-slate-900 opacity-40 cursor-not-allowed'
                          : 'bg-slate-950/70 hover:bg-slate-950 border-slate-800 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5'
                      }`}
                    >
                      <div>
                        <div className="text-xs text-slate-500 mb-1 flex justify-between items-center">
                          <span>{p.category}</span>
                          {isOut && <span className="text-rose-400 text-[10px] font-bold">OUT</span>}
                        </div>
                        <div className="font-semibold text-slate-200 text-sm line-clamp-2 leading-tight group-hover:text-amber-400 transition mb-2">
                          {p.name}
                        </div>
                      </div>
                      
                      <div className="mt-2 pt-2 border-t border-slate-900 flex justify-between items-end">
                        <span className="text-base font-bold text-amber-500">
                          R {p.sellPrice.toFixed(2)}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isOut ? 'bg-rose-500/15 text-rose-400' : isLow ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                          Qty: {p.qty}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Cart / Checkout Panel */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex justify-between items-center">
              <h3 className="font-bold text-slate-100 flex items-center gap-1.5">
                <ReceiptText className="text-amber-500 h-4.5 w-4.5" /> Cart Items ({cart.reduce((a,c) => a+c.qty, 0)})
              </h3>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-xs text-rose-400 hover:underline flex items-center gap-0.5">
                  <Trash2 className="h-3 w-3" /> Clear Cart
                </button>
              )}
            </div>

            {/* Cart Scroll Area */}
            <div className="flex-1 p-4 overflow-y-auto max-h-[350px] min-h-[220px] space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <ShoppingBag className="h-10 w-10 text-slate-800 stroke-1 mb-2" />
                  <p className="text-xs text-slate-400">Cart is empty. Select items from the catalog.</p>
                </div>
              ) : (
                cart.map((item, index) => (
                  <div key={item.stockId} className="flex items-center gap-3 bg-slate-950 border border-slate-800/60 rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-200 text-sm truncate">{item.name}</div>
                      <div className="text-xs text-amber-500 font-semibold mt-0.5">
                        R {item.price.toFixed(2)} / {item.unit}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(index, -1)}
                        className="h-7 w-7 rounded-lg bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white flex items-center justify-center border border-slate-800 active:scale-95 transition"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-sm font-bold text-slate-200 w-6 text-center">{item.qty}</span>
                      <button
                        onClick={() => updateQty(index, 1)}
                        className="h-7 w-7 rounded-lg bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white flex items-center justify-center border border-slate-800 active:scale-95 transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => removeFromCart(index)}
                        className="h-7 w-7 rounded-lg bg-rose-950/20 text-rose-400 hover:bg-rose-900/35 flex items-center justify-center border border-rose-900/10 ml-1 active:scale-95 transition"
                        title="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Customer Picker section */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Assign Registered Customer (Optional)
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg text-slate-200 py-2 px-2.5 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Walk-in Anonymous Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.surname} (File: {c.fileNo})</option>
                  ))}
                </select>
              </div>

              {selectedCustomerId && (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Active Debt Exposure:</span>
                    <span className={`font-bold ${currentExposure > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      R {currentExposure.toFixed(2)}
                    </span>
                  </div>

                  {isCustomerInDefaultOrHasBalance && (
                    <div className="pt-2 border-t border-slate-850/60 space-y-2">
                      <div className="flex gap-1.5 text-rose-400 text-[10px] font-bold leading-tight">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                        <span>⛔ CHECKOUT BLOCKED DUE TO DEFAULT / UNPAID BALANCE</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Clerks are barred from completing retail sales for clients in default.
                      </p>

                      <div className="flex flex-col gap-2 pt-1.5">
                        {adminOverrideActive ? (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] p-1.5 rounded flex items-center justify-between">
                            <span className="font-bold flex items-center gap-0.5">
                              <ShieldCheck className="h-3 w-3" /> Override Active
                            </span>
                            <span className="opacity-80 truncate max-w-[120px]" title={overrideReason}>
                              "{overrideReason}"
                            </span>
                          </div>
                        ) : (
                          <>
                            {currentUser?.role === 'main_admin' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setOverrideReason('');
                                  setShowOverrideModal(true);
                                }}
                                className="w-full py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold text-[10px] transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Shield size={11} /> Apply Admin Override
                              </button>
                            ) : (
                              <div className="text-[10px] text-rose-400/80 italic font-medium">
                                🔒 Administrator authorization required to bypass.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Summary & Checkout Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/20 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-slate-400 text-sm">
                  <span>Subtotal</span>
                  <span>R {getSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 text-sm">
                  <span>Discount (R)</span>
                  <input
                    type="number"
                    min="0"
                    max={getSubtotal()}
                    value={discount || ''}
                    onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    className="w-20 px-2 py-1 text-right bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex justify-between text-slate-100 font-bold text-lg pt-2 border-t border-slate-800/40">
                  <span className="text-slate-300">Total</span>
                  <span className="text-amber-500">R {getTotal().toFixed(2)}</span>
                </div>
              </div>

              <div className="divider my-1 border-t border-slate-800/60"></div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Payment Mode
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['cash', 'card', 'eft'] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`py-2 text-xs font-semibold rounded-lg border capitalize transition ${
                          paymentMethod === method
                            ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                            : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {!activeDay && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-2.5 rounded-lg">
                  ⚠️ <strong>Register Locked:</strong> You cannot complete cash sales while the Cash Day is Closed. Go to <strong>Cash Control</strong> to open the day first.
                </div>
              )}

              {isBlocked && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-2.5 rounded-lg">
                  ⛔ <strong>Checkout Blocked:</strong> Assignment customer has unpaid exposure/arrears. Administrative authorization required.
                </div>
              )}

              <button
                disabled={cart.length === 0 || !activeDay || isBlocked}
                onClick={handleCompleteSale}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 disabled:from-slate-800 disabled:to-slate-800 text-slate-950 disabled:text-slate-500 font-bold rounded-xl flex items-center justify-center gap-1.5 border border-amber-400/20 disabled:border-transparent cursor-pointer disabled:cursor-not-allowed hover:brightness-110 active:scale-98 transition shadow-lg shadow-amber-500/5 disabled:shadow-none"
              >
                <Sparkles className="h-4.5 w-4.5" /> Complete Cash Sale
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* POS Administrative Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-850 flex items-center justify-between">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Shield className="text-amber-500 h-5 w-5" />
                <span>POS Administrative Override</span>
              </h3>
              <button 
                onClick={() => {
                  setShowOverrideModal(false);
                  setOverrideReason('');
                }}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cancel
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-400 space-y-2">
                <p className="font-bold">⚠️ AUDITED POS OVERRIDE</p>
                <p>
                  You are overriding a blocked status on POS checkout for customer <strong>{selectedCustomer ? `${selectedCustomer.firstNames || ''} ${selectedCustomer.surname || ''}`.trim() || selectedCustomer.name : 'Unknown'}</strong>.
                </p>
                <p>
                  Current Active Exposure: <strong>R {currentExposure.toFixed(2)}</strong>.
                </p>
                <p>
                  This action violates default checkout rules and will be permanently logged under Reports for regulatory oversight with your user details (<strong>{currentUser?.fullName || 'Operator'}</strong>).
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Compulsory Short Note / Justification Report *
                </label>
                <textarea
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Enter detailed reason / administrative error explanation here..."
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg text-slate-200 p-3 text-sm focus:outline-none focus:border-amber-500 placeholder-slate-600"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-950/40 border-t border-slate-850 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowOverrideModal(false);
                  setOverrideReason('');
                }}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold rounded-lg text-xs"
              >
                Abort
              </button>
              <button
                type="button"
                disabled={!overrideReason.trim()}
                onClick={() => {
                  if (!overrideReason.trim()) return;
                  setAdminOverrideActive(true);
                  setShowOverrideModal(false);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-extrabold rounded-lg text-xs flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <Check size={14} /> Authorize & Apply Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
