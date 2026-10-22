
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal,
  Mail,
  Phone,
  Calendar,
  UserPlus,
  Loader2,
  ChevronDown,
  ChevronRight,
  MapPin,
  CheckCircle,
  Clock,
  FileSpreadsheet,
  TrendingUp,
  Trash2
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Lead, LeadStatus, User, Order, InventoryItem } from '@/src/types';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { dataService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { LeadAddDialog } from './LeadAddDialog';
import { LeadDetailDialog } from './LeadDetailDialog';
import { LeadImportDialog } from './LeadImportDialog';
import { motion, AnimatePresence } from 'motion/react';

const statusColors: Record<LeadStatus, string> = {
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

export function LeadManager() {
  const [searchTerm, setSearchTerm] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editableLead, setEditableLead] = useState<Lead | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [team, setTeam] = useState<User[]>([]);
  const { user: currentUser } = useAuth();
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [customerHistory, setCustomerHistory] = useState<{ leads: Lead[], orders: Order[] }>({ leads: [], orders: [] });
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [statusOpen, setStatusOpen] = useState(false);
  const [callbackDialogOpen, setCallbackDialogOpen] = useState(false);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [tempCallbackTime, setTempCallbackTime] = useState('');
  const [targetLeadId, setTargetLeadId] = useState<string | null>(null);

  // Filter states
  const [filters, setFilters] = useState({
    status: 'All',
    source: 'All',
    product: 'All',
    salesRep: 'All',
    dateRange: 'All'
  });

  useEffect(() => {
    if (!currentUser?.id) return;

    const unsub = dataService.subscribeLeads(currentUser, (data) => {
      // Sort manually since we removed it from some queries to avoid index issues
      const sorted = [...data].sort((a, b) => {
        // First prioritize "New Lead" status
        if (a.status === 'New Lead' && b.status !== 'New Lead') return -1;
        if (a.status !== 'New Lead' && b.status === 'New Lead') return 1;
        
        // Then sort by createdAt DESC
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setLeads(sorted);
      setLoading(false);
    });

    dataService.getInventoryList(currentUser.orgId || '').then(setInventory);

    // Also fetch team for assignment
    let teamUnsub = () => {};
    teamUnsub = dataService.subscribeUsersPresence(currentUser, (data) => {
      setTeam(data);
    });

    return () => {
      unsub();
      teamUnsub();
    };
  }, [currentUser?.id, currentUser?.orgId, currentUser?.role]);

  useEffect(() => {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
    if (selectedLead && isDetailOpen && (currentUser?.orgId || isSuperAdmin)) {
      setEditableLead({ ...selectedLead });
      setHasChanges(false);
      
      // Fetch customer history
      dataService.getCustomerHistory(currentUser?.orgId || 'root-admin', selectedLead.phone, selectedLead.email)
        .then(setCustomerHistory);
    } else {
      setEditableLead(null);
      setHasChanges(false);
      setCustomerHistory({ leads: [], orders: [] });
    }
  }, [selectedLead, isDetailOpen, currentUser?.orgId]);

  const handleUpdateStatus = async (leadId: string, status: LeadStatus, extras: Partial<Lead> = {}) => {
    if (status === 'Call Back' && !extras.callbackTime) {
      setTargetLeadId(leadId);
      setTempCallbackTime('');
      setCallbackDialogOpen(true);
      return;
    }

    try {
      const currentLead = leads.find(l => l.id === leadId);
      const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
      if (!currentLead || (!currentUser?.orgId && !isSuperAdmin)) return;

      await dataService.updateLead(currentUser?.orgId || 'root-admin', leadId, { status, ...extras });
      
      toast.success(`Status updated to ${status}`);
      
      // Update local states if needed
      if (editableLead && editableLead.id === leadId) {
        setEditableLead(prev => prev ? { ...prev, status, ...extras } : null);
      }
    } catch (e) {
      console.error("Status update error:", e);
      toast.error('Failed to update status');
    }
  };

  const submitCallback = () => {
    if (!tempCallbackTime || !targetLeadId) return;
    handleUpdateStatus(targetLeadId, 'Call Back', { callbackTime: tempCallbackTime });
    setCallbackDialogOpen(false);
    setTargetLeadId(null);
  };

  const handleAssign = async (leadId: string, agent: User) => {
    try {
      const currentLead = leads.find(l => l.id === leadId);
      const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
      if (!currentUser?.orgId && !isSuperAdmin) return;

      await dataService.updateLead(currentUser?.orgId || 'root-admin', leadId, { 
        assignedTo: agent.name, 
        assignedToId: agent.id 
      });

      // Log history
      if (currentUser && currentLead) {
        await dataService.addLeadHistory(currentUser?.orgId || 'root-admin', leadId, {
          type: 'assignment',
          from: currentLead.assignedTo || 'Unassigned',
          to: agent.name,
          updatedBy: currentUser.name,
          updatedById: currentUser.id
        });
      }

      toast.success(`Assigned to ${agent.name}`);
      
      // Send notification to the assigned agent
      await dataService.addNotification(
        currentUser?.orgId || 'root-admin',
        agent.id,
        'New Lead Assigned',
        `Lead ${currentLead?.name} (#${currentLead?.serialId}) has been assigned to you.`,
        'info'
      );

      // Update editable lead
      if (editableLead && editableLead.id === leadId) {
        setEditableLead(prev => prev ? { ...prev, assignedTo: agent.name, assignedToId: agent.id } : null);
      }
    } catch (e) {
      toast.error('Assignment failed');
    }
  };

  const handleSaveChanges = async () => {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
    if (!editableLead || !selectedLead || (!currentUser?.orgId && !isSuperAdmin)) return;
    
    try {
      setLoading(true);
      const { id, history, ...updates } = editableLead;
      await dataService.updateLead(currentUser?.orgId || 'root-admin', id, updates);
      
      // Log some major changes in history if needed
      if (currentUser) {
        await dataService.addLeadHistory(currentUser?.orgId || 'root-admin', id, {
          type: 'other',
          updatedBy: currentUser.name,
          updatedById: currentUser.id,
          note: 'Manually updated lead details (Name/Contact/Product/Address)'
        });
      }
      
      setHasChanges(false);
      toast.success('Lead details saved successfully');
    } catch (e) {
      toast.error('Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLead = async (formData: any) => {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email?.toLowerCase() === 'tzsupportayurveda@gmail.com';
    const isAdmin = ['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '') || isSuperAdmin;
    
    if (!currentUser || (!currentUser.orgId && !isSuperAdmin)) {
      toast.error("Organization ID missing. Kripya admin se sampark karein.");
      return;
    }
    
    try {
      // Ensure agents don't skip verification even if they try to bypass UI
      let finalStatus = formData.status;
      if (finalStatus === 'Order Confirmed' && !isAdmin) {
        finalStatus = 'Pending Verification';
      }

      await dataService.addLead(currentUser.orgId || 'root-admin', {
        ...formData,
        status: finalStatus,
        assignedTo: formData.assignedTo || currentUser.name,
        assignedToId: formData.assignedToId || currentUser.id,
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const handleCreateOrder = async (lead: Lead) => {
    try {
      const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
      if (!currentUser || (!currentUser.orgId && !isSuperAdmin)) return;
      setLoading(true);
      
      await dataService.handleOrderConfirmation(currentUser?.orgId || 'root-admin', lead);
      
      toast.success(`Order created and stock adjusted successfully!`);
      setIsDetailOpen(false);
    } catch (e) {
      toast.error('Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this lead?')) {
      try {
        const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
        if (!currentUser?.orgId && !isSuperAdmin) return;
        await dataService.deleteLead(currentUser?.orgId || 'root-admin', id);
        toast.success('Lead deleted');
      } catch (e) {
        toast.error('Delete failed');
      }
    }
  };
  
  const handleBulkUpdate = async (status?: LeadStatus, agentId?: string, agentName?: string, isArchived?: boolean) => {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
    
    if (selectedLeads.length === 0) {
      toast.error('Pehle leads select karein (Please select leads first)');
      return;
    }

    if (!currentUser?.orgId && !isSuperAdmin) {
      toast.error('Galti: Organization ID missing (Permission Denied)');
      return;
    }
    
    try {
      setLoading(true);
      const updates: Partial<Lead> = {};
      if (status) updates.status = status;
      if (agentId) {
        updates.assignedToId = agentId;
        updates.assignedTo = agentName || '';
      }
      if (isArchived !== undefined) {
        updates.isArchived = isArchived;
        // When moving to bin, unassign the lead so agents don't see it
        if (isArchived) {
          updates.assignedToId = 'unassigned';
          updates.assignedTo = 'Unassigned';
        }
      }
      
      await dataService.bulkUpdateLeads(currentUser?.orgId || 'root-admin', selectedLeads, updates);
      
      toast.success(`${selectedLeads.length} leads successfully ${isArchived ? 'bin mein move' : 'update'} ho gayi hain`);
      setSelectedLeads([]);
    } catch (e) {
      console.error('Bulk update error:', e);
      toast.error('Update fail ho gaya');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
    if (selectedLeads.length === 0 || (!currentUser?.orgId && !isSuperAdmin)) return;
    if (confirm(`Are you sure you want to delete ${selectedLeads.length} leads? This cannot be undone.`)) {
      try {
        setLoading(true);
        await dataService.bulkDeleteLeads(currentUser?.orgId || 'root-admin', selectedLeads);
        toast.success(`Bulk deleted ${selectedLeads.length} leads`);
        setSelectedLeads([]);
      } catch (e) {
        toast.error('Bulk delete failed');
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredLeads = leads.filter(lead => {
    // 0. Bin Filter (Critical: Hide archived from main view, show ONLY archived in Bin)
    if (showArchived) {
      if (!lead.isArchived) return false;
    } else {
      if (lead.isArchived) return false;
    }

    // 1. Role & Access Filter
    const isSpecialist = ['Admin', 'Manager', 'Marketer', 'SuperAdmin', 'Inventory', 'Delivery'].includes(currentUser?.role || '') || currentUser?.email?.toLowerCase() === 'tzsupportayurveda@gmail.com';
    const isAgent = currentUser?.role === 'Sales' || currentUser?.role === 'Agent';
    const isOwner = lead.assignedToId === currentUser?.id;
    const isUnassigned = !lead.assignedToId || lead.assignedToId === 'unassigned' || lead.assignedToId === 'CRM User' || lead.assignedToId === 'CRM user' || lead.assignedToId === '';
    
    // If it's archived, only Admin/Manager should see it in the bin
    if (showArchived && !isSpecialist) return false;
    
    // Specialist sees everything in the org.
    // Agents see assigned leads, unassigned leads, or new leads.
    if (isAgent) {
      if (!isOwner && lead.status !== 'New Lead' && !isUnassigned) return false;
    } else if (!isSpecialist && !isOwner && !isUnassigned) {
      // Other roles (if any) see assigned/unassigned
      return false;
    }

    // 2. Search Filter
    const matchesSearch = 
      (lead.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (lead.email?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (lead.phone || "").includes(searchTerm);
    if (!matchesSearch) return false;

    // 3. Status Filter
    if (filters.status !== 'All' && lead.status !== filters.status) return false;

    // 4. Source Filter
    if (filters.source !== 'All' && lead.source !== filters.source) return false;

    // 5. Product Filter
    if (filters.product !== 'All' && lead.product !== filters.product) return false;

    // 6. Sales Rep Filter
    if (filters.salesRep !== 'All' && lead.assignedToId !== filters.salesRep) return false;

    // 7. Date Range (Simple implementation: Today/Yesterday/7 Days)
    if (filters.dateRange !== 'All') {
      const leadDate = new Date(lead.createdAt);
      const now = new Date();
      if (filters.dateRange === 'Today') {
        if (leadDate.toDateString() !== now.toDateString()) return false;
      } else if (filters.dateRange === 'Yesterday') {
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        if (leadDate.toDateString() !== yesterday.toDateString()) return false;
      } else if (filters.dateRange === '7 Days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        if (leadDate < sevenDaysAgo) return false;
      }
    }

    return true;
  });

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Status Summary Calculations
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => {
      // Only count if not archived (unless viewing archived)
      if (showArchived && !l.isArchived) return;
      if (!showArchived && l.isArchived) return;
      
      const status = l.status || 'Unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [leads, showArchived]);

  const handleSelectAllOnPage = (checked: boolean) => {
    const pageIds = paginatedLeads.map(l => l.id);
    if (checked) {
      setSelectedLeads(prev => Array.from(new Set([...prev, ...pageIds])));
    } else {
      setSelectedLeads(prev => prev.filter(id => !pageIds.includes(id)));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Lead Registry</h1>
            <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[9px] uppercase tracking-widest px-2.5">
              Live Pipeline
            </Badge>
          </div>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-tight">Active sales funnel and customer acquisition records.</p>
        </div>
        
        <div className="flex gap-2">
          {['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '') && (
            <Button 
              variant="outline"
              onClick={() => setIsImportDialogOpen(true)} 
              className="neo-shadow border-slate-200 text-slate-600 hover:bg-slate-50 gap-2 font-black uppercase text-[10px] tracking-widest h-10 px-4"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Bulk Import
            </Button>
          )}
          <Button onClick={() => setIsDialogOpen(true)} className="neo-shadow bg-slate-900 hover:bg-black text-white gap-2 font-black uppercase text-[10px] tracking-widest h-10 px-4">
            <Plus className="w-4 h-4" /> Register New
          </Button>
          {['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '') && (
            <Button 
              variant="ghost"
              onClick={() => setShowArchived(!showArchived)} 
              className={cn(
                "p-2 font-black transition-all rounded-xl",
                showArchived ? "bg-red-50 text-red-600" : "text-slate-400 hover:bg-slate-100"
              )}
              title={showArchived ? 'Main View' : 'Audit Bin'}
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Status Buckets */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'New Leads', status: 'New Lead', icon: UserPlus, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'No Answer', status: 'No Answer', icon: Phone, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
          { label: 'Call Back', status: 'Call Back', icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
          { label: 'Interested', status: 'Interested', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Pending', status: 'Pending Verification', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'Confirmed', status: 'Order Confirmed', icon: CheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-600/10', border: 'border-emerald-200' },
        ].map((bucket) => (
          <div 
            key={bucket.status}
            onClick={() => setFilters({ ...filters, status: bucket.status })}
            className={cn(
              "p-4 rounded-2xl border transition-all cursor-pointer neo-shadow group hover:scale-[1.02]",
              filters.status === bucket.status ? cn(bucket.bg, bucket.border, "ring-2 ring-emerald-500/20") : "bg-white border-slate-100 hover:border-slate-200"
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div className={cn("p-2 rounded-xl", bucket.bg)}>
                <bucket.icon className={cn("w-4 h-4", bucket.color)} />
              </div>
              <span className={cn("text-2xl font-black font-mono", bucket.color)}>
                {statusCounts[bucket.status] || 0}
              </span>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{bucket.label}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Active Funnel</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
          <Input 
            placeholder="Search leads by name, phone or email..." 
            className="pl-10 border-slate-200 bg-white h-11 text-xs font-bold focus:ring-emerald-500/10 focus:border-emerald-500/50 rounded-xl neo-shadow transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <select 
            value={filters.status}
            onChange={e => setFilters({...filters, status: e.target.value})}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 neo-shadow"
          >
            <option value="All">ST: ALL RECORDS</option>
            {Object.keys(statusColors).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>

          <select 
            value={filters.product}
            onChange={e => setFilters({...filters, product: e.target.value})}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 neo-shadow"
          >
            <option value="All">INV: ALL ITEMS</option>
            {inventory.map(item => (
              <option key={item.id} value={item.name}>{item.name.toUpperCase()}</option>
            ))}
          </select>

          <select 
            value={filters.salesRep}
            onChange={e => setFilters({...filters, salesRep: e.target.value})}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 neo-shadow"
          >
            <option value="All">REP: ALL AGENTS</option>
            {team.map(member => (
              <option key={member.id} value={member.id}>{member.name.toUpperCase()}</option>
            ))}
          </select>

          <select 
            value={filters.dateRange}
            onChange={e => setFilters({...filters, dateRange: e.target.value})}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 neo-shadow"
          >
            <option value="All">PERIOD: LIFETIME</option>
            <option value="Today">PERIOD: TODAY</option>
            <option value="Yesterday">PERIOD: YESTERDAY</option>
            <option value="7 Days">PERIOD: 7 DAYS</option>
          </select>

          <Button 
            variant="ghost" 
            size="sm" 
            className="h-11 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500"
            onClick={() => setFilters({ status: 'All', source: 'All', product: 'All', salesRep: 'All', dateRange: 'All' })}
          >
            Clear Filters
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/20 overflow-hidden neo-shadow">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-32 gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing database records...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-32 text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center">
              <Users className="w-8 h-8 text-slate-200" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-black text-slate-900 uppercase tracking-tight">Zero matching entries</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-loose">Refine parameters or initiate manual registration.</p>
            </div>
            <Button variant="outline" className="h-10 rounded-xl px-6 font-black uppercase text-[10px] tracking-widest" onClick={() => setSearchTerm('')}>Reset Database Search</Button>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="h-14 hover:bg-transparent border-b-slate-100">
                <TableHead className="w-14 px-6">
                  <input 
                    type="checkbox" 
                    className="rounded-md border-slate-300 w-4 h-4 cursor-pointer accent-emerald-600 transition-all"
                    checked={paginatedLeads.length > 0 && paginatedLeads.every(l => selectedLeads.includes(l.id))}
                    onChange={(e) => handleSelectAllOnPage(e.target.checked)}
                  />
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Entity Details</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Validation State</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Commercial Data</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Ownership</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4 text-right">Registered</TableHead>
                <TableHead className="w-14 px-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLeads.map((lead) => (
                <TableRow 
                  key={lead.id} 
                  className={cn(
                    "group h-16 transition-all duration-200 cursor-pointer border-b-slate-50",
                    selectedLeads.includes(lead.id) ? "bg-emerald-50/20" : "hover:bg-slate-50/40"
                  )}
                  onClick={() => {
                    setSelectedLead(lead);
                    setIsDetailOpen(true);
                  }}
                >
                  <TableCell className="px-6" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      className="rounded-md border-slate-300 w-4 h-4 accent-emerald-600 cursor-pointer"
                      checked={selectedLeads.includes(lead.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedLeads([...selectedLeads, lead.id]);
                        else setSelectedLeads(selectedLeads.filter(id => id !== lead.id));
                      }}
                    />
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-slate-400 font-mono">#{lead.serialId}</span>
                        <span className="text-sm font-black text-slate-900 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{lead.name}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                        <span className="flex items-center gap-1 font-mono text-slate-500"><Phone className="w-2.5 h-2.5" /> {lead.phone}</span>
                        <span className="opacity-20">|</span>
                        <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {lead.city || 'UNDEFINED'}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex flex-col gap-1.5">
                      <Badge variant="outline" className={cn(
                        "text-[9px] font-black uppercase tracking-widest h-6 px-2.5 border-2 w-fit rounded-lg shadow-sm transition-transform group-hover:scale-105",
                        statusColors[lead.status]
                      )}>
                        {lead.status}
                      </Badge>
                      {lead.status === 'Call Back' && lead.callbackTime && (
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 uppercase tracking-widest ml-1">
                          <div className="w-1 h-1 bg-indigo-500 rounded-full animate-ping" />
                          <Calendar className="w-2 h-2" />
                          {(() => {
                            try {
                              return new Date(lead.callbackTime).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                            } catch (e) {
                              return 'ERR_TIMESTAMP';
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 w-fit px-1.5 py-0.5 rounded mb-1">
                          {lead.product || 'NO PRODUCT'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 leading-none font-mono">₹{lead.value.toLocaleString()}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">
                            {lead.paymentMode} • {lead.quantity}U
                          </span>
                        </div>
                      </div>
                      <a 
                        href={`tel:${lead.phone}`} 
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all transform hover:scale-110"
                        title="Initiate Dial"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-slate-900 flex items-center justify-center text-[10px] font-black text-white uppercase shadow-lg shadow-slate-900/10 ring-2 ring-slate-100">
                        {(lead.assignedTo || 'U')[0]}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{lead.assignedTo || 'UNASSIGNED'}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AGENT OPS</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black text-slate-900 font-mono">
                        {new Date(lead.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">UTM_ENTRY</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-xl hover:bg-slate-100 transition-all cursor-pointer outline-none border border-transparent hover:border-slate-200">
                        <MoreHorizontal className="w-4 h-4 text-slate-400" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-2xl border-slate-100 z-[100]">
                        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Lifecycle Management</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-slate-50" />
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                           {Object.keys(statusColors).map(s => (
                             <DropdownMenuItem key={s} onSelect={() => handleUpdateStatus(lead.id, s as LeadStatus)} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-600 gap-2">
                               <div className={cn("w-2 h-2 rounded-full", statusColors[s as LeadStatus].split(' ')[0].replace('bg-', 'bg-'))} />
                               {s}
                             </DropdownMenuItem>
                           ))}
                        </div>
                        {['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '') && (
                          <>
                            <DropdownMenuSeparator className="bg-slate-50" />
                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Transfer Ownership</DropdownMenuLabel>
                            <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                              {team.filter(t => t.id !== lead.assignedToId).map(agent => (
                                <DropdownMenuItem key={agent.id} onSelect={() => handleAssign(lead.id, agent)} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-600 gap-3">
                                  <div className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] font-black">{agent.name[0]}</div>
                                  {agent.name}
                                </DropdownMenuItem>
                              ))}
                            </div>
                          </>
                        )}
                        <DropdownMenuSeparator className="bg-slate-50" />
                        <DropdownMenuItem onSelect={() => handleDelete(lead.id)} className="rounded-xl px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-600 gap-2">
                          <Trash2 className="w-4 h-4" /> Purge Record
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination Controls */}
        {filteredLeads.length > itemsPerPage && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredLeads.length)} of {filteredLeads.length} Leads
            </p>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="h-8 text-[10px] font-black uppercase tracking-widest border-slate-200"
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = currentPage;
                  if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  
                  if (pageNum < 1 || pageNum > totalPages) return null;

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "h-8 w-8 p-0 text-[10px] font-black",
                        currentPage === pageNum ? "bg-emerald-600 hover:bg-emerald-700" : "border-slate-200"
                      )}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="h-8 text-[10px] font-black uppercase tracking-widest border-slate-200"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bulk Actions Bar */}
      <AnimatePresence>
        {selectedLeads.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-full shadow-2xl z-[100] flex items-center gap-8 border border-white/10 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 pr-8 border-r border-white/10">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-black">
                {selectedLeads.length}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">Leads Selected</span>
            </div>

            <div className="flex items-center gap-3">
              {['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '') && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsBulkAssignOpen(true)}
                  className="h-9 px-4 hover:bg-white/10 text-white gap-2 text-[10px] font-black uppercase tracking-widest outline-none"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Assign To
                </Button>
              )}

              {['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '') && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleBulkUpdate(undefined, undefined, undefined, !showArchived)}
                  className="h-9 px-4 hover:bg-white/10 text-emerald-400 hover:text-white gap-2 text-[10px] font-black uppercase tracking-widest outline-none transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {showArchived ? 'Restore' : 'Move to Bin'}
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger 
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "h-9 px-4 hover:bg-white/10 text-white gap-2 text-[10px] font-black uppercase tracking-widest outline-none"
                  )}
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Status
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="center" className="w-48 p-1 bg-white z-[9999] mb-2 shadow-2xl border border-slate-200">
                  {['Call Back', 'No Answer', 'Interested', 'Not Interested', 'Fake/Spam', 'Duplicate', 'Wrong Number', 'Unavailable'].map(s => (
                    <DropdownMenuItem 
                      key={s} 
                      onSelect={() => handleBulkUpdate(s as LeadStatus)}
                      className="cursor-pointer text-slate-900 font-medium hover:bg-slate-50"
                    >
                      {s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager' || currentUser?.role === 'SuperAdmin') && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleBulkDelete}
                  className="h-9 px-4 hover:bg-red-500 text-red-400 hover:text-white gap-2 text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              )}

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedLeads([])}
                className="h-9 px-4 hover:bg-white/10 text-white/50 hover:text-white text-[10px] font-black uppercase tracking-widest"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    <LeadDetailDialog 
      leadId={selectedLead?.id || null} 
      open={isDetailOpen} 
      onOpenChange={setIsDetailOpen} 
      onDelete={handleDelete}
    />

    <LeadAddDialog
      open={isDialogOpen}
      onOpenChange={setIsDialogOpen}
      onAdd={handleAddLead}
    />

    <LeadImportDialog
      open={isImportDialogOpen}
      onOpenChange={setIsImportDialogOpen}
    />

    {/* Callback Scheduler Dialog */}
    <Dialog open={callbackDialogOpen} onOpenChange={setCallbackDialogOpen}>
      <DialogContent className="sm:max-w-[400px] rounded-2xl bg-white border-none shadow-2xl p-6 z-[120]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-800 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-purple-600" /> Schedule Call Back
          </DialogTitle>
        </DialogHeader>
        <div className="py-6 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Date & Time</label>
            <Input 
              type="datetime-local" 
              className="h-12 rounded-xl border-slate-200 font-bold focus:ring-purple-500/20"
              value={tempCallbackTime}
              onChange={(e) => setTempCallbackTime(e.target.value)}
            />
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
            A task will be automatically created and you'll be reminded to call this customer at the scheduled time.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="ghost" className="h-10 text-xs font-bold uppercase tracking-widest text-slate-400" onClick={() => setCallbackDialogOpen(false)}>Cancel</Button>
          <Button 
            className="bg-purple-600 hover:bg-purple-700 h-10 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-500/20 px-8" 
            onClick={submitCallback}
            disabled={!tempCallbackTime}
          >
            Schedule Callback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Bulk Assign Dialog */}
    <Dialog open={isBulkAssignOpen} onOpenChange={setIsBulkAssignOpen}>
      <DialogContent className="sm:max-w-[400px] bg-white z-[9999] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-500" /> Bulk Assignment
          </h3>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Assigning {selectedLeads.length} leads</p>
        </div>
        <div className="max-h-[400px] overflow-y-auto p-4 space-y-2">
          {team.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 uppercase font-bold">No active team members available</div>
          ) : (
            team.filter(t => t.status === 'active' && t.role !== 'Marketer').map(member => (
              <button
                key={member.id}
                onClick={async () => {
                  try {
                    await handleBulkUpdate(undefined, member.id, member.name);
                    setIsBulkAssignOpen(false);
                  } catch (e) {
                    console.error("Bulk update inside dialog failed", e);
                  }
                }}
                className="w-full flex items-center justify-between p-3 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-100 rounded-xl transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ring-2 ring-white",
                    member.role === 'SuperAdmin' ? 'bg-amber-500' : member.role === 'Admin' ? 'bg-purple-500' : member.role === 'Manager' ? 'bg-blue-500' : 'bg-emerald-500'
                  )}>
                    {member.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{member.name}</p>
                    <p className="text-[10px] font-black uppercase tracking-tight text-slate-400">{member.role}</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-4 h-4 text-emerald-500" />
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  </div>
  );
}
