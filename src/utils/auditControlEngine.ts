import { Sale, Agreement, Payment, CashMovement, CashDay, Product, WriteOff, AccountingPeriod, AccountingAuditLog } from '../types';
import { 
  calculateCashOnHand, 
  calculateBankBalance, 
  calculateInventoryCost, 
  calculateOutstandingPrincipal,
  calculateExpenseLedger 
} from './financialEngine';
import { closeAccountingPeriod } from './accountingPeriodEngine';

/**
 * AUDIT & FINANCIAL CONTROL LAYER
 * 
 * This module enforces strict capital balance checks, reconciliation exceptions,
 * and fraud risk indicators. It serves as a verification layer that wraps
 * the Financial Engine and Accounting Period Engine to ensure absolute bookkeeping integrity.
 */

export interface BarcodeMapping {
  id: string;
  productId: string;
  barcode: string;
  sku: string;
  description?: string;
}

export interface StockAdjustmentEntry {
  id: string;
  productId: string;
  sku: string;
  date: string;
  type: 'damage' | 'theft' | 'audit_correction' | 'initial_load' | 'manual_add';
  quantityAdjusted: number; // positive or negative
  reason: string;
  user: string;
  costValueAdjusted: number; // buyPrice * quantityAdjusted
  timestamp: string;
}

