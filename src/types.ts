export interface BankDetails {
  name: string;
  accountNumber: string;
  branchCode: string;
  holder: string;
}

export interface Customer {
  id: string;
  fileNo: string;
  name: string;
  surname: string;
  firstNames: string;
  phone: string;
  email: string;
  idNumber: string;
  address: string;
  employer: string;
  workPhone: string;
  workAddress: string;
  salaryDay: number | string;
  incomeSource: string;
  church: string;
  pastor: string;
  mandate: 'yes' | 'no';
  creditLimit: number;
  type: 'cash' | 'credit';
  bank: BankDetails;
  notes: string;
  photoUrl?: string;
  hasWhatsApp?: 'yes' | 'no';
  nokName?: string;
  nokPhone?: string;
  created: string;
  updated: string;
}

export interface WhatsAppLog {
  id: string;
  customerId: string;
  date: string; // e.g. "2026-06-30 14:22"
  message: string;
  senderName: string;
  direction: 'sent' | 'received';
}

export interface CartItem {
  stockId: string;
  name: string;
  price: number;
  qty: number;
  unit: string;
}

export interface Sale {
  id: string;
  date: string;
  customerId: string | null;
  customerName: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  method: 'cash' | 'card' | 'eft' | 'credit';
  discount: number;
  desc: string;
  created: string;
}

export interface AffordabilityAssessment {
  income: number;
  expensesTotal: number;
  disposable: number;
  afterAgreement: number;
  rent?: number;
  municipal?: number;
  food?: number;
  transport?: number;
  clothing?: number;
  telephone?: number;
  otherLoans?: number;
  insurance?: number;
  pocketMoney?: number;
}

export interface AgreementItem {
  name: string;
  qty: number;
  price: number;
}

export interface Agreement {
  id: string;
  agrNumber: string;
  customerId: string;
  customerSnapshot: Customer | null;
  date: string;
  dueDate: string;
  purpose: string;
  goods: number;
  loan: number;
  capital: number;
  initiationFee: number;
  serviceFee: number;
  insuranceType?: 'none' | 'base' | 'topup';
  insurancePremium?: number;
  vatAmount?: number;
  totalAmountWithVat?: number;
  totalAmount: number;
  balance: number;
  paid: number;
  items: AgreementItem[];
  status: 'active' | 'overdue' | 'paid';
  agreementType?: 'STANDARD' | 'DEFAULT' | 'RESTRUCTURED';
  saleId?: string;
  affordability?: AffordabilityAssessment;
  notes: string;
  electronicSignature?: string; // Base64 signature image or typed signature name
  electronicSignatureType?: 'drawn' | 'typed';
  electronicSignatureDate?: string;
  linkedBankStatementText?: string;
  linkedBankStatementName?: string;
  created: string;
  updated: string;
}

export interface Payment {
  id: string;
  customerId: string;
  agrId: string;
  agrNumber: string;
  date: string;
  amount: number;
  method: 'cash' | 'card' | 'eft' | 'debicheck';
  reference: string;
  note: string;
  created: string;
}

export interface CollectionNote {
  id: string;
  customerId: string;
  agrId: string;
  date: string;
  type: 'call' | 'promise' | 'visit' | 'arrangement' | 'other';
  note: string;
  promiseDate: string;
  promiseAmount: number;
  printable: boolean;
  createdBy: string;
  createdAt: string;
}

export interface CashDay {
  id: string;
  date: string;
  openingCash: number;
  status: 'open' | 'closed';
  openedBy: string;
  openedByName: string;
  openedAt: string;
  notes: string;
  expectedClosing?: number;
  closingCash?: number;
  difference?: number;
  closeNote?: string;
  closedBy?: string;
  closedByName?: string;
  closedAt?: string;
}

