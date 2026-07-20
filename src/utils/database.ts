import { Customer, Agreement, Sale, Payment, CollectionNote, CashDay, CashMovement, Product, BusinessSettings, User, Session, BankDetails } from '../types';
import { 
  saveDocToFirestore, 
  saveSettingsToFirestore, 
  fetchCollectionFromFirestore, 
  deleteDocFromFirestore, 
  loadSettingsFromFirestore 
} from '../lib/firestoreService';

const DB_PREFIX = 'sassc2_';

export const loadDBList = <T>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(DB_PREFIX + key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveDBList = <T>(key: string, data: T[]): void => {
  // Try to find deleted items and remove them from Firestore
  try {
    const oldRaw = localStorage.getItem(DB_PREFIX + key);
    const oldList: any[] = oldRaw ? JSON.parse(oldRaw) : [];
    const oldIds = new Set(oldList.map(item => item?.id).filter(Boolean));
    const newIds = new Set(data.map((item: any) => item?.id).filter(Boolean));
    
    // Deletions: in oldIds but not in newIds
    const deletedIds = [...oldIds].filter(id => !newIds.has(id));
    deletedIds.forEach(id => {
      deleteDocFromFirestore(key, id).catch(err => {
        console.error(`Error deleting ${id} from Firestore collection ${key}:`, err);
      });
    });
  } catch (e) {
    console.error('Error calculating deleted records for sync:', e);
  }

  // Save locally first for instant feedback
  localStorage.setItem(DB_PREFIX + key, JSON.stringify(data));

  // Sync current items asynchronously to Firestore
  data.forEach((item: any) => {
    if (item && typeof item === 'object' && item.id) {
      saveDocToFirestore(key, item).catch(err => {
        console.error(`Error syncing item ${item.id} to Firestore collection ${key}:`, err);
      });
    }
  });
};

export const loadDBObj = <T>(key: string, defaultValue: T): T => {
  try {
    const raw = localStorage.getItem(DB_PREFIX + key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
};

export const saveDBObj = <T>(key: string, data: T): void => {
  localStorage.setItem(DB_PREFIX + key, JSON.stringify(data));
  if (key === 'settings') {
    saveSettingsToFirestore('settings', data).catch(err => {
      console.error('Error syncing settings to Firestore:', err);
    });
  }
};

/**
 * Perform a complete background synchronization of all collections from Firestore.
 * Merges local and remote collections to prevent data loss.
 */
export const syncWithFirestore = async (): Promise<void> => {
  try {
    const collectionsToSync = [
      'customers', 'agreements', 'sales', 'payments', 'collection_notes', 
      'cashDays', 'stock', 'users', 'cashMovements', 'stockTakes', 
      'writeOffs', 'override_logs', 'whatsapp_logs',
      'accountingPeriods', 'accountingAuditLogs', 'barcodeMappings', 'stockAdjustments'
    ];
    
    for (const key of collectionsToSync) {
      const remoteData = await fetchCollectionFromFirestore<any>(key);
      if (remoteData && remoteData.length > 0) {
        const localRaw = localStorage.getItem(DB_PREFIX + key);
        const localData: any[] = localRaw ? JSON.parse(localRaw) : [];
        
        const mergedMap = new Map<string, any>();
        
        // Load local records first
        localData.forEach(item => {
          if (item && item.id) mergedMap.set(item.id, item);
        });
        
        // Merge in remote records (Firestore is ultimate truth)
        remoteData.forEach(item => {
          if (item && item.id) {
            mergedMap.set(item.id, item);
          }
        });
        
        const mergedList = Array.from(mergedMap.values());
        localStorage.setItem(DB_PREFIX + key, JSON.stringify(mergedList));
      }
    }

    // Sync business settings object
    const remoteSettings = await loadSettingsFromFirestore<any>('settings');
    if (remoteSettings) {
      localStorage.setItem(DB_PREFIX + 'settings', JSON.stringify(remoteSettings));
    }
  } catch (error) {
    console.error('Error running full background sync from Firestore:', error);
  }
};


// --- NCA Fees Calculations ---
export const INITIATION_RATE = 0.10;
export const SERVICE_FEE = 60.00;

export const calcNcaFees = (capital: number) => {
  const cap = Math.max(0, capital);
  const initiation = Math.round(cap * INITIATION_RATE * 100) / 100;
  const service = SERVICE_FEE;
  return {
    capital: cap,
    initiation,
    service,
    total: cap + initiation + service
  };
};

// --- Credit Checkers ---
export const getCustomerExposure = (customerId: string, agreements: Agreement[]): number => {
  return agreements
    .filter((a) => a.customerId === customerId && a.status !== 'paid')
    .reduce((sum, a) => sum + (a.balance || 0), 0);
};

export const checkCustomerOverdue = (customerId: string, agreements: Agreement[]): boolean => {
  return agreements.some((a) => a.customerId === customerId && a.status === 'overdue');
};

// --- ID Generation ---
export const generateUid = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
};

export const generateNextAgreementNumber = (agreements: Agreement[]): string => {
  const max = agreements.reduce((highest, a) => {
    const m = String(a.agrNumber || '').match(/(\d+)$/);
    const n = m ? parseInt(m[1]) : 0;
    return n > highest ? n : highest;
  }, 0);
  return 'AGR-RTB1-' + String(max + 1).padStart(6, '0');
};

export const generateNextCustomerFileNo = (customers: Customer[]): string => {
  const max = customers.reduce((highest, c) => {
    const n = parseInt(String(c.fileNo || '').replace(/\D/g, '')) || 0;
    return n > highest ? n : highest;
  }, 0);
  return String(max + 1).padStart(6, '0');
};

// --- Auth Utilities ---
export const hashPassword = (password: string): string => {
  // Simple base64 encoding for client-side demo and portability
  return btoa(unescape(encodeURIComponent(password || '')));
};

export const getPermissionList = () => [
  { key: 'manageUsers', label: 'Manage Users' },
  { key: 'editCustomers', label: 'Edit Customers / Profiles' },
  { key: 'changePayDate', label: 'Adjust Repayment / Pay Dates' },
  { key: 'changeLimits', label: 'Set/Change Credit Limits' },
  { key: 'approveCredit', label: 'Approve New Credit Agreements' },
  { key: 'manageStock', label: 'Manage Stock & Pricing' },
  { key: 'reverseTransactions', label: 'Reverse Transactions / Delete' },
  { key: 'openDay', label: 'Open Daily Cash Registers' },
  { key: 'closeDay', label: 'Close Daily Cash Registers' },
  { key: 'cashMovements', label: 'Record Cash Movements (In/Out/Bank)' },
  { key: 'viewReports', label: 'View Financial Reports' },
  { key: 'backupRestore', label: 'Perform Data Backup & Restore' },
];

export const getRolePermissions = (role: 'main_admin' | 'manager' | 'cashier'): Record<string, boolean> => {
  const perms: Record<string, boolean> = {};
  getPermissionList().forEach(({ key }) => {
    if (role === 'main_admin') {
      perms[key] = true;
    } else if (role === 'manager') {
      perms[key] = key !== 'manageUsers';
    } else {
      perms[key] = ['editCustomers', 'cashMovements'].includes(key);
    }
  });
  return perms;
};

// --- Database Seeding ---
export const seedSampleData = () => {
  const customers: Customer[] = [
    {
      id: 'c1',
      fileNo: '000001',
      name: 'Thabo Dlamini',
      firstNames: 'Thabo',
      surname: 'Dlamini',
      phone: '0821234567',
      email: 'thabo@gmail.com',
      idNumber: '8501015800086',
      address: '22 Rustenburg Road, Phokeng',
      employer: 'City of Joburg',
      workPhone: '0115551234',
      workAddress: '66 Civic Boulevard, Braamfontein',
      salaryDay: 25,
      incomeSource: 'Monthly Salary',
      church: 'ZCC',
      pastor: 'Pastor Mokoena',
      mandate: 'yes',
      creditLimit: 5000,
      type: 'credit',
      bank: {
        name: 'FNB',
        accountNumber: '62012345678',
        branchCode: '250655',
        holder: 'Thabo Dlamini'
      },
      notes: 'Reliable customer. Always pays via EFT on salary date.',
      created: new Date().toISOString().split('T')[0],
      updated: new Date().toISOString()
    },
    {
      id: 'c2',
      fileNo: '000002',
      name: 'Sarah Mokoena',
      firstNames: 'Sarah',
      surname: 'Mokoena',
      phone: '0731234567',
      email: 'sarah.m@sassa.gov.za',
      idNumber: '9203024800082',
      address: '14 Bethlehem Ext, Rustenburg',
      employer: 'Shoprite Rustenburg',
      workPhone: '0145924000',
      workAddress: 'Nelson Mandela Drive, Rustenburg',
      salaryDay: 1,
      incomeSource: 'SASSA Disability Grant',
      church: 'Methodist Church',
      pastor: 'Reverend Khumalo',
      mandate: 'yes',
      creditLimit: 3000,
      type: 'credit',
      bank: {
        name: 'Capitec',
        accountNumber: '1234567890',
        branchCode: '470010',
        holder: 'Sarah Mokoena'
      },
      notes: 'Repays on the first of each month when grant is cleared.',
      created: new Date().toISOString().split('T')[0],
      updated: new Date().toISOString()
    }
  ];

  const stock: Product[] = [
    {
      id: 's1',
      sku: 'MAIZE5KG',
      name: 'White Star Maize Meal (Raw)',
      category: 'Raw Ingredients',
      buyPrice: 12.00, // per kg (e.g. 5kg bag is R60)
      sellPrice: 18.00,
      qty: 40,
      lowAt: 5,
      unit: 'kg',
      created: new Date().toISOString().split('T')[0]
    },
    {
      id: 's2',
      sku: 'STEAK1KG',
      name: 'Beef Steak (Raw)',
      category: 'Raw Ingredients',
      buyPrice: 110.00, // per kg
      sellPrice: 160.00,
      qty: 15,
      lowAt: 3,
      unit: 'kg',
      created: new Date().toISOString().split('T')[0]
    },
    {
      id: 's3',
      sku: 'SALAD1KG',
      name: 'Fresh Salad Mix (Raw)',
      category: 'Raw Ingredients',
      buyPrice: 35.00, // per kg
      sellPrice: 55.00,
      qty: 10,
      lowAt: 2,
      unit: 'kg',
      created: new Date().toISOString().split('T')[0]
    },
    {
      id: 's4',
      sku: 'OIL2L',
      name: 'Sunflower Cooking Oil (Raw)',
      category: 'Raw Ingredients',
      buyPrice: 25.00, // per Liter
      sellPrice: 38.00,
      qty: 20,
      lowAt: 4,
      unit: 'l',
      created: new Date().toISOString().split('T')[0]
    },
    {
      id: 's5',
      sku: 'BREAD',
      name: 'White Bread Loaf',
      category: 'Bakery',
      buyPrice: 14.00,
      sellPrice: 20.00,
      qty: 12,
      lowAt: 4,
      unit: 'each',
      created: new Date().toISOString().split('T')[0]
    },
    {
      id: 's6',
      sku: 'MILK1L',
      name: 'Full Cream Milk 1L',
      category: 'Dairy',
      buyPrice: 18.00,
      sellPrice: 26.00,
      qty: 15,
      lowAt: 5,
      unit: 'each',
      created: new Date().toISOString().split('T')[0]
    },
    {
      id: 's7',
      sku: 'SUGAR1KG',
      name: 'White Sugar 1kg',
      category: 'Groceries',
      buyPrice: 22.00,
      sellPrice: 30.00,
      qty: 18,
      lowAt: 4,
      unit: 'each',
      created: new Date().toISOString().split('T')[0]
    },
    {
      id: 's8',
      sku: 'EGGS6',
      name: 'Large Eggs x6',
      category: 'Dairy',
      buyPrice: 25.00,
      sellPrice: 38.00,
      qty: 20,
      lowAt: 3,
      unit: 'each',
      created: new Date().toISOString().split('T')[0]
    }
  ];

  const defaultAdmin: User = {
    id: 'u1',
    fullName: 'Main Admin',
    username: 'admin',
    passwordHash: hashPassword('admin123'),
    role: 'main_admin',
    permissions: {},
    isActive: true,
    created: new Date().toISOString(),
    lastLoginAt: ''
  };

  const settings: BusinessSettings = {
    bizName: 'Lerato Community Financial Services',
    tradingAs: 'Lerato',
    owner: 'Claudine Pike du Plessis',
    phone: '086 100 2472',
    address: '50A Von Weilligh Street, Rustenburg, 0300',
    ncr: 'NCR/CP/10452'
  };

  saveDBList('customers', customers);
  saveDBList('stock', stock);
  saveDBList('users', [defaultAdmin]);
  saveDBObj('settings', settings);
  localStorage.setItem('sassc2_seeded', 'true');
};

export const clearAllProductionData = () => {
  saveDBList('customers', []);
  saveDBList('agreements', []);
  saveDBList('sales', []);
  saveDBList('payments', []);
  saveDBList('collection_notes', []);
  saveDBList('cashDays', []);
  saveDBList('stock', []);
  saveDBList('cashMovements', []);
  saveDBList('stockTakes', []);
  saveDBList('writeOffs', []);
  saveDBList('override_logs', []);
  saveDBList('whatsapp_logs', []);
  saveDBList('accountingPeriods', []);
  saveDBList('accountingAuditLogs', []);
  saveDBList('barcodeMappings', []);
  saveDBList('stockAdjustments', []);

  const defaultAdmin: User = {
    id: 'u1',
    fullName: 'Main Admin',
    username: 'admin',
    passwordHash: hashPassword('admin123'),
    role: 'main_admin',
    permissions: {},
    isActive: true,
    created: new Date().toISOString(),
    lastLoginAt: ''
  };
  saveDBList('users', [defaultAdmin]);

  const settings = loadDBObj<BusinessSettings>('settings', {
    bizName: 'Lerato Community Financial Services',
    tradingAs: 'Lerato',
    owner: 'Claudine Pike du Plessis',
    phone: '086 100 2472',
    address: '50A Von Weilligh Street, Rustenburg, 0300',
    ncr: 'NCR/CP/10452'
  });
  saveDBObj('settings', settings);

  localStorage.setItem('sassc2_seeded', 'true');
};
