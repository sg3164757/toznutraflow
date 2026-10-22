
import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Search, 
  Trash2, 
  RefreshCw, 
  AlertTriangle, 
  User as UserIcon, 
  FileText,
  Clock,
  History
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AuditLog } from '@/src/types';
import { dataService } from '@/src/services/dataService';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

import { useAuth } from '@/src/contexts/AuthContext';

export function AuditLogs() {
  const { user: currentUser } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    const unsub = dataService.subscribeAuditLogs(currentUser.orgId || '', (data) => {
      setLogs(data);
      setLoading(false);
    });
    return unsub;
  }, [currentUser?.orgId]);

  const filteredLogs = logs.filter(log => 
    log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.entityType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionColor = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes('delete')) return 'text-red-600 bg-red-50 border-red-100';
    if (a.includes('confirmed')) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (a.includes('update') || a.includes('change')) return 'text-blue-600 bg-blue-50 border-blue-100';
    if (a.includes('reassigned')) return 'text-purple-600 bg-purple-50 border-purple-100';
    return 'text-slate-600 bg-slate-50 border-slate-100';
  };

  const getLogIcon = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes('delete')) return <Trash2 className="w-3.5 h-3.5" />;
    if (a.includes('confirmed')) return <Shield className="w-3.5 h-3.5" />;
    if (a.includes('reassigned')) return <RefreshCw className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Audit Trail</h1>
          <Badge className="bg-red-100 text-red-700 border-none font-black text-[9px] uppercase tracking-widest px-2.5">
            Security Logs
          </Badge>
        </div>
        <p className="text-slate-500 font-bold text-xs uppercase tracking-tight">Comprehensive record of all database modifications and sensitive actions.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-red-500 transition-colors" />
          <Input 
            placeholder="Search audit trail by user, action or details..." 
            className="pl-10 border-slate-200 bg-white h-11 text-xs font-bold focus:ring-red-500/10 focus:border-red-500/50 rounded-xl shadow-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl overflow-hidden shadow-slate-200/20">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-32 gap-4">
            <div className="w-12 h-12 border-4 border-slate-100 border-t-red-500 rounded-full animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Trail...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-32 text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center">
              <History className="w-8 h-8 text-slate-200" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-black text-slate-900 uppercase tracking-tight">No actions recorded</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-loose">Database is clean or no actions match current filters.</p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b-slate-100">
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-6">Timestamp</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Operator</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Action Type</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Audit Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id} className="group h-16 hover:bg-slate-50 transition-colors border-b-slate-50">
                  <TableCell className="px-6">
                    <div className="flex items-center gap-2">
                       <Clock className="w-3 h-3 text-slate-400 font-black" />
                       <span className="text-[10px] font-black text-slate-900 font-mono">
                         {format(new Date(log.timestamp), 'MMM dd, hh:mm:ss a').toUpperCase()}
                       </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-[10px] font-black text-white uppercase shadow-sm">
                        {log.userName[0]}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{log.userName}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Operator ID: {log.userId.slice(0, 8)}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <Badge variant="outline" className={cn(
                      "text-[9px] font-black uppercase tracking-widest h-6 px-2.5 border-2 gap-1.5",
                      getActionColor(log.action)
                    )}>
                      {getLogIcon(log.action)}
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex flex-col max-w-lg">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{log.entityType} • {log.entityId}</span>
                      <p className={cn(
                        "text-xs font-medium leading-relaxed",
                        log.action.toLowerCase().includes('delete') ? "text-red-600 font-black" : "text-slate-600"
                      )}>
                        {log.details}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
