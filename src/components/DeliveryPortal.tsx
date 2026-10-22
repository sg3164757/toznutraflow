
import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Package, 
  CheckCircle2, 
  MapPin, 
  Phone, 
  ChevronRight,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { dataService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';
import { Order } from '@/src/types';
import { format } from 'date-fns';
import { OrderDetailDialog } from './OrderDetailDialog';
import { LeadDetailDialog } from './LeadDetailDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from 'sonner';

const deliveryStatuses = ['Shipped', 'Dispatched', 'Out for Delivery', 'Delivered', 'Returned', 'RTO'] as const;

export function DeliveryPortal() {
  const { user: currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLeadDetailOpen, setIsLeadDetailOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedOrderForView, setSelectedOrderForView] = useState<Order | null>(null);
  
  // Local state for update
  const [updateData, setUpdateData] = useState({
    status: '' as Order['status'],
    trackingId: '',
    courier: '',
    notes: ''
  });

  useEffect(() => {
    if (!currentUser?.orgId) return;
    // Only fetch orders that are ready for delivery or handled by delivery
    const unsub = dataService.subscribeOrders(currentUser, (data) => {
      const relevant = data.filter(o => 
        ['Shipped', 'Dispatched', 'Out for Delivery', 'Delivered', 'Returned', 'RTO'].includes(o.status)
      );
      setOrders(relevant);
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  const handleStatusUpdate = async () => {
    if (!selectedOrder || !currentUser?.orgId) return;
    try {
      setLoading(true);
      await dataService.updateOrderStatus(currentUser.orgId, selectedOrder.id, updateData.status, {
        trackingId: updateData.trackingId,
        courier: updateData.courier,
        deliveryNotes: updateData.notes
      });
      toast.success(`Order status updated to ${updateData.status}`);
      setIsUpdateOpen(false);
    } catch (err) {
      toast.error('Galti: Status update nahi ho paya');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(o => 
    o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.orderSerial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Truck className="w-8 h-8 text-indigo-600" /> Delivery Management
          </h1>
          <p className="text-slate-500 font-medium">Handle shipping, tracking, and final delivery status updates.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-xl border border-slate-200 flex shadow-sm">
            <div className="px-3 py-1 bg-indigo-50 rounded-lg text-indigo-700 text-xs font-black uppercase tracking-widest">
              Live Shipments
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Quick Filters</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search Name/Phone/Order ID" 
                className="pl-10 h-11 bg-slate-50 border-transparent focus-visible:bg-white transition-all rounded-xl"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {['Dispatched', 'Out for Delivery', 'Delivered'].map(s => (
                <div 
                  key={s} 
                  className={cn(
                    badgeVariants({ variant: "outline" }), 
                    "cursor-pointer hover:bg-slate-50 font-bold border-slate-200"
                  )}
                >
                  {s}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-indigo-600 p-6 rounded-2xl shadow-xl shadow-indigo-200 text-white relative overflow-hidden">
            <Package className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
            <div className="relative z-10 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Team Delivery Info</p>
              <h2 className="text-2xl font-black leading-tight">Deliver goods safely & update status instantly.</h2>
              <p className="text-sm text-white/50 leading-relaxed font-medium">Aapka kaam delivered orders ko mark karna aur return tracking maintain karna hai.</p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-20 gap-4">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-slate-500 font-bold">Fetching delivery queue...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-20 text-center gap-4">
                <AlertCircle className="w-12 h-12 text-slate-100" />
                <p className="text-slate-900 font-black text-lg">No active shipments</p>
                <p className="text-slate-500 text-sm max-w-xs font-medium">Everything is delivered or waiting for dispatch from warehouse.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/50 h-14">
                  <TableRow>
                    <TableHead className="font-black text-xs uppercase text-slate-500 pl-6">Order ID</TableHead>
                    <TableHead className="font-black text-xs uppercase text-slate-500">Customer</TableHead>
                    <TableHead className="font-black text-xs uppercase text-slate-500 text-center">Status</TableHead>
                    <TableHead className="font-black text-xs uppercase text-slate-500 text-right pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map(order => (
                    <TableRow key={order.id} className="h-20 hover:bg-slate-50/50 transition-colors group">
                      <TableCell 
                        className="pl-6" 
                      >
                        <button 
                          className="flex flex-col text-left group/id"
                          onClick={() => {
                            setSelectedOrderForView(order);
                            setIsViewOpen(true);
                          }}
                        >
                          <span className="font-black text-indigo-600 group-hover/id:text-indigo-700 transition-colors flex items-center gap-1.5">
                            #{order.orderSerial || order.id.substring(0, 5)}
                            <ChevronRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover/id:opacity-100 group-hover/id:translate-x-0 transition-all" />
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">{format(new Date(order.createdAt), 'MMM dd')}</span>
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col leading-tight">
                          <span className="font-bold text-slate-900">{order.customerName}</span>
                          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-red-400" /> {order.address?.substring(0, 30)}...
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn(
                          "font-black text-[10px] uppercase h-6 px-3 rounded-full border-none shadow-sm",
                          order.status === 'Dispatched' ? "bg-teal-100 text-teal-700" :
                          order.status === 'Shipped' ? "bg-indigo-100 text-indigo-700" :
                          order.status === 'Out for Delivery' ? "bg-amber-100 text-amber-700" :
                          order.status === 'Delivered' ? "bg-emerald-100 text-emerald-700" :
                          order.status === 'RTO' ? "bg-orange-100 text-orange-700" :
                          order.status === 'Returned' ? "bg-rose-100 text-rose-700" :
                          "bg-slate-100 text-slate-700"
                        )}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button 
                          onClick={() => {
                            setSelectedOrder(order);
                            setUpdateData({
                              status: order.status,
                              trackingId: order.trackingId || '',
                              courier: order.courier || '',
                              notes: order.deliveryNotes || ''
                            });
                            setIsUpdateOpen(true);
                          }}
                          variant="ghost" 
                          size="sm" 
                          className="font-black text-[10px] uppercase tracking-widest text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl gap-2"
                        >
                          Update <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>

      {/* Update Status Dialog */}
      <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-slate-900 p-8 text-white">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-2">Update Shipment</h4>
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl font-black leading-tight">Order #{selectedOrder?.orderSerial}</h2>
              <div className="p-3 bg-white/10 rounded-2xl">
                <Truck className="w-6 h-6 text-indigo-400" />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-4 text-xs font-bold text-white/50">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" /> {selectedOrder && format(new Date(selectedOrder.createdAt), 'MMM dd, yyyy')}
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/30" />
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" /> {selectedOrder?.customerName}
              </div>
            </div>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">New Status</label>
                  <select 
                    value={updateData.status}
                    onChange={e => setUpdateData({...updateData, status: e.target.value as any})}
                    className="flex h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-black appearance-none cursor-pointer"
                  >
                    {['Shipped', 'Dispatched', 'Out for Delivery', 'Delivered', 'Returned', 'RTO'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Courier Name</label>
                  <Input 
                    value={updateData.courier}
                    onChange={e => setUpdateData({...updateData, courier: e.target.value})}
                    placeholder="Delhivery, Bluedart..."
                    className="h-12 bg-slate-50 border-slate-200 rounded-2xl font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tracking ID / Number</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    value={updateData.trackingId}
                    onChange={e => setUpdateData({...updateData, trackingId: e.target.value})}
                    placeholder="1234567890"
                    className="h-12 bg-slate-50 border-slate-200 rounded-2xl pl-12 font-black text-indigo-600"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Delivery Notes</label>
                <textarea 
                  value={updateData.notes}
                  onChange={e => setUpdateData({...updateData, notes: e.target.value})}
                  className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none transition-all"
                  placeholder="Address issues, customer availability etc..."
                />
              </div>
            </div>
            
            <div className="flex gap-4">
              <Button 
                variant="ghost" 
                onClick={() => setIsUpdateOpen(false)}
                className="flex-1 h-12 rounded-2xl font-bold text-slate-500"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleStatusUpdate}
                disabled={loading}
                className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Confirm Update
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <OrderDetailDialog 
        order={selectedOrderForView} 
        open={isViewOpen} 
        onOpenChange={setIsViewOpen} 
      />

      <LeadDetailDialog 
        leadId={selectedLeadId} 
        open={isLeadDetailOpen} 
        onOpenChange={setIsLeadDetailOpen} 
      />
    </div>
  );
}