export interface AuditTrailEvent {
  id: string;
  user: string;
  timestamp: string;
  systemValue: number;
  expectedValue: number;
  difference: number;
  reasonForClosure: string;
  flagSeverity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface AuditException {
  missingCash: number;
  stockVariance: number;
  loanVariance: number;
  expenseVariance: number;
  unknownDifference: number;
}

export interface AuditReconciliationResult {
  isMatched: boolean;
  expectedCapital: number;
  actualSystemValue: number;
  difference: number;
  exceptions: AuditException;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

/**
 * Calculates the complete system value at any given point in time.
 * TOTAL SYSTEM VALUE = Cash on Hand + Stock at Cost + Outstanding Loan Principal + Operational Expense Ledger + Default Book Principal (if applicable)
 */
export function calculateSystemTotalValue(
  sales: Sale[],
  payments: Payment[],
  cashMovements: CashMovement[],
  cashDays: CashDay[],
  agreements: Agreement[],
  stock: Product[],
  adjustments: StockAdjustmentEntry[] = []
): {
  cashOnHand: number;
  cashInBank: number;
  totalCash: number;
  stockValue: number;
  loanPrincipalSplit: {
    STANDARD: number;
    RESTRUCTURED: number;
    DEFAULT: number;
  };
  defaultPrincipal: number;
  expenseLedger: number;
  totalValue: number;
} {
  // Use existing financial calculations as base
  const cashOnHand = Math.round(calculateCashOnHand(sales, payments, cashMovements, cashDays) * 100);
  const cashInBank = Math.round(calculateBankBalance(sales, payments, cashMovements) * 100);
  const totalCash = cashOnHand + cashInBank;

  // Apply optional inventory adjustments for Stock Cost Valuation
  const rawStockCost = calculateInventoryCost(stock);
  const adjustmentsCostValue = adjustments.reduce((sum, adj) => sum + Math.round((adj.costValueAdjusted || 0) * 100), 0);
  const stockValue = Math.round(rawStockCost * 100) + adjustmentsCostValue;

  // Categorize Loan Principal Splits
  let standardPrincipal = 0;
  let restructuredPrincipal = 0;
  let defaultPrincipal = 0;

  const activeAgreements = agreements.filter(a => a.status === 'active' || a.status === 'overdue');
  for (const a of activeAgreements) {
    const type = a.agreementType || 'STANDARD';
    const principal = (a.goods || 0) + (a.loan || 0);
    const total = a.totalAmount || 1;
    const ratio = principal / total;
    const outstanding = (a.balance || 0) * ratio;
    const outstandingCents = Math.round(outstanding * 100);

    if (type === 'DEFAULT') {
      defaultPrincipal += outstandingCents;
    } else if (type === 'RESTRUCTURED') {
      restructuredPrincipal += outstandingCents;
    } else {
      standardPrincipal += outstandingCents;
    }
  }

  const expenseLedger = Math.round(calculateExpenseLedger(cashMovements) * 100);

  // TOTAL SYSTEM VALUE = Cash + Stock + Outstanding Principal + Operational Expense Ledger + Default Principal
  const totalValueCents = totalCash + stockValue + standardPrincipal + restructuredPrincipal + defaultPrincipal + expenseLedger;

  return {
    cashOnHand: cashOnHand / 100,
    cashInBank: cashInBank / 100,
    totalCash: totalCash / 100,
    stockValue: stockValue / 100,
    loanPrincipalSplit: {
      STANDARD: standardPrincipal / 100,
      RESTRUCTURED: restructuredPrincipal / 100,
      DEFAULT: defaultPrincipal / 100
    },
    defaultPrincipal: defaultPrincipal / 100,
    expenseLedger: expenseLedger / 100,
    totalValue: totalValueCents / 100
  };
}

/**
 * Audits and compares standard Financial Engine Capital under Management against the manually reconstructed system value.
 * If differences are identified, specific exceptions are calculated to pinpoint leakage.
 */
export function runAuditReconciliation(
  sales: Sale[],
  payments: Payment[],
  cashMovements: CashMovement[],
  cashDays: CashDay[],
  agreements: Agreement[],
  stock: Product[],
  writeOffs: WriteOff[],
  actualCounts?: {
    actualCashOnHand?: number;
    actualCashInBank?: number;
    actualStockValue?: number;
    actualLoanPrincipal?: number;
    actualExpenseLedger?: number;
  },
  adjustments: StockAdjustmentEntry[] = []
): AuditReconciliationResult {
  const expectedCashOnHand = calculateCashOnHand(sales, payments, cashMovements, cashDays);
  const expectedCashInBank = calculateBankBalance(sales, payments, cashMovements);
  const totalCashExpected = expectedCashOnHand + expectedCashInBank;

  const rawStockExpected = calculateInventoryCost(stock);
  const adjustmentsCostValue = adjustments.reduce((sum, adj) => sum + (adj.costValueAdjusted || 0), 0);
  const stockCostExpected = rawStockExpected + adjustmentsCostValue;

  const outstandingPrincipalExpected = calculateOutstandingPrincipal(agreements);
  const expenseLedgerExpected = calculateExpenseLedger(cashMovements);

  // Financial Engine Formula: Capital Under Management = Cash + Inventory at Cost + Outstanding Principal + Operational Expense Ledger
  const expectedCapital = totalCashExpected + stockCostExpected + outstandingPrincipalExpected + expenseLedgerExpected;

  // Reconstructed Physical / Actual counts
  const actualCashOnHand = actualCounts?.actualCashOnHand !== undefined ? actualCounts.actualCashOnHand : expectedCashOnHand;
  const actualCashInBank = actualCounts?.actualCashInBank !== undefined ? actualCounts.actualCashInBank : expectedCashInBank;
  const actualStockValue = actualCounts?.actualStockValue !== undefined ? actualCounts.actualStockValue : stockCostExpected;
  const actualLoanPrincipal = actualCounts?.actualLoanPrincipal !== undefined ? actualCounts.actualLoanPrincipal : outstandingPrincipalExpected;
  const actualExpenseLedger = actualCounts?.actualExpenseLedger !== undefined ? actualCounts.actualExpenseLedger : expenseLedgerExpected;

  const actualSystemValue = (actualCashOnHand + actualCashInBank) + actualStockValue + actualLoanPrincipal + actualExpenseLedger;

  const expectedCapitalCents = Math.round(expectedCapital * 100);
  const actualSystemValueCents = Math.round(actualSystemValue * 100);
  const differenceCents = actualSystemValueCents - expectedCapitalCents;
  const difference = differenceCents / 100;

  // Calculate Variance Exceptions
  const missingCash = Math.round((expectedCashOnHand + expectedCashInBank - (actualCashOnHand + actualCashInBank)) * 100) / 100;
  const stockVariance = Math.round((stockCostExpected - actualStockValue) * 100) / 100;
  const loanVariance = Math.round((outstandingPrincipalExpected - actualLoanPrincipal) * 100) / 100;
  const expenseVariance = Math.round((expenseLedgerExpected - actualExpenseLedger) * 100) / 100;

  const totalCategorizedCents = Math.round((missingCash + stockVariance + loanVariance + expenseVariance) * 100);
  const unknownDifferenceCents = Math.abs(differenceCents) - Math.abs(totalCategorizedCents);
  const unknownDifference = Math.max(0, unknownDifferenceCents / 100);

  const isMatched = Math.abs(differenceCents) === 0;

  let severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO';
  if (!isMatched) {
    const absoluteDiff = Math.abs(difference);
    if (absoluteDiff > 500) { // High exception threshold (e.g. R500 threshold)
      severity = 'CRITICAL';
    } else {
      severity = 'WARNING';
    }
  }

  return {
    isMatched,
    expectedCapital: Math.round(expectedCapital * 100) / 100,
    actualSystemValue: Math.round(actualSystemValue * 100) / 100,
    difference: Math.round(difference * 100) / 100,
    exceptions: {
      missingCash: Math.round(missingCash * 100) / 100,
      stockVariance: Math.round(stockVariance * 100) / 100,
      loanVariance: Math.round(loanVariance * 100) / 100,
      expenseVariance: Math.round(expenseVariance * 100) / 100,
      unknownDifference: Math.round(unknownDifference * 100) / 100
    },
    severity
  };
}

/**
 * ENHANCED BOOK CLOSING SYSTEM (By Extension)
 * 
 * Runs the standard Close Books operation but runs audit checks, detects variances,
 * flags FRAUD RISKS, and forces a closure reason if discrepancies exist.
 */
export function enhancedCloseAccountingPeriod(
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
  actualCounts?: {
    actualCashOnHand?: number;
    actualCashInBank?: number;
    actualStockValue?: number;
    actualLoanPrincipal?: number;
    actualExpenseLedger?: number;
  },
  closureReason?: 'Cash shortage' | 'Stock loss' | 'System correction' | 'Unknown (fraud risk flag)' | 'None',
  notes?: string
): { 
  period: AccountingPeriod; 
  auditLog: AccountingAuditLog; 
  auditEvent: AuditTrailEvent; 
} {
  // 1. Run reconciliation prior to closure to calculate exact variances
  const recon = runAuditReconciliation(
    sales,
    payments,
    cashMovements,
    cashDays,
    agreements,
    stock,
    writeOffs,
    actualCounts
  );

  // 2. Prevent silent closing when variances exist without a valid explanation
  if (!recon.isMatched) {
    if (!closureReason || closureReason === 'None') {
      throw new Error(`A financial variance of ZAR ${recon.difference} is detected. You must select a valid closure reason ('Cash shortage', 'Stock loss', 'System correction', or 'Unknown (fraud risk flag)') to complete book closing.`);
    }
  }

  // 3. Call standard Accounting Period Engine close function as extension
  const baseResult = closeAccountingPeriod(
    periods,
    periodId,
    user,
    sales,
    payments,
    cashMovements,
    cashDays,
    agreements,
    stock,
    writeOffs,
    notes
  );

  const updatedPeriod = { ...baseResult.period };

  // 4. Enhance the period record with frozen audit control data
  updatedPeriod.systemTotalValueExpected = recon.expectedCapital;
  updatedPeriod.systemTotalValueActual = recon.actualSystemValue;
  updatedPeriod.systemTotalValueVariance = recon.difference;
  updatedPeriod.closureReason = closureReason || 'None';
  updatedPeriod.auditStatus = recon.isMatched ? 'PASSED' : 'EXCEPTION';

  // 5. Fraud Detection Rule: Mark status as AUDIT_EXCEPTION if mismatched
  if (!recon.isMatched) {
    updatedPeriod.status = 'AUDIT_EXCEPTION';
    updatedPeriod.auditExceptionDetails = JSON.stringify(recon.exceptions);
  }

  // 6. Record formal Audit Trail Event
  const now = new Date();
  const auditEvent: AuditTrailEvent = {
    id: 'evt_' + Math.random().toString(36).substring(2, 11),
    user,
    timestamp: now.toISOString(),
    systemValue: recon.actualSystemValue,
    expectedValue: recon.expectedCapital,
    difference: recon.difference,
    reasonForClosure: closureReason || 'None',
    flagSeverity: recon.severity
  };

  // Modify baseAuditLog to match the status outcome
  const updatedAuditLog = { ...baseResult.auditLog };
  if (!recon.isMatched) {
    updatedAuditLog.reason = `WARNING [Variance ZAR ${recon.difference}]: Book closed with Exception under category: ${closureReason}. Notes: ${notes || ''}`;
  }

  return {
    period: updatedPeriod,
    auditLog: updatedAuditLog,
    auditEvent
  };
}

/**
 * STOCK CONTROL HELPERS
 */

/**
 * Creates a unique Barcode Mapping to tie SKU variants/barcodes back to main catalog product ID.
 */
export function createBarcodeMapping(
  productId: string,
  sku: string,
  barcode: string,
  description?: string
): BarcodeMapping {
  return {
    id: 'bar_' + Math.random().toString(36).substring(2, 11),
    productId,
    barcode: barcode.trim(),
    sku,
    description
  };
}

/**
 * Maps scan barcodes back to main Product. Handles variations of barcodes.
 */
export function findProductByBarcode(
  barcode: string,
  stock: Product[],
  mappings: BarcodeMapping[]
): Product | null {
  const cleanBarcode = barcode.trim();
  // Check exact SKU match
  const directSkuMatch = stock.find(p => p.sku === cleanBarcode);
  if (directSkuMatch) return directSkuMatch;

  // Check barcode mappings
  const mapping = mappings.find(m => m.barcode === cleanBarcode);
  if (mapping) {
    return stock.find(p => p.id === mapping.productId) || null;
  }

  return null;
}

/**
 * Registers an Adjustment Entry to dynamically track stock variances, damaged units, or theft.
 */
export function createStockAdjustment(
  productId: string,
  sku: string,
  type: 'damage' | 'theft' | 'audit_correction' | 'initial_load' | 'manual_add',
  quantity: number,
  buyPrice: number,
  reason: string,
  user: string
): StockAdjustmentEntry {
  const now = new Date();
  const costValueAdjusted = Math.round((buyPrice * quantity) * 100) / 100;
  return {
    id: 'adj_' + Math.random().toString(36).substring(2, 11),
    productId,
    sku,
    date: now.toISOString().split('T')[0],
    type,
    quantityAdjusted: quantity,
    reason,
    user,
    costValueAdjusted,
    timestamp: now.toISOString()
  };
}

/**
 * Calculates stock cost taking adjustment ledger into account.
 */
export function calculateStockCostWithAdjustments(
  stock: Product[],
  adjustments: StockAdjustmentEntry[]
): number {
  const baseCost = calculateInventoryCost(stock);
  const adjustmentsSum = adjustments.reduce((sum, adj) => sum + (adj.costValueAdjusted || 0), 0);
  return Math.round((baseCost + adjustmentsSum) * 100) / 100;
}

/**
 * Simple helper to detect Stock variance.
 */
export function calculateStockVariance(expectedStockCost: number, actualStockCost: number): number {
  return Math.round((expectedStockCost - actualStockCost) * 100) / 100;
}
