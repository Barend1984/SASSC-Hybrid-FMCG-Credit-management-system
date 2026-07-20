import { Sale, Agreement, Payment, CashMovement, CashDay, Product, WriteOff } from '../types';

/**
 * FINANCIAL ENGINE FOR LERATO CREDIT MANAGEMENT SYSTEM
 * 
 * This module acts as the single source of truth for all financial calculations,
 * metric aggregates, cash ledger balances, portfolio indicators, and profit margins.
 * 
 * DESIGN CONSTRAINTS:
 * 1. Functions are 100% pure (no side effects, no React state, no database writes, no UI rendering).
 * 2. Precision: Operates strictly on Integer Cents (ZAR Cents, where R1.00 = 100 cents) to prevent IEEE 754 float drift.
 * 3. Adaptable architecture: Designed for modular scalability in preparation for Firebase migration.
 */

// --- Mandatory Integer Cents Helpers ---
export function toCents(rands: number): number {
  return Math.round((rands || 0) * 100);
}

export function fromCents(cents: number): number {
  return (cents || 0) / 100;
}

export function formatZAR(cents: number): string {
  return `R ${(cents / 100).toFixed(2)}`;
}

/**
 * Calculates the current expected cash physical balance inside the register drawer (Cash on Hand).
 * Starts with the openingCash of the single active cash day where status === 'open'.
 * Filters all transactional inputs strictly by cashDayId === activeDay.id OR timestamp >= activeDay.openedAt.
 */
export function calculateCashOnHand(
  sales: Sale[],
  payments: Payment[],
  cashMovements: CashMovement[],
  cashDays: CashDay[]
): number {
  const activeDay = cashDays.find(d => d.status === 'open');
  if (!activeDay) {
    // If no day is open, get the latest day's closing cash, or opening cash as fallback
    const sortedDays = [...cashDays].sort((a, b) => b.date.localeCompare(a.date));
    if (sortedDays.length > 0) {
      return sortedDays[0].closingCash ?? sortedDays[0].openingCash ?? 0;
    }
    return 0;
  }

  const openingCashCents = toCents(activeDay.openingCash);

  // Filter sales: cash payment method during this active cash day
  const daySales = sales.filter(s => 
    s.method?.toLowerCase() === 'cash' && 
    (s.created >= activeDay.openedAt || s.date === activeDay.date)
  );
  const totalCashSalesCents = daySales.reduce((sum, s) => sum + toCents(s.total), 0);

  // Filter payments: cash payment method during this active cash day
  const dayPayments = payments.filter(p => 
    p.method?.toLowerCase() === 'cash' && 
    (p.created >= activeDay.openedAt || p.date === activeDay.date)
  );
  const totalCashPaymentsCents = dayPayments.reduce((sum, p) => sum + toCents(p.amount), 0);

  // Filter manual cash movements during this active cash day
  const dayMovements = cashMovements.filter(m => 
    m.cashDayId === activeDay.id || m.createdAt >= activeDay.openedAt
  );

  const totalManualInCents = dayMovements
    .filter(m => m.type === 'cash_in')
    .reduce((sum, m) => sum + toCents(m.amount), 0);

  const totalManualOutCents = dayMovements
    .filter(m => ['cash_out', 'expense', 'stock_purchase'].includes(m.type))
    .reduce((sum, m) => sum + toCents(m.amount), 0);

  const totalBankDepositsCents = dayMovements
    .filter(m => m.type === 'bank_deposit' && m.status !== 'pending_approval' && m.status !== 'rejected')
    .reduce((sum, m) => sum + toCents(m.amount), 0);

  const cashOnHandCents = openingCashCents + totalCashSalesCents + totalCashPaymentsCents + totalManualInCents - totalManualOutCents - totalBankDepositsCents;

  return fromCents(cashOnHandCents);
}

/**
 * Zero-Drawer Interlock: Checks if a proposed debit amount would cause cashOnHand to drop below zero.
 */
