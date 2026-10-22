
import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Package, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Eye,
  FileText,
  Loader2,
  ShoppingCart,
  Send,
  User,
  MapPin,
  Phone,
  CreditCard,
  ExternalLink
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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { dataService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';
import { Order, Lead } from '@/src/types';
import { format } from 'date-fns';
import { LeadDetailDialog } from '@/src/components/LeadDetailDialog';
import { OrderDetailDialog } from '@/src/components/OrderDetailDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const orderStatusColors = {
  'Pending': 'bg-slate-100 text-slate-700',
  'Processing': 'bg-blue-100 text-blue-700',
  'Shipped': 'bg-amber-100 text-amber-700',
  'Dispatched': 'bg-teal-100 text-teal-700',
  'Delivered': 'bg-emerald-100 text-emerald-700',
  'Cancelled': 'bg-red-100 text-red-700',
  'RTO': 'bg-orange-100 text-orange-700',
  'Returned': 'bg-rose-100 text-rose-700',
};

const statusIcons = {
  'Pending': Clock,
  'Processing': Package,
  'Shipped': Truck,
  'Dispatched': Send,
  'Delivered': CheckCircle2,
  'Cancelled': XCircle,
};

export function OrderManager() {
  const { user: currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;

    const unsub = dataService.subscribeOrders(currentUser, (data) => {
      const sorted = [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(sorted);
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser?.id, currentUser?.orgId, currentUser?.role]);

  const filteredOrders = orders.filter(order => {
    const isSpecialist = ['Admin', 'Manager', 'Marketer', 'SuperAdmin', 'Inventory', 'Delivery'].includes(currentUser?.role || '') || currentUser?.email?.toLowerCase() === 'tzsupportayurveda@gmail.com';
    if (isSpecialist) return true;
    const isOwner = order.assignedToId === currentUser?.id;
    const isUnassigned = !order.assignedToId || order.assignedToId === 'unassigned' || order.assignedToId === 'CRM User' || order.assignedToId === '';
    return isOwner || isUnassigned;
  });

  const [shipData, setShipData] = useState({
    trackingId: '',
    courier: 'Delhivery',
    notes: ''
  });

  const handleDispatch = async (orderId: string) => {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
    if (!currentUser?.orgId && !isSuperAdmin) return;
    try {
      await dataService.updateOrderStatus(currentUser?.orgId || 'root-admin', orderId, 'Shipped', {
        trackingId: shipData.trackingId,
        courier: shipData.courier,
        deliveryNotes: shipData.notes
      });
      toast.success('Order marked as Shipped with tracking info');
      setIsDetailsOpen(false);
      setShipData({ trackingId: '', courier: 'Delhivery', notes: '' });
    } catch (error) {
      toast.error('Failed to update shipping info');
    }
  };

  const handleSendToDelivery = async (orderId: string) => {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
    if (!currentUser?.orgId && !isSuperAdmin) return;
    try {
      await dataService.updateOrderStatus(currentUser?.orgId || 'root-admin', orderId, 'Dispatched');
      toast.success('Order sent to Delivery Portal successfully');
      setIsDetailsOpen(false);
    } catch (e) {
      toast.error('Failed to send to delivery');
    }
  };

  const handleStatusUpdate = async (orderId: string, status: any) => {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
    if (!currentUser?.orgId && !isSuperAdmin) return;
    try {
      await dataService.updateOrderStatus(currentUser?.orgId || 'root-admin', orderId, status);
      toast.success(`Order status updated to ${status}`);
    } catch (e) {
      toast.error('Status update failed');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Order Fulfillment</h1>
            <Badge className="bg-blue-100 text-blue-700 border-none font-black text-[9px] uppercase tracking-widest px-2.5">
              Processing Queue
            </Badge>
          </div>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-tight">Lifecycle monitoring of confirmed commercial transactions.</p>
        </div>
        {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager' || currentUser?.role === 'SuperAdmin') && (
          <Button className="neo-shadow bg-slate-900 hover:bg-black text-white gap-2 font-black uppercase text-[10px] tracking-widest h-10 px-4">
            <Truck className="w-4 h-4 text-blue-400" /> Batch Dispatch
          </Button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/20 overflow-hidden neo-shadow min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-32 gap-4">
             <div className="relative">
              <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Order Records...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-32 text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center">
              <ShoppingCart className="w-8 h-8 text-slate-200" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-black text-slate-900 uppercase tracking-tight">No Transactions Recorded</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-loose">
                {currentUser?.role === 'Admin' ? 'Awaiting commercial conversion from lead registry.' : 'Your assignment queue is currently empty.'}
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="h-14 hover:bg-transparent border-b-slate-100">
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-6">Order ID</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Entity Details</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Fulfillment Date</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Financial Value</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Status & Logistics</TableHead>
                {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager' || currentUser?.role === 'SuperAdmin') && <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Assigned To</TableHead>}
                <TableHead className="w-14 px-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const Icon = statusIcons[order.status as keyof typeof statusIcons] || Clock;
                return (
                  <TableRow key={order.id} className="h-20 hover:bg-slate-50/30 group transition-all border-b-slate-50">
                    <TableCell className="px-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-blue-600 font-mono tracking-tighter">#{order.orderSerial || order.id.substring(0, 8).toUpperCase()}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">TRAN_ID</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{order.customerName}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                           <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-1.5 py-0.5 rounded">
                             {order.product || 'NO PRODUCT'}
                           </span>
                           <span className="text-[10px] font-bold text-slate-500 font-mono tracking-tight">{order.phone || 'NO_PHONE'}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-slate-700 font-mono uppercase tracking-tighter">
                          {format(new Date(order.createdAt), 'dd MMM yyyy').toUpperCase()}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">TS_ENTRY</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 font-mono">₹{order.total.toLocaleString()}</span>
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Confirmed Revenue</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex flex-col gap-2">
                        <Badge variant="outline" className={cn(
                          "text-[9px] font-black uppercase tracking-widest h-6 px-2.5 border-2 w-fit rounded-lg shadow-sm transition-transform group-hover:scale-105",
                          orderStatusColors[order.status as keyof typeof orderStatusColors] || "bg-slate-50 text-slate-400 border-slate-200"
                        )}>
                          <Icon className="w-3 h-3 mr-1.5" /> {order.status}
                        </Badge>
                        {order.trackingId && (
                          <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-600 uppercase tracking-widest ml-1">
                            <Truck className="w-2.5 h-2.5" /> 
                            {order.courier?.toUpperCase() || 'LOGISTICS'}: <span className="font-mono text-slate-500">{order.trackingId}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager' || currentUser?.role === 'SuperAdmin') && (
                      <TableCell className="px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-[10px] font-black text-white uppercase ring-2 ring-slate-100">
                            {(order.agentName || 'S')[0]}
                          </div>
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{order.agentName || 'SYSTEM_OP'}</span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 border border-transparent hover:border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsDetailsOpen(true);
                          }}
                          title="View Details"
                        >
                          <Eye className="w-4.5 h-4.5" />
                        </Button>
                        {['Pending', 'Dispatched'].includes(order.status) && (currentUser?.role === 'Admin' || currentUser?.role === 'Manager' || currentUser?.role === 'SuperAdmin') && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 border border-transparent hover:border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm"
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsUpdateOpen(true);
                            }}
                            title="Quick Actions"
                          >
                            <Send className="w-4.5 h-4.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Order Details Dialog */}
      <OrderDetailDialog 
        order={selectedOrder} 
        open={isDetailsOpen} 
        onOpenChange={setIsDetailsOpen} 
        onViewLead={(leadId) => {
          setIsLeadDialogOpen(true);
        }}
      />

      {/* Quick Action / Dispatch Dialog */}
      <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
        <DialogContent className="max-w-md border-slate-200 rounded-2xl overflow-hidden p-0 border-none shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="bg-slate-900 p-8 text-white">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-2">Order Processing</h4>
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl font-black leading-tight">#{selectedOrder?.orderSerial}</h2>
              <div className="p-3 bg-white/10 rounded-2xl">
                <Package className="w-6 h-6 text-indigo-400" />
              </div>
            </div>
            <p className="mt-4 text-xs font-bold text-white/50">{selectedOrder?.customerName} • {selectedOrder?.product}</p>
          </div>
          
          <div className="p-8 space-y-6 bg-white">
            {selectedOrder?.status === 'Pending' && (
              <div className="space-y-4">
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                  <p className="text-sm font-bold text-indigo-900">Push to Delivery Ops?</p>
                  <p className="text-[10px] text-indigo-600/70 font-black uppercase mt-1">This will make the order visible in the Delivery Portal.</p>
                </div>
                <Button 
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-indigo-100"
                  onClick={() => handleSendToDelivery(selectedOrder.id)}
                >
                  <Send className="w-4 h-4 mr-2" /> Send to Delivery Portal
                </Button>
              </div>
            )}

            {['Pending', 'Dispatched'].includes(selectedOrder?.status || '') && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Direct Dispatch (Admin)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Courier</Label>
                    <select 
                      value={shipData.courier}
                      onChange={e => setShipData({...shipData, courier: e.target.value})}
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs font-bold outline-none"
                    >
                      <option value="Delhivery">Delhivery</option>
                      <option value="Shiprocket">Shiprocket</option>
                      <option value="BlueDart">BlueDart</option>
                      <option value="Self Delivery">Self Delivery</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tracking ID</Label>
                    <Input 
                      placeholder="Number" 
                      value={shipData.trackingId}
                      onChange={e => setShipData({...shipData, trackingId: e.target.value})}
                      className="h-11 bg-slate-50 border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>
                <Button 
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-emerald-100"
                  onClick={() => selectedOrder && handleDispatch(selectedOrder.id)}
                >
                  Confirm Shipment
                </Button>
              </div>
            )}

            <Button 
              variant="ghost" 
              className="w-full text-[10px] font-black uppercase tracking-widest text-slate-400 h-10"
              onClick={() => setIsUpdateOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLeadDialogOpen && (
        <LeadDetailDialog 
          open={isLeadDialogOpen}
          onOpenChange={setIsLeadDialogOpen}
          leadId={selectedOrder?.leadId || null}
        />
      )}
    </div>
  );
}
