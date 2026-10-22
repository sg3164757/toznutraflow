export type LeadStatus = 
  | 'New Lead' 
  | 'Interested' 
  | 'Pending Verification'
  | 'Order Confirmed' 
  | 'Dispatched'
  | 'Shipped'
  | 'Delivered'
  | 'RTO/Cancelled'
  | 'Call Back'
  | 'No Answer'
  | 'Not Interested'
  | 'Fake/Spam'
  | 'Unavailable'
  | 'Language Issue'
  | 'Duplicate'
  | 'Wrong Number';

export type OrderStatus = 'Pending' | 'Processing' | 'Dispatched' | 'Shipped' | 'Delivered' | 'Returned' | 'Cancelled' | 'RTO';

export interface HistoryItem {
  id: string;
  type: 'status_change' | 'assignment' | 'note_added' | 'call_log' | 'order_placed' | 'export' | 'other';
  from?: string;
  to?: string;
  updatedBy: string;
  updatedById: string;
  timestamp: string;
  note?: string;
  callDuration?: number;
}

export interface Organization {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  logo?: string;
  subscription: 'Free' | 'Pro' | 'Enterprise';
  plan?: string;
  maxSeats?: number;
  roleLimits?: {
    Manager?: number;
    TeamLeader?: number;
    Sales?: number;
    [key: string]: number | undefined;
  };
  status: 'Active' | 'Suspended';
  pincodeLookupEnabled?: boolean;
}

export interface InventoryItem {
  id: string;
  orgId: string;
  sku: string;
  name: string;
  description?: string;
  stock: number;
  minStock: number;
  price: number;
  category: string;
}

export interface Lead {
  id: string;
  orgId: string;
  serialId?: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  city?: string;
  pincode?: string;
  state?: string;
  status: LeadStatus;
  source: string;
  assignedTo: string;
  assignedToId: string;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
  history?: HistoryItem[];
  value: number;
  product?: string;
  quantity?: number;
  paymentMode: 'COD' | 'Prepaid';
  affiliateId?: string;
  clickId?: string;
  campaignId?: string;
  adSource?: string;
  subId?: string;
  postbackStatus?: 'success' | 'failed' | 'pending';
  postbackFired?: boolean;
  lastCallDate?: string;
  ltv?: number; // Lifetime Value
  callbackTime?: string;
  isArchived?: boolean;
}

export interface Order {
  id: string;
  orgId: string;
  orderSerial?: string;
  leadId: string;
  customerId: string;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  product: string;
  quantity: number;
  total: number;
  paymentMode: 'COD' | 'Prepaid';
  status: OrderStatus;
  createdAt: string;
  assignedToId: string;
  assignedTo: string;
  commission: number; // Commission earned by rep
  trackingId?: string;
  courier?: string;
  deliveredAt?: string;
  rtoReason?: string;
  deliveryNotes?: string;
  state?: string;
  clickId?: string;
  campaignId?: string;
  adSource?: string;
  history?: HistoryItem[];
}

export interface Task {
  id: string;
  orgId: string;
  title: string;
  description: string;
  dueDate: string;
  userId: string;
  leadId?: string;
  status: 'pending' | 'completed';
  type: 'refill' | 'callback' | 'other';
}

export interface User {
  id: string;
  orgId?: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'TeamLeader' | 'Sales' | 'Inventory' | 'Marketer' | 'Delivery' | 'SuperAdmin' | 'Agent';
  status: 'active' | 'pending' | 'blocked';
  avatar?: string;
  createdAt: string;
  lastLogin?: string;
  lastBrowser?: string;
  lastDevice?: string;
  lastSeen?: string;
  isOnline?: boolean;
  notificationsEnabled?: boolean;
  earnings?: {
    daily: number;
    monthly: number;
    total: number;
  };
}

export interface AuditLog {
  id: string;
  orgId: string;
  userId: string;
  userName: string;
  action: string;
  entityId: string;
  entityType: string;
  details: string;
  timestamp: string;
}

export interface OTPRecord {
  email: string;
  otp: string;
  expiresAt: number;
}

export type PostbackEventTrigger = 
  | 'lead_created' 
  | 'lead_interested' 
  | 'order_confirmed' 
  | 'order_dispatched' 
  | 'order_delivered';

export interface PostbackEventRule {
  event: PostbackEventTrigger;
  enabled: boolean;
  actionName: string; // e.g. 'lead', 'confirm', 'sale', 'delivered'
  payout: number;
  currency?: string;
}

export interface PostbackConfig {
  id: string;
  orgId: string;
  name: string; // e.g. 'TrafficStars CPA Campaign'
  adNetwork: 'TrafficStars' | 'ExoClick' | 'PropellerAds' | 'Custom';
  postbackUrl: string; // e.g. 'https://tsyndicate.com/api/v1/cpa/action?key=...&clickid={clickid}&action={action}&payout={payout}'
  events: PostbackEventRule[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface PostbackLog {
  id: string;
  orgId: string;
  postbackId?: string;
  postbackName?: string;
  adNetwork: string;
  leadId: string;
  leadName?: string;
  leadPhone?: string;
  clickId: string;
  event: PostbackEventTrigger;
  actionName: string;
  url: string;
  httpCode?: number;
  responseBody?: string;
  status: 'success' | 'failed';
  payout: number;
  timestamp: string;
  errorMessage?: string;
}

