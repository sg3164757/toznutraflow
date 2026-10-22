
import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Truck, 
  MapPin, 
  Phone, 
  Clock, 
  ChevronRight,
  Clipboard,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  User as UserIcon,
  Tag
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Order, HistoryItem } from '@/src/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface OrderDetailDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewLead?: (leadId: string) => void;
}

export function OrderDetailDialog({ order, open, onOpenChange, onViewLead }: OrderDetailDialogProps) {
  if (!order) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-slate-900 p-8 text-white relative">
          <div className="absolute top-6 right-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onOpenChange(false)}
              className="text-white/40 hover:text-white hover:bg-white/10 rounded-full h-8 w-8 p-0"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Order Fulfillment Details</h4>
            <div className="flex items-center gap-4 mt-2">
              <h2 className="text-3xl font-black tracking-tight self-center">#{order.orderSerial || order.id.substring(0, 8).toUpperCase()}</h2>
              <button 
                onClick={() => copyToClipboard(order.orderSerial || order.id, "ID")}
                className="p-1.5 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                title="Copy ID"
              >
                <Clipboard className="w-4 h-4 text-indigo-300" />
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-6 text-xs font-bold text-white/50">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Ordered on {format(new Date(order.createdAt), 'MMM dd, h:mm a')}
            </div>
            <div className="w-1 h-1 rounded-full bg-white/20" />
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5" /> ₹{order.total.toLocaleString()} Paid via {order.paymentMode || 'COD'}
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar bg-white">
          {/* Customer Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <UserIcon className="w-3 h-3 text-indigo-500" /> Customer Information
              </h3>
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-black text-slate-900">{order.customerName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Contact</span>
                    <a href={`tel:${order.phone}`} className="text-sm font-black text-slate-900 hover:text-indigo-600 underline decoration-indigo-200 underline-offset-4 tracking-tight">
                      +91 {order.phone}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <MapPin className="w-3 h-3 text-rose-500" /> Delivery Address
              </h3>
              <div className="p-5 bg-rose-50/30 rounded-2xl border border-rose-100/50 space-y-3 relative group">
                <button 
                  onClick={() => copyToClipboard(order.address || '', "Address")}
                  className="absolute top-4 right-4 p-2 bg-white rounded-xl shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Clipboard className="w-3.5 h-3.5 text-rose-400" />
                </button>
                <p className="text-sm font-bold text-slate-800 leading-relaxed pr-8">
                  {order.address}
                </p>
                <div className="pt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-white border-rose-100 text-rose-600 font-bold px-3">{order.city || 'N/A'}</Badge>
                  <Badge variant="outline" className="bg-white border-rose-100 text-rose-600 font-bold px-3">{order.state || 'N/A'}</Badge>
                  <Badge variant="outline" className="bg-white border-rose-100 text-rose-600 font-bold px-3">{order.pincode || 'N/A'}</Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Package className="w-3 h-3 text-emerald-500" /> Package Details
            </h3>
            <div className="p-5 border border-slate-100 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-base font-black text-slate-900 uppercase tracking-tight">{order.product || 'Unknown Product'}</p>
                  <p className="text-xs font-bold text-slate-500">Quantity: {order.quantity || 1} unit(s)</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-slate-900 tracking-tight">₹{order.total.toLocaleString()}</p>
                <p className="text-[10px] font-black text-emerald-600 uppercase">Paid in Full</p>
              </div>
            </div>
          </div>

          {/* Shipping Section */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Truck className="w-3 h-3 text-indigo-500" /> Shipment Tracking
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block mb-1">Status</span>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full animate-pulse",
                    order.status === 'Delivered' ? "bg-emerald-500" : "bg-amber-500"
                  )} />
                  <span className="text-base font-black text-slate-900 capitalize">{order.status}</span>
                </div>
              </div>
              <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block mb-1">Carrier & Tracking</span>
                {order.trackingId ? (
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-base font-black text-slate-900 uppercase leading-none">{order.courier || 'General Courier'}</span>
                      <span className="text-xs font-bold text-slate-500 mt-1">{order.trackingId}</span>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(order.trackingId || '', "Tracking ID")}
                      className="p-2 bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-indigo-500"
                    >
                      <Clipboard className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-bold text-slate-400 italic">No tracking info added yet.</p>
                )}
              </div>
            </div>
            {order.deliveryNotes && (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" /> Agent Notes
                </p>
                <p className="text-sm font-medium text-amber-900 leading-relaxed italic">{order.deliveryNotes}</p>
              </div>
            )}
          </div>

          {/* History Section */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-3 h-3 text-slate-400" /> Order History
            </h3>
            <div className="space-y-3 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-px before:bg-slate-100">
              {(order.history || []).slice().reverse().map((event, idx) => (
                <div key={idx} className="relative pl-10">
                  <div className={cn(
                    "absolute left-2.5 top-1 w-3 h-3 rounded-full border-2 border-white ring-4 shadow-sm",
                    idx === 0 ? "bg-indigo-600 ring-indigo-50" : "bg-slate-300 ring-slate-50"
                  )} />
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-900 uppercase">{event.type || 'Update'}</span>
                      <span className="text-[10px] font-bold text-slate-400">{format(new Date(event.timestamp), 'MMM dd, h:mm a')}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-600 mt-1">{event.note || `Status changed to ${order.status}`}</p>
                    <p className="text-[9px] font-black text-slate-400 mt-1 uppercase tracking-tighter">By {event.updatedBy || 'System'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
          <Button 
            className="flex-1 h-14 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl shadow-slate-200"
            onClick={() => onOpenChange(false)}
          >
            Close Detail
          </Button>
          <a 
            href={`tel:${order.phone}`}
            className="flex items-center justify-center px-8 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl hover:bg-slate-50 transition-all font-black uppercase text-[10px] tracking-widest gap-2"
          >
            <Phone className="w-4 h-4" /> Call Customer
          </a>
          {order.leadId && (
            <Button 
              variant="outline"
              className="px-8 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl hover:bg-slate-50 transition-all font-black uppercase text-[10px] tracking-widest gap-2 h-14"
              onClick={() => {
                if (onViewLead && order.leadId) {
                  onViewLead(order.leadId);
                  onOpenChange(false);
                } else {
                  toast.info("Associated lead ID not found");
                }
              }}
            >
              <ExternalLink className="w-4 h-4" /> View Lead
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
