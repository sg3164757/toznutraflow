import { Lead, InventoryItem, Order, User } from './types';

export const MOCK_USERS: User[] = [
  { id: '1', orgId: 'test-org-123', name: 'Zaid Khan', email: 'zaid@nutraflow.com', role: 'Admin', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zaid', status: 'active', createdAt: '2024-01-01T00:00:00Z' },
  { id: '2', orgId: 'test-org-123', name: 'Sarah Smith', email: 'sarah@nutraflow.com', role: 'Sales', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah', status: 'active', createdAt: '2024-01-01T00:00:00Z' },
];

export const MOCK_LEADS: Lead[] = [
  { id: 'L1', orgId: 'test-org-123', serialId: '01', name: 'Raj Kumar', email: 'raj@example.com', phone: '+91 9876543210', status: 'New Lead', value: 5000, source: 'Website', assignedTo: 'Zaid Khan', assignedToId: '1', createdAt: '2024-03-20T10:00:00Z', address: '123 Main St', city: 'Mumbai', pincode: '400001', paymentMode: 'COD' },
  { id: 'L2', orgId: 'test-org-123', serialId: '02', name: 'Anita Desai', email: 'anita@example.com', phone: '+91 9876543211', status: 'Call Back', value: 12000, source: 'Referral', assignedTo: 'Sarah Smith', assignedToId: '2', createdAt: '2024-03-19T14:30:00Z', address: '456 West St', city: 'Delhi', pincode: '110001', paymentMode: 'COD' },
];

export const MOCK_INVENTORY: InventoryItem[] = [
  { id: 'P1', orgId: 'test-org-123', name: 'Advanced Gel Formula', category: 'Gel', sku: 'AGF-001', stock: 150, minStock: 20, price: 2999 },
  { id: 'P2', orgId: 'test-org-123', name: 'Zosh Tablets (30 Caps)', category: 'Tablets', sku: 'ZT-030', stock: 100, minStock: 15, price: 2999 },
  { id: 'P3', orgId: 'test-org-123', name: 'Booster 3X Pills', category: 'Pills', sku: 'B3X-001', stock: 80, minStock: 10, price: 2599 },
  { id: 'P4', orgId: 'test-org-123', name: 'Booster Cream', category: 'Cream', sku: 'BC-001', stock: 60, minStock: 10, price: 2590 },
];

export const MOCK_ORDERS: Order[] = [
  { 
    id: 'ORD-001', 
    orgId: 'test-org-123',
    orderSerial: '01',
    leadId: 'L1',
    customerId: 'C1', 
    customerName: 'Raj Kumar', 
    phone: '+91 9876543210',
    address: '123 Main St',
    city: 'Mumbai',
    pincode: '400001',
    product: 'Booster 3X Pills',
    quantity: 1,
    total: 2999,
    status: 'Delivered', 
    createdAt: '2024-03-15T15:20:00Z', 
    paymentMode: 'COD',
    assignedToId: '1',
    assignedTo: 'Zaid Khan',
    commission: 150
  },
];
