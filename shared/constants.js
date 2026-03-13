const ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  ATTENDANT: 'attendant'
};

const PAYMENT_METHODS = {
  CASH: 'cash',
  BANK: 'bank',
  CREDIT: 'credit',
  POS_TERMINAL: 'pos_terminal',
  MOBILE_MONEY: 'mobile_money',
  SPLIT: 'split'
};

const SALE_STATUS = {
  COMPLETED: 'completed',
  RETURNED: 'returned',
  VOIDED: 'voided'
};

const CREDIT_TYPES = {
  CUSTOMER: 'customer',
  SUPPLIER: 'supplier'
};

const CREDIT_STATUS = {
  PENDING: 'pending',
  PARTIAL: 'partial',
  PAID: 'paid',
  OVERDUE: 'overdue'
};

const EXPENSE_CATEGORIES = [
  'rent', 'salary', 'transport', 'stock',
  'utilities', 'maintenance', 'other'
];

const ACCOUNT_TYPES = {
  BANK: 'bank',
  MOBILE_MONEY: 'mobile_money',
  POS_TERMINAL: 'pos_terminal'
};

const TRANSACTION_TYPES = {
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdrawal',
  SALE: 'sale',
  EXPENSE: 'expense',
  CREDIT_PAYMENT: 'credit_payment'
};

const CASH_TRANSACTION_TYPES = {
  ADD: 'add',
  REMOVE: 'remove',
  SALE: 'sale',
  EXPENSE: 'expense',
  CREDIT_PAYMENT: 'credit_payment'
};

const NOTIFICATION_CHANNELS = {
  WHATSAPP: 'whatsapp',
  TELEGRAM: 'telegram',
  SMS: 'sms',
  USSD: 'ussd',
  ESP32_GSM: 'esp32_gsm',
  APP: 'app'
};

const ACTION_TYPES = [
  'sale', 'batch_sale', 'add_item', 'edit_item',
  'add_credit', 'pay_credit', 'add_expense',
  'cash_transaction', 'return'
];

const PLAN_TYPES = {
  FREE: 'free',
  PREMIUM: 'premium'
};

const FREE_TIER_LIMITS = {
  maxStaff: 1,        // owner only
  maxProducts: 20,
  reportsAccess: false,
  exportAccess: false,
  creditTracking: false,
  cashReconciliation: false,
  multipleAccounts: false,
  alertsAccess: false,
};

const MAX_ACTION_HISTORY = 50;
const DEFAULT_LOW_STOCK_THRESHOLD = 10;
const DEFAULT_PAGE_SIZE = 20;
const MAX_OFFLINE_QUEUE = 500;

module.exports = {
  ROLES,
  PAYMENT_METHODS,
  SALE_STATUS,
  CREDIT_TYPES,
  CREDIT_STATUS,
  EXPENSE_CATEGORIES,
  ACCOUNT_TYPES,
  TRANSACTION_TYPES,
  CASH_TRANSACTION_TYPES,
  NOTIFICATION_CHANNELS,
  ACTION_TYPES,
  PLAN_TYPES,
  FREE_TIER_LIMITS,
  MAX_ACTION_HISTORY,
  DEFAULT_LOW_STOCK_THRESHOLD,
  DEFAULT_PAGE_SIZE,
  MAX_OFFLINE_QUEUE
};
