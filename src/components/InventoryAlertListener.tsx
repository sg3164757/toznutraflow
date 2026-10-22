
import { useEffect, useRef } from 'react';
import { dataService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';
import { toast } from 'sonner';
import { AlertTriangle, Box, ArrowRight } from 'lucide-react';

export function InventoryAlertListener() {
  const { user } = useAuth();
  // Map of itemId -> last seen stock level that we alerted for
  const lastAlertedStockRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!user?.id || !user?.orgId) return;
    
    // Only Admin, Manager, and Inventory roles should see these alerts
    if (!['Admin', 'Manager', 'Inventory'].includes(user.role)) return;

    const unsub = dataService.subscribeInventory(user.orgId, (items) => {
      items.forEach(item => {
        // If stock is below or at minStock
        if (item.stock <= item.minStock) {
          // Only alert if we haven't alerted for this specific stock level yet
          if (lastAlertedStockRef.current[item.id] !== item.stock) {
            toast(
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-black text-[10px] uppercase tracking-widest">
                    Critical Stock Alert
                  </span>
                </div>
                <div className="flex flex-col">
                  <p className="text-sm font-black text-slate-900 uppercase">{item.name}</p>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-tight flex items-center gap-1.5 mt-0.5">
                    Stock: <span className="text-red-500 font-black font-mono">{item.stock}</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                    Threshold: <span className="text-slate-900 font-black font-mono">{item.minStock}</span>
                  </p>
                </div>
              </div>,
              {
                duration: 8000,
                icon: <Box className="w-4 h-4 text-amber-500" />,
              }
            );

            // Update ref
            lastAlertedStockRef.current[item.id] = item.stock;
          }
        } else {
          // If stock is now above threshold, clear the last alerted stock level
          if (lastAlertedStockRef.current[item.id] !== undefined) {
            delete lastAlertedStockRef.current[item.id];
          }
        }
      });
    });

    return () => unsub();
  }, [user?.id, user?.orgId, user?.role]);

  return null;
}
