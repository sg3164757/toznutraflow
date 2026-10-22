import React, { useState } from 'react';
import { Sidebar } from '@/src/components/Sidebar';
import { Dashboard } from '@/src/components/Dashboard';
import { LeadManager } from '@/src/components/LeadManager';
import { InventoryManager } from '@/src/components/InventoryManager';
import { OrderManager } from '@/src/components/OrderManager';
import { VerificationQueue } from '@/src/components/VerificationQueue';
import { TeamManager } from '@/src/components/TeamManager';
import { ConfirmedLeads } from '@/src/components/ConfirmedLeads';
import { Settings } from '@/src/components/Settings';
import { AffiliateManager } from '@/src/components/AffiliateManager';
import { DeliveryPortal } from '@/src/components/DeliveryPortal';
import { AuditLogs } from '@/src/components/AuditLogs';
import { PostbackManager } from '@/src/components/PostbackManager';
import { LandingPage } from '@/src/components/LandingPage';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Bell, 
  Search, 
  HelpCircle,
  User as UserIcon,
  ShieldCheck,
  ChevronDown,
  Loader2,
  LogOut,
  Check
} from 'lucide-react';
import { dataService } from '@/src/services/dataService';
import { useEffect } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Toaster } from '@/components/ui/sonner';
import { BrandLogo } from '@/src/components/BrandLogo';

import { TaskReminderListener } from '@/src/components/TaskReminderListener';
import { PresenceListener } from '@/src/components/PresenceListener';
import { InventoryAlertListener } from '@/src/components/InventoryAlertListener';

import { OrganizationSetup } from '@/src/components/OrganizationSetup';

function CRMApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const { user, signOut, loading, impersonate, isImpersonating } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      // In SaaS, we also want to filter notifications by orgId to be safe, 
      // but userId is usually unique anyway. Still, let's stick to user.id for now.
      return dataService.subscribeNotifications(user.id, (data) => {
        setNotifications(data);
      });
    }
  }, [user?.id]);

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 gap-6">
        <div className="relative">
          <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center shadow-2xl shadow-black/50 animate-pulse relative z-10">
            <BrandLogo className="w-10 h-10" />
          </div>
          <div className="absolute inset-0 bg-emerald-500/20 blur-3xl animate-pulse"></div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
          <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Initializing Workspace</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  const isAdminEmail = user?.email?.toLowerCase() === 'tzsupportayurveda@gmail.com';
  const isSuperAdminRole = user?.role === 'SuperAdmin';
  const hasAccess = user?.status === 'active' || isSuperAdminRole || isAdminEmail || isImpersonating;

  // SaaS Onboarding (Less strict for legacy users)
  if (!user.orgId && hasAccess && !user.role && !isAdminEmail) {
    return <OrganizationSetup />;
  }

  // Admin bypasses approval
  if (!hasAccess) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white p-6">
        <div className="max-w-md w-full bg-slate-800 border border-white/5 rounded-[2.5rem] p-10 text-center neo-shadow animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-indigo-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 ring-1 ring-indigo-500/30">
            <ShieldCheck className="w-10 h-10 text-indigo-400 animate-pulse" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight mb-4">Access Restricted</h1>
          <p className="text-slate-400 font-bold text-sm leading-relaxed mb-10">
            Verification required. Aapka account abhi "Pending" status mein hai. Kripya apne SuperAdmin se approval ke liye sampark karein.
          </p>
          <div className="flex flex-col gap-3">
            <Button 
              variant="outline" 
              onClick={() => signOut()}
              className="h-12 border-white/10 hover:bg-white/5 rounded-2xl font-black uppercase tracking-widest text-[10px]"
            >
              Sign Out & Try Another Identity
            </Button>
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mt-4 italic opacity-50">
              System ID: {user.id}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'leads': return <LeadManager />;
      case 'verification': return <VerificationQueue />;
      case 'confirmed': return <ConfirmedLeads />;
      case 'inventory': return <InventoryManager />;
      case 'orders': return <OrderManager />;
      case 'delivery': return <DeliveryPortal />;
      case 'team': return <TeamManager />;
      case 'audit': return <AuditLogs />;
      case 'affiliate': return <AffiliateManager />;
      case 'postback': return <PostbackManager onNavigateToLeads={() => setActiveTab('leads')} />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        collapsed={collapsed} 
        setCollapsed={setCollapsed} 
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        {isImpersonating && (
          <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2 text-sm font-bold">
              <UserIcon className="w-4 h-4" />
              <span>LOGGED IN AS AGENT: {user?.name} (Audit Mode)</span>
            </div>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => impersonate(null)}
              className="h-7 text-[10px] font-black uppercase tracking-widest bg-white text-blue-600 hover:bg-white/90"
            >
              Exit Audit
            </Button>
          </div>
        )}
        <header className="h-16 glass sticky top-0 z-20 border-b border-slate-200/60 flex items-center justify-between px-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] focus-within:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-shadow">
          <div className="flex items-center gap-6 flex-1">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-slate-400">
                <span className="hover:text-slate-600 transition-colors cursor-pointer">Workspace</span>
                <span className="opacity-40">/</span>
                <span className="text-slate-900">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</span>
              </div>
            </div>
            <div className="h-4 w-px bg-slate-200 hidden md:block"></div>
            <div className="relative w-full max-w-sm hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input 
                placeholder="Quick search (Cmd + K)..." 
                className="pl-9 h-9 border-slate-200 bg-slate-100/50 focus-visible:bg-white transition-all ring-primary/10 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="text-slate-500 relative hover:bg-slate-100 outline-none flex items-center justify-center size-9 rounded-lg transition-all group active:scale-95">
                <Bell className="w-4.5 h-4.5 group-hover:text-slate-800 transition-colors" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-indigo-600 rounded-full border-2 border-white text-[6px] font-black text-white flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0 rounded-xl border-slate-200 shadow-2xl bg-white overflow-hidden z-[100] animate-in zoom-in-95 duration-200">
                <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Activity Center</span>
                    <span className="text-xs font-bold opacity-80">{unreadCount} Pending updates</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => user?.id && dataService.clearNotifications(user.id)}
                    className="h-7 text-[9px] font-black uppercase text-white/50 hover:text-white hover:bg-white/10 px-2 rounded-lg border border-white/5"
                  >
                    Mark all read
                  </Button>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                      <Bell className="w-8 h-8 opacity-20 mx-auto mb-3" />
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Inbox Zero</p>
                      <p className="text-[10px] mt-1 font-medium italic">You're all caught up.</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div 
                        key={n.id} 
                        onClick={() => dataService.markNotificationRead(n.id)}
                        className={cn(
                          "p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors relative group",
                          !n.read && "bg-indigo-50/20"
                        )}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1">
                            <h4 className={cn("text-xs transition-colors", n.read ? "text-slate-600 font-bold" : "text-slate-950 font-black")}>{n.title}</h4>
                            <p className="text-[11px] text-slate-500 font-medium mt-1 leading-normal">{n.message}</p>
                            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-2">
                              {format(new Date(n.timestamp), 'MMM dd, hh:mm a')}
                            </p>
                          </div>
                          {!n.read && <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full mt-1.5" />}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-px h-4 bg-slate-200 mx-2"></div>

            <DropdownMenu>
              <DropdownMenuTrigger
                className="pl-1 pr-1 h-10 gap-2 hover:bg-slate-100 rounded-lg border-transparent inline-flex items-center transition-all outline-none cursor-pointer active:scale-95 group"
              >
                <div className="relative">
                  <Avatar className="h-7 w-7 border-2 border-white shadow-sm ring-1 ring-slate-200 group-hover:ring-slate-300 transition-all">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback className="bg-slate-100 text-slate-600"><UserIcon className="w-3.5 h-3.5" /></AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
                </div>
                <div className="hidden lg:flex flex-col items-start leading-none pr-1">
                  <span className="text-xs font-black text-slate-900">{user.name.split(' ')[0]}</span>
                  <span className="text-[9px] text-slate-400 font-bold tracking-tighter uppercase mt-0.5">{user.role}</span>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2 rounded-xl border-slate-200 shadow-2xl bg-white z-[120]">
                <div className="px-3 py-3 mb-2 bg-slate-50/50 rounded-lg border border-slate-100 flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback><UserIcon className="w-5 h-5" /></AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-900 truncate">{user.name}</p>
                    <p className="text-[10px] font-bold text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                
                <DropdownMenuSeparator className="bg-slate-100 my-1" />
                
                <DropdownMenuItem 
                  className="rounded-lg h-9 px-3 cursor-pointer hover:bg-slate-50 gap-3 group transition-all"
                  onClick={() => setActiveTab('settings')}
                >
                  <UserIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary transition-colors" />
                  <span className="text-xs font-bold text-slate-700">Account Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="rounded-lg h-9 px-3 text-red-600 focus:text-red-700 focus:bg-red-50/50 cursor-pointer gap-3 group"
                  onClick={signOut}
                >
                  <LogOut className="w-3.5 h-3.5 text-red-400 group-hover:text-red-600 transition-colors" />
                  <span className="text-xs font-bold">Terminate Session</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {renderContent()}
          </div>
        </main>
      </div>
      
      <Toaster position="top-right" />
      <TaskReminderListener />
      <PresenceListener />
      <InventoryAlertListener />
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          @apply bg-slate-200 rounded-full border-2 border-transparent bg-clip-content;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          @apply bg-slate-300;
        }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CRMApp />
    </AuthProvider>
  );
}
