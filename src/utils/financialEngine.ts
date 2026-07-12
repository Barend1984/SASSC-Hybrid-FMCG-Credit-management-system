import { Sale, Agreement, Payment, CashMovement, CashDay, Product, WriteOff } from '../types';

/**
 * FINANCIAL ENGINE FOR SASSC CREDIT MANAGEMENT SYSTEM
 * 
 * This module acts as the single source of truth for all financial calculations,
 * metric aggregates, cash ledger balances, portfolio indicators, and profit margins.
 * 
 * DESIGN CONSTRAINTS:
 * 1. Functions are 100% pure (no side effects, no React state, no database writes, no UI rendering).
 * 2. Precision: Operates directly on the stored currency numbers (ZAR / South African Rands) to avoid rounding issues.
 * 3. Adaptable architecture: Designed for modular scalability in preparation for Firebase migration.
 */

/**
 * Calculates the current expected cash physical balance inside the register drawer (Cash on Hand).
 * This aggregates starting day floats, cash sales, cash repayments, and manual cash adjustments, 
 * offset by manual cash outs/expenses and bank deposits.
 * 
 * @param sales All retail and credit sales.
 * @param payments Received installments or credit repayment sessions.
 * @param cashMovements Audit trail of manual cash drawer adjustments.
 * @param cashDays Session logs tracking open/closed days with opening floats.
 */
export function calculateCashOnHand(
  sales: Sale[],
  payments: Payment[],
  cashMovements: CashMovement[],
  cashDays: CashDay[]
): number {
  const totalOpeningCash = cashDays.reduce((sum, d) => sum + (d.openingCash || 0), 0);
  
  const totalCashSales = sales
    .filter(s => s.method?.toLowerCase() === 'cash')
    .reduce((sum, s) => sum + (s.total || 0), 0);

  const totalCashPayments = payments
    .filter(p => p.method?.toLowerCase() === 'cash')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalManualIn = cashMovements
    .filter(m => m.type === 'cash_in')
    .reduce((sum, m) => sum + (m.amount || 0), 0);

  const totalManualOut = cashMovements
    .filter(m => ['cash_out', 'expense', 'stock_purchase'].includes(m.type))
    .reduce((sum, m) => sum + (m.amount || 0), 0);

  const totalBankDeposits = cashMovements
    .filter(m => m.type === 'bank_deposit')
    .reduce((sum, m) => sum + (m.amount || 0), 0);

  return totalOpeningCash + totalCashSales + totalCashPayments + totalManualIn - totalManualOut - totalBankDeposits;
}

/**
 * Calculates the balance settled digitally into bank accounts (Cash in Bank).
 * This aggregates EFT sales, card sales, direct bank settlements, bank deposits from drawer, 
 * and bank payments/repayments.
 */
export function calculateBankBalance(
  sales: Sale[],
  payments: Payment[],
  cashMovements: CashMovement[]
): number {
  const bankSales = sales
    .filter(s => ['eft', 'bank', 'card'].includes(s.method?.toLowerCase() || ''))
    .reduce((sum, s) => sum + (s.total || 0), 0);

  const bankPayments = payments
    .filter(p => ['eft', 'bank', 'card'].includes(p.method?.toLowerCase() || ''))
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalBankDeposits = cashMovements
    .filter(m => m.type === 'bank_deposit')
    .reduce((sum, m) => sum + (m.amount || 0), 0);

  return totalBankDeposits + bankSales + bankPayments;
}

/**
 * Calculates total valuation cost of products currently held in inventory (Stock Valuation).
 * Iterates through active catalog items and multiplies quantity by buy unit price.
 */
export function calculateInventoryCost(stock: Product[]): number {
  return stock.reduce((sum, p) => sum + ((p.qty || 0) * (p.buyPrice || 0)), 0);
}

/**
 * Calculates the outstanding capital principal portion of active/overdue agreements.
 * This filters agreements to those with unpaid statuses and calculates the principal ratio
 * (goods + loan capital portion vs total contract value) applied to their current balances.
 */
export function calculateOutstandingPrincipal(agreements: Agreement[]): number {
  return agreements
    .filter(a => a.status === 'active' || a.status === 'overdue')
    .reduce((sum, a) => {
      const principal = (a.goods || 0) + (a.loan || 0);
      const total = a.totalAmount || 1;
      const ratio = principal / total;
      return sum + ((a.balance || 0) * ratio);
    }, 0);
}

