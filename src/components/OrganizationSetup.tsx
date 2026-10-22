
import React, { useState } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { dataService } from '@/src/services/dataService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Building2, Plus, LogOut, Loader2, ArrowRight, ShieldCheck, Globe, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { BrandLogo } from './BrandLogo';

export function OrganizationSetup() {
  const { user, signOut } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'selection' | 'create'>('selection');

  const handleCreateOrg = async () => {
    if (!orgName.trim() || !user) return;
    
    setLoading(true);
    try {
      await dataService.createOrganization(orgName, user.id);
      toast.success("Organization created successfully! Welcome to your new workspace.");
    } catch (error) {
      console.error("Creation error:", error);
      toast.error("Failed to create organization. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse"></div>
      </div>

      <div className="w-full max-w-lg relative z-10">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center p-3 shadow-2xl backdrop-blur-xl">
            <BrandLogo />
          </div>
        </div>

        <Card className="bg-slate-900/50 border-white/10 backdrop-blur-2xl shadow-2xl overflow-hidden rounded-3xl">
          <CardHeader className="text-center pt-8 pb-4">
            <CardTitle className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-3 lowercase italic opacity-40">
              Welcome, {user?.name.split(' ')[0]}
            </CardTitle>
            <CardTitle className="text-3xl font-black text-white tracking-tight mt-2">
              Setup Your Business
            </CardTitle>
            <CardDescription className="text-slate-400 font-medium">
              Join an existing organization or build your own lead power-house.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6 pt-4">
            {mode === 'selection' ? (
              <div className="space-y-4">
                <button 
                  onClick={() => setMode('create')}
                  className="w-full group p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-white">Create Business Workspace</h3>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md">5-Seat Trial</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">Includes 1 Manager, 1 Team Leader, and 3 Sales Agent seats with private lead isolation.</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-500 transition-colors mt-1" />
                </button>

                <div className="p-6 rounded-2xl bg-slate-950/50 border border-white/5 opacity-50 cursor-not-allowed">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-300 mb-1">Join Organization</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">Contact your manager to add your email ({user?.email}) to their workspace.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Business / Brand Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input 
                      placeholder="e.g. Acme Marketing PVT LTD"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="bg-white/5 border-white/10 h-14 pl-12 text-white placeholder:text-slate-600 rounded-xl focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center text-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">Lead Security</span>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center text-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">Round Robin</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-12 font-bold border-white/10 text-white hover:bg-white/5"
                    onClick={() => setMode('selection')}
                  >
                    Back
                  </Button>
                  <Button 
                    className="flex-[2] h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest"
                    disabled={!orgName.trim() || loading}
                    onClick={handleCreateOrg}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Launch Workspace"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex-col gap-4 pb-8 border-t border-white/5 pt-6 bg-white/[0.02]">
            <div className="flex items-center gap-2 text-slate-500">
              <Globe className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Ready for leadvertex-style enterprise scale</span>
            </div>
            <Button 
              variant="link" 
              className="text-slate-400 hover:text-white h-auto p-0 flex items-center gap-2 text-xs font-bold"
              onClick={signOut}
            >
              <LogOut className="w-3 h-3" />
              Different Account? Sign Out
            </Button>
          </CardFooter>
        </Card>
        
        <p className="text-center mt-8 text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 animate-pulse">
          Powered by LeadForce Enterprise
        </p>
      </div>
    </div>
  );
}
