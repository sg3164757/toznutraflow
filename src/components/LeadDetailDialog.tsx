
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Mail,
  Phone,
  Calendar,
  Loader2,
  ChevronDown,
  MapPin,
  CheckCircle,
  TrendingUp,
  X,
  Trash2,
  Radio,
  Copy,
  Send,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Lead, LeadStatus, User, Order, InventoryItem, HistoryItem } from '@/src/types';
import { cn } from '@/lib/utils';
import { dataService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  'New Lead': 'bg-blue-50 text-blue-700 border-blue-200',
  'Interested': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Pending Verification': 'bg-amber-600 text-white border-amber-600',
  'Order Confirmed': 'bg-emerald-600 text-white border-emerald-600',
  'Dispatched': 'bg-blue-600 text-white border-blue-600',
  'Shipped': 'bg-cyan-600 text-white border-cyan-600',
  'Delivered': 'bg-emerald-500 text-white border-emerald-500',
  'RTO/Cancelled': 'bg-red-50 text-red-700 border-red-200',
  'Call Back': 'bg-purple-50 text-purple-700 border-purple-200',
  'No Answer': 'bg-orange-50 text-orange-700 border-orange-200',
  'Not Interested': 'bg-slate-100 text-slate-500 border-slate-200',
  'Fake/Spam': 'bg-gray-100 text-gray-500 border-gray-200',
  'Unavailable': 'bg-amber-50 text-amber-700 border-amber-200',
  'Language Issue': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Duplicate': 'bg-rose-50 text-rose-700 border-rose-200',
  'Wrong Number': 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

interface LeadDetailDialogProps {
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (id: string) => void;
}

export function LeadDetailDialog({ leadId, open, onOpenChange, onDelete }: LeadDetailDialogProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [editableLead, setEditableLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [customerHistory, setCustomerHistory] = useState<{ leads: Lead[], orders: Order[] }>({ leads: [], orders: [] });
  const [statusOpen, setStatusOpen] = useState(false);
  const [showCallbackScheduler, setShowCallbackScheduler] = useState(false);
  const [callbackTime, setCallbackTime] = useState('');
  const { user: currentUser } = useAuth();

  useEffect(() => {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email?.toLowerCase() === 'tzsupportayurveda@gmail.com';
    const isSpecialist = ['Admin', 'Manager', 'SuperAdmin', 'Marketer'].includes(currentUser?.role || '') || isSuperAdmin;
    const isAgent = currentUser?.role === 'Sales' || currentUser?.role === 'Agent';

    if (leadId && open) {
      setLoading(true);
      setError(null);
      // Faster, single-lead subscription
      const unsub = dataService.subscribeLead(leadId, (found) => {
        if (found) {
          setLead(found);
          setEditableLead({ ...found });
          if (found.callbackTime) {
            setCallbackTime(found.callbackTime);
          }
          
          // Fetch associations
          dataService.getCustomerHistory(currentUser?.orgId || found.orgId || 'root-admin', found.phone, found.email).then(setCustomerHistory);
        } else {
          setLead(null);
          setEditableLead(null);
          // If we see it in the list but can't fetch it, it's likely a permission issue
          setError("Lead data unreachable. Aapke paas is lead ko dekhne ki permission nahi hai.");
        }
        setLoading(false);
      });

      dataService.getInventoryList(currentUser.orgId).then(setInventory);

      // Fetch team for assignment
      let teamUnsub = () => {};
      if (['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '')) {
        teamUnsub = dataService.subscribeUsersPresence(currentUser, (data) => {
          setTeam(data);
        });
      }

      return () => {
        unsub();
        teamUnsub();
      };
    }
  }, [leadId, open, currentUser]);

  const handleUpdateStatus = async (status: LeadStatus, extras: Partial<Lead> = {}) => {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
    const isAdmin = ['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '') || isSuperAdmin;
    const isAgent = ['Sales', 'Agent'].includes(currentUser?.role || '');
    
    // If it's a "Confirm" action and the user is NOT an admin, it goes to Pending Verification
    let finalStatus = status;
    if (status === 'Order Confirmed' && !isAdmin) {
      finalStatus = 'Pending Verification';
    }

    try {
      await dataService.updateLead(currentUser?.orgId || 'root-admin', editableLead.id, { 
        status: finalStatus, 
        notes: (extras.notes !== undefined ? extras.notes : (editableLead.notes || '')),
        ...extras 
      });
      toast.success(`Status updated to ${finalStatus}`);
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  const handleScheduleCallback = () => {
    if (!callbackTime) {
      toast.error("Please select a callback time");
      return;
    }
    handleUpdateStatus('Call Back', { callbackTime });
    setShowCallbackScheduler(false);
  };

  const handleAssignLead = async (agent: User) => {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
    if (!editableLead || (!currentUser?.orgId && !isSuperAdmin)) return;
    try {
      await dataService.updateLead(currentUser?.orgId || 'root-admin', editableLead.id, { 
        assignedTo: agent.name, 
        assignedToId: agent.id 
      });
      toast.success(`Assigned to ${agent.name}`);
      
      // Update local state
      setEditableLead({ ...editableLead, assignedTo: agent.name, assignedToId: agent.id });
    } catch (e) {
      toast.error('Assignment failed');
    }
  };

  const handleSaveChanges = async () => {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
    if (!editableLead || (!currentUser?.orgId && !isSuperAdmin)) return;
    try {
      setLoading(true);
      const { id, history, ...updates } = editableLead;
      await dataService.updateLead(currentUser?.orgId || 'root-admin', id, updates);
      setHasChanges(false);
      toast.success('Details saved');
    } catch (e) {
      toast.error('Save failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePincodeChange = async (pincode: string) => {
    if (!editableLead) return;
    const cleanPincode = pincode.replace(/\D/g, '').slice(0, 6);
    setEditableLead({ ...editableLead, pincode: cleanPincode });
    setHasChanges(true);

    if (cleanPincode.length === 6) {
      const location = await dataService.fetchLocationByPincode(cleanPincode);
      if (location) {
        setEditableLead(prev => prev ? { 
          ...prev, 
          city: prev.city || location.city 
        } : null);
        toast.success(`Location detected: ${location.city}`);
      }
    }
  };

  const handleCreateOrder = async (l: Lead) => {
    try {
      const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
      if (!currentUser?.orgId && !isSuperAdmin) return;
      setLoading(true);
      await dataService.handleOrderConfirmation(currentUser?.orgId || 'root-admin', l);
      toast.success("Order created successfully");
      onOpenChange(false);
    } catch (e) {
      toast.error("Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] rounded-2xl p-0 overflow-hidden bg-white">
        {loading && !editableLead ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-slate-500 font-medium">Loading lead details...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-red-600 font-bold max-w-xs">{error}</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close View</Button>
          </div>
        ) : editableLead ? (
          <div className="flex h-[85vh] overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-100">
              <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1 border-2", statusColors[editableLead.status])}>
                    {editableLead.status}
                  </Badge>
                  <div className="h-4 w-px bg-slate-200" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID: {editableLead.serialId}</span>
                  {editableLead.isArchived && (
                    <Badge variant="destructive" className="text-[8px] font-black uppercase tracking-widest ml-2 px-1.5 py-0">Bin</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager' || currentUser?.role === 'SuperAdmin') && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
                        if (!currentUser?.orgId && !isSuperAdmin) return;
                        handleSaveChanges(); // Save changes first
                        dataService.updateLead(currentUser?.orgId || 'root-admin', editableLead.id, { 
                          isArchived: !editableLead.isArchived,
                          assignedToId: !editableLead.isArchived ? 'unassigned' : editableLead.assignedToId,
                          assignedTo: !editableLead.isArchived ? 'Unassigned' : editableLead.assignedTo
                        });
                        toast.success(editableLead.isArchived ? 'Restored from bin' : 'Moved to bin');
                        onOpenChange(false);
                      }}
                      className="h-8 text-xs font-bold text-slate-500 hover:text-slate-900 border border-slate-200 px-3 flex items-center gap-2"
                    >
                      <Trash2 className="w-3 h-3" />
                      {editableLead.isArchived ? 'Restore' : 'Move to Bin'}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs font-bold text-slate-500">Close</Button>
                  {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager' || currentUser?.role === 'SuperAdmin') && onDelete && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        if (confirm('Delete lead?')) {
                          onDelete(editableLead.id);
                          onOpenChange(false);
                        }
                      }} 
                      className="h-8 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      Delete Lead
                    </Button>
                  )}
                  {hasChanges && (
                    <Button onClick={handleSaveChanges} size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 shadow-sm">
                      Save Profile
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {/* Header Info */}
                <div className="space-y-4">
                  <Input 
                    value={editableLead.name}
                    onChange={(e) => {
                      setEditableLead({ ...editableLead, name: e.target.value });
                      setHasChanges(true);
                    }}
                    className="text-3xl font-black bg-transparent border-none p-0 h-auto focus-visible:ring-0 shadow-none placeholder:text-slate-200"
                    placeholder="Customer Name"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Phone</label>
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 h-10">
                        <Phone className="w-3.5 h-3.5 text-emerald-500" />
                        <Input 
                          value={editableLead.phone} 
                          onChange={e => { setEditableLead({...editableLead, phone: e.target.value}); setHasChanges(true); }} 
                          className="border-none bg-transparent shadow-none focus-visible:ring-0 text-sm font-bold h-full"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email</label>
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 h-10">
                        <Mail className="w-3.5 h-3.5 text-blue-500" />
                        <Input 
                          value={editableLead.email || ''} 
                          onChange={e => { setEditableLead({...editableLead, email: e.target.value}); setHasChanges(true); }} 
                          className="border-none bg-transparent shadow-none focus-visible:ring-0 text-sm font-bold h-full"
                          placeholder="No email provided"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Full Address</label>
                    <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 mt-1" />
                      <textarea 
                        value={editableLead.address || ''} 
                        onChange={e => { setEditableLead({...editableLead, address: e.target.value}); setHasChanges(true); }} 
                        className="w-full bg-transparent border-none shadow-none focus:ring-0 text-sm font-bold min-h-[60px] resize-none outline-none"
                        placeholder="No address provided"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">City</label>
                      <Input value={editableLead.city || ''} onChange={e => { setEditableLead({...editableLead, city: e.target.value}); setHasChanges(true); }} className="bg-slate-50 border-slate-200 rounded-xl font-bold h-10" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Pincode</label>
                      <Input 
                        value={editableLead.pincode || ''} 
                        onChange={e => handlePincodeChange(e.target.value)} 
                        className="bg-slate-50 border-slate-200 rounded-xl font-bold h-10" 
                      />
                    </div>
                  </div>

                  {/* TrafficStars & Ad Attribution Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-slate-50 border border-indigo-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-indigo-600 animate-pulse" />
                        <span className="text-xs font-black text-slate-900 tracking-tight">Marketing Attribution & S2S Postback</span>
                      </div>
                      <Badge className="bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                        {editableLead.adSource || editableLead.source || 'TrafficStars'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Click ID (Tracking Token)</span>
                        <div className="flex items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800">
                          <span className="truncate flex-1 font-semibold">{editableLead.clickId || 'No Click ID'}</span>
                          {editableLead.clickId && (
                            <button 
                              type="button" 
                              onClick={() => {
                                navigator.clipboard.writeText(editableLead.clickId || '');
                                toast.success('Click ID copied!');
                              }}
                              className="text-slate-400 hover:text-slate-700 p-0.5"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Campaign / Sub ID</span>
                        <div className="bg-white p-2 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700 truncate font-semibold">
                          {editableLead.campaignId || editableLead.subId || 'Default Campaign'}
                        </div>
                      </div>
                    </div>

                    {editableLead.clickId && (
                      <div className="pt-2 border-t border-indigo-100 flex items-center justify-between">
                        <span className="text-[10px] text-indigo-800 font-medium">
                          Postback will automatically fire upon confirmation & delivery.
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            toast.loading('Sending S2S postback to TrafficStars...');
                            const res = await dataService.triggerPostbackForLead(
                              currentUser?.orgId || 'root-admin',
                              editableLead,
                              editableLead.status === 'Order Confirmed' ? 'order_confirmed' : editableLead.status === 'Delivered' ? 'order_delivered' : 'lead_created',
                              editableLead.value || 0
                            );
                            toast.dismiss();
                            if (res.success) {
                              toast.success(`Postback sent successfully! (HTTP ${res.httpCode || 200})`);
                            } else {
                              toast.error(`Postback ping failed: ${res.reason || res.error || 'Check config'}`);
                            }
                          }}
                          className="h-7 text-[10px] font-bold bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 gap-1.5 shadow-sm"
                        >
                          <Send className="w-3 h-3 text-indigo-600" />
                          Manual Postback Ping
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Product Selection (Restricted)</label>
                    <div className="relative">
                      <select 
                        value={editableLead.product || ''}
                        onChange={e => {
                          const prodName = e.target.value;
                          const mainProducts = [
                            { name: 'Advanced Gel Formula', price: 2999 },
                            { name: 'Zosh Tablets (30 Caps)', price: 2999 },
                            { name: 'Booster 3X Pills', price: 2599 },
                            { name: 'Booster Cream', price: 2590 }
                          ];
                          const selected = mainProducts.find(p => p.name === prodName);
                          
                          setEditableLead({
                            ...editableLead, 
                            product: prodName,
                            value: selected ? selected.price * (editableLead.quantity || 1) : editableLead.value
                          });
                          setHasChanges(true);
                        }}
                        className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-black focus:ring-2 focus:ring-emerald-500/10 outline-none appearance-none transition-all font-mono"
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
                        <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Qty</label>
                        <Input 
                          type="number" 
                          min="1" 
                          className="w-20 h-9 text-xs font-black bg-white"
                          value={editableLead.quantity || 1}
                          onChange={e => {
                            const qty = parseInt(e.target.value) || 1;
                            const mainProducts = [
                              { name: 'Advanced Gel Formula', price: 2999 },
                              { name: 'Zosh Tablets (30 Caps)', price: 2999 },
                              { name: 'Booster 3X Pills', price: 2599 },
                              { name: 'Booster Cream', price: 2590 }
                            ];
                            const selected = mainProducts.find(p => p.name === editableLead.product) || inventory.find(i => i.name === editableLead.product);
                            
                            setEditableLead({
                              ...editableLead, 
                              quantity: qty, 
                              value: selected ? selected.price * qty : (editableLead.value / (editableLead.quantity || 1)) * qty
                            });
                            setHasChanges(true);
                          }}
                        />
                      </div>
                      <div className="h-5 w-px bg-emerald-200" />
                      <div className="flex-1">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Calculated Cost: </span>
                        <span className="text-sm font-black text-emerald-900 font-mono">₹{editableLead.value}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agent Notes</label>
                  <textarea 
                    value={editableLead.notes || ''}
                    onChange={e => { setEditableLead({...editableLead, notes: e.target.value}); setHasChanges(true); }}
                    className="w-full min-h-[100px] p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-slate-100 outline-none resize-none"
                    placeholder="Add customer notes here..."
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pipeline Status</label>
                  
                  {editableLead.status === 'Call Back' && editableLead.callbackTime && (
                    <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-purple-700/60 uppercase">Scheduled Callback</span>
                        <span className="text-sm font-black text-purple-900">
                          {(() => {
                            try {
                              return new Date(editableLead.callbackTime || '').toLocaleString();
                            } catch (e) {
                              return 'Invalid Date';
                            }
                          })()}
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowCallbackScheduler(true)}
                        className="ml-auto h-7 text-[10px] font-black text-purple-600 hover:bg-purple-100 uppercase"
                      >
                        Reschedule
                      </Button>
                    </div>
                  )}

                  <div className="relative">
                    <Button 
                      onClick={() => setStatusOpen(!statusOpen)}
                      className="w-full h-12 bg-slate-900 text-white gap-2 font-black uppercase text-[10px] tracking-widest rounded-xl"
                    >
                      <CheckCircle className="w-4 h-4" /> {editableLead.status}
                      <ChevronDown className="w-4 h-4 ml-auto opacity-50" />
                    </Button>
                    {statusOpen && (
                      <div className="absolute bottom-full left-0 mb-2 w-[300px] p-2 bg-white z-[1200] rounded-xl shadow-2xl border border-slate-200 grid grid-cols-2 gap-1">
                        {['Call Back', 'No Answer', 'Interested', 'Not Interested', 'Order Confirmed', 'Pending Verification', 'Duplicate', 'Wrong Number', 'Fake/Spam', 'RTO/Cancelled'].map(s => (
                          <button 
                            key={s} 
                            onClick={() => {
                              if (s === 'Call Back') {
                                setShowCallbackScheduler(true);
                                setStatusOpen(false);
                              } else {
                                handleUpdateStatus(s as LeadStatus);
                                setStatusOpen(false);
                              }
                            }}
                            className="w-full flex items-center h-10 px-3 cursor-pointer rounded-lg hover:bg-slate-50 font-bold text-sm text-slate-700"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Assignment Section */}
                  {['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '') && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Assign Agent</label>
                      <select 
                        value={editableLead.assignedToId || ''}
                        onChange={(e) => {
                          const agent = team.find(t => t.id === e.target.value);
                          if (agent) handleAssignLead(agent);
                        }}
                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500/10"
                      >
                        <option value="">Select Agent</option>
                        {team.filter(t => ['Sales', 'Manager', 'Admin', 'SuperAdmin', 'Marketer', 'Inventory', 'Delivery'].includes(t.role)).map(agent => (
                          <option key={agent.id} value={agent.id}>{agent.name} ({agent.role})</option>
                        ))}
                      </select>
                      {editableLead.assignedTo && (
                        <p className="mt-1.5 text-[10px] font-bold text-slate-400 italic">
                          Currently assigned to: <span className="text-emerald-600">{editableLead.assignedTo}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {showCallbackScheduler && (
                    <div className="mt-3 p-4 bg-purple-50 border border-purple-100 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-purple-900 uppercase tracking-widest">Schedule Callback</h4>
                        <Button variant="ghost" size="sm" onClick={() => setShowCallbackScheduler(false)} className="h-6 w-6 p-0 rounded-full">
                          <X className="w-3 h-3 text-purple-400" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-purple-600 uppercase">Select Date & Time</label>
                        <Input 
                          type="datetime-local" 
                          value={callbackTime}
                          onChange={(e) => setCallbackTime(e.target.value)}
                          className="bg-white border-purple-200 rounded-xl font-bold"
                        />
                      </div>
                      <Button 
                        onClick={handleScheduleCallback}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[10px] h-10 rounded-xl"
                      >
                        Confirm Schedule
                      </Button>
                    </div>
                  )}
                </div>

                <div className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-4">
                  <h3 className="text-sm font-black text-emerald-900 uppercase tracking-widest">Order Entry</h3>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-emerald-700/60 uppercase">Order Value (₹)</span>
                        <div className="flex gap-1">
                          {[2999, 2599, 2590].map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                setEditableLead({ ...editableLead, value: p });
                                setHasChanges(true);
                              }}
                              className="text-[9px] font-black bg-emerald-100 hover:bg-emerald-200 text-emerald-600 px-2 py-1 rounded transition-colors"
                            >
                              ₹{p}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center mt-1">
                        <span className="text-xl font-black text-emerald-600 mr-2">₹</span>
                        <Input 
                          type="number"
                          value={editableLead.value || 0}
                          onChange={(e) => {
                            setEditableLead({ ...editableLead, value: parseInt(e.target.value) || 0 });
                            setHasChanges(true);
                          }}
                          className="bg-white border-emerald-100 rounded-xl text-xl font-black text-emerald-600 h-12 focus:ring-emerald-500 shadow-sm"
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={() => {
                        const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
                        const isAdmin = ['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '') || isSuperAdmin;
                        
                        if (isAdmin) {
                          handleCreateOrder(editableLead);
                        } else {
                          handleUpdateStatus('Pending Verification');
                        }
                      }}
                      className="bg-emerald-600 text-white font-black uppercase text-[10px] h-12 px-8 rounded-xl shadow-lg hover:shadow-emerald-200 transition-all hover:bg-emerald-700 mt-4 sm:mt-0"
                    >
                      {['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '') || (currentUser?.email === 'tzsupportayurveda@gmail.com') ? 'Confirm Order' : 'Submit for Verification'}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">History Log</label>
                  <div className="space-y-3">
                    {(editableLead.history || []).slice().reverse().map((item, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-black text-slate-900 uppercase">{item.type}</span>
                          <span className="text-[9px] text-slate-400">{new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 font-medium">
                          {item.type === 'status_change' ? `${item.from} → ${item.to}` : item.note}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 font-bold">By {item.updatedBy}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Stats */}
            <div className="w-80 flex flex-col bg-slate-50/50 p-6">
              <div className="space-y-6">
                <div className="p-4 bg-emerald-900 text-white rounded-2xl">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Customer LTV</p>
                  <p className="text-2xl font-black">₹{(editableLead.ltv || 0).toLocaleString()}</p>
                </div>
                
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Orders</h4>
                  {customerHistory.orders.map(o => (
                    <div key={o.id} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-black">#{o.orderSerial}</span>
                        <Badge className="text-[8px] bg-indigo-50 text-indigo-600">{o.status}</Badge>
                      </div>
                      <p className="text-[10px] font-bold text-slate-500">₹{o.total.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
