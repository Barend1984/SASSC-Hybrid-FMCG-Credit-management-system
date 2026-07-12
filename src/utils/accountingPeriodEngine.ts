import { Sale, Agreement, Payment, CashMovement, CashDay, Product, WriteOff, AccountingPeriod, AccountingAuditLog } from '../types';
import { 
  calculateCashOnHand, 
  calculateBankBalance, 
  calculateInventoryCost, 
  calculateOutstandingPrincipal,
  calculateOutstandingInterest,
  calculateExpenseLedger,
  calculateCustomerPayments
} from './financialEngine';

/**
 * ACCOUNTING PERIOD ENGINE FOR SASSC CREDIT MANAGEMENT SYSTEM
 * 
 * This engine governs financial periods, monthly closures, and strict audit ledgering.
 * It coordinates with the primary Financial Engine to compute and permanently frozen
 * historical snapshots of business health, assets, and Profit & Loss metrics.
 * 
 * CORE PRINCIPLES & LAWS OF BUSINESS IN SASSC:
 * 1. Read-Only Closed Periods: Once closed, historical values are frozen and immune to dynamic ledger changes.
 * 2. Opening Balance Rollovers: Only Cash, Stock at Cost, and Outstanding Principal roll over.
 * 3. Profit Rules: Principal is never profit. Interest/service fees are profit on accrual. Retail profit is gross margin.
 * 4. Capital Under Management Formula: Cash + Stock at Cost + Outstanding Principal + Active Operational Expense Ledger.
 * 5. Input Safety: Inputs are sanitized, validated against overlaps, and strictly tracked via audit logs.
 */

/**
 * Helper to check if two date ranges overlap.
 */
function datesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return (startA <= endB) && (endA >= startB);
}

/**
 * Validates whether a proposed accounting period date range overlaps with any existing periods.
 * 
 * @param periods Existing accounting periods.
 * @param startDate Proposed start date (YYYY-MM-DD).
 * @param endDate Proposed end date (YYYY-MM-DD).
 * @param ignorePeriodId Optional ID of a period to ignore (e.g., during self-update validation).
 */
export function validatePeriod(
  periods: AccountingPeriod[],
  startDate: string,
  endDate: string,
  ignorePeriodId?: string
): { valid: boolean; message?: string } {
  if (startDate > endDate) {
    return { valid: false, message: 'Start date cannot be after end date.' };
  }

  for (const p of periods) {
    if (ignorePeriodId && p.id === ignorePeriodId) continue;
    if (datesOverlap(p.startDate, p.endDate, startDate, endDate)) {
      return { 
        valid: false, 
        message: `The proposed dates (${startDate} to ${endDate}) overlap with the existing period "${p.name}" (${p.startDate} to ${p.endDate}).` 
      };
    }
  }

  return { valid: true };
}

/**
 * Finds the currently active open accounting period if one exists.
 * 
 * @param periods Existing accounting periods.
 */
export function getCurrentAccountingPeriod(periods: AccountingPeriod[]): AccountingPeriod | null {
  const openPeriods = periods.filter(p => p.status === 'OPEN');
  if (openPeriods.length > 0) {
    // Return the latest open period
    return openPeriods.sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  }
  return null;
}

/**
 * Finds the previous accounting period immediately preceding the current one.
 * 
 * @param periods Existing accounting periods.
 * @param currentPeriod The reference current period.
 */
export function getPreviousAccountingPeriod(
  periods: AccountingPeriod[],
  currentPeriod: AccountingPeriod
): AccountingPeriod | null {
  const preceding = periods.filter(p => p.endDate < currentPeriod.startDate);
  if (preceding.length === 0) return null;
  // Sort descending by endDate to get the immediately preceding period
  return preceding.sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
}

/**
 * Pure function to calculate P&L (Profit and Loss) metrics for a specific date range.
 * 
 * @param sales All retail and credit sales.
 * @param stock All active inventory/product lists for COGS lookups.
 * @param agreements All credit agreements for service fee/interest earned computations.
 * @param payments Repayments processed (not counted directly as profit, but used for audits).
 * @param cashMovements Expense ledgers and manual cash flows.
 * @param writeOffs Written off items to register as stock losses.
 * @param startDate Start date boundary.
 * @param endDate End date boundary.
 */