/**
 * Calculates the outstanding interest & regulatory fees portion of active/overdue agreements.
 * Similar to principal portion, this isolates the initiation and monthly service fees
 * and applies the fee-to-total ratio to current outstanding credit balances.
 */
export function calculateOutstandingInterest(agreements: Agreement[]): number {
  return agreements
    .filter(a => a.status === 'active' || a.status === 'overdue')
    .reduce((sum, a) => {
      const principal = (a.goods || 0) + (a.loan || 0);
      const total = a.totalAmount || 1;
      const fees = total - principal;
      const ratio = fees / total;
      return sum + ((a.balance || 0) * ratio);
    }, 0);
}

/**
 * Calculates total historical manual cash outflow (operational expenses, stock purchases, manual outflows).
 */
export function calculateExpenseLedger(cashMovements: CashMovement[]): number {
  return cashMovements
    .filter(m => ['expense', 'cash_out', 'stock_purchase'].includes(m.type))
    .reduce((sum, m) => sum + (m.amount || 0), 0);
}

/**
 * Sums up total repayment installments processed across all customers.
 */
export function calculateCustomerPayments(payments: Payment[]): number {
  return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
}

/**
 * Sums up total credit sales issued through the point of sale.
 */
export function calculateCreditIssued(sales: Sale[]): number {
  return sales
    .filter(s => s.method === 'credit')
    .reduce((sum, s) => sum + (s.total || 0), 0);
}

/**
 * Prepares the complete unified capital reconciliation summary used for formal audits,
 * integrating liquid drawer assets, bank accounts, outstanding consumer credit debt, and stock valuations.
 */
export function calculateCapitalReconciliation(
  sales: Sale[],
  payments: Payment[],
  cashMovements: CashMovement[],
  cashDays: CashDay[],
  agreements: Agreement[],
  stock: Product[],
  writeOffs: WriteOff[]
) {
  const cashOnHand = calculateCashOnHand(sales, payments, cashMovements, cashDays);
  const stockCost = calculateInventoryCost(stock);
  const accountsCredit = agreements
    .filter(a => a.status === 'active' || a.status === 'overdue')
    .reduce((sum, a) => sum + (a.balance || 0), 0);
  const cashInBank = calculateBankBalance(sales, payments, cashMovements);
  const cashOut = calculateExpenseLedger(cashMovements);
  const totalWriteOffLoss = writeOffs.reduce((sum, w) => sum + (w.lossValue || 0), 0);

  const totalFinancialState = cashOnHand + stockCost + accountsCredit + cashInBank - cashOut - totalWriteOffLoss;

  return {
    cashOnHand,
    stockCost,
    accountsCredit,
    cashInBank,
    cashOut,
    totalWriteOffLoss,
    totalFinancialState
  };
}

/**
 * Calculates real-time business net profit/loss.
 * Total sales value (cash + card + EFT + credit contracts) minus business expenses and stock write-offs.
 */
export function calculateRealTimeProfit(
  sales: Sale[],
  cashMovements: CashMovement[],
  writeOffs: WriteOff[]
): number {
  const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalExpenses = cashMovements
    .filter(m => ['expense', 'stock_purchase'].includes(m.type))
    .reduce((sum, m) => sum + (m.amount || 0), 0);
  const totalWriteOffs = writeOffs.reduce((sum, w) => sum + (w.lossValue || 0), 0);
  return totalSales - totalExpenses - totalWriteOffs;
}

/**
 * Calculates aggregate statistics and structural metrics of the active loan book portfolio.
 */
export function calculateLoanPortfolio(agreements: Agreement[], payments: Payment[]) {
  const activeAgreements = agreements.filter(a => a.status !== 'paid');
  const overdueAgreements = agreements.filter(a => a.status === 'overdue');

  const totalBookValue = activeAgreements.reduce((sum, a) => sum + (a.balance || 0), 0);
  const overdueExposure = overdueAgreements.reduce((sum, a) => sum + (a.balance || 0), 0);
  
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalIssued = agreements.reduce((sum, a) => sum + (a.totalAmount || 0), 0);
  const repaymentRate = totalIssued > 0 ? totalPaid / totalIssued : 0;

  const averageAgreementValue = agreements.length > 0 
    ? agreements.reduce((sum, a) => sum + (a.totalAmount || 0), 0) / agreements.length
    : 0;

  return {
    totalBookValue,
    activeCount: activeAgreements.length,
    overdueCount: overdueAgreements.length,
    overdueExposure,
    averageAgreementValue,
    repaymentRate
  };
}

