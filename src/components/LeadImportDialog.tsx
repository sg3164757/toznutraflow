import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { dataService } from '@/src/services/dataService';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Lead } from '../types';
import { useAuth } from '@/src/contexts/AuthContext';

interface LeadImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadImportDialog({ open, onOpenChange }: LeadImportDialogProps) {
  const { user: currentUser } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({
    name: '',
    phone: '',
    product: '',
    state: '',
    city: '',
    source: '',
    value: ''
  });
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        if (rows.length > 0) {
          // Use the raw first row for mapping keys, but show trimmed versions for UI
          const rawHeaders = rows[0] as any[];
          const cleanHeaders = rawHeaders.map(h => String(h || '').trim());
          
          setHeaders(cleanHeaders.filter(Boolean));
          setFile(selectedFile);
          
          // Basic auto-mapping
          const newMapping = { ...mapping };
          cleanHeaders.forEach((h, index) => {
            if (!h) return;
            const lowH = h.toLowerCase();
            const originalHeader = rawHeaders[index];
            
            if (lowH.includes('name')) newMapping.name = originalHeader;
            if (lowH.includes('phone') || lowH.includes('mobile') || lowH.includes('number') || lowH.includes('contact')) newMapping.phone = originalHeader;
            if (lowH.includes('product') || lowH.includes('package') || lowH.includes('item')) newMapping.product = originalHeader;
            if (lowH.includes('state')) newMapping.state = originalHeader;
            if (lowH.includes('city')) newMapping.city = originalHeader;
            if (lowH.includes('source')) newMapping.source = originalHeader;
            if (lowH.includes('value') || lowH.includes('price') || lowH.includes('amount')) newMapping.value = originalHeader;
          });
          setMapping(newMapping);

          // Get actual data for import as objects using original headers
          const jsonData = XLSX.utils.sheet_to_json(ws, { defval: "" });
          setPreviewData(jsonData);
        }
      } catch (err) {
        toast.error('Error reading Excel file');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleImport = async () => {
    if (!mapping.name || !mapping.phone) {
      toast.error('Name and Phone columns must be mapped');
      return;
    }

    setImporting(true);
    const leadsToImport: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'history'>[] = [];

    try {
      previewData.forEach(row => {
        const rawPhone = String(row[mapping.phone] || '');
        const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
        
        const leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'history'> = {
          name: String(row[mapping.name] || 'Unknown').trim(),
          phone: cleanPhone,
          product: String(row[mapping.product] || 'General Product').trim(),
          state: String(row[mapping.state] || '').trim(),
          city: String(row[mapping.city] || '').trim(),
          source: String(row[mapping.source] || 'Excel Import').trim(),
          value: Number(String(row[mapping.value] || '0').replace(/[^0-9.]/g, '')) || 0,
          status: 'New Lead',
          assignedTo: currentUser?.name || 'Unassigned',
          assignedToId: currentUser?.id || 'unassigned',
          paymentMode: 'COD',
          quantity: 1,
          serialId: '', 
          affiliateId: '' 
        } as any;

        if (leadData.phone && leadData.phone.length >= 10) {
          leadsToImport.push(leadData);
        }
      });

      if (leadsToImport.length > 0) {
        const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email?.toLowerCase() === 'tzsupportayurveda@gmail.com';
        if (!currentUser?.orgId && !isSuperAdmin) {
          toast.error('Organization ID missing');
          return;
        }
        await dataService.bulkAddLeads(currentUser?.orgId || 'root-admin', leadsToImport);
        toast.success(`Import Complete: ${leadsToImport.length} leads added successfully`);
        onOpenChange(false);
        resetInternal();
      } else {
        toast.error('No valid leads found in file');
      }
    } catch (err: any) {
      console.error(err);
      let errorMessage = 'Bulk import failed. Please check your data format.';
      
      try {
        const parsedError = JSON.parse(err.message);
        if (parsedError.error?.toLowerCase().includes('permission') || parsedError.error?.toLowerCase().includes('insufficient')) {
          errorMessage = 'Security Permission Denied. Aapke paas is action ki permission nahi hai.';
        }
      } catch (e) {
        // Not a JSON error message, use fallback
        if (err.message?.toLowerCase().includes('permission')) {
           errorMessage = 'Security Permission Denied. Aapke paas is action ki permission nahi hai.';
        }
      }

      toast.error(errorMessage);
    } finally {
      setImporting(false);
    }
  };

  const resetInternal = () => {
    setFile(null);
    setHeaders([]);
    setPreviewData([]);
    setMapping({
      name: '',
      phone: '',
      product: '',
      state: '',
      city: '',
      source: '',
      value: ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!importing) onOpenChange(val); }}>
      <DialogContent className="max-w-4xl bg-white p-0 overflow-hidden border-none rounded-3xl shadow-2xl h-[90vh] flex flex-col">
        <Tabs defaultValue="manual" className="w-full h-full flex flex-col">
          <div className="bg-slate-900 p-8 pb-0 text-white shrink-0">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-white" />
                </div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Lead Management</DialogTitle>
              </div>
              <DialogDescription className="text-slate-400 font-medium">
                एक्सेल फाइल अपलोड करें या अपनी गूगल शीट को सीधे CRM से कनेक्ट करें।
              </DialogDescription>
            </DialogHeader>
            <TabsList className="bg-white/5 border-none p-1 gap-1 h-12 mt-6 rounded-t-2xl">
              <TabsTrigger value="manual" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 text-xs font-black uppercase tracking-widest px-8">Manual Import</TabsTrigger>
              <TabsTrigger value="auto" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 text-xs font-black uppercase tracking-widest px-8">Auto Sync (Excel/Sheets)</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="manual" className="flex-1 flex flex-col overflow-hidden m-0">
            <div className="p-8 space-y-6 flex-1 overflow-y-auto bg-slate-50/50">
              {!file ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-all group"
                >
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-slate-400 group-hover:text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-700">Click to upload Excel or CSV</p>
                    <p className="text-sm text-slate-400 font-medium mt-1">Make sure your file has headers in the first row</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* ... same manual import UI ... */}
                  <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-emerald-600" />
                      <div>
                        <p className="text-sm font-bold text-emerald-900">{file.name}</p>
                        <p className="text-xs text-emerald-600/70 font-medium">{previewData.length} records found</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetInternal} className="text-xs font-bold text-emerald-700 hover:bg-emerald-100">Change File</Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">CRM Field Mapping</h4>
                      {Object.entries(mapping).map(([field, mappedHeader]) => (
                        <div key={field} className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-600 capitalize">
                            {field.replace(/([A-Z])/g, ' $1')} {field === 'name' || field === 'phone' ? '*' : ''}
                          </label>
                          <select 
                            value={mappedHeader} 
                            onChange={(e) => setMapping(prev => ({ ...prev, [field]: e.target.value }))}
                            className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          >
                            <option value="">Select Column</option>
                            {headers.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
                      <div className="relative z-10">
                        <AlertCircle className="w-8 h-8 text-emerald-400 mb-4" />
                        <h4 className="text-lg font-black uppercase tracking-tight mb-2">Instructions</h4>
                        <ul className="text-xs space-y-3 text-slate-400 font-medium">
                          <li className="flex gap-2"><span className="text-emerald-400">•</span> First row must be headings.</li>
                          <li className="flex gap-2"><span className="text-emerald-400">•</span> Name and Phone are required.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter className="p-8 bg-white border-t border-slate-100">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importing} className="text-xs font-black uppercase tracking-widest text-slate-400">Cancel</Button>
              <Button 
                onClick={handleImport}
                disabled={!file || importing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[200px] h-12 rounded-2xl text-xs font-black uppercase tracking-widest gap-2 shadow-lg shadow-emerald-600/20"
              >
                {importing ? "Importing..." : "Start Bulk Import"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="auto" className="flex-1 flex flex-col overflow-hidden m-0">
            <div className="p-8 space-y-6 flex-1 overflow-y-auto bg-slate-50/50">
              <div className="bg-emerald-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                      <FileSpreadsheet className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Auto-Connect Google Sheets</h3>
                  </div>
                  <p className="text-emerald-100 text-sm font-medium mb-6 leading-relaxed">
                    जैसे ही आपकी गूगल शीट में कोई नई लीड आए, वह सीधे CRM में पहुँच जाए, इसके लिए नीचे दिए गए स्टेप्स फॉलो करें।
                  </p>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Your CRM Webhook URL</p>
                      <code className="text-sm font-mono break-all font-bold text-white select-all">
                        {window.location.origin}/api/webhook/lead
                      </code>
                    </div>
                    <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">X-API-KEY (Header)</p>
                      <code className="text-sm font-mono font-bold text-white">crm_sync_default_key_123</code>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-white/10 blur-3xl rounded-full" />
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 border-b pb-2">How to Setup:</h4>
                <div className="grid gap-4">
                  {[
                    { step: 1, text: "अपनी Google Sheet खोलें और Extensions -> App Script पर जाएँ।" },
                    { step: 2, text: "नीचे दिया गया कोड वहां पेस्ट करें और API Key बदलें।" },
                    { step: 3, text: "Triggers (Clock Icon) पर क्लिक करें और 'On Form Submit' या 'On Change' लगावें।" }
                  ].map(s => (
                    <div key={s.step} className="flex gap-4 p-4 bg-white border border-slate-100 rounded-2xl">
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold text-sm">
                        {s.step}
                      </div>
                      <p className="text-sm font-medium text-slate-600 leading-snug">{s.text}</p>
                    </div>
                  ))}
                </div>

                <div className="p-6 bg-slate-900 rounded-3xl text-white">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Paste this code in App Script:</p>
                  <pre className="text-[10px] font-mono text-emerald-400 overflow-x-auto p-4 bg-black/30 rounded-xl leading-normal">
{`function syncCRM(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row = e.range.getRow();
  
  // Headers are in Row 1. Data starts from Row 2.
  if (row < 2) return; 

  var url = "${window.location.origin}/api/webhook/lead";
  var payload = {
    "name": sheet.getRange(row, 2).getValue(),    // Column B (Name)
    "phone": sheet.getRange(row, 3).getValue(),   // Column C (Phone)
    "package": sheet.getRange(row, 4).getValue(), // Column D (Package)
    "address": sheet.getRange(row, 5).getValue(), // Column E (Address)
    "city": sheet.getRange(row, 6).getValue(),    // Column F (City)
    "pincode": sheet.getRange(row, 7).getValue(), // Column G (Pincode)
    "method": sheet.getRange(row, 8).getValue(),  // Column H (Method)
    "price": sheet.getRange(row, 9).getValue(),   // Column I (Price)
    "source": "Google Sheet Sync"
  };

  // Only send if Name and Phone are present
  if (!payload.name || !payload.phone) return;

  var options = {
    "method": "post",
    "headers": { "x-api-key": "crm_sync_default_key_123" },
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  
  try {
    var response = UrlFetchApp.fetch(url, options);
    Logger.log(response.getContentText());
  } catch (err) {
    Logger.log("Error: " + err.toString());
  }
}`}
                  </pre>
                </div>
              </div>
            </div>
            <DialogFooter className="p-8 bg-white border-t border-slate-100">
              <Button onClick={() => onOpenChange(false)} className="w-full bg-slate-900 h-12 rounded-2xl text-xs font-black uppercase tracking-widest">
                Done, I've Setup the Script
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