export function checkZeroDrawerInterlock(
  proposedDebitAmount: number,
  sales: Sale[],
  payments: Payment[],
  cashMovements: CashMovement[],
  cashDays: CashDay[]
): { allowed: boolean; currentCashCents: number; proposedDebitCents: number; message?: string } {
  const currentCash = calculateCashOnHand(sales, payments, cashMovements, cashDays);
  const currentCashCents = toCents(currentCash);
  const proposedDebitCents = toCents(proposedDebitAmount);

  if (currentCashCents - proposedDebitCents < 0) {
    return {
      allowed: false,
      currentCashCents,
      proposedDebitCents,
      message: `Zero-Drawer Interlock: Proposed withdrawal of ${formatZAR(proposedDebitCents)} exceeds available Cash on Hand of ${formatZAR(currentCashCents)}.`
    };
  }

  return { allowed: true, currentCashCents, proposedDebitCents };
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
  const bankSalesCents = sales
    .filter(s => ['eft', 'bank', 'card'].includes(s.method?.toLowerCase() || ''))
    .reduce((sum, s) => sum + toCents(s.total), 0);

  const bankPaymentsCents = payments
    .filter(p => ['eft', 'bank', 'card', 'debicheck'].includes(p.method?.toLowerCase() || ''))
    .reduce((sum, p) => sum + toCents(p.amount), 0);

  const totalBankDepositsCents = cashMovements
    .filter(m => m.type === 'bank_deposit' && m.status !== 'pending_approval' && m.status !== 'rejected')
    .reduce((sum, m) => sum + toCents(m.amount), 0);

  return fromCents(totalBankDepositsCents + bankSalesCents + bankPaymentsCents);
}

/**
 * Calculates total valuation cost of products currently held in inventory (Stock Valuation).
 * Iterates through active catalog items and multiplies quantity by buy unit price strictly using cost price.
 */
export function calculateInventoryCost(stock: Product[]): number {
  const totalCostCents = stock.reduce((sum, p) => {
    const qty = p.qty || 0;
    const buyPriceCents = toCents(p.buyPrice);
    return sum + (qty * buyPriceCents);
  }, 0);
  return fromCents(totalCostCents);
}

/**
 * Calculates the outstanding capital principal portion of active/overdue agreements.
 * Extracts and sums ONLY the outstanding core goods and cash loan principal.
 */
export function calculateOutstandingPrincipal(agreements: Agreement[]): number {
  const activeAgreements = agreements.filter(a => a.status === 'active' || a.status === 'overdue');
  let totalOutstandingPrincipalCents = 0;

  for (const a of activeAgreements) {
    const principalCents = toCents((a.goods || 0) + (a.loan || 0));
    const totalAmountCents = toCents(a.totalAmount);
    const balanceCents = toCents(a.balance);

    if (totalAmountCents > 0) {
      const outstandingPrincipalCents = Math.round((principalCents * balanceCents) / totalAmountCents);
      totalOutstandingPrincipalCents += outstandingPrincipalCents;
    }
  }

  return fromCents(totalOutstandingPrincipalCents);
}

/**
 * Calculates the outstanding interest & regulatory fees portion of active/overdue agreements.
 * Sums all accrued interest, initiation fees, and monthly service fees separately for presentation to Profit Ledger.
 */
export function calculateOutstandingInterest(agreements: Agreement[]): number {
  const activeAgreements = agreements.filter(a => a.status === 'active' || a.status === 'overdue');
  let totalOutstandingInterestCents = 0;

  for (const a of activeAgreements) {
    const totalAmountCents = toCents(a.totalAmount);
    const principalCents = toCents((a.goods || 0) + (a.loan || 0));
    const balanceCents = toCents(a.balance);

    const interestAndFeesCents = totalAmountCents - principalCents;

    if (totalAmountCents > 0 && interestAndFeesCents > 0) {
      const outstandingInterestCents = Math.round((interestAndFeesCents * balanceCents) / totalAmountCents);
      totalOutstandingInterestCents += outstandingInterestCents;
    }
  }

  return fromCents(totalOutstandingInterestCents);
}

/**
 * Calculates total historical manual cash outflow (operational expenses, stock purchases, manual outflows).
 */
export function calculateExpenseLedger(cashMovements: CashMovement[]): number {
  const totalExpensesCents = cashMovements
    .filter(m => ['expense', 'cash_out', 'stock_purchase'].includes(m.type))
    .reduce((sum, m) => sum + toCents(m.amount), 0);
  return fromCents(totalExpensesCents);
}

