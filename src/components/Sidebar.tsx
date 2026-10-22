
import { LayoutDashboard, Users, Package, ShoppingCart, Settings, LogOut, ChevronLeft, ChevronRight, Stethoscope, Truck, ShieldCheck, CheckCircle2, TrendingUp, History, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/src/contexts/AuthContext';
import { BrandLogo } from './BrandLogo';
import { motion } from 'motion/react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const navItems = [
  { id: 'dashboard', label: 'SYSTEM OVERVIEW', icon: LayoutDashboard, roles: ['Admin', 'Manager', 'TeamLeader', 'Sales', 'Marketer', 'SuperAdmin', 'Inventory', 'Delivery'] },
  { id: 'leads', label: 'LEAD REGISTRY', icon: Users, roles: ['Admin', 'Manager', 'TeamLeader', 'Sales', 'Marketer', 'SuperAdmin', 'Inventory', 'Delivery'] },
  { id: 'verification', label: 'VERIFICATION QUEUE', icon: ShieldCheck, roles: ['Admin', 'Manager', 'TeamLeader', 'SuperAdmin'] },
  { id: 'confirmed', label: 'CONFIRMED SLOTS', icon: CheckCircle2, roles: ['Admin', 'Manager', 'TeamLeader', 'Sales', 'SuperAdmin', 'Marketer'] },
  { id: 'inventory', label: 'SKU REPOSITORY', icon: Package, roles: ['Admin', 'Manager', 'Inventory', 'SuperAdmin'] },
  { id: 'orders', label: 'FULFILLMENT OPS', icon: ShoppingCart, roles: ['Admin', 'Manager', 'TeamLeader', 'SuperAdmin', 'Inventory', 'Delivery'] },
  { id: 'delivery', label: 'LOGISTICS CHAIN', icon: Truck, roles: ['Admin', 'Manager', 'Delivery', 'SuperAdmin'] },
  { id: 'affiliate', label: 'MARKETING HUB', icon: TrendingUp, roles: ['Admin', 'Marketer', 'SuperAdmin'] },
  { id: 'postback', label: 'TRAFFIC & POSTBACK', icon: Radio, roles: ['Admin', 'Marketer', 'Manager', 'SuperAdmin'] },
  { id: 'team', label: 'HUMAN RESOURCES', icon: ShieldCheck, roles: ['Admin', 'Manager', 'TeamLeader', 'SuperAdmin'] },
  { id: 'audit', label: 'AUDIT TRAIL', icon: History, roles: ['Admin', 'Manager', 'SuperAdmin'] },
  { id: 'settings', label: 'SYSTEM CONFIG', icon: Settings, roles: ['Admin', 'Manager', 'SuperAdmin'] },
];

export function Sidebar({ activeTab, setActiveTab, collapsed, setCollapsed }: SidebarProps) {
  const { signOut, user, organization } = useAuth();
  
  const isAdminEmail = user?.email?.toLowerCase() === 'tzsupportayurveda@gmail.com';
  const isSuperAdminRole = user?.role === 'SuperAdmin';
  
  const filteredNavItems = navItems.filter(item => 
    isAdminEmail || isSuperAdminRole || !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <div className={cn(
      "flex flex-col h-screen bg-slate-950 text-white transition-all duration-500 ease-in-out border-r border-white/5 shadow-2xl relative z-30",
      collapsed ? "w-20" : "w-72"
    )}>
      {/* Header Profile Section */}
      <div className="flex flex-col p-6 h-auto border-b border-white/5 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative group">
            <div className="absolute -inset-1.5 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition-opacity duration-300" />
            <div className="relative p-2.5 bg-slate-900 border border-white/10 rounded-2xl shadow-xl overflow-hidden h-11 w-11 flex items-center justify-center">
              {organization?.logo ? (
                <img src={organization.logo} alt="" className="w-full h-full object-contain" />
              ) : (
                <BrandLogo className="w-6 h-6 text-indigo-400 group-hover:text-white transition-colors" />
              )}
            </div>
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none animate-in fade-in slide-in-from-left-2 duration-700">
              <span className="font-black text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 uppercase truncate max-w-[150px]">
                {organization?.name || 'TOZ FLOW'}
              </span>
              <span className="text-[9px] font-black tracking-widest text-indigo-500/80 uppercase mt-1">Enterprise Command</span>
            </div>
          )}
        </div>

        {!collapsed && user && (
          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3 group hover:bg-white/[0.08] transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xs font-black ring-1 ring-white/10 overflow-hidden">
              <img 
                 src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} 
                 alt="" 
                 className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
              />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[11px] font-black uppercase tracking-tight truncate group-hover:text-indigo-300 transition-colors">{user.name}</span>
              <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest h-5 px-2 bg-indigo-500/10 text-indigo-400 border-indigo-500/20 w-fit mt-1">{user.role}</Badge>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 px-4 py-8 space-y-1.5 custom-scrollbar overflow-y-auto">
        {!collapsed && (
          <div className="text-[9px] uppercase font-black tracking-[0.2em] text-slate-600 px-4 mb-6 flex items-center gap-2">
            <div className="w-1 h-3 bg-indigo-500/40 rounded-full" />
            Workspace Systems
          </div>
        )}
        {filteredNavItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-4 h-12 transition-all duration-300 rounded-xl relative px-4 group overflow-hidden border border-transparent",
              activeTab === item.id 
                ? "bg-indigo-500/15 text-white border-white/5" 
                : "text-slate-500 hover:text-white hover:bg-white/5 hover:border-white/[0.02]",
              collapsed && "justify-center px-0 h-14"
            )}
            onClick={() => setActiveTab(item.id)}
          >
            {activeTab === item.id && (
              <motion.div 
                layoutId="active-pill" 
                className="absolute left-0 top-3 bottom-3 w-1.5 bg-indigo-500 rounded-r-full shadow-[0_0_12px_rgba(99,102,241,0.6)]" 
              />
            )}
            <item.icon className={cn(
              "w-5 h-5 flex-shrink-0 transition-all duration-300",
              activeTab === item.id ? "text-indigo-400 scale-110" : "text-slate-600 group-hover:text-slate-200 group-hover:scale-105"
            )} />
            {!collapsed && (
              <span className={cn(
                "text-[10px] uppercase tracking-[0.1em] transition-all duration-300", 
                activeTab === item.id ? "font-black" : "font-bold"
              )}>
                {item.label}
              </span>
            )}
          </Button>
        ))}
      </div>

      <div className="p-4 mt-auto border-t border-white/5 bg-slate-950">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-4 h-12 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl group transition-all px-4 border border-transparent hover:border-red-500/20",
            collapsed && "justify-center px-0 h-14"
          )}
          onClick={signOut}
        >
          <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          {!collapsed && <span className="font-black text-[10px] uppercase tracking-widest">Terminate Session</span>}
        </Button>
        
        <div className="pt-4 flex justify-center">
          <button
            className="w-full h-10 flex items-center justify-center gap-3 rounded-xl bg-white/[0.03] border border-white/5 text-[10px] font-black uppercase text-slate-600 hover:bg-white/10 hover:text-white transition-all tracking-widest group"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight size={16} className="text-indigo-400" /> : (
              <>
                <ChevronLeft size={16} className="text-indigo-400 transition-transform group-hover:-translate-x-1" />
                <span className="opacity-60 group-hover:opacity-100">Compact Mode</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
