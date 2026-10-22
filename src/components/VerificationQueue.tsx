
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  ShieldCheck, 
  CheckCircle,
  XCircle,
  Loader2,
  MapPin,
  Phone,
  ChevronRight,
  Filter,
  MoreHorizontal
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
import { Lead, InventoryItem } from '@/src/types';
import { dataService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';
import { toast } from 'sonner';
import { LeadDetailDialog } from './LeadDetailDialog';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export function VerificationQueue() {
  const [searchTerm, setSearchTerm] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { user: currentUser } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.id) return;

    const unsub = dataService.subscribeLeads(currentUser, (data) => {
      // Filter ONLY pending verification leads
      const pending = data.filter(l => l.status === 'Pending Verification' && !l.isArchived);
      setLeads(pending.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser?.id]);

  const handleVerify = async (lead: Lead) => {
    try {
      setProcessingId(lead.id);
      await dataService.handleOrderConfirmation(currentUser?.orgId || 'root-admin', lead);
      toast.success(`Verification Success: Order confirmed for ${lead.name}`);
    } catch (e) {
      toast.error('Verification failed');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (leadId: string) => {
    if (confirm('Are you sure you want to reject this verification request? Status will revert to Interested.')) {
      try {
        setProcessingId(leadId);
        await dataService.updateLead(currentUser?.orgId || 'root-admin', leadId, { status: 'Interested' });
        toast.info('Verification rejected. Lead returned to Interested state.');
      } catch (e) {
        toast.error('Operation failed');
      } finally {
        setProcessingId(null);
      }
    }
  };

  const filteredLeads = leads.filter(lead => 
    lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.phone.includes(searchTerm) ||
    lead.serialId?.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Verification Queue</h1>
            <Badge className="bg-amber-100 text-amber-700 border-none font-black text-[9px] uppercase tracking-widest px-2.5">
              Verification Required
            </Badge>
          </div>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-tight">Review and verify orders submitted by agents before fulfillment.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
          <Input 
            placeholder="Search pending verifications..." 
            className="pl-10 border-slate-200 bg-white h-11 text-xs font-bold focus:ring-emerald-500/10 focus:border-emerald-500/50 rounded-xl neo-shadow transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex-1" />
        <div className="p-3 bg-white border border-slate-100 neo-shadow rounded-xl flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-500" />
          <span className="text-xs font-black uppercase text-slate-500">Pending: <span className="text-amber-600 font-mono text-sm ml-1">{leads.length}</span></span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl overflow-hidden neo-shadow">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-32 gap-4">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading verification tasks...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-32 text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-emerald-300" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-black text-slate-900 uppercase tracking-tight">Queue is Clear</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Great job! All submitted orders have been verified.</p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="h-14 hover:bg-transparent border-b-slate-100">
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-6">Order Details</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Commercials</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Submitted By</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Location</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow 
                  key={lead.id} 
                  className="group h-20 transition-all cursor-pointer border-b-slate-50 hover:bg-slate-50/40"
                  onClick={() => {
                    setSelectedLead(lead);
                    setIsDetailOpen(true);
                  }}
                >
                  <TableCell className="px-6">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-slate-400 font-mono">#{lead.serialId}</span>
                        <span className="text-sm font-black text-slate-900 group-hover:text-amber-600 transition-colors uppercase">{lead.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 font-bold">{lead.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 w-fit px-1.5 py-0.5 rounded mb-1">
                        {lead.product}
                      </span>
                      <span className="text-sm font-black text-slate-900 font-mono">₹{lead.value.toLocaleString()} ({lead.quantity}U)</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-700 uppercase">{lead.assignedTo}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Agent Partner</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-700 uppercase">{lead.city || 'UNDEFINED'}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{lead.pincode}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-3">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleReject(lead.id)}
                        disabled={processingId === lead.id}
                        className="h-10 px-4 text-red-500 hover:bg-red-50 hover:text-red-600 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all"
                      >
                        <XCircle className="w-4 h-4 mr-2" /> Reject
                      </Button>
                      <Button 
                        onClick={() => handleVerify(lead)}
                        disabled={processingId === lead.id}
                        className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-emerald-200 transition-all"
                      >
                        {processingId === lead.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" /> Verify & Confirm
                          </>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <LeadDetailDialog 
        leadId={selectedLead?.id || null} 
        open={isDetailOpen} 
        onOpenChange={setIsDetailOpen} 
      />
    </div>
  );
}
