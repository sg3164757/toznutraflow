
import React, { useEffect, useState, useMemo } from 'react';
import { 
  Users, 
  TrendingUp, 
  Package as PackageIcon, 
  DollarSign,
  Clock,
  Phone,
  Trash2,
  Filter,
  Calendar,
  UserPlus,
  User as UserIcon,
  ChevronDown,
  Target,
  CheckCircle,
  FileText,
  Trophy,
  AlertTriangle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { dataService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';
import { Lead, Order, InventoryItem, User, Task } from '@/src/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { startOfDay, startOfMonth, isAfter, parseISO, format, isSameDay, isBefore, endOfDay } from 'date-fns';

type DateFilter = 'today' | 'month' | 'all' | 'custom';

export function Dashboard() {
  const { user: currentUser } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  useEffect(() => {
    if (!currentUser?.id) return;

    const unsubLeads = dataService.subscribeLeads(currentUser, setLeads);
    const unsubOrders = dataService.subscribeOrders(currentUser, setOrders);
    const unsubInv = dataService.subscribeInventory(currentUser.orgId || '', setInventory);

    let unsubTasks = () => {};
    unsubTasks = dataService.subscribeTasks(currentUser.orgId || '', currentUser.id, (data) => {
      setTasks(data);
      setLoadingTasks(false);
    });

    if (['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '')) {
      dataService.getTeamMembers(currentUser).then(setTeamMembers);
    }

    return () => {
      unsubLeads();
      unsubOrders();
      unsubInv();
      unsubTasks();
    };
  }, [currentUser?.id, currentUser?.orgId, currentUser?.role]);

  // Derived filtered data
  const filteredData = useMemo(() => {
    let resultLeads = [...leads];
    let resultOrders = [...orders];

    // 1. Role / Agent Filter
    const isSpecialist = ['Admin', 'Manager', 'Marketer', 'SuperAdmin', 'Inventory', 'Delivery'].includes(currentUser?.role || '') || currentUser?.email?.toLowerCase() === 'tzsupportayurveda@gmail.com';

    if (!isSpecialist) {
      // Agents only see their data + unassigned (to see potential new work)
      const isMyLead = (l: Lead) => l.assignedToId === currentUser?.id || !l.assignedToId || l.assignedToId === 'unassigned' || l.assignedToId === 'CRM User';
      const isMyOrder = (o: Order) => o.assignedToId === currentUser?.id || !o.assignedToId || o.assignedToId === 'unassigned';
      
      resultLeads = resultLeads.filter(isMyLead);
      resultOrders = resultOrders.filter(isMyOrder);
    } else if (selectedAgentId !== 'all') {
      // Admin/Specialist viewing specific agent
      resultLeads = resultLeads.filter(l => l.assignedToId === selectedAgentId);
      resultOrders = resultOrders.filter(o => o.assignedToId === selectedAgentId);
    }

    // 2. Date Filter
    const now = new Date();
    if (dateFilter === 'today') {
      const today = startOfDay(now);
      resultLeads = resultLeads.filter(l => isSameDay(parseISO(l.createdAt), today));
      resultOrders = resultOrders.filter(o => isSameDay(parseISO(o.createdAt), today));
    } else if (dateFilter === 'month') {
      const monthStart = startOfMonth(now);
      resultLeads = resultLeads.filter(l => isAfter(parseISO(l.createdAt), monthStart));
      resultOrders = resultOrders.filter(o => isAfter(parseISO(o.createdAt), monthStart));
    } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
      const start = startOfDay(parseISO(customStartDate));
      const end = endOfDay(parseISO(customEndDate));
      resultLeads = resultLeads.filter(l => {
        const leadDate = parseISO(l.createdAt);
        return (isAfter(leadDate, start) || isSameDay(leadDate, start)) && 
               (isBefore(leadDate, end) || isSameDay(leadDate, end));
      });
      resultOrders = resultOrders.filter(o => {
        const orderDate = parseISO(o.createdAt);
        return (isAfter(orderDate, start) || isSameDay(orderDate, start)) && 
               (isBefore(orderDate, end) || isSameDay(orderDate, end));
      });
    }

    return { filteredLeads: resultLeads, filteredOrders: resultOrders };
  }, [leads, orders, dateFilter, selectedAgentId, currentUser, customStartDate, customEndDate]);

  const { filteredLeads, filteredOrders } = filteredData;

  const leadStatusSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    filteredLeads.forEach(l => {
      summary[l.status] = (summary[l.status] || 0) + 1;
    });
    return summary;
  }, [filteredLeads]);

  const leaderboardData = useMemo(() => {
    const leaderMap: Record<string, { id: string, name: string, confirmed: number, revenue: number, avatar?: string }> = {};

    leads.forEach(l => {
      if (l.status === 'Order Confirmed') {
        if (!leaderMap[l.assignedToId]) {
          leaderMap[l.assignedToId] = { id: l.assignedToId, name: l.assignedTo, confirmed: 0, revenue: 0 };
        }
        leaderMap[l.assignedToId].confirmed++;
      }
    });

    orders.forEach(o => {
      if (!leaderMap[o.agentId || '']) {
        leaderMap[o.agentId || ''] = { id: o.agentId || '', name: o.agentName || 'Unknown Agent', confirmed: 0, revenue: 0 };
      }
      leaderMap[o.agentId || ''].revenue += o.total;
    });

    // Match with team members for avatars/roles
    const finalData = Object.values(leaderMap).map(l => {
      const member = teamMembers.find(m => m.id === l.id);
      return { ...l, avatar: member?.avatar };
    });

    // Sort by revenue primarily, then confirmed
    return finalData.sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [leads, orders, teamMembers]);

  const stats = {
    leads: filteredLeads.length,
    revenue: filteredOrders.reduce((acc, o) => acc + o.total, 0),
    earnings: filteredOrders.reduce((acc, o) => acc + (o.commission || 0), 0),
    confirmed: filteredLeads.filter(l => l.status === 'Order Confirmed').length,
    pending: filteredOrders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length
  };

  const selectedAgent = teamMembers.find(m => m.id === selectedAgentId);

  // Generate chart data based on filtered data
  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthData = months.map(m => ({ name: m, leads: 0, revenue: 0 }));
    
    filteredLeads.forEach(l => {
      const monthIdx = parseISO(l.createdAt).getMonth();
      currentMonthData[monthIdx].leads++;
    });
    
    filteredOrders.forEach(o => {
      const monthIdx = parseISO(o.createdAt).getMonth();
      currentMonthData[monthIdx].revenue += o.total;
    });

    return currentMonthData.filter((_, i) => i <= new Date().getMonth());
  }, [filteredLeads, filteredOrders]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight text-slate-900">
            {['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '') ? (selectedAgentId === 'all' ? 'Company Analytics' : `${selectedAgent?.name}'s Performance`) : 'My Sales Performance'}
          </h1>
          {['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '') && selectedAgentId !== 'all' && (
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-black rounded uppercase tracking-tighter">
                ACTIVE AGENT ID
              </span>
              <code className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {selectedAgentId}
              </code>
            </div>
          )}
          <p className="text-slate-500 font-medium">Monitoring business growth and agent productivity in real-time.</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          {['Admin', 'Manager', 'SuperAdmin'].includes(currentUser?.role || '') && (
            <DropdownMenu>
              <DropdownMenuTrigger className="h-10 px-4 gap-2 border-r border-slate-100 rounded-none first:rounded-xl last:rounded-r-xl hover:bg-slate-50 transition-colors flex items-center outline-none">
                <UserIcon className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-bold truncate max-w-[120px]">
                  {selectedAgentId === 'all' ? 'All Agents' : selectedAgent?.name}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-slate-400 font-black px-2 py-1.5">View Agent Performance</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setSelectedAgentId('all')} className="rounded-lg">All Company Data</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {teamMembers.map(member => (
                    <DropdownMenuItem 
                      key={member.id} 
                      onSelect={() => setSelectedAgentId(member.id)}
                      className="rounded-lg gap-2"
                    >
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                        {member.name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{member.name}</span>
                          <span className={cn(
                            "text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter",
                            member.role === 'Manager' ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700"
                          )}>
                            {member.role}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono italic">ID: {member.id.substring(0, 8)}...</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="flex p-1 bg-slate-50 rounded-xl">
            {(['today', 'month', 'all', 'custom'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={cn(
                  "px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                  dateFilter === filter 
                    ? "bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {filter}
              </button>
            ))}
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">From</span>
                <input 
                  type="date" 
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">To</span>
                <input 
                  type="date" 
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {currentUser?.role === 'Sales' ? (
          <Card className="neo-shadow border-slate-200/60 overflow-hidden group hover:neo-shadow-lg transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 group-hover:scale-110 transition-transform duration-500">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <Badge className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md text-[10px] font-black border-transparent">
                  EARNINGS
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">My Sales Commission</p>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">₹{stats.earnings.toLocaleString()}</h3>
              </div>
            </div>
            <div className="h-1 w-full bg-slate-100 italic flex">
               <div className="h-full w-2/3 bg-emerald-500/30" />
            </div>
          </Card>
        ) : (
          <Card className="neo-shadow border-slate-200/60 overflow-hidden group hover:neo-shadow-lg transition-all duration-300">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 group-hover:scale-110 transition-transform duration-500">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <Badge className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md text-[10px] font-black border-transparent">
                  TOTAL VOLUME
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Total Leads Processed</p>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{stats.leads}</h3>
              </div>
            </div>
          </Card>
        )}

        <Card className="neo-shadow border-slate-200/60 overflow-hidden group hover:neo-shadow-lg transition-all duration-300">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 group-hover:scale-110 transition-transform duration-500">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <Badge className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md text-[10px] font-black border-transparent">
                REVENUE
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Total Confirmed Value</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">₹{stats.revenue.toLocaleString()}</h3>
            </div>
          </div>
        </Card>

        <Card className="neo-shadow border-slate-200/60 overflow-hidden group hover:neo-shadow-lg transition-all duration-300">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 group-hover:scale-110 transition-transform duration-500">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <Badge className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md text-[10px] font-black border-transparent">
                SUCCESS
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Total Confirmed Orders</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{stats.confirmed}</h3>
            </div>
          </div>
        </Card>

        <Card className="neo-shadow border-slate-200/60 overflow-hidden group hover:neo-shadow-lg transition-all duration-300">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 group-hover:scale-110 transition-transform duration-500">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <Badge className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md text-[10px] font-black border-transparent">
                PENDING
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Awaiting Finalization</p>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{stats.pending}</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Lead Pipeline Breakdown */}
      <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight -mb-2">Lead Pipeline Breakdown</h2>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'New Ingress', status: 'New Lead', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: UserPlus },
          { label: 'Follow Ups', status: 'Call Back', color: 'bg-purple-50 text-purple-600 border-purple-100', icon: Clock },
          { label: 'No Answer', status: 'No Answer', color: 'bg-orange-50 text-orange-600 border-orange-100', icon: Phone },
          { label: 'Interested', status: 'Interested', icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
          { label: 'Unavailable', status: 'Unavailable', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: AlertTriangle },
          { label: 'Bin/Duplicates', status: 'Duplicate', color: 'bg-slate-50 text-slate-400 border-slate-100', icon: Trash2 },
        ].map((item) => (
          <Card key={item.label} className="neo-shadow border-slate-100 group hover:border-slate-300 transition-all cursor-default">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={cn("p-1.5 rounded-lg", item.color.split(' ')[0])}>
                  <item.icon className={cn("w-3.5 h-3.5", item.color.split(' ')[1])} />
                </div>
                <span className={cn("text-lg font-black font-mono", item.color.split(' ')[1])}>
                  {leadStatusSummary[item.status] || 0}
                </span>
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 neo-shadow border-slate-200/60 overflow-hidden bg-white">
          <CardHeader className="bg-white border-b border-slate-50 p-6 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-black text-slate-900 tracking-tight">Revenue Stream</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Monthly Projection & Performance</CardDescription>
            </div>
            <div className="flex -space-x-1.5">
              {leaderboardData.slice(0, 3).map((agent, i) => (
                <div key={agent.id} className={cn(
                  "w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-sm ring-1 ring-slate-100 flex-shrink-0 transition-transform hover:-translate-y-1 cursor-help",
                  i === 0 ? "bg-indigo-500 z-30" : i === 1 ? "bg-slate-400 z-20" : "bg-slate-700 z-10"
                )}>
                  {agent.name.charAt(0)}
                </div>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    fontWeight={800}
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: '#64748b' }}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    fontWeight={800}
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `₹${value/1000}k`}
                    tick={{ fill: '#64748b' }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    labelStyle={{ color: '#cbd5e1', fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar dataKey="revenue" fill="url(#barGradient)" radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Sales Leaderboard */}
        <Card className="lg:col-span-3 neo-shadow border-slate-200/60 overflow-hidden bg-white">
          <CardHeader className="bg-slate-900 text-white p-6 border-none">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-black flex items-center gap-2.5">
                  <Trophy className="w-5 h-5 text-indigo-400" />
                  Sales Efficiency
                </CardTitle>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 italic">Agent Rankings • Current Cycle</p>
              </div>
              <Badge className="bg-white/10 text-white border-white/10 px-2 font-black text-[9px] uppercase tracking-tighter">
                Live Data
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {leaderboardData.length > 0 ? leaderboardData.map((agent, index) => (
                <div key={agent.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {index === 0 && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center z-10 shadow-lg shadow-indigo-500/20 border-2 border-white">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-sm ring-1",
                        index === 0 ? "bg-indigo-50 text-indigo-700 ring-indigo-100" : 
                        index === 1 ? "bg-slate-50 text-slate-600 ring-slate-100" : 
                        index === 2 ? "bg-slate-50 text-slate-700 ring-slate-100" : "bg-slate-50 text-slate-400 ring-slate-100 opacity-60"
                      )}>
                        {agent.name.charAt(0)}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-black text-slate-900 text-xs tracking-tight">{agent.name}</p>
                        {index < 3 && (
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-sm",
                            index === 0 ? "bg-indigo-600 text-white" : 
                            index === 1 ? "bg-slate-200 text-slate-700" : "bg-slate-100 text-slate-500"
                          )}>
                            Top {index + 1}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 font-mono mt-0.5 tracking-tighter">
                        {agent.confirmed} ORDERS SECURED
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900 text-sm tracking-tight font-mono">₹{agent.revenue.toLocaleString()}</p>
                    <div className="h-1 w-16 bg-slate-100 rounded-full mt-1 ml-auto overflow-hidden">
                       <div 
                         className="h-full bg-indigo-500 transition-all duration-1000" 
                         style={{ width: `${Math.min((agent.revenue / (leaderboardData[0]?.revenue || 1)) * 100, 100)}%` }} 
                       />
                    </div>
                  </div>
                </div>
              )) : (
                <div className="p-20 text-center">
                  <Trophy className="w-8 h-8 text-slate-200 mx-auto mb-3 opacity-20" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No rankings available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-7 neo-shadow border-slate-200/60 overflow-hidden bg-white">
          <CardHeader className="bg-white border-b border-slate-50 p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg font-black text-slate-900 tracking-tight">Conversion Velocity</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Yield trends over the fiscal period</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lead Input</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    fontWeight={800}
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    fontWeight={800}
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    labelStyle={{ color: '#cbd5e1', fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="leads" 
                    stroke="#6366f1" 
                    strokeWidth={3} 
                    dot={{ fill: '#6366f1', r: 4, strokeWidth: 0 }} 
                    activeDot={{ r: 6, strokeWidth: 4, stroke: '#fff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commercial Activity Stream */}
      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-7 neo-shadow border-slate-200/60 overflow-hidden bg-white">
          <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600" />
                Commercial Activity Stream
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">
                Real-time validation of business transitions
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">LIVE FEED</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
             <div className="overflow-x-auto">
               <table className="w-full">
                 <thead className="bg-slate-50/50 border-b border-slate-100">
                   <tr className="text-left">
                     <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entity</th>
                     <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operation</th>
                     <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Value</th>
                     <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {filteredLeads.slice(0, 5).map((lead, i) => (
                     <tr key={lead.id} className="group hover:bg-slate-50/50 transition-colors">
                       <td className="px-6 py-4">
                         <div className="flex items-center gap-3">
                           <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-lg shadow-black/10">
                             {lead.name.charAt(0)}
                           </div>
                           <div>
                             <p className="text-sm font-black text-slate-900 leading-none mb-1">{lead.name}</p>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight font-mono">{lead.city || 'GLOBAL MARKET'}</p>
                           </div>
                         </div>
                       </td>
                       <td className="px-6 py-4">
                         <div className="flex flex-col">
                           <span className="text-[11px] font-black text-indigo-600 uppercase tracking-tighter">{lead.product}</span>
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">LEAD_INGRESS</span>
                         </div>
                       </td>
                       <td className="px-4 py-4 text-right">
                         <span className="text-sm font-black text-slate-900 font-mono">₹{lead.value.toLocaleString()}</span>
                       </td>
                       <td className="px-6 py-4 text-right">
                         <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-2 bg-white px-2.5 h-6">
                           {lead.status}
                         </Badge>
                       </td>
                     </tr>
                   ))}
                   {filteredLeads.length === 0 && (
                     <tr>
                       <td colSpan={4} className="px-6 py-12 text-center text-slate-300 font-bold uppercase tracking-[0.2em] text-xs">
                         Waiting for incoming telemetry...
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* RTO Analysis (Only for Admin/SuperAdmin) */}
      {(currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin') && (
        <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden">
          <CardHeader className="bg-red-50/50 border-b border-red-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-black text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                RTO Analysis
              </CardTitle>
              <CardDescription className="text-red-700/60 font-medium font-bold">Identifying high-risk products and regions for returns.</CardDescription>
            </div>
            <Badge className="bg-red-100 text-red-700 border-none font-black text-[10px] px-3">
              CRITICAL TRACKING
            </Badge>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top RTO Products</h4>
                <div className="space-y-3">
                  {[
                    { name: 'Advanced Gel Formula', rate: '12%', color: 'bg-red-500' },
                    { name: 'Booster 3X Pills', rate: '8%', color: 'bg-orange-500' },
                    { name: 'Booster Cream', rate: '5%', color: 'bg-amber-500' }
                  ].map((p, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">{p.name}</span>
                        <span className="font-black text-red-600">{p.rate}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", p.color)} style={{ width: p.rate }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">High Return Regions</h4>
                <div className="space-y-2">
                  {[
                    { region: 'Bihar', count: 42, rate: '18%' },
                    { region: 'West Bengal', count: 31, rate: '15%' },
                    { region: 'Uttar Pradesh', count: 56, rate: '11%' }
                  ].map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center font-bold text-xs text-slate-600">
                          {i + 1}
                        </div>
                        <span className="font-bold text-slate-800">{r.region}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-red-600">{r.rate}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">{r.count} Returns</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Tasks & Refill Reminders */}
      <Card className="border-none shadow-xl shadow-slate-200/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Action Items & Refills
            </CardTitle>
            <CardDescription className="font-medium">Stay ahead of your customer re-order cycles.</CardDescription>
          </div>
          <Badge className="bg-indigo-100 text-indigo-700 border-none font-black text-[10px] px-3">
            {tasks.length} PENDING
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.length > 0 ? tasks.map(task => (
              <div key={task.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-indigo-200 transition-colors group">
                <div className="flex items-start justify-between mb-3">
                  <Badge variant="secondary" className={cn(
                    "text-[8px] font-black uppercase tracking-tighter px-1.5 h-4",
                    task.type === 'refill' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {task.type}
                  </Badge>
                  <span className="text-[10px] font-bold text-slate-400">
                    Due {format(parseISO(task.dueDate), 'MMM dd')}
                  </span>
                </div>
                <h4 className="font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">{task.title}</h4>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 italic">"{task.description}"</p>
                <div className="pt-4 flex gap-2">
                  {task.type === 'callback' && (
                    <a 
                      href={`tel:${task.description.match(/Phone: (\d+)/)?.[1] || ''}`}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[10px] tracking-widest h-8 flex items-center justify-center rounded-lg no-underline"
                    >
                      Call Now
                    </a>
                  )}
                  <Button 
                    size="sm" 
                    className={cn(
                      "flex-1 font-black uppercase text-[10px] tracking-widest h-8",
                      task.type === 'callback' ? "bg-slate-100 text-slate-900 hover:bg-slate-200" : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    )}
                    onClick={async () => {
                        try {
                          await dataService.updateTask(task.id, { status: 'completed' });
                          toast.success('Task marked as completed');
                        } catch (e) {
                          toast.error('Failed to complete task');
                        }
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            )) : (
              <div className="col-span-3 py-10 text-center text-slate-400 font-medium italic bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                No pending tasks. Great job staying on top of your leads!
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stock Alerts (Only for Admin/Inventory/SuperAdmin) */}
      {(currentUser?.role === 'Admin' || currentUser?.role === 'Inventory' || currentUser?.role === 'SuperAdmin') && (
        <Card className="border-none shadow-xl shadow-slate-200/50">
          <CardHeader>
            <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <PackageIcon className="w-5 h-5 text-amber-500" />
              Inventory Pulse
            </CardTitle>
            <CardDescription className="font-medium">Items requiring attention due to low stock levels.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {inventory.filter(i => i.stock <= i.minStock).slice(0, 3).map(item => (
                <div key={item.id} className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-amber-900">{item.name}</p>
                    <p className="text-xs text-amber-700 font-bold">Only {item.stock} units left</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-200/50 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-amber-700" />
                  </div>
                </div>
              ))}
              {inventory.filter(i => i.stock <= i.minStock).length === 0 && (
                <div className="col-span-3 text-center py-6 text-slate-400 font-medium italic">
                  All items are sufficiently stocked.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