/**
 * Calculates profit specifically generated on a selected day.
 */
export function calculateDailyProfit(
  sales: Sale[],
  cashMovements: CashMovement[],
  writeOffs: WriteOff[],
  dateStr: string
): number {
  const dailySales = sales.filter(s => s.date === dateStr);
  const dailyMovements = cashMovements.filter(m => m.date.startsWith(dateStr));
  const dailyWriteOffs = writeOffs.filter(w => w.date.startsWith(dateStr));
  return calculateRealTimeProfit(dailySales, dailyMovements, dailyWriteOffs);
}

/**
 * Calculates profit specifically generated inside a selected calendar month (format: YYYY-MM).
 */
export function calculateMonthlyProfit(
  sales: Sale[],
  cashMovements: CashMovement[],
  writeOffs: WriteOff[],
  yearMonthStr: string
): number {
  const monthlySales = sales.filter(s => s.date.startsWith(yearMonthStr));
  const monthlyMovements = cashMovements.filter(m => m.date.startsWith(yearMonthStr));
  const monthlyWriteOffs = writeOffs.filter(w => w.date.startsWith(yearMonthStr));
  return calculateRealTimeProfit(monthlySales, monthlyMovements, monthlyWriteOffs);
}

/**
 * Calculates total available liquid cash (drawer balances + bank settled values).
 */
export function calculateAvailableCash(
  sales: Sale[],
  payments: Payment[],
  cashMovements: CashMovement[],
  cashDays: CashDay[]
): number {
  const cashOnHand = calculateCashOnHand(sales, payments, cashMovements, cashDays);
  const cashInBank = calculateBankBalance(sales, payments, cashMovements);
  return cashOnHand + cashInBank;
}

/**
 * Conducts a multidimensional health check score evaluating collection rates, 
 * default write-off tolerances, portfolio values, and absolute profitability.
 * Returns a score between 0 and 100.
 */
export function calculateBusinessHealth(
  sales: Sale[],
  payments: Payment[],
  agreements: Agreement[],
  cashMovements: CashMovement[],
  writeOffs: WriteOff[]
) {
  const activeAgreements = agreements.filter(a => a.status !== 'paid');
  const totalActiveBalance = activeAgreements.reduce((sum, a) => sum + (a.balance || 0), 0);
  const overdueAgreements = agreements.filter(a => a.status === 'overdue');
  const totalOverdueBalance = overdueAgreements.reduce((sum, a) => sum + (a.balance || 0), 0);

  const overdueRatio = totalActiveBalance > 0 ? totalOverdueBalance / totalActiveBalance : 0;
  
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalIssued = agreements.reduce((sum, a) => sum + (a.totalAmount || 0), 0);
  const repaymentRate = totalIssued > 0 ? totalPaid / totalIssued : 0;

  // Weightings:
  // 1. Overdue default control (40% weight) - score drops as overdue portion grows
  const overdueScore = Math.max(0, 100 - (overdueRatio * 150)) * 0.4;
  
  // 2. Repayment recovery rate (40% weight) - target 80%+ collection rate
  const repaymentScore = Math.min(100, repaymentRate * 125) * 0.4;
  
  // 3. Operational profitability (20% weight)
  const profit = calculateRealTimeProfit(sales, cashMovements, writeOffs);
  const profitScore = profit > 0 ? 20 : (profit === 0 ? 10 : 0);

  const score = Math.round(overdueScore + repaymentScore + profitScore);

  let status: 'Excellent' | 'Good' | 'Caution' | 'Critical' = 'Good';
  if (score >= 85) status = 'Excellent';
  else if (score >= 65) status = 'Good';
  else if (score >= 40) status = 'Caution';
  else status = 'Critical';

  return {
    score,
    status,
    overdueRatio,
    repaymentRate,
    profit
  };
}
