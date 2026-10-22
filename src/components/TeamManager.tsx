import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  UserPlus, 
  Mail, 
  Lock,
  MoreVertical,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  Copy,
  Sparkles,
  Key,
  AlertCircle,
  Check,
  Crown,
  Headphones,
  UserCheck
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { dataService } from '@/src/services/dataService';
import { User } from '@/src/types';
import { useAuth } from '@/src/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function TeamManager() {
  const { impersonate, isImpersonating, user: activeUser, adminUser, organization } = useAuth();
  const [team, setTeam] = useState<User[]>([]);
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  const [confirmedCounts, setConfirmedCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Add Member State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [memberRole, setMemberRole] = useState<'TeamLeader' | 'Sales'>('Sales');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email: string;
    password: string;
    role: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!activeUser) return;
    const isSuperAdmin = activeUser.role === 'SuperAdmin' || activeUser.email?.toLowerCase() === 'tzsupportayurveda@gmail.com';
    if (!activeUser.orgId && !isSuperAdmin) return;

    // 1. Live presence subscription
    const unsubPresence = dataService.subscribeUsersPresence(activeUser, (users) => {
      setTeam(users);
      setLoading(false);
    });

    // 2. Fetch leads to count assignments and confirmed orders
    const unsubLeads = dataService.subscribeLeads(activeUser, (leads) => {
      const counts: Record<string, number> = {};
      const confirmed: Record<string, number> = {};
      leads.forEach(lead => {
        if (lead.assignedToId) {
          counts[lead.assignedToId] = (counts[lead.assignedToId] || 0) + 1;
          if (lead.status === 'Order Confirmed' || lead.status === 'Dispatched' || lead.status === 'Delivered') {
            confirmed[lead.assignedToId] = (confirmed[lead.assignedToId] || 0) + 1;
          }
        }
      });
      setLeadCounts(counts);
      setConfirmedCounts(confirmed);
    });

    return () => {
      unsubPresence();
      unsubLeads();
    };
  }, [activeUser]);

  // Quota Math
  const maxSeats = organization?.maxSeats || 5;
  const managerCount = team.filter(m => m.role === 'Manager' || m.role === 'Admin').length;
  const tlCount = team.filter(m => m.role === 'TeamLeader').length;
  const salesCount = team.filter(m => m.role === 'Sales' || m.role === 'Agent').length;
  const totalUsed = team.length;
  const availableSeats = Math.max(0, maxSeats - totalUsed);

  const isManagerOrAdmin = activeUser?.role === 'Manager' || activeUser?.role === 'Admin' || activeUser?.role === 'SuperAdmin' || activeUser?.email?.toLowerCase() === 'tzsupportayurveda@gmail.com';

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let pwd = '';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setMemberPassword(pwd);
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser?.orgId) {
      toast.error("Organization ID missing. Please refresh.");
      return;
    }

    if (!memberName.trim() || !memberEmail.trim() || !memberPassword.trim()) {
      toast.error("Please fill in all member fields.");
      return;
    }

    if (totalUsed >= maxSeats) {
      toast.error(`5-Seat Trial limit reached (${totalUsed}/${maxSeats}).`);
      return;
    }

    if (memberRole === 'TeamLeader' && tlCount >= 1) {
      toast.error("Team Leader slot is already filled (1 max in trial).");
      return;
    }

    if (memberRole === 'Sales' && salesCount >= 3) {
      toast.error("All 3 Sales Agent slots are already filled in your trial.");
      return;
    }

    setIsSubmitting(true);
    try {
      await dataService.createTeamMember({
        orgId: activeUser.orgId,
        name: memberName,
        email: memberEmail.trim().toLowerCase(),
        password: memberPassword,
        role: memberRole
      });

      setCreatedCredentials({
        name: memberName,
        email: memberEmail.trim().toLowerCase(),
        password: memberPassword,
        role: memberRole === 'TeamLeader' ? 'Team Leader' : 'Sales Agent'
      });

      toast.success(`${memberName} ko ${memberRole === 'TeamLeader' ? 'Team Leader' : 'Sales Agent'} role ke sath add kar diya gaya hai!`);
      
      // Reset form
      setMemberName('');
      setMemberEmail('');
      setMemberPassword('');
    } catch (err: any) {
      console.error("Create member error:", err);
      toast.error(err.message || "Failed to create team member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = `TOZ Flow CRM Login Details:\n• Name: ${createdCredentials.name}\n• Role: ${createdCredentials.role}\n• Email/ID: ${createdCredentials.email}\n• Password: ${createdCredentials.password}\n• Login URL: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Credentials copied to clipboard! Share with agent.");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleToggleStatus = async (uid: string, currentStatus: string, orgId?: string) => {
    try {
      await dataService.toggleUserStatus(uid, currentStatus, orgId);
      toast.success(`User status updated to ${currentStatus === 'active' ? 'Pending' : 'Active'}`);
    } catch (error) {
      toast.error("Failed to update user status");
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (window.confirm("Are you sure you want to REJECT and PERMANENTLY DELETE this user? Their seat will be freed.")) {
      try {
        await dataService.deleteUser(uid);
        toast.success("User removed and trial seat freed successfully.");
      } catch (error) {
        toast.error("Failed to delete user");
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Human Resources</h1>
            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-[9px] uppercase tracking-widest px-2.5">
              5-Seat Trial System
            </Badge>
          </div>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-tight">
            Role hierarchy: 1 Manager • 1 Team Leader • 3 Sales Agents with private lead isolation.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {isImpersonating && (
            <Button 
              variant="destructive" 
              onClick={() => impersonate(null)}
              className="neo-shadow rounded-xl px-4 font-black uppercase text-[10px] tracking-widest bg-red-600 hover:bg-red-700 h-10"
            >
              Exit Impersonation
            </Button>
          )}

          {isManagerOrAdmin && (
            <Button 
              onClick={() => {
                setCreatedCredentials(null);
                generatePassword();
                setIsAddOpen(true);
              }}
              disabled={availableSeats <= 0}
              className={cn(
                "h-10 px-4 rounded-xl font-black text-xs uppercase tracking-wider gap-2 shadow-lg transition-all",
                availableSeats > 0 
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-95" 
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
            >
              <UserPlus className="w-4 h-4" />
              Add Team Member ({availableSeats} Left)
            </Button>
          )}
        </div>
      </div>

      {/* 5-Seat Quota Visual Monitor Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Total Trial Seats Card */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 neo-shadow group hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Trial Seat Quota</span>
            <span className={cn(
              "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
              availableSeats > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
            )}>
              {availableSeats > 0 ? `${availableSeats} Seats Available` : 'All Seats Full'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-mono tracking-tighter">{totalUsed}</span>
            <span className="text-sm font-bold text-slate-400 font-mono">/ {maxSeats}</span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                totalUsed >= maxSeats ? "bg-amber-500" : "bg-emerald-500"
              )}
              style={{ width: `${Math.min(100, (totalUsed / maxSeats) * 100)}%` }}
            />
          </div>
        </div>

        {/* Manager Slot Card */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 neo-shadow group hover:border-purple-200 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-purple-500" /> Manager (Owner)
            </span>
            <Badge className="bg-purple-50 text-purple-700 border-purple-200 font-black text-[9px]">1 Seat Max</Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-purple-700 font-mono tracking-tighter">{managerCount}</span>
            <span className="text-sm font-bold text-slate-400 font-mono">/ 1</span>
          </div>
          <p className="text-[10px] font-bold text-slate-500 mt-2">Full workspace authority & settings.</p>
        </div>

        {/* Team Leader Slot Card */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 neo-shadow group hover:border-amber-200 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" /> Team Leader
            </span>
            <Badge className={cn(
              "font-black text-[9px]",
              tlCount >= 1 ? "bg-amber-100 text-amber-800 border-none" : "bg-slate-100 text-slate-600 border-none"
            )}>
              {tlCount >= 1 ? '1 / 1 Filled' : '1 Seat Open'}
            </Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600 font-mono tracking-tighter">{tlCount}</span>
            <span className="text-sm font-bold text-slate-400 font-mono">/ 1</span>
          </div>
          <p className="text-[10px] font-bold text-slate-500 mt-2">Lead assignments, verification & audit.</p>
        </div>

        {/* Sales Agents Card */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 neo-shadow group hover:border-blue-200 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5 text-blue-500" /> Sales Agents
            </span>
            <Badge className={cn(
              "font-black text-[9px]",
              salesCount >= 3 ? "bg-blue-100 text-blue-800 border-none" : "bg-emerald-50 text-emerald-700 border-emerald-200"
            )}>
              {3 - salesCount > 0 ? `${3 - salesCount} Slots Left` : '3 / 3 Filled'}
            </Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-600 font-mono tracking-tighter">{salesCount}</span>
            <span className="text-sm font-bold text-slate-400 font-mono">/ 3</span>
          </div>
          <p className="text-[10px] font-bold text-slate-500 mt-2">Calling, lead follow-ups & order confirm.</p>
        </div>
      </div>

      {/* Team Roster Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/20 overflow-hidden neo-shadow min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-32 gap-4">
             <div className="relative">
              <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Personnel Database...</p>
          </div>
        ) : team.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No team members enrolled yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You have 5 seats available in your business trial. Add 1 Team Leader and up to 3 Sales Agents to begin operations.
            </p>
            {isManagerOrAdmin && (
              <Button 
                onClick={() => {
                  setCreatedCredentials(null);
                  generatePassword();
                  setIsAddOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase"
              >
                <UserPlus className="w-4 h-4 mr-2" /> Add First Team Member
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="h-14 hover:bg-transparent border-b-slate-100">
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-6">Staff Member</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Role & Clearance</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Assigned Leads</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Confirmed Orders</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Last Activity</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((member) => (
                <TableRow key={member.id} className="h-20 hover:bg-slate-50/30 group transition-all border-b-slate-50">
                  <TableCell className="px-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img 
                          src={member.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.id}`} 
                          alt="" 
                          className="w-12 h-12 rounded-xl border border-slate-200 shadow-sm transition-transform group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className={cn(
                          "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white",
                          member.isOnline ? "bg-emerald-500" : "bg-slate-300"
                        )} />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{member.name}</span>
                          {member.isOnline && (
                            <span className="text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-sm ring-1 ring-emerald-100">Online</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 font-medium">{member.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell className="px-4">
                    <div className="flex items-center gap-2">
                      {member.role === 'Manager' || member.role === 'Admin' ? (
                        <Badge className="bg-purple-100 text-purple-800 border border-purple-200 font-black text-[9px] uppercase tracking-wider px-2.5 py-1 flex items-center gap-1">
                          <Crown className="w-3 h-3 text-purple-600" /> Manager
                        </Badge>
                      ) : member.role === 'TeamLeader' ? (
                        <Badge className="bg-amber-100 text-amber-800 border border-amber-200 font-black text-[9px] uppercase tracking-wider px-2.5 py-1 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-amber-600" /> Team Leader
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-800 border border-blue-200 font-black text-[9px] uppercase tracking-wider px-2.5 py-1 flex items-center gap-1">
                          <Headphones className="w-3 h-3 text-blue-600" /> Sales Agent
                        </Badge>
                      )}

                      {isManagerOrAdmin && member.id !== adminUser?.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                            <ChevronDown className="w-3 h-3" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-44 p-2 rounded-xl shadow-xl">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-wider text-slate-400">Change Role</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={async () => {
                                if (salesCount >= 3 && member.role !== 'Sales' && member.role !== 'Agent') {
                                  toast.error("Sales Agent quota is full (3/3)");
                                  return;
                                }
                                await dataService.updateUserRole(member.id, 'Sales', activeUser?.orgId);
                                toast.success(`${member.name} is now Sales Agent`);
                              }}
                              className="text-xs font-bold"
                            >
                              <Headphones className="w-3.5 h-3.5 mr-2 text-blue-500" /> Sales Agent
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={async () => {
                                if (tlCount >= 1 && member.role !== 'TeamLeader') {
                                  toast.error("Team Leader slot is already occupied (1/1)");
                                  return;
                                }
                                await dataService.updateUserRole(member.id, 'TeamLeader', activeUser?.orgId);
                                toast.success(`${member.name} is now Team Leader`);
                              }}
                              className="text-xs font-bold"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 mr-2 text-amber-500" /> Team Leader
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={async () => {
                                await dataService.updateUserRole(member.id, 'Manager', activeUser?.orgId);
                                toast.success(`${member.name} is now Manager`);
                              }}
                              className="text-xs font-bold"
                            >
                              <Crown className="w-3.5 h-3.5 mr-2 text-purple-500" /> Manager
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="px-4">
                    <Badge 
                      className={cn(
                        "rounded-xl px-2.5 py-0.5 font-black text-[9px] uppercase tracking-wider",
                        member.status === 'active' 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      )}
                    >
                      {member.status === 'active' ? 'Active' : 'Pending'}
                    </Badge>
                  </TableCell>

                  <TableCell className="px-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">{leadCounts[member.id] || 0}</span>
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-0.5">Assigned</span>
                    </div>
                  </TableCell>

                  <TableCell className="px-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-emerald-600 font-mono tracking-tighter">{confirmedCounts[member.id] || 0}</span>
                      <span className="text-[9px] font-black uppercase text-emerald-400 tracking-widest mt-0.5">Confirmed</span>
                    </div>
                  </TableCell>

                  <TableCell className="px-4">
                    <div className="flex flex-col gap-1 min-w-[130px]">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] font-bold">
                          {member.lastLogin ? new Date(member.lastLogin).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Never'}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono truncate max-w-[100px]">
                        {member.lastDevice || 'Desktop'}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isManagerOrAdmin && member.id !== adminUser?.id && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => impersonate(member)}
                          className="h-8 px-3 gap-1.5 font-bold text-[10px] uppercase tracking-wider text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        >
                          <Lock className="w-3 h-3" /> View as
                        </Button>
                      )}
                      
                      {isManagerOrAdmin && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className={cn(
                            "h-8 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider",
                            member.status === 'active' 
                              ? "text-slate-600 hover:text-amber-600 hover:bg-amber-50" 
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          )}
                          onClick={() => handleToggleStatus(member.id, member.status, activeUser?.orgId)}
                          disabled={member.email === 'tzsupportayurveda@gmail.com'}
                        >
                          {member.status === 'active' ? 'Suspend' : 'Activate'}
                        </Button>
                      )}

                      {isManagerOrAdmin && member.id !== adminUser?.id && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteUser(member.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add Team Member Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              Add Team Member (Trial Seat)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Provision instant credentials for your Team Leader or Sales Agent. They can log in immediately.
            </DialogDescription>
          </DialogHeader>

          {createdCredentials ? (
            <div className="space-y-4 py-3 animate-in fade-in duration-300">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-xs uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Account Created & Active!
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-emerald-100">
                    <span className="text-emerald-700 font-medium">Name:</span>
                    <span className="font-bold text-slate-900">{createdCredentials.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-emerald-100">
                    <span className="text-emerald-700 font-medium">Role:</span>
                    <span className="font-bold text-emerald-800">{createdCredentials.role}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-emerald-100">
                    <span className="text-emerald-700 font-medium">Email / ID:</span>
                    <span className="font-mono font-bold text-slate-900">{createdCredentials.email}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-emerald-700 font-medium">Password:</span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      {createdCredentials.password}
                    </span>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleCopyCredentials}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Details to Share with Agent"}
              </Button>

              <Button 
                variant="outline" 
                onClick={() => {
                  setCreatedCredentials(null);
                  setIsAddOpen(false);
                }}
                className="w-full text-xs font-bold text-slate-600 h-10 rounded-xl"
              >
                Close
              </Button>
            </div>
          ) : (
            <form onSubmit={handleCreateMember} className="space-y-4 py-2">
              {/* Role Selection */}
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Select Role</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMemberRole('TeamLeader')}
                    disabled={tlCount >= 1}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all relative",
                      memberRole === 'TeamLeader' 
                        ? "border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20" 
                        : "border-slate-200 hover:border-slate-300",
                      tlCount >= 1 && "opacity-50 cursor-not-allowed bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 mb-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                      Team Leader
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {tlCount >= 1 ? 'Slot Full (1/1)' : '1 Slot Available'}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMemberRole('Sales')}
                    disabled={salesCount >= 3}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all relative",
                      memberRole === 'Sales' 
                        ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20" 
                        : "border-slate-200 hover:border-slate-300",
                      salesCount >= 3 && "opacity-50 cursor-not-allowed bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 mb-1">
                      <Headphones className="w-3.5 h-3.5 text-blue-500" />
                      Sales Agent
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {salesCount >= 3 ? 'Slots Full (3/3)' : `${3 - salesCount} Slots Left`}
                    </p>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Full Name</Label>
                <Input 
                  placeholder="e.g. Rahul Sharma"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  required
                  className="h-10 text-xs"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Login Email</Label>
                <Input 
                  type="email"
                  placeholder="agent@company.com"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  required
                  className="h-10 text-xs font-mono"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Temporary Password</Label>
                  <button 
                    type="button" 
                    onClick={generatePassword}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Re-generate
                  </button>
                </div>
                <Input 
                  type="text"
                  placeholder="Password"
                  value={memberPassword}
                  onChange={(e) => setMemberPassword(e.target.value)}
                  required
                  className="h-10 text-xs font-mono"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsAddOpen(false)}
                  className="text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider h-10 px-5 rounded-xl shadow-lg shadow-emerald-500/20"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  Create & Activate Seat
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