/**
 * Sums up total repayment installments processed across all customers.
 */
export function calculateCustomerPayments(payments: Payment[]): number {
  const sumCents = payments.reduce((sum, p) => sum + toCents(p.amount), 0);
  return fromCents(sumCents);
}

/**
 * Sums up total credit sales issued through the point of sale.
 */
export function calculateCreditIssued(sales: Sale[]): number {
  const sumCents = sales
    .filter(s => s.method === 'credit')
    .reduce((sum, s) => sum + toCents(s.total), 0);
  return fromCents(sumCents);
}

/**
 * Calculates the complete company financial state using the explicit subtraction-based formula:
 * Company current financial state = Cash on hand (Float/petty + cash sales + positive adjustments)
 *                                  + Stock on hand (Cost Value)
 *                                  + Debtor accounts (Cost of accounts payable / Outstanding principal)
 *                                  + Bank account value (total of all deposits/digital sales)
 *                                  - Cash paid out sum total (expenses, payouts, stock purchases)
 *                                  - Stock write-off / negative adjustments.
 * All math uses integer cents internally.
 */
export function calculateCompanyFinancialState(
  sales: Sale[],
  payments: Payment[],
  cashMovements: CashMovement[],
  cashDays: CashDay[],
  agreements: Agreement[],
  stock: Product[],
  writeOffs: WriteOff[]
) {
  const activeDay = cashDays.find(d => d.status === 'open');
  const openingCashCents = activeDay ? toCents(activeDay.openingCash) : 0;

  // Float and petty cash
  const floatAndPettyCashCents = openingCashCents;

  // Cash sales total
  const cashSales = sales.filter(s => s.method?.toLowerCase() === 'cash');
  const totalCashSalesCents = cashSales.reduce((sum, s) => sum + toCents(s.total), 0);

  // Positive adjustments (cash_in)
  const positiveAdjustmentsCents = cashMovements
    .filter(m => m.type === 'cash_in')
    .reduce((sum, m) => sum + toCents(m.amount), 0);

  // 1. Remaining physical cash on hand (net remaining cash inside register drawer)
  const remainingCashOnHand = calculateCashOnHand(sales, payments, cashMovements, cashDays);
  const remainingCashOnHandCents = toCents(remainingCashOnHand);

  // 2. Remaining bank account value (digital cash balance)
  const bankAccountValue = calculateBankBalance(sales, payments, cashMovements);
  const bankAccountValueCents = toCents(bankAccountValue);

  // 3. Stock on hand (at Cost Value)
  const stockCents = stock.reduce((sum, p) => sum + (p.qty || 0) * toCents(p.buyPrice), 0);
  const stockCost = fromCents(stockCents);

  // 4. Debtor accounts (Outstanding Principal)
  const outstandingPrincipal = calculateOutstandingPrincipal(agreements);
  const outstandingPrincipalCents = toCents(outstandingPrincipal);

  // 5. Expense Ledger (Total cash paid out / unrecovered expenses)
  const cashPaidOut = calculateExpenseLedger(cashMovements);
  const cashPaidOutCents = toCents(cashPaidOut);

  // Total assets currently in the system (balancing state of all liquid & physical assets)
  const totalSystemAssetsCents = 
    remainingCashOnHandCents + 
    bankAccountValueCents + 
    stockCents + 
    outstandingPrincipalCents + 
    cashPaidOutCents;

  // Real-time net operating profit
  const netProfit = calculateRealTimeProfit(sales, cashMovements, writeOffs, agreements, stock);
  const netProfitCents = toCents(netProfit);

  // CAPITAL UNDER MANAGEMENT LAW (Capital Preservation Constraint)
  // Capital = Total System Assets - Cumulative Net Operating Profit
  // This remains perfectly constant across arbitrary book-closing periods unless capital injection/withdrawal occurs.
  const capitalPreservedCents = totalSystemAssetsCents - netProfitCents;

  // Stock write off loss
  const stockWriteOffCents = writeOffs.reduce((sum, w) => sum + toCents(w.lossValue), 0);

  return {
    floatAndPettyCash: fromCents(floatAndPettyCashCents),
    floatAndPettyCashCents,
    totalCashSales: fromCents(totalCashSalesCents),
    totalCashSalesCents,
    positiveAdjustments: fromCents(positiveAdjustmentsCents),
    positiveAdjustmentsCents,
    grossCashOnHand: remainingCashOnHand, // Backwards compatible alias mapping to actual remaining net cash on hand
    grossCashOnHandCents: remainingCashOnHandCents,
    stockCost,
    stockCostCents: stockCents,
    outstandingPrincipal,
    outstandingPrincipalCents,
    bankAccountValue,
    bankAccountValueCents,
    cashPaidOut,
    cashPaidOutCents,
    stockWriteOff: fromCents(stockWriteOffCents),
    stockWriteOffCents,
    companyCurrentFinancialState: fromCents(capitalPreservedCents), // Maps to preserved capital under management
    companyCurrentFinancialStateCents: capitalPreservedCents
  };
}

