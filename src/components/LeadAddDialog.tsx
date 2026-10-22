import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lead, InventoryItem, User, LeadStatus } from '@/src/types';
import { toast } from 'sonner';
import { dataService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';
import { History, AlertCircle, Calendar, User as UserIcon, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (lead: any) => Promise<void>;
}

export function LeadAddDialog({ open, onOpenChange, onAdd }: LeadAddDialogProps) {
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    pincode: '',
    product: '',
    quantity: 1,
    value: 0,
    source: 'Direct',
    paymentMode: 'COD' as 'COD' | 'Prepaid',
    status: 'New Lead' as LeadStatus,
    assignedToId: '',
    assignedTo: ''
  });
  const [team, setTeam] = useState<User[]>([]);
  const [existingHistory, setExistingHistory] = useState<{ leads: Lead[] }>({ leads: [] });
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email?.toLowerCase() === 'tzsupportayurveda@gmail.com';
    if (open && (currentUser?.orgId || isSuperAdmin)) {
      setExistingHistory({ leads: [] });
      dataService.getInventoryList(currentUser?.orgId || '').then(items => {
        setInventory(items);
        if (items.length > 0 && !formData.product) {
          setFormData(prev => ({ 
            ...prev, 
            product: items[0].name,
            value: items[0].price 
          }));
        }
      });

      if (['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '')) {
        dataService.getTeamMembers(currentUser).then(setTeam);
      }
    }
  }, [open, currentUser]);

  const handlePhoneChange = async (phone: string) => {
    setFormData(prev => ({ ...prev, phone }));
    
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
    if (phone.length >= 10 && (currentUser?.orgId || isSuperAdmin)) {
      setCheckingDuplicates(true);
      try {
        const history = await dataService.getCustomerHistory(currentUser?.orgId || '', phone);
        setExistingHistory({ leads: history.leads });
        if (history.leads.length > 0) {
          toast.info(`Customer already in CRM with ${history.leads.length} previous leads.`);
        }
      } catch (e) {
        console.error("Duplicate check failed", e);
      } finally {
        setCheckingDuplicates(false);
      }
    } else {
      setExistingHistory({ leads: [] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error('Name and Phone are required');
      return;
    }

    setLoading(true);
    try {
      const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
      const isAdmin = ['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '') || isSuperAdmin;
      
      let finalStatus = formData.status;
      if (formData.status === 'Order Confirmed' && !isAdmin) {
        finalStatus = 'Pending Verification';
      }

      await onAdd({
        ...formData,
        status: finalStatus
      });
      onOpenChange(false);
      setFormData({
        name: '',
        phone: '',
        email: '',
        city: '',
        address: '',
        pincode: '',
        product: inventory[0]?.name || '',
        quantity: 1,
        value: inventory[0]?.price || 0,
        source: 'Direct',
        paymentMode: 'COD',
        status: 'New Lead',
        assignedToId: '',
        assignedTo: ''
      });
      toast.success('Lead added successfully');
    } catch (error) {
      toast.error('Failed to add lead');
    } finally {
      setLoading(false);
    }
  };

  const handleProductChange = (productName: string) => {
    if (productName === '') return;
    const mainProducts = [
      { name: 'Advanced Gel Formula', price: 2999 },
      { name: 'Zosh Tablets (30 Caps)', price: 2999 },
      { name: 'Booster 3X Pills', price: 2599 },
      { name: 'Booster Cream', price: 2590 }
    ];
    const item = mainProducts.find(p => p.name === productName) || inventory.find(i => i.name === productName);
    if (item) {
      setFormData(prev => ({ 
        ...prev, 
        product: productName, 
        value: item.price * (prev.quantity || 1)
      }));
    } else {
      setFormData(prev => ({ ...prev, product: productName }));
    }
  };

  const handleQtyChange = (val: string) => {
    const qty = parseInt(val) || 1;
    const mainProducts = [
      { name: 'Advanced Gel Formula', price: 2999 },
      { name: 'Zosh Tablets (30 Caps)', price: 2999 },
      { name: 'Booster 3X Pills', price: 2599 },
      { name: 'Booster Cream', price: 2590 }
    ];
    const item = mainProducts.find(p => p.name === formData.product) || inventory.find(i => i.name === formData.product);
    if (item) {
      setFormData(prev => ({ ...prev, quantity: qty, value: item.price * qty }));
    } else {
      // If custom product, try to keep unit price consistent
      const currentUnitPrice = formData.value / (formData.quantity || 1);
      setFormData(prev => ({ ...prev, quantity: qty, value: Math.round(currentUnitPrice * qty) }));
    }
  };

  const handlePincodeChange = async (pincode: string) => {
    // Only allow numbers and max 6 digits
    const cleanPincode = pincode.replace(/\D/g, '').slice(0, 6);
    setFormData(prev => ({ ...prev, pincode: cleanPincode }));

    if (cleanPincode.length === 6) {
      const location = await dataService.fetchLocationByPincode(cleanPincode);
      if (location) {
        setFormData(prev => ({ 
          ...prev, 
          city: prev.city || location.city 
        }));
        toast.success(`Location detected: ${location.city}`);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">Add New Sales Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Name</Label>
              <Input 
                placeholder="Rohan Sharma" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</Label>
              <div className="relative">
                <Input 
                  placeholder="+91 99999 00000" 
                  value={formData.phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  required
                  className={cn(existingHistory.leads.length > 0 && "border-amber-500 ring-amber-500/10 focus:ring-amber-500")}
                />
                {checkingDuplicates && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {existingHistory.leads.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Existing Customer History</span>
              </div>
              <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                {existingHistory.leads.map(lead => (
                  <div key={lead.id} className="bg-white border border-amber-100 p-2 rounded-lg flex items-center justify-between group hover:border-amber-300 transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-900">{lead.name}</span>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                          lead.status === 'Order Confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        )}>
                          {lead.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[9px] text-slate-400">
                        <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> {new Date(lead.createdAt).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><UserIcon className="w-2.5 h-2.5" /> {lead.assignedTo}</span>
                      </div>
                    </div>
                    <div className="text-[10px] font-black text-slate-900">₹{lead.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address (Optional)</Label>
            <Input 
              type="email"
              placeholder="customer@example.com" 
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Shipping Address</Label>
            <textarea 
              placeholder="House No, Street, Landmark..." 
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})}
              className="w-full min-h-[80px] p-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">City / Location</Label>
              <Input 
                placeholder="e.g. Mumbai" 
                value={formData.city}
                onChange={e => setFormData({...formData, city: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pincode</Label>
              <Input 
                placeholder="400001" 
                value={formData.pincode}
                onChange={e => handlePincodeChange(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Product (Required)</Label>
            <div className="relative">
              <select 
                value={formData.product}
                onChange={e => {
                  const prodName = e.target.value;
                  const mainProducts = [
                    { name: 'Advanced Gel Formula', price: 2999 },
                    { name: 'Zosh Tablets (30 Caps)', price: 2999 },
                    { name: 'Booster 3X Pills', price: 2599 },
                    { name: 'Booster Cream', price: 2590 }
                  ];
                  const selected = mainProducts.find(p => p.name === prodName);
                  
                  setFormData(prev => ({ 
                    ...prev, 
                    product: prodName, 
                    value: selected ? selected.price * (prev.quantity || 1) : prev.value
                  }));
                }}
                required
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-200 appearance-none transition-all font-mono"
              >
                <option value="">-- Choose Product --</option>
                <option value="Advanced Gel Formula">Advanced Gel Formula - ₹2,999</option>
                <option value="Zosh Tablets (30 Caps)">Zosh Tablets (30 Caps) - ₹2,999</option>
                <option value="Booster 3X Pills">Booster 3X Pills - ₹2,599</option>
                <option value="Booster Cream">Booster Cream - ₹2,590</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="flex items-center gap-4 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
              <div className="flex items-center gap-3 pl-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Quantity</Label>
                <Input 
                  type="number" 
                  min="1" 
                  className="w-20 h-9 text-xs font-black bg-white"
                  value={formData.quantity}
                  onChange={e => handleQtyChange(e.target.value)}
                />
              </div>
              <div className="h-5 w-px bg-emerald-200" />
              <div className="flex-1">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Pricing Calculation: </span>
                <span className="text-sm font-black text-emerald-900 font-mono">₹{formData.value}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Override Value (INR)</Label>
                <div className="flex gap-1">
                  {[2999, 2599, 2590].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFormData({...formData, value: p})}
                      className="text-[8px] font-bold bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors"
                    >
                      ₹{p}
                    </button>
                  ))}
                </div>
              </div>
              <Input 
                type="number" 
                value={formData.value}
                onChange={e => setFormData({...formData, value: parseInt(e.target.value) || 0})}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Source</Label>
              <select 
                value={formData.source}
                onChange={e => setFormData({...formData, source: e.target.value})}
                className="w-full h-10 border border-slate-200 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-100"
              >
                <option value="Direct">Direct</option>
                <option value="Website">Website</option>
                <option value="Facebook">Facebook</option>
                <option value="WhatsApp">WhatsApp</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Mode</Label>
              <select 
                value={formData.paymentMode}
                onChange={e => setFormData({...formData, paymentMode: e.target.value as any})}
                className="w-full h-10 border border-slate-200 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-100"
              >
                <option value="COD">COD (Delhivery)</option>
                <option value="Prepaid">Prepaid (PhonePe)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Initial Status</Label>
              <select 
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as any})}
                className="w-full h-10 border border-slate-200 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-100"
              >
                <option value="New Lead">New Lead</option>
                <option value="Interested">Interested</option>
                <option value="Order Confirmed">{['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '') ? 'Order Confirmed' : 'Confirm Order (Needs Verification)'}</option>
                <option value="Call Back">Call Back</option>
                <option value="No Answer">No Answer</option>
              </select>
            </div>
          </div>

          {['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '') && (
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assign To Agent</Label>
              <select 
                value={formData.assignedToId}
                onChange={e => {
                  const agent = team.find(t => t.id === e.target.value);
                  setFormData({
                    ...formData, 
                    assignedToId: e.target.value,
                    assignedTo: agent?.name || ''
                  });
                }}
                className="w-full h-10 border border-slate-200 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-100"
              >
                <option value="">Auto-Assign (Round Robin)</option>
                {team.filter(t => ['Sales', 'Manager', 'Admin', 'SuperAdmin', 'Marketer', 'Inventory', 'Delivery'].includes(t.role)).map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button type="submit" disabled={loading} className="w-full bg-slate-900 h-12 rounded-xl text-xs font-black uppercase tracking-widest">
              {loading ? 'Adding Lead...' : 'Create Sales Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