export function calculatePeriodProfit(
  sales: Sale[],
  stock: Product[],
  agreements: Agreement[],
  payments: Payment[],
  cashMovements: CashMovement[],
  writeOffs: WriteOff[],
  startDate: string,
  endDate: string
) {
  // Isolate records within the period boundaries
  const periodSales = sales.filter(s => s.date >= startDate && s.date <= endDate);
  const periodAgreements = agreements.filter(a => a.date >= startDate && a.date <= endDate);
  const periodMovements = cashMovements.filter(m => {
    const d = m.date.split(' ')[0]; // Handle timestamp format "YYYY-MM-DD HH:mm"
    return d >= startDate && d <= endDate;
  });
  const periodWriteOffs = writeOffs.filter(w => {
    const d = w.date.split(' ')[0];
    return d >= startDate && d <= endDate;
  });

  // 1. Retail Profit (Gross Margin on Retail and Credit Goods)
  // Gross Margin = Sales Price - Cost of Goods Sold
  let retailProfit = 0;
  for (const sale of periodSales) {
    for (const item of sale.items) {
      const prod = stock.find(p => p.id === item.stockId);
      const buyPrice = prod ? (prod.buyPrice || 0) : 0;
      const margin = item.price - buyPrice;
      retailProfit += margin * (item.qty || 0);
    }
  }

  // 2. Interest Earned (accrual base: service fees created)
  const interestEarned = periodAgreements.reduce((sum, a) => sum + (a.serviceFee || 0), 0);

  // 3. Fees Earned (accrual base: initiation fees created)
  const feesEarned = periodAgreements.reduce((sum, a) => sum + (a.initiationFee || 0), 0);

  // 4. Other Income (manual cash inflows)
  const otherIncome = periodMovements
    .filter(m => m.type === 'cash_in')
    .reduce((sum, m) => sum + (m.amount || 0), 0);

  // 5. Operational Expenses
  const operationalExpenses = periodMovements
    .filter(m => ['expense', 'cash_out', 'stock_purchase'].includes(m.type))
    .reduce((sum, m) => sum + (m.amount || 0), 0);

  // 6. Loss from written off stock
  const stockLossVal = periodWriteOffs.reduce((sum, w) => sum + (w.lossValue || 0), 0);

  const grossProfit = interestEarned + feesEarned + retailProfit + otherIncome;
  // Stock write-off losses directly reduce net profit margins
  const netProfit = grossProfit - operationalExpenses - stockLossVal;

  return {
    interestEarned: Math.round(interestEarned * 100) / 100,
    feesEarned: Math.round(feesEarned * 100) / 100,
    retailProfit: Math.round(retailProfit * 100) / 100,
    otherIncome: Math.round(otherIncome * 100) / 100,
    operationalExpenses: Math.round(operationalExpenses * 100) / 100,
    stockLossVal: Math.round(stockLossVal * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100
  };
}

/**
 * Pure function to calculate capital reconciliation and structural assets.
 */
export function calculatePeriodCapital(
  sales: Sale[],
  payments: Payment[],
  cashMovements: CashMovement[],
  cashDays: CashDay[],
  agreements: Agreement[],
  stock: Product[],
  writeOffs: WriteOff[],
  startDate: string,
  endDate: string
) {
  // Isolate records within the period boundaries
  const rangeSales = sales.filter(s => s.date >= startDate && s.date <= endDate);
  const rangePayments = payments.filter(p => p.date >= startDate && p.date <= endDate);
  const rangeMovements = cashMovements.filter(m => {
    const d = m.date.split(' ')[0];
    return d >= startDate && d <= endDate;
  });
  const rangeCashDays = cashDays.filter(d => d.date >= startDate && d.date <= endDate);
  const rangeAgreements = agreements.filter(a => a.date >= startDate && a.date <= endDate);
  const rangeWriteOffs = writeOffs.filter(w => {
    const d = w.date.split(' ')[0];
    return d >= startDate && d <= endDate;
  });

  // Calculate Sub-components using the financial engine logic
  const cashOnHand = calculateCashOnHand(rangeSales, rangePayments, rangeMovements, rangeCashDays);
  const cashInBank = calculateBankBalance(rangeSales, rangePayments, rangeMovements);
  const totalCash = cashOnHand + cashInBank;
  
  const stockCost = calculateInventoryCost(stock); // Always current stock count
  const outstandingPrincipal = calculateOutstandingPrincipal(rangeAgreements);
  const activeExpenseLedger = calculateExpenseLedger(rangeMovements);

  // CAPITAL UNDER MANAGEMENT RULE:
  // Capital = Cash + Inventory at Cost + Outstanding Principal + Operational Expense Ledger
  // Never include: Interest, Profit, Fees, VAT, Markup.
  const capitalUnderManagement = totalCash + stockCost + outstandingPrincipal + activeExpenseLedger;

  return {
    cash: Math.round(totalCash * 100) / 100,
    stockCost: Math.round(stockCost * 100) / 100,
    outstandingPrincipal: Math.round(outstandingPrincipal * 100) / 100,
    operationalExpenses: Math.round(activeExpenseLedger * 100) / 100,
    capitalUnderManagement: Math.round(capitalUnderManagement * 100) / 100
  };
}

/**
 * Creates and initializes a new OPEN accounting period.
 * Automatically handles carry-forward opening balances from previous period.
 * 
 * @param periods Existing accounting periods.
 * @param name Period designation (e.g. "June 2026").
 * @param startDate Start boundary date.
 * @param endDate End boundary date.
 * @param user The system user authorizing the open command.
 * @param notes Optional description or notes.
 */
export function openAccountingPeriod(
  periods: AccountingPeriod[],
  name: string,
  startDate: string,
  endDate: string,
  user: string,
  notes?: string
): { period: AccountingPeriod; auditLog: AccountingAuditLog } {
  // 1. Validation for overlaps
  const check = validatePeriod(periods, startDate, endDate);
  if (!check.valid) {
    throw new Error(check.message || 'Accounting period overlaps with an existing period.');
  }

  // 2. Locate previous period to roll forward opening balances
  const tempCurrent: AccountingPeriod = {
    id: 'temp',
    name,
    startDate,
    endDate,
    status: 'OPEN',
    capitalOpeningBalance: 0,
    capitalClosingBalance: 0,
    cashOpening: 0,
    cashClosing: 0,
    stockOpening: 0,
    stockClosing: 0,
    outstandingPrincipalOpening: 0,
    outstandingPrincipalClosing: 0,
    interestEarned: 0,
    feesEarned: 0,
    retailProfit: 0,
    otherIncome: 0,
    operationalExpenses: 0,
    grossProfit: 0,
    netProfit: 0,
    createdDate: new Date().toISOString(),
    modifiedDate: new Date().toISOString()
  };

  const prevPeriod = getPreviousAccountingPeriod(periods, tempCurrent);

  let cashOpening = 0;
  let stockOpening = 0;
  let outstandingPrincipalOpening = 0;

  if (prevPeriod) {
    // Carry forward ONLY: Cash, Stock at Cost, Outstanding Loan Principal
    cashOpening = prevPeriod.cashClosing;
    stockOpening = prevPeriod.stockClosing;
    outstandingPrincipalOpening = prevPeriod.outstandingPrincipalClosing;
  }

  // Capital Opening = Cash + Stock + Outstanding Principal
  const capitalOpeningBalance = cashOpening + stockOpening + outstandingPrincipalOpening;

  const now = new Date();
  const periodId = 'ap_' + Math.random().toString(36).substring(2, 11);

  const period: AccountingPeriod = {
    id: periodId,
    name,
    startDate,
    endDate,
    status: 'OPEN',
    capitalOpeningBalance,
    capitalClosingBalance: 0,
    cashOpening,
    cashClosing: 0,
    stockOpening,
    stockClosing: 0,
    outstandingPrincipalOpening,
    outstandingPrincipalClosing: 0,
    interestEarned: 0,
    feesEarned: 0,
    retailProfit: 0,
    otherIncome: 0,
    operationalExpenses: 0,
    grossProfit: 0,
    netProfit: 0,
    auditNotes: notes,
    createdDate: now.toISOString(),
    modifiedDate: now.toISOString()
  };

  const auditLog: AccountingAuditLog = {
    id: 'log_' + Math.random().toString(36).substring(2, 11),
    periodId,
    periodName: name,
    user,
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().split(' ')[0],
    action: 'OPEN',
    reason: notes || 'Initializing new accounting period.',
    timestamp: now.toISOString()
  };

  return { period, auditLog };
}

/**
 * Freezes and closes an active accounting period.
 * Calculates final P&L, records historical states, and tags the status as CLOSED.
 */
export function closeAccountingPeriod(
  periods: AccountingPeriod[],
  periodId: string,
  user: string,
  sales: Sale[],
  payments: Payment[],
  cashMovements: CashMovement[],
  cashDays: CashDay[],
  agreements: Agreement[],
  stock: Product[],
  writeOffs: WriteOff[],
  notes?: string
): { period: AccountingPeriod; auditLog: AccountingAuditLog } {
  const periodIndex = periods.findIndex(p => p.id === periodId);
  if (periodIndex === -1) {
    throw new Error('Accounting period not found.');
  }

  const period = { ...periods[periodIndex] };

  // Validation Rules
  if (period.status === 'CLOSED') {
    throw new Error('Cannot close an already closed period.');
  }

  // 1. Run Profit and Capital calculators for the exact date range
  const profitStats = calculatePeriodProfit(
    sales,
    stock,
    agreements,
    payments,
    cashMovements,
    writeOffs,
    period.startDate,
    period.endDate
  );

  const capitalStats = calculatePeriodCapital(
    sales,
    payments,
    cashMovements,
    cashDays,
    agreements,
    stock,
    writeOffs,
    period.startDate,
    period.endDate
  );

  // 2. Populating historical snapshots permanently inside the period record
  period.status = 'CLOSED';
  period.closingDate = new Date().toISOString().split('T')[0];
  period.closedBy = user;
  
  period.cashClosing = capitalStats.cash;
  period.stockClosing = capitalStats.stockCost;
  period.outstandingPrincipalClosing = capitalStats.outstandingPrincipal;
  period.capitalClosingBalance = capitalStats.capitalUnderManagement;

  period.interestEarned = profitStats.interestEarned;
  period.feesEarned = profitStats.feesEarned;
  period.retailProfit = profitStats.retailProfit;
  period.otherIncome = profitStats.otherIncome;
  period.operationalExpenses = profitStats.operationalExpenses;
  period.grossProfit = profitStats.grossProfit;
  period.netProfit = profitStats.netProfit;

  if (notes) {
    period.auditNotes = (period.auditNotes ? period.auditNotes + '\n' : '') + notes;
  }

  period.modifiedDate = new Date().toISOString();

  const now = new Date();
  const auditLog: AccountingAuditLog = {
    id: 'log_' + Math.random().toString(36).substring(2, 11),
    periodId,
    periodName: period.name,
    user,
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().split(' ')[0],
    action: 'CLOSE',
    reason: notes || 'Books successfully closed and audited.',
    timestamp: now.toISOString()
  };

  return { period, auditLog };
}

/**
 * Reopens an already closed accounting period for correction.
 * Changes state back to OPEN.
 */
export function reopenAccountingPeriod(
  periods: AccountingPeriod[],
  periodId: string,
  user: string,
  reason: string
): { period: AccountingPeriod; auditLog: AccountingAuditLog } {
  const periodIndex = periods.findIndex(p => p.id === periodId);
  if (periodIndex === -1) {
    throw new Error('Accounting period not found.');
  }

  const period = { ...periods[periodIndex] };

  if (period.status === 'OPEN') {
    throw new Error('Accounting period is already open.');
  }

  if (!reason || reason.trim().length === 0) {
    throw new Error('A detailed audit explanation is required to reopen closed books.');
  }

  period.status = 'OPEN';
  period.auditNotes = (period.auditNotes ? period.auditNotes + '\n' : '') + `Reopened by ${user}. Reason: ${reason}`;
  period.modifiedDate = new Date().toISOString();

  const now = new Date();
  const auditLog: AccountingAuditLog = {
    id: 'log_' + Math.random().toString(36).substring(2, 11),
    periodId,
    periodName: period.name,
    user,
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().split(' ')[0],
    action: 'REOPEN',
    reason,
    timestamp: now.toISOString()
  };

  return { period, auditLog };
}

/**
 * Archives an accounting period structure (returns the validated closed representation).
 */
export function archiveAccountingPeriod(period: AccountingPeriod): AccountingPeriod {
  if (period.status !== 'CLOSED') {
    throw new Error('Only closed periods can be archived.');
  }
  return {
    ...period,
    modifiedDate: new Date().toISOString()
  };
}

/**
 * Returns a clean set of CashMovement entries with active operational expenses 
 * within the period tagged/archived or reset.
 * 
 * @param cashMovements Global cash movements list.
 * @param period Closed accounting period.
 */
export function resetOperationalExpensesAfterClose(
  cashMovements: CashMovement[],
  period: AccountingPeriod
): CashMovement[] {
  return cashMovements.map(m => {
    const d = m.date.split(' ')[0];
    if (d >= period.startDate && d <= period.endDate && ['expense', 'cash_out', 'stock_purchase'].includes(m.type)) {
      // Mark as archived and link to the period record
      return {
        ...m,
        archived: true,
        accountingPeriodId: period.id
      } as any;
    }
    return m;
  });
}
