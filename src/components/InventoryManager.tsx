
import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  AlertTriangle,
  ArrowUpDown,
  History,
  Box,
  Loader2,
  Plus,
  Minus,
  Trash2,
  Tag,
  IndianRupee,
  Factory
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
import { cn } from '@/lib/utils';
import { dataService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';
import { InventoryItem, Lead } from '@/src/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';

export function InventoryManager() {
  const { user: currentUser } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [newStock, setNewStock] = useState<number>(0);
  
  const [newItem, setNewItem] = useState({
    name: '',
    category: '',
    sku: '',
    stock: 0,
    minStock: 5,
    price: 0,
    description: ''
  });

  useEffect(() => {
    if (!currentUser) return;

    const unsubInv = dataService.subscribeInventory(currentUser.orgId || '', (data) => {
      setItems(data);
      setLoading(false);
    });

    // Subscribe to leads to see confirmed demand if needed
    const unsubLeads = dataService.subscribeLeads(currentUser, (data) => {
      setLeads(data);
    });

    return () => {
      unsubInv();
      unsubLeads();
    };
  }, [currentUser]);

  const handleSyncDefaultRates = async () => {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
    if (!currentUser?.orgId && !isSuperAdmin) return;
    
    const defaultProducts = [
      { name: 'Advanced Gel Formula', price: 2999, category: 'Gel', sku: 'AGF-001' },
      { name: 'Zosh Tablets (30 Caps)', price: 2999, category: 'Tablets', sku: 'ZT-030' },
      { name: 'Booster 3X Pills', price: 2599, category: 'Pills', sku: 'B3X-001' },
      { name: 'Booster Cream', price: 2590, category: 'Cream', sku: 'BC-001' }
    ];

    setLoading(true);
    try {
      const orgId = currentUser?.orgId || 'root-admin';
      
      for (const defProd of defaultProducts) {
        const existing = items.find(i => i.name.toLowerCase() === defProd.name.toLowerCase());
        if (existing) {
          await dataService.updateInventoryItem(existing.id, { price: defProd.price });
        } else {
          await dataService.addInventoryItem(orgId, {
            orgId,
            name: defProd.name,
            price: defProd.price,
            category: defProd.category,
            sku: defProd.sku,
            stock: 100,
            minStock: 10,
            description: 'Default Product Rate Sync'
          });
        }
      }
      toast.success('Rates successfully synced to catalog');
    } catch (err) {
      console.error(err);
      toast.error('Sync failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
    if (!currentUser?.orgId && !isSuperAdmin) return;
    try {
      await dataService.addInventoryItem(currentUser?.orgId || 'root-admin', {
        ...newItem,
        orgId: currentUser?.orgId || 'root-admin'
      });
      toast.success('Successfully added to catalog');
      setIsAddOpen(false);
      setNewItem({ name: '', category: '', sku: '', stock: 0, minStock: 5, price: 0, description: '' });
    } catch (err) {
      toast.error('Galti: Item add nahi hua');
    }
  };

  const handleUpdateStock = async () => {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
    if (!selectedItem || (!currentUser?.orgId && !isSuperAdmin)) return;
    try {
      await dataService.updateStock(currentUser?.orgId || 'root-admin', selectedItem.id, newStock);
      toast.success('Inventory ledger updated');
      setIsUpdateOpen(false);
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const handleDelete = async (id: string) => {
    const isSuperAdmin = currentUser?.role === 'SuperAdmin' || currentUser?.email === 'tzsupportayurveda@gmail.com';
    if (!currentUser?.orgId && !isSuperAdmin) return;
    if (confirm('Are you sure? This item will be purged from catalog.')) {
      try {
        await dataService.deleteInventoryItem(currentUser?.orgId || 'root-admin', id);
        toast.success('Item removed');
      } catch (e) {
        toast.error('Deletion failed');
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Master Inventory</h1>
            <Badge className="bg-amber-100 text-amber-700 border-none font-black text-[9px] uppercase tracking-widest px-2.5">
              Live Ledger
            </Badge>
          </div>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-tight">Stock level monitoring and asset procurement tracking.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleSyncDefaultRates}
            variant="outline"
            disabled={loading}
            className="border-slate-200 hover:bg-slate-50 text-slate-600 gap-2 font-black uppercase text-[10px] tracking-widest h-11 px-6 rounded-xl"
          >
            <History className="w-4 h-4 text-indigo-400" /> 
            {loading ? 'Syncing...' : 'Sync Default Rates'}
          </Button>
          <Button 
            onClick={() => setIsAddOpen(true)}
            className="neo-shadow bg-slate-900 hover:bg-black text-white gap-2 font-black uppercase text-[10px] tracking-widest h-11 px-6 rounded-xl"
          >
            <Plus className="w-4 h-4 text-emerald-400" /> Register New Asset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/10 flex items-center justify-between group hover:border-indigo-200 transition-colors">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total SKU Count</p>
            <p className="text-2xl font-black text-slate-900">{items.length}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
            <Box className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xl shadow-slate-200/10 flex items-center justify-between group hover:border-rose-200 transition-colors">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Critical Stock</p>
            <p className="text-2xl font-black text-rose-600">{items.filter(i => i.stock <= i.minStock).length}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-2xl shadow-slate-200/20 overflow-hidden neo-shadow min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-32 gap-4">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Master Ledger...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-32 text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-200">
              <Package className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <p className="text-xl font-black text-slate-900 uppercase tracking-tight">Catalog Is Empty</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-loose">Register your first product to begin tracking fulfillments.</p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="h-16 hover:bg-transparent border-b-slate-100">
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-8">Product Entity</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Identification</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Inventory Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] px-4">Price Point</TableHead>
                <TableHead className="w-20 px-8 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isCritical = item.stock <= item.minStock;
                return (
                  <TableRow key={item.id} className="h-24 hover:bg-slate-50/30 group transition-all border-b-slate-50">
                    <TableCell className="px-8">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                          isCritical ? "bg-rose-50 text-rose-600" : "bg-slate-900 text-white"
                        )}>
                          <Tag className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{item.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{item.category}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-indigo-600 font-mono">#{item.sku}</span>
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mt-1">SKU_REF</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col min-w-[100px]">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={cn(
                              "text-sm font-black tracking-tighter",
                              isCritical ? "text-rose-600" : "text-slate-900"
                            )}>
                              {item.stock} / {item.minStock}
                            </span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Stock Units</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all duration-1000 ease-out",
                                isCritical ? "bg-rose-500" : "bg-indigo-500"
                              )}
                              style={{ width: `${Math.min(100, (item.stock / (item.minStock * 4)) * 100)}%` }}
                            />
                          </div>
                        </div>
                        {isCritical && (
                          <div className="flex items-center gap-1 text-rose-600 animate-pulse">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-tighter">Refill Required</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex items-center gap-1 font-mono text-base font-black text-slate-900 underline decoration-indigo-200 underline-offset-4">
                        <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                        {item.price.toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell className="px-8 text-right">
                      <div className="flex items-center justify-end gap-2 pr-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 border border-slate-200 hover:bg-slate-900 hover:text-white rounded-xl transition-all"
                          onClick={() => {
                            setSelectedItem(item);
                            setNewStock(item.stock);
                            setIsUpdateOpen(true);
                          }}
                        >
                          <History className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 border border-slate-200 hover:bg-rose-600 hover:text-white rounded-xl transition-all"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add Item Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl animate-in zoom-in-95 duration-200">
          <form onSubmit={handleAddItem}>
            <div className="bg-slate-900 p-8 text-white flex items-center justify-between">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-2">Inventory Management</h4>
                <h2 className="text-2xl font-black tracking-tight uppercase">Catalog Registration</h2>
              </div>
              <div className="p-4 bg-white/10 rounded-3xl">
                <Plus className="w-6 h-6 text-indigo-400" />
              </div>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Product Name</Label>
                  <Input 
                    required 
                    value={newItem.name}
                    onChange={e => setNewItem({...newItem, name: e.target.value})}
                    placeholder="E.g. Booster 3X Pills" 
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl px-4 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Category Tag</Label>
                  <Input 
                    required 
                    value={newItem.category}
                    onChange={e => setNewItem({...newItem, category: e.target.value})}
                    placeholder="Supplements" 
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl px-4 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">SKU Code</Label>
                  <Input 
                    required 
                    value={newItem.sku}
                    onChange={e => setNewItem({...newItem, sku: e.target.value})}
                    placeholder="NF-B3X-001" 
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl px-4 font-black text-indigo-600 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unit Price (₹)</Label>
                  <Input 
                    type="number" 
                    required 
                    value={newItem.price}
                    onChange={e => setNewItem({...newItem, price: Number(e.target.value)})}
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl px-4 font-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 border-t border-slate-100 pt-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Initial Stock Units</Label>
                  <Input 
                    type="number" 
                    required 
                    value={newItem.stock}
                    onChange={e => setNewItem({...newItem, stock: Number(e.target.value)})}
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl px-4 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-rose-400">Threshold Alert Level</Label>
                  <Input 
                    type="number" 
                    required 
                    value={newItem.minStock}
                    onChange={e => setNewItem({...newItem, minStock: Number(e.target.value)})}
                    className="h-12 bg-rose-50 border-rose-100 rounded-xl px-4 font-bold text-rose-600"
                  />
                </div>
              </div>

              <DialogFooter className="pt-4">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-xl h-12 font-bold px-6 text-slate-400"
                >
                  Discard
                </Button>
                <Button 
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 font-black uppercase text-[10px] tracking-widest px-8 shadow-xl shadow-indigo-100"
                >
                  Publish Asset
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Update Stock Dialog */}
      <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-slate-900 p-8 text-white">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-2">Stock Ledger</h4>
            <h2 className="text-2xl font-black uppercase">{selectedItem?.name}</h2>
            <p className="mt-2 text-xs font-bold text-white/40">Manual stock adjustment and procurement log.</p>
          </div>
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Inventory</span>
                <span className="text-2xl font-black text-slate-900">{selectedItem?.stock} Units</span>
              </div>
              <ArrowUpDown className="w-6 h-6 text-slate-300" />
              <div className="flex flex-col text-right">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Adjustment To</span>
                <span className="text-2xl font-black text-indigo-600">{newStock} Units</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-6">
              <Button 
                variant="outline" 
                size="icon" 
                className="w-14 h-14 rounded-2xl border-2 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all"
                onClick={() => setNewStock(Math.max(0, newStock - 10))}
              >
                <Minus className="w-6 h-6" />
              </Button>
              <div className="flex flex-col items-center gap-1 flex-1">
                <Input 
                  type="number"
                  value={newStock}
                  onChange={e => setNewStock(Number(e.target.value))}
                  className="h-16 text-center text-2xl font-black text-slate-900 border-none bg-slate-50 rounded-2xl ring-2 ring-slate-100 focus-visible:ring-indigo-200"
                />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Precise Entry</span>
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                className="w-14 h-14 rounded-2xl border-2 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-100 transition-all"
                onClick={() => setNewStock(newStock + 10)}
              >
                <Plus className="w-6 h-6" />
              </Button>
            </div>

            <div className="flex gap-4">
              <Button 
                variant="ghost" 
                onClick={() => setIsUpdateOpen(false)}
                className="flex-1 h-14 rounded-2xl font-bold text-slate-400"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateStock}
                className="flex-1 h-14 bg-slate-900 hover:bg-black text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl shadow-slate-200"
              >
                Update Ledger
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

