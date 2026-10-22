
import React, { useState } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogIn, ShieldCheck, Zap, Globe, Loader2, AlertCircle, Lock, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { BrandLogo } from './BrandLogo';
import { dataService } from '@/src/services/dataService';
import { toast } from 'sonner';

export function LandingPage() {
  const { signIn, login, signup, registerBusiness, resetPassword, error, loading, user, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [view, setView] = useState<'login' | 'signup' | 'register_business' | 'forgot'>('login');
  const [forgotStep, setForgotStep] = useState<'email' | 'otp'>('email');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (view === 'login') {
        await login(email, password);
      } else if (view === 'register_business') {
        if (!businessName.trim()) {
          toast.error('Business name required');
          return;
        }
        await registerBusiness(businessName.trim(), name.trim(), email.trim(), password);
      } else if (view === 'signup') {
        await signup(email, password, name);
      } else {
        // Forgot Password Flow
        toast.loading('Sending Reset Link...', { id: 'reset-loading' });
        await resetPassword(email);
        toast.success('Reset link bhej diya gaya hai! Check your email.', { id: 'reset-loading' });
        setForgotStep('otp'); // Repurposing to show the success view
      }
    } catch (err: any) {
      console.error('Action Failed:', err);
      toast.error(err.message || 'Kuchh galat ho gaya. Please try again.', { id: 'reset-loading', id2: 'reg-biz' } as any);
    } finally {
      setIsProcessing(false);
    }
  };

  const isAdminEmail = user?.email?.toLowerCase() === 'tzsupportayurveda@gmail.com';
  const isSuperAdminRole = user?.role === 'SuperAdmin';
  const hasRootAccess = isAdminEmail || isSuperAdminRole;

  if (user && user.status !== 'active' && !hasRootAccess) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 selection:bg-emerald-500/30 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-500 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[120px]"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg bg-white/5 border border-white/10 rounded-[40px] p-10 backdrop-blur-xl shadow-2xl relative z-10 text-center space-y-8"
        >
          <div className="w-24 h-24 bg-amber-500/20 rounded-3xl flex items-center justify-center mx-auto ring-1 ring-amber-500/50">
            <ShieldCheck className="w-12 h-12 text-amber-500 animate-pulse" />
          </div>
          
          <div className="space-y-4">
            <h2 className="text-3xl font-black tracking-tight">Abhi Ye Account <span className="text-amber-500">Waitlist</span> Mein Hai</h2>
            <p className="text-slate-400 font-medium leading-relaxed">
              Hello <span className="text-white font-bold">{user.name}</span>, aapka request admin ke paas approval ke liye bhej di gayi hai. <br/>
              Jab admin aapko approve kar denge, tab aap CRM use kar payenge.
            </p>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <Button 
              variant="outline" 
              className="w-full h-14 bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-2xl font-bold uppercase tracking-widest text-xs"
              onClick={() => window.location.reload()}
            >
              Refresh Status
            </Button>
            <Button 
              variant="ghost" 
              className="w-full text-slate-500 hover:text-white"
              onClick={signOut}
            >
              Log Out
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-emerald-500/30 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[120px]"></div>
      </div>

      <nav className="container mx-auto px-6 py-8 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-slate-900 rounded-xl shadow-lg shadow-black/20">
            <BrandLogo className="w-8 h-8" />
          </div>
          <span className="font-bold text-2xl tracking-tight text-white">TOZ Flow</span>
        </div>
      </nav>

      <main className="container mx-auto px-6 pt-10 pb-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-20 items-center max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
              The Ultimate <span className="text-emerald-400">CRM</span> for <br />
              Nutraceutical Growth.
            </h1>
            <p className="text-slate-400 text-lg max-w-xl leading-relaxed">
              TOZ Flow helps health brand founders manage leads, automate orders, and track inventory in real-time.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white/5 rounded-lg border border-white/10 mt-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="font-bold text-sm text-white">5-Seat Business Trial</p>
                  <p className="text-xs text-slate-500">1 Manager, 1 TL, 3 Sales Agents pre-configured.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white/5 rounded-lg border border-white/10 mt-1">
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="font-bold text-sm text-white">Isolated Workspace</p>
                  <p className="text-xs text-slate-500">Private leads, orders & staff per business.</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full max-w-md mx-auto lg:ml-auto"
          >
            <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 backdrop-blur-xl shadow-2xl relative">
              <div className="absolute -top-6 -right-6 p-4 bg-emerald-500 rounded-2xl shadow-xl shadow-emerald-500/20 rotate-12">
                <Lock className="w-6 h-6 text-white" />
              </div>

              {view === 'forgot' && forgotStep === 'otp' ? (
                <div className="text-center py-6">
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
                  >
                    <Mail className="w-10 h-10 text-emerald-500" />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
                  <p className="text-slate-400 mb-8 leading-relaxed text-sm">
                    Password reset link <b>{email}</b> par bhej diya gaya hai. 
                    Kripya apna inbox check karein aur link par click karke password change karein.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full border-white/10 text-white font-bold hover:bg-white/5 h-12 rounded-xl uppercase tracking-widest text-xs"
                    onClick={() => { setView('login'); setForgotStep('email'); }}
                  >
                    Back to Login
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex p-1 bg-white/5 rounded-2xl mb-8 gap-1">
                    <button 
                      className={cn("flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all", view === 'login' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-slate-400 hover:text-white")}
                      onClick={() => setView('login')}
                    >
                      Login
                    </button>
                    <button 
                      className={cn("flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all", view === 'register_business' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-slate-400 hover:text-white")}
                      onClick={() => setView('register_business')}
                    >
                      Business Trial
                    </button>
                    <button 
                      className={cn("flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all", view === 'signup' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-slate-400 hover:text-white")}
                      onClick={() => setView('signup')}
                    >
                      Join Team
                    </button>
                  </div>

                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">
                      {view === 'login' ? 'Secure Login' : 
                       view === 'register_business' ? 'Launch Business CRM' :
                       view === 'signup' ? 'Request Team Access' : 'Reset Secret Key'}
                    </h2>
                    <p className="text-slate-500 text-sm font-medium">
                      {view === 'login' ? 'Enter your ID and secret key to access workspace.' : 
                       view === 'register_business' ? 'Instant 5-seat setup (1 Manager, 1 TL, 3 Agents).' :
                       view === 'signup' ? 'Provide your details for admin approval.' : 
                       'Enter your email to receive a reset link.'}
                    </p>
                  </div>

                  {view === 'register_business' && (
                    <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>Free 5-Seat Trial activated automatically with full lead isolation.</span>
                    </div>
                  )}

                  {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-200">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p className="text-sm font-medium italic leading-relaxed">{error}</p>
                    </div>
                  )}

                  <div className="space-y-6">
                    <form onSubmit={handleAction} className="space-y-4">
                      {view === 'register_business' && (
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Business / Brand Name</label>
                          <Input 
                            placeholder="e.g. AyurVeda Healthcare" 
                            className="bg-white/5 border-white/10 h-12 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 text-white placeholder:text-slate-600"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            required
                          />
                        </div>
                      )}

                      {(view === 'signup' || view === 'register_business') && (
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                            {view === 'register_business' ? 'Founder / Manager Name' : 'Full Name'}
                          </label>
                          <Input 
                            placeholder={view === 'register_business' ? 'Manager Name' : 'Agent Name'} 
                            className="bg-white/5 border-white/10 h-12 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 text-white placeholder:text-slate-600"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                          {view === 'register_business' ? 'Business Work Email' : 'ID (Email)'}
                        </label>
                        <Input 
                          type="email" 
                          placeholder="name@company.com" 
                          className="bg-white/5 border-white/10 h-12 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 text-white placeholder:text-slate-600"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>

                      {view !== 'forgot' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between ml-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Secret Key (Password)</label>
                            {view === 'login' && (
                              <button 
                                type="button" 
                                onClick={() => { setView('forgot'); setForgotStep('email'); }}
                                className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-wider"
                              >
                                Forgot?
                              </button>
                            )}
                          </div>
                          <Input 
                            type="password" 
                            placeholder="••••••••" 
                            className="bg-white/5 border-white/10 h-12 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 text-white placeholder:text-slate-600"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                          />
                        </div>
                      )}

                      <div className="pt-2">
                        <Button 
                          className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/10 active:scale-[0.98]" 
                          type="submit"
                          disabled={loading || isProcessing}
                        >
                          {(loading || isProcessing) ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : (
                            view === 'login' ? <LogIn className="w-5 h-5 mr-2" /> : 
                            view === 'register_business' ? <ShieldCheck className="w-5 h-5 mr-2" /> :
                            view === 'signup' ? <ShieldCheck className="w-5 h-5 mr-2" /> : 
                            <Zap className="w-5 h-5 mr-2" />
                          )}
                          {view === 'login' ? 'Enter with ID' : 
                           view === 'register_business' ? 'Start 5-Seat Business Workspace' :
                           view === 'signup' ? 'Send Request' : 'Send Reset Link'}
                        </Button>
                      </div>
                    </form>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/5"></div>
                      </div>
                      <div className="relative flex justify-center text-[10px] uppercase font-black tracking-[0.2em] text-slate-600">
                        <span className="bg-[#0f172a] px-4">OR</span>
                      </div>
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full bg-slate-900 border-white/10 hover:bg-slate-800 text-white h-12 rounded-xl transition-all font-bold gap-3"
                      onClick={signIn}
                      disabled={loading || isProcessing}
                    >
                      <Globe className="w-5 h-5" /> Continue with Google
                    </Button>

                    {view === 'forgot' && (
                      <button 
                        type="button" 
                        onClick={() => setView('login')}
                        className="w-full text-xs font-bold text-slate-500 hover:text-white uppercase tracking-widest"
                      >
                        Back to Login
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 mt-auto">
        <div className="container mx-auto px-6 text-center text-slate-600 text-xs">
          &copy; 2024 TOZ Flow CRM • Enterprise Security Active
        </div>
      </footer>
    </div>
  );
}