/**
 * Prepares the complete unified capital reconciliation summary used for formal audits,
 * integrating liquid drawer assets, bank accounts, outstanding consumer credit debt, and stock valuations.
 * It is fully reconciled using the master financial formula.
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
  const state = calculateCompanyFinancialState(sales, payments, cashMovements, cashDays, agreements, stock, writeOffs);
  
  return {
    cashOnHand: state.grossCashOnHand,
    cashOnHandCents: state.grossCashOnHandCents,
    stockCost: state.stockCost,
    stockCostCents: state.stockCostCents,
    outstandingPrincipal: state.outstandingPrincipal,
    outstandingPrincipalCents: state.outstandingPrincipalCents,
    cashInBank: state.bankAccountValue,
    cashInBankCents: state.bankAccountValueCents,
    expenseLedger: state.cashPaidOut,
    expenseLedgerCents: state.cashPaidOutCents,
    totalWriteOffLoss: state.stockWriteOff,
    totalWriteOffLossCents: state.stockWriteOffCents,
    capitalUnderManagement: state.companyCurrentFinancialState,
    capitalUnderManagementCents: state.companyCurrentFinancialStateCents,
    // backwards compatibility aliases
    accountsCredit: state.outstandingPrincipal,
    cashOut: state.cashPaidOut,
    totalFinancialState: state.companyCurrentFinancialState
  };
}

/**
 * Calculates real-time business net profit/loss using Profit Ledger formula.
 */
export function calculateRealTimeProfit(
  sales: Sale[],
  cashMovements: CashMovement[],
  writeOffs: WriteOff[],
  agreements: Agreement[] = [],
  stock: Product[] = []
): number {
  const salesCents = sales.reduce((sum, s) => sum + toCents(s.total), 0);

  // 1. Markup = Sales Price - Cost of Goods Sold (COGS)
  let markupCents = 0;
  if (stock.length > 0) {
    for (const sale of sales) {
      for (const item of sale.items) {
        const prod = stock.find(p => p.id === item.stockId);
        const buyPriceCents = prod ? toCents(prod.buyPrice) : 0;
        const priceCents = toCents(item.price);
        const itemMarginCents = priceCents - buyPriceCents;
        markupCents += itemMarginCents * (item.qty || 0);
      }
    }
  } else {
    // If stock is empty/not provided, fallback safely
    markupCents = salesCents;
  }

  // 2. Interest Earned (accrual base: service fees created)
  const interestEarnedCents = agreements.reduce((sum, a) => sum + toCents(a.serviceFee), 0);

  // 3. Fees Earned (accrual base: initiation fees created)
  const feesEarnedCents = agreements.reduce((sum, a) => sum + toCents(a.initiationFee), 0);

  // 4. Operational Expenses
  const operationalExpensesCents = cashMovements
    .filter(m => ['expense', 'cash_out', 'stock_purchase'].includes(m.type))
    .reduce((sum, m) => sum + toCents(m.amount), 0);

  // 5. Stock loss from write-offs
  const stockLossValCents = writeOffs.reduce((sum, w) => sum + toCents(w.lossValue), 0);

  // Profit Ledger Law formula: profit = markup + interest + fees - expenses - write-offs
  const profitCents = markupCents + interestEarnedCents + feesEarnedCents - operationalExpensesCents - stockLossValCents;

  return fromCents(profitCents);
}

