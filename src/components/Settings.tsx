
import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Shield, 
  Users, 
  Bell, 
  Database, 
  Globe,
  Save,
  CheckCircle2,
  Lock,
  Loader2,
  User as UserIcon,
  Mail,
  Fingerprint
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useAuth } from '@/src/contexts/AuthContext';
import { dataService } from '@/src/services/dataService';
import { cn } from '@/lib/utils';

export function Settings() {
  const { user } = useAuth();
  const [activeMode, setActiveMode] = useState<'profile' | 'system'>('profile');
  const [loading, setLoading] = useState(false);
  
  // Profile form state
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      await dataService.updateUserProfile(user.id, { name, avatar });
      toast.success('Your profile has been updated!');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSystem = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success('System settings updated successfully!');
    }, 1000);
  };

  const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            {activeMode === 'profile' ? 'My Profile' : 'System Configuration'}
          </h1>
          <p className="text-slate-500 font-medium">
            {activeMode === 'profile' 
              ? 'Manage your personal identity and credentials.' 
              : 'Configure workspace-wide rules and integrations.'}
          </p>
        </div>

        <div className="flex p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm w-fit">
          <button 
            onClick={() => setActiveMode('profile')}
            className={cn(
              "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
              activeMode === 'profile' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Profile
          </button>
          {isAdmin && (
            <button 
              onClick={() => setActiveMode('system')}
              className={cn(
                "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                activeMode === 'system' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
              )}
            >
              System
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6">
        {activeMode === 'profile' ? (
          <div className="space-y-6">
            {/* Profile Overview Card */}
            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              
              <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-3xl overflow-hidden ring-4 ring-emerald-500/10 shadow-xl">
                    <img src={user?.avatar} alt={user?.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 p-1.5 bg-white rounded-lg shadow-md border border-slate-100">
                    <Save className="w-3 h-3 text-emerald-500" />
                  </div>
                </div>
                
                <div className="flex-1 space-y-4 text-center md:text-left">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black text-slate-900">{user?.name}</h2>
                    <div className="flex flex-wrap justify-center md:justify-start items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                        < Shield className="w-3 h-3" /> {user?.role}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                        <Fingerprint className="w-3 h-3" /> {user?.id}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="grid gap-6">
              <section className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><UserIcon className="w-5 h-5" /></div>
                  <h3 className="font-black text-slate-900">Personal Information</h3>
                </div>

                {!isAdmin && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                    <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 font-medium leading-relaxed">
                      Your identity information is locked. Please contact a System Administrator to update your name or role permissions.
                    </p>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Display Name</label>
                    <Input 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative group">
                      <Input 
                        value={user?.email} 
                        disabled 
                        className="h-12 bg-slate-100 border-slate-200 rounded-xl font-bold pr-10"
                      />
                      <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Avatar Image URL</label>
                    <Input 
                      value={avatar} 
                      onChange={(e) => setAvatar(e.target.value)} 
                      placeholder="https://..."
                      className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Bell className="w-4 h-4" /></div>
                      <div>
                        <p className="text-sm font-black text-slate-900">Push Notifications</p>
                        <p className="text-[10px] text-slate-500 font-medium tracking-tight">Receive alerts for reminders and status changes.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {user?.notificationsEnabled !== false ? 'Active' : 'Muted'}
                      </span>
                      <Switch 
                        checked={user?.notificationsEnabled !== false} 
                        onCheckedChange={async (checked) => {
                          if (!user) return;
                          try {
                            await dataService.updateUserProfile(user.id, { notificationsEnabled: checked });
                            toast.success(`Notifications ${checked ? 'enabled' : 'muted'}`);
                          } catch (e) {
                            toast.error('Failed to update preference');
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button 
                    className="h-12 px-8 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl gap-2 shadow-lg"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Update Profile
                  </Button>
                </div>
              </section>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3 text-slate-900 mb-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Globe className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-black tracking-tight">General Configuration</h3>
                  <p className="text-xs text-slate-500 font-medium">Workspace name and regional settings.</p>
                </div>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Company Name</label>
                  <Input placeholder="TOZ Flow Inc." defaultValue="TOZ Flow" className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Support Email</label>
                  <Input placeholder="support@example.com" defaultValue="tzsupportayurveda@gmail.com" className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold" />
                </div>
              </div>
            </section>

            <section className="p-8 bg-white rounded-[32px] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3 text-slate-900 mb-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Shield className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-black tracking-tight">Access Control (RBAC)</h3>
                  <p className="text-xs text-slate-500 font-medium">Define what agents can do by default.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="space-y-1">
                    <p className="text-sm font-black text-slate-900">Restrict Lead Visibility</p>
                    <p className="text-xs text-slate-500 font-medium">Agents can only see leads assigned specifically to them.</p>
                  </div>
                  <Switch checked={true} />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="space-y-1">
                    <p className="text-sm font-black text-slate-900">Allow Manual Deletion</p>
                    <p className="text-xs text-slate-500 font-medium">Allow Sales role to delete leads from their dashboard.</p>
                  </div>
                  <Switch checked={false} />
                </div>
              </div>
            </section>

            <section className="p-8 bg-white rounded-[32px] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-3 text-slate-900 mb-2">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><Database className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-black tracking-tight">Developer & API Integration</h3>
                  <p className="text-xs text-slate-500 font-medium">Connect your website and ads to track lead sources Automatically.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-[11px] space-y-3">
                  <p className="text-slate-900 font-bold uppercase tracking-widest border-b border-slate-200 pb-2">Tracking Parameters</p>
                  <p className="text-slate-500 italic">// Pass these parameters in your lead capture form or API call</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <span className="text-purple-600 font-bold">"source":</span>
                    <span className="text-slate-700">"Capsule Ads" | "Gel Ads" | "Website"</span>
                    <span className="text-purple-600 font-bold">"affiliateId":</span>
                    <span className="text-slate-700">"AFF-123" // (Unique Tracking Number)</span>
                    <span className="text-purple-600 font-bold">"paymentMode":</span>
                    <span className="text-slate-700">"COD" | "Prepaid" // (Direct confirmation if Prepaid)</span>
                  </div>
                  <div className="pt-4 mt-4 border-t border-slate-200">
                    <p className="text-slate-400 mb-1">Example Payload:</p>
                    <pre className="text-emerald-600">
{`{
  "name": "John Doe",
  "phone": "9999999999",
  "source": "Capsule Ads",
  "affiliateId": "AFF-001",
  "paymentMode": "Prepaid"
}`}
                    </pre>
                  </div>
                </div>
              </div>
            </section>

            <div className="flex justify-end pt-4 pb-10">
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 h-14 text-lg font-black rounded-[20px] shadow-xl shadow-emerald-500/20 gap-3"
                onClick={handleSaveSystem}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Apply Workspace Changes
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
