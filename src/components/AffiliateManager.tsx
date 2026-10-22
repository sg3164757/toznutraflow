
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Target, 
  TrendingUp, 
  Globe, 
  ExternalLink, 
  BarChart2, 
  Plus, 
  Search,
  Filter,
  ArrowUpRight,
  MousePointer2,
  ShoppingCart
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { dataService } from '@/src/services/dataService';
import { Lead, Order } from '@/src/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';

interface AffiliateSource {
  id: string;
  name: string;
  type: 'Ad' | 'Website' | 'Social';
  leads: number;
  conversions: number;
  revenue: number;
}

export function AffiliateManager() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsubLeads = dataService.subscribeLeads(user, setLeads);
    const unsubOrders = dataService.subscribeOrders(user, setOrders);
    return () => {
      unsubLeads();
      unsubOrders();
    };
  }, [user]);

  const isMarketer = user?.role === 'Marketer';

  // Predefined or common sources
  const defaultSources = ['Capsule Ads', 'Gel Ads', 'Website', 'Direct', 'WhatsApp'];
  
  // Calculate stats per source
  const sourceStats = useMemo(() => {
    const stats: Record<string, { leads: number; orders: number; revenue: number }> = {};
    
    // Initialize with defaults
    defaultSources.forEach(s => {
      stats[s] = { leads: 0, orders: 0, revenue: 0 };
    });

    leads.forEach(l => {
      const src = l.source || 'Direct';
      if (!stats[src]) stats[src] = { leads: 0, orders: 0, revenue: 0 };
      stats[src].leads++;
    });

    orders.forEach(o => {
      const src = o.source || 'Direct';
      if (!stats[src]) stats[src] = { leads: 0, orders: 0, revenue: 0 };
      stats[src].orders++;
      stats[src].revenue += o.total;
    });

    return Object.entries(stats).map(([name, data]) => ({
      name,
      ...data,
      conversionRate: data.leads > 0 ? ((data.orders / data.leads) * 100).toFixed(1) : '0'
    })).sort((a, b) => b.revenue - a.revenue);
  }, [leads, orders]);

  const filteredSources = sourceStats.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none px-2 py-0 h-5 font-black text-[9px] uppercase tracking-tighter">
              {isMarketer ? 'Marketer Dashboard' : 'Performance Audit'}
            </Badge>
            {isMarketer && <span className="text-[10px] font-bold text-slate-400 italic">Welcome, {user?.name}</span>}
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Marketing Attribution</h1>
          <p className="text-slate-500 font-medium">Track lead sources, affiliate performance, and campaign ROI.</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 px-6 font-bold shadow-lg shadow-emerald-500/10">
          <Plus className="w-4 h-4 mr-2" /> Create Trackable Link
        </Button>
      </div>

      {isMarketer && (
        <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-900/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-black tracking-tight">Your Campaign Performance</h2>
              <p className="text-slate-400 text-sm max-w-md leading-relaxed">
                As our Digital Marketer, your goal is to optimize Ad conversion. Review the metrics below to see which campaigns are delivering the highest ROI.
              </p>
            </div>
            <div className="flex gap-4">
              <div className="bg-white/10 px-6 py-4 rounded-2xl border border-white/10 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Target</p>
                <p className="text-2xl font-black">15% Conv.</p>
              </div>
              <div className="bg-white/10 px-6 py-4 rounded-2xl border border-white/10 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Status</p>
                <p className="text-2xl font-black">On Track</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-xl shadow-slate-200/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Total Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{sourceStats.length}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl shadow-slate-200/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Top Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-black text-emerald-600">{sourceStats[0]?.name || 'N/A'}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl shadow-slate-200/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Ad Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">
              {sourceStats.find(s => s.name.includes('Ads'))?.conversionRate || 0}%
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl shadow-slate-200/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Web Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">
              ₹{sourceStats.find(s => s.name === 'Website')?.revenue.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search source or affiliate..." 
              className="pl-10 h-11 bg-white border-slate-200 rounded-xl font-medium"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-11 rounded-xl font-bold gap-2">
              <Filter className="w-4 h-4" /> Filters
            </Button>
            <Button variant="outline" className="h-11 rounded-xl font-bold gap-2">
              <BarChart2 className="w-4 h-4" /> Reports
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Channel / Source</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Total Leads</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Orders</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Revenue Generated</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Conv. %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSources.map((source) => (
                <tr key={source.name} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        source.name.includes('Ads') ? "bg-blue-50 text-blue-600" : 
                        source.name === 'Website' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                      )}>
                        {source.name.includes('Ads') ? <TrendingUp className="w-5 h-5" /> : 
                         source.name === 'Website' ? <Globe className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 leading-none mb-1">{source.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 tracking-tight flex items-center">
                          {source.name.includes('Ads') ? 'Paid Campaign' : 'Organic Traffic'} 
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <MousePointer2 className="w-3 h-3 text-slate-400" />
                      <span className="font-bold text-slate-700">{source.leads}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-3 h-3 text-slate-400" />
                      <span className="font-bold text-slate-700">{source.orders}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right font-black text-slate-900">
                    ₹{source.revenue.toLocaleString()}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center">
                      <Badge className={cn(
                        "font-black text-[9px] uppercase tracking-tighter px-2 py-0.5 border-transparent h-5",
                        Number(source.conversionRate) > 10 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 shadow-none"
                      )}>
                        {source.conversionRate}%
                      </Badge>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