/**
 * Calculates aggregate statistics and structural metrics of the active loan book portfolio.
 */
export function calculateLoanPortfolio(agreements: Agreement[], payments: Payment[]) {
  const activeAgreements = agreements.filter(a => a.status !== 'paid');
  const overdueAgreements = agreements.filter(a => a.status === 'overdue');

  const totalBookValueCents = activeAgreements.reduce((sum, a) => sum + toCents(a.balance), 0);
  const overdueExposureCents = overdueAgreements.reduce((sum, a) => sum + toCents(a.balance), 0);
  
  const totalPaidCents = payments.reduce((sum, p) => sum + toCents(p.amount), 0);
  const totalIssuedCents = agreements.reduce((sum, a) => sum + toCents(a.totalAmount), 0);
  const repaymentRate = totalIssuedCents > 0 ? totalPaidCents / totalIssuedCents : 0;

  const averageAgreementValue = agreements.length > 0 
    ? fromCents(Math.round(totalIssuedCents / agreements.length))
    : 0;

  return {
    totalBookValue: fromCents(totalBookValueCents),
    totalBookValueCents,
    activeCount: activeAgreements.length,
    overdueCount: overdueAgreements.length,
    overdueExposure: fromCents(overdueExposureCents),
    overdueExposureCents,
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
  dateStr: string,
  agreements: Agreement[] = [],
  stock: Product[] = []
): number {
  const dailySales = sales.filter(s => s.date === dateStr);
  const dailyMovements = cashMovements.filter(m => m.date.startsWith(dateStr));
  const dailyWriteOffs = writeOffs.filter(w => w.date.startsWith(dateStr));
  const dailyAgreements = agreements.filter(a => a.date === dateStr);
  return calculateRealTimeProfit(dailySales, dailyMovements, dailyWriteOffs, dailyAgreements, stock);
}

/**
 * Calculates profit specifically generated inside a selected calendar month (format: YYYY-MM).
 */
export function calculateMonthlyProfit(
  sales: Sale[],
  cashMovements: CashMovement[],
  writeOffs: WriteOff[],
  yearMonthStr: string,
  agreements: Agreement[] = [],
  stock: Product[] = []
): number {
  const monthlySales = sales.filter(s => s.date.startsWith(yearMonthStr));
  const monthlyMovements = cashMovements.filter(m => m.date.startsWith(yearMonthStr));
  const monthlyWriteOffs = writeOffs.filter(w => w.date.startsWith(yearMonthStr));
  const monthlyAgreements = agreements.filter(a => a.date.startsWith(yearMonthStr));
  return calculateRealTimeProfit(monthlySales, monthlyMovements, monthlyWriteOffs, monthlyAgreements, stock);
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
  return fromCents(toCents(cashOnHand) + toCents(cashInBank));
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
  writeOffs: WriteOff[],
  stock: Product[] = []
) {
  const activeAgreements = agreements.filter(a => a.status !== 'paid');
  const totalActiveBalanceCents = activeAgreements.reduce((sum, a) => sum + toCents(a.balance), 0);
  const overdueAgreements = agreements.filter(a => a.status === 'overdue');
  const totalOverdueBalanceCents = overdueAgreements.reduce((sum, a) => sum + toCents(a.balance), 0);

  const overdueRatio = totalActiveBalanceCents > 0 ? totalOverdueBalanceCents / totalActiveBalanceCents : 0;
  
  const totalPaidCents = payments.reduce((sum, p) => sum + toCents(p.amount), 0);
  const totalIssuedCents = agreements.reduce((sum, a) => sum + toCents(a.totalAmount), 0);
  const repaymentRate = totalIssuedCents > 0 ? totalPaidCents / totalIssuedCents : 0;

  // Weightings:
  // 1. Overdue default control (40% weight) - score drops as overdue portion grows
  const overdueScore = Math.max(0, 100 - (overdueRatio * 150)) * 0.4;
  
  // 2. Repayment recovery rate (40% weight) - target 80%+ collection rate
  const repaymentScore = Math.min(100, repaymentRate * 125) * 0.4;
  
  // 3. Operational profitability (20% weight)
  const profit = calculateRealTimeProfit(sales, cashMovements, writeOffs, agreements, stock);
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