export interface CashMovement {
  id: string;
  cashDayId: string;
  date: string;
  type: 'cash_in' | 'cash_out' | 'expense' | 'stock_purchase' | 'bank_deposit';
  amount: number;
  reference: string;
  note: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  status?: 'pending_approval' | 'approved' | 'rejected';
  cashierApprovedBy?: string;
  cashierApprovedByName?: string;
  cashierSignature?: string;
  cashierSignatureType?: 'drawn' | 'typed';
  supervisorApprovedBy?: string;
  supervisorApprovedByName?: string;
  supervisorCodeUsed?: string;
  approvedAt?: string;
}

export interface RecipeIngredient {
  productId: string;
  name: string;
  quantityUsed: number;
  unitUsed: string;
  costCalculated: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  buyPrice: number;
  sellPrice: number;
  qty: number;
  lowAt: number;
  sku: string;
  unit: string;
  created: string;
  isPreparedFood?: boolean;
  ingredients?: RecipeIngredient[];
}

export interface BusinessSettings {
  bizName: string;
  tradingAs: string;
  owner: string;
  phone: string;
  address: string;
  ncr: string;
}

export interface User {
  id: string;
  fullName: string;
  username: string;
  passwordHash: string;
  role: 'main_admin' | 'manager' | 'cashier';
  permissions: Record<string, boolean>;
  isActive: boolean;
  created: string;
  lastLoginAt: string;
}

export interface Session {
  userId?: string;
  loginAt?: string;
}

export interface StockTakeItem {
  productId: string;
  name: string;
  sku: string;
  expectedQty: number;
  countedQty: number;
  variance: number; // countedQty - expectedQty
  buyPrice: number;
  varianceCostValue: number; // variance * buyPrice
}

export interface StockTake {
  id: string;
  date: string;
  capturedBy: string;
  capturedByName: string;
  items: StockTakeItem[];
  applied: boolean;
  appliedBy?: string;
  appliedByName?: string;
  appliedDate?: string;
  // Recorded financial state at this exact point in time
  financialState: {
    cashOnHand: number;
    stockCost: number;
    accountsCredit: number;
    cashInBank: number;
    cashOut: number;
    totalWriteOffLoss: number;
    totalFinancialState: number;
  };
}

export interface WriteOff {
  id: string;
  productId: string;
  name: string;
  sku: string;
  qty: number;
  buyPrice: number;
  lossValue: number; // qty * buyPrice
  reason: string;
  date: string;
  recordedBy: string;
  recordedByName: string;
}

export interface OverrideLog {
  id: string;
  customerId: string;
  customerName: string;
  fileNo: string;
  date: string;
  type: 'credit_wizard_override' | 'pos_override';
  overriddenBy: string;
  overriddenByName: string;
  reason: string;
  outstandingBalance: number;
  created: string;
}

export interface AccountingPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED' | 'AUDIT_EXCEPTION';
  closingDate?: string;
  closedBy?: string;
  capitalOpeningBalance: number;
  capitalClosingBalance: number;
  cashOpening: number;
  cashClosing: number;
  stockOpening: number;
  stockClosing: number;
  outstandingPrincipalOpening: number;
  outstandingPrincipalClosing: number;
  interestEarned: number;
  feesEarned: number;
  retailProfit: number;
  otherIncome: number;
  operationalExpenses: number;
  grossProfit: number;
  netProfit: number;
  auditNotes?: string;
  createdDate: string;
  modifiedDate: string;
  // Audit control layer additions
  systemTotalValueExpected?: number;
  systemTotalValueActual?: number;
  systemTotalValueVariance?: number;
  auditStatus?: 'PASSED' | 'FAILED' | 'EXCEPTION';
  closureReason?: 'Cash shortage' | 'Stock loss' | 'System correction' | 'Unknown (fraud risk flag)' | 'None';
  auditExceptionDetails?: string;
}

export interface AccountingAuditLog {
  id: string;
  periodId: string;
  periodName: string;
  user: string;
  date: string;
  time: string;
  action: 'OPEN' | 'CLOSE' | 'REOPEN';
  reason: string;
  timestamp: string;
}

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



