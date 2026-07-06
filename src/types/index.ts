// Type definitions for SASSC application

export interface CreditAccount {
  id: string;
  name: string;
  amount: number;
  dueDate: Date;
  status: 'active' | 'inactive' | 'overdue';
}

export interface FMCGTransaction {
  id: string;
  accountId: string;
  amount: number;
  date: Date;
  description: string;
}
