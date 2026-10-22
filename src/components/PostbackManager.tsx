import React, { useState, useEffect, useMemo } from 'react';
import { 
  Radio, 
  Send, 
  Share2, 
  ExternalLink, 
  Copy, 
  Check, 
  Activity, 
  Sparkles, 
  RefreshCw, 
  Play, 
  Flame, 
  Zap, 
  Settings, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Layers, 
  ArrowUpRight, 
  Search, 
  Filter, 
  Code, 
  Terminal, 
  Globe, 
  HelpCircle,
  AlertTriangle,
  FileText,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Lead, Order, User, PostbackConfig, PostbackLog, PostbackEventTrigger } from '@/src/types';
import { dataService } from '@/src/services/dataService';
import { useAuth } from '@/src/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';

interface PostbackManagerProps {
  onNavigateToLeads?: () => void;
}

const PRESETS = [
  {
    name: 'TrafficStars CPA Postback',
    adNetwork: 'TrafficStars' as const,
    url: 'https://tsyndicate.com/api/v1/cpa/action?key=YOUR_API_KEY&clickid={clickid}&action={action}&payout={payout}',
    description: 'Standard TrafficStars S2S Conversion Postback. Sends dynamic event actions and payouts to TrafficStars.',
    events: [
      { event: 'lead_created' as PostbackEventTrigger, enabled: true, actionName: 'lead', payout: 0, currency: 'INR' },
      { event: 'order_confirmed' as PostbackEventTrigger, enabled: true, actionName: 'confirm', payout: 250, currency: 'INR' },
      { event: 'order_delivered' as PostbackEventTrigger, enabled: true, actionName: 'sale', payout: 500, currency: 'INR' }
    ]
  },
  {
    name: 'ExoClick S2S Postback',
    adNetwork: 'ExoClick' as const,
    url: 'https://main.exoclick.com/tag.php?goal=YOUR_GOAL_ID&tag={clickid}&value={payout}',
    description: 'ExoClick conversion tracking with dynamic tag (clickId) and payout values.',
    events: [
      { event: 'order_confirmed' as PostbackEventTrigger, enabled: true, actionName: 'confirm', payout: 200, currency: 'INR' },
      { event: 'order_delivered' as PostbackEventTrigger, enabled: true, actionName: 'delivery', payout: 450, currency: 'INR' }
    ]
  },
  {
    name: 'PropellerAds S2S Postback',
    adNetwork: 'PropellerAds' as const,
    url: 'http://ad.propellerads.com/conversion.php?aid=YOUR_AID&tid=YOUR_TID&visitor_id={clickid}&payout={payout}',
    description: 'PropellerAds CPA tracking postback with visitor_id macro mapping.',
    events: [
      { event: 'lead_created' as PostbackEventTrigger, enabled: true, actionName: 'lead', payout: 0, currency: 'INR' },
      { event: 'order_delivered' as PostbackEventTrigger, enabled: true, actionName: 'conversion', payout: 400, currency: 'INR' }
    ]
  },
  {
    name: 'Custom Ad Network Postback',
    adNetwork: 'Custom' as const,
    url: 'https://your-adnetwork.com/postback?clickid={clickid}&event={action}&payout={payout}&order_id={lead_id}',
    description: 'Custom webhook or S2S URL with dynamic tokens.',
    events: [
      { event: 'lead_created' as PostbackEventTrigger, enabled: true, actionName: 'lead', payout: 0, currency: 'INR' },
      { event: 'order_confirmed' as PostbackEventTrigger, enabled: true, actionName: 'confirmed', payout: 200, currency: 'INR' },
      { event: 'order_delivered' as PostbackEventTrigger, enabled: true, actionName: 'sale', payout: 500, currency: 'INR' }
    ]
  }
];

export function PostbackManager({ onNavigateToLeads }: PostbackManagerProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'analytics' | 'configs' | 'setup' | 'logs'>('analytics');
  const [configs, setConfigs] = useState<PostbackConfig[]>([]);
  const [logs, setLogs] = useState<PostbackLog[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Partial<PostbackConfig> | null>(null);
  
  // Test Ping State
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testUrl, setTestUrl] = useState('https://tsyndicate.com/api/v1/cpa/action?key=SAMPLE_KEY&clickid={clickid}&action={action}&payout={payout}');
  const [testClickId, setTestClickId] = useState('ts_click_' + Math.floor(Math.random() * 899999 + 100000));
  const [testAction, setTestAction] = useState('lead');
  const [testPayout, setTestPayout] = useState('10.00');
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Campaign URL Builder State
  const [landingBaseUrl, setLandingBaseUrl] = useState('https://myshop.com/product');
  const [selectedNetworkForUrl, setSelectedNetworkForUrl] = useState<'TrafficStars' | 'ExoClick' | 'PropellerAds'>('TrafficStars');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Filters for logs
  const [logSearch, setLogSearch] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [logEventFilter, setLogEventFilter] = useState<string>('all');

  const orgId = user?.orgId || 'root-admin';

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const unsubConfigs = dataService.subscribePostbacks(user, (data) => {
      setConfigs(data);
    });

    const unsubLogs = dataService.subscribePostbackLogs(user, (data) => {
      setLogs(data);
    });

    const unsubLeads = dataService.subscribeLeads(user, (data) => {
      setLeads(data);
    });

    const unsubOrders = dataService.subscribeOrders(user, (data) => {
      setOrders(data);
      setLoading(false);
    });

    return () => {
      unsubConfigs();
      unsubLogs();
      unsubLeads();
      unsubOrders();
    };
  }, [user]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Analytics Computations
  const stats = useMemo(() => {
    const clickTrackedLeads = leads.filter(l => Boolean(l.clickId));
    const trafficStarLeads = leads.filter(l => 
      (l.source && l.source.toLowerCase().includes('traffic')) || 
      (l.adSource && l.adSource.toLowerCase().includes('traffic')) ||
      Boolean(l.clickId)
    );

    const confirmedTracked = clickTrackedLeads.filter(l => l.status === 'Order Confirmed' || l.status === 'Dispatched' || l.status === 'Shipped' || l.status === 'Delivered');
    const deliveredTracked = clickTrackedLeads.filter(l => l.status === 'Delivered');

    const totalFired = logs.length;
    const successfulFired = logs.filter(l => l.status === 'success').length;
    const failedFired = logs.filter(l => l.status === 'failed').length;

    const totalPostbackPayout = logs
      .filter(l => l.status === 'success')
      .reduce((sum, l) => sum + (l.payout || 0), 0);

    const conversionRate = clickTrackedLeads.length > 0 
      ? ((confirmedTracked.length / clickTrackedLeads.length) * 100).toFixed(1) 
      : '0.0';

    const deliveryRate = confirmedTracked.length > 0
      ? ((deliveredTracked.length / confirmedTracked.length) * 100).toFixed(1)
      : '0.0';

    return {
      clickTrackedLeadsCount: clickTrackedLeads.length,
      trafficStarLeadsCount: trafficStarLeads.length,
      confirmedCount: confirmedTracked.length,
      deliveredCount: deliveredTracked.length,
      totalFired,
      successfulFired,
      failedFired,
      totalPostbackPayout,
      conversionRate,
      deliveryRate
    };
  }, [leads, logs]);

  // Open Edit Config Dialog
  const handleOpenEdit = (config?: PostbackConfig) => {
    if (config) {
      setEditingConfig({ ...config });
    } else {
      // Default to TrafficStars preset
      const preset = PRESETS[0];
      setEditingConfig({
        name: 'TrafficStars Campaign Postback',
        adNetwork: 'TrafficStars',
        postbackUrl: preset.url,
        isActive: true,
        events: preset.events
      });
    }
    setIsConfigDialogOpen(true);
  };

  // Apply Preset
  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setEditingConfig({
      name: preset.name,
      adNetwork: preset.adNetwork,
      postbackUrl: preset.url,
      isActive: true,
      events: preset.events
    });
    toast.success(`Applied ${preset.name} template!`);
  };

  // Save Config
  const handleSaveConfig = async () => {
    if (!editingConfig?.name || !editingConfig?.postbackUrl) {
      toast.error('Please enter a name and postback URL.');
      return;
    }

    try {
      await dataService.savePostbackConfig(orgId, editingConfig);
      toast.success('Postback configuration saved successfully!');
      setIsConfigDialogOpen(false);
      setEditingConfig(null);
    } catch (e: any) {
      toast.error('Failed to save config: ' + e.message);
    }
  };

  // Toggle active
  const handleToggleStatus = async (id: string, current: boolean) => {
    try {
      await dataService.togglePostbackStatus(id, !current);
      toast.success(`Postback ${!current ? 'Activated' : 'Paused'}`);
    } catch (e: any) {
      toast.error('Error updating postback status');
    }
  };

  // Delete Config
  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Postback configuration?')) return;
    try {
      await dataService.deletePostbackConfig(id);
      toast.success('Postback deleted.');
    } catch (e: any) {
      toast.error('Error deleting postback');
    }
  };

  // Run Live Postback Test
  const handleRunTest = async () => {
    if (!testUrl) {
      toast.error('Please enter a postback URL to test.');
      return;
    }
    setTestRunning(true);
    setTestResult(null);
    try {
      const res = await dataService.testPostbackUrl(testUrl, {
        clickId: testClickId,
        action: testAction,
        payout: Number(testPayout) || 0
      });
      setTestResult(res);
      if (res.success) {
        toast.success(`Postback Ping Success! HTTP ${res.httpCode}`);
      } else {
        toast.warning(`Postback Ping Response: HTTP ${res.httpCode || 'Error'}`);
      }
    } catch (err: any) {
      setTestResult({ success: false, errorMessage: err.message });
      toast.error('Ping test failed');
    } finally {
      setTestRunning(false);
    }
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (logStatusFilter !== 'all' && log.status !== logStatusFilter) return false;
      if (logEventFilter !== 'all' && log.event !== logEventFilter) return false;
      if (logSearch) {
        const q = logSearch.toLowerCase();
        const matchLead = log.leadName?.toLowerCase().includes(q) || log.leadPhone?.includes(q);
        const matchClick = log.clickId?.toLowerCase().includes(q);
        const matchNetwork = log.adNetwork?.toLowerCase().includes(q);
        const matchUrl = log.url?.toLowerCase().includes(q);
        if (!matchLead && !matchClick && !matchNetwork && !matchUrl) return false;
      }
      return true;
    });
  }, [logs, logStatusFilter, logEventFilter, logSearch]);

  // Campaign URL construction
  const generatedCampaignUrl = useMemo(() => {
    const base = landingBaseUrl.trim();
    if (!base) return '';
    const sep = base.includes('?') ? '&' : '?';
    if (selectedNetworkForUrl === 'TrafficStars') {
      return `${base}${sep}clickid={click_id}&campaign_id={campaign_id}&source={pricing_model}&creative_id={creative_id}&subid={publisher_id}`;
    } else if (selectedNetworkForUrl === 'ExoClick') {
      return `${base}${sep}clickid={conversions_tracking}&campaign_id={campaign_id}&variation_id={variation_id}&subid={src_hostname}`;
    } else {
      return `${base}${sep}clickid={clickid}&campaign_id={campaignid}&zoneid={zoneid}`;
    }
  }, [landingBaseUrl, selectedNetworkForUrl]);

  // Universal Landing Page Snippet
  const landingScriptSnippet = `<!-- TrafficStars & Ad Network Click ID Auto-Capture Script -->
<script>
  (function() {
    function getQueryParam(name) {
      const params = new URLSearchParams(window.location.search);
      return params.get(name) || params.get(name.toLowerCase());
    }

    // Capture Click ID from TrafficStars (?clickid=... or ?click_id=...)
    const clickId = getQueryParam('clickid') || getQueryParam('click_id') || getQueryParam('ts_clickid') || getQueryParam('tag');
    const campaignId = getQueryParam('campaign_id') || getQueryParam('campaignid') || getQueryParam('utm_campaign');
    const adSource = getQueryParam('ad_source') || getQueryParam('utm_source') || 'TrafficStars';

    if (clickId) {
      // Save in session for multi-page funnel persistence
      sessionStorage.setItem('crm_click_id', clickId);
      sessionStorage.setItem('crm_campaign_id', campaignId || '');
      sessionStorage.setItem('crm_ad_source', adSource);
    }

    // Auto-fill hidden form inputs if present on page
    document.addEventListener('DOMContentLoaded', function() {
      const activeClickId = clickId || sessionStorage.getItem('crm_click_id');
      const activeCampaign = campaignId || sessionStorage.getItem('crm_campaign_id');
      
      const clickInput = document.querySelector('input[name="clickid"], input[name="click_id"]');
      if (clickInput && activeClickId) clickInput.value = activeClickId;

      const campInput = document.querySelector('input[name="campaign_id"], input[name="campaignId"]');
      if (campInput && activeCampaign) campInput.value = activeCampaign;
    });
  })();
</script>`;

  const webhookJsonExample = `{
  "name": "Ramesh Kumar",
  "phone": "9876543210",
  "product": "Ayurvedic Booster Combo",
  "price": 1499,
  "address": "House 12, MG Road",
  "city": "Jaipur",
  "pincode": "302001",
  "clickid": "{click_id}",
  "campaign_id": "{campaign_id}",
  "ad_source": "TrafficStars"
}`;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Traffic & Postback Hub</h1>
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-medium">
                  TrafficStars S2S v2.0
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Server-to-Server (S2S) postbacks, dynamic click tracking, conversion attribution & TrafficStars optimization.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsTestDialogOpen(true)}
            className="text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Play className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            Test Postback Ping
          </Button>

          <Button 
            size="sm" 
            onClick={() => handleOpenEdit()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Postback Setup
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl gap-2">
        <button
          onClick={() => setActiveTab('analytics')}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2",
            activeTab === 'analytics'
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          )}
        >
          <Activity className="w-4 h-4" />
          TRAFFIC & CONVERSIONS ANALYTICS
        </button>

        <button
          onClick={() => setActiveTab('configs')}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2",
            activeTab === 'configs'
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          )}
        >
          <Settings className="w-4 h-4" />
          POSTBACK INTEGRATIONS ({configs.length})
        </button>

        <button
          onClick={() => setActiveTab('setup')}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2",
            activeTab === 'setup'
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          )}
        >
          <Code className="w-4 h-4" />
          TRACKING CODE & URL BUILDER
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2",
            activeTab === 'logs'
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          )}
        >
          <Terminal className="w-4 h-4" />
          POSTBACK EXECUTION LOGS ({logs.length})
        </button>
      </div>

      {/* TAB 1: ANALYTICS & ATTRIBUTION PERFORMANCE */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tracked Click Leads</span>
                <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <Radio className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{stats.clickTrackedLeadsCount}</span>
                <span className="text-xs font-medium text-slate-500">
                  {stats.trafficStarLeadsCount} TrafficStars
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                Leads carrying verified S2S clickid tokens
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Postbacks Fired</span>
                <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <Send className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{stats.totalFired}</span>
                <span className="text-xs font-bold text-emerald-600">
                  {stats.successfulFired} Success
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                {stats.failedFired > 0 ? `${stats.failedFired} failed attempts` : '100% S2S Delivery Health'}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lead Confirmation Rate</span>
                <span className="p-2 rounded-lg bg-amber-50 text-amber-600">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{stats.conversionRate}%</span>
                <span className="text-xs font-medium text-slate-500">{stats.confirmedCount} Confirmed</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                Traffic click-to-confirmed conversion
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tracked CPA Value</span>
                <span className="p-2 rounded-lg bg-violet-50 text-violet-600">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">₹{stats.totalPostbackPayout.toLocaleString()}</span>
                <span className="text-xs font-bold text-indigo-600">{stats.deliveredCount} Delivered</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                Logged conversion payouts across networks
              </div>
            </div>
          </div>

          {/* Attribution Pipeline & Funnel Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">TrafficStars Conversion Funnel</h3>
                  <p className="text-xs text-slate-500 mt-0.5">End-to-end lifecycle from Ad Click to Delivered Sale</p>
                </div>
                <Badge className="bg-slate-100 text-slate-700 font-mono text-[11px]">
                  Real-time Data
                </Badge>
              </div>

              <div className="space-y-4">
                {/* Step 1: Click Inbound */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      1. Inbound Ad Clicks with ClickID
                    </span>
                    <span className="text-slate-900">{stats.clickTrackedLeadsCount} Leads (100%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full w-full"></div>
                  </div>
                </div>

                {/* Step 2: Order Confirmed */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      2. Tele-calling Order Confirmed
                    </span>
                    <span className="text-slate-900">{stats.confirmedCount} Leads ({stats.conversionRate}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, Math.min(100, Number(stats.conversionRate)))}%` }}
                    ></div>
                  </div>
                </div>

                {/* Step 3: Delivered Sale */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      3. Parcel Delivered & CPA Payout
                    </span>
                    <span className="text-slate-900">{stats.deliveredCount} Sales ({stats.deliveryRate}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(3, Math.min(100, Number(stats.deliveryRate)))}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Quick Info Box */}
              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-900">
                  <span className="font-bold">TrafficStars Auto-Optimization Tip:</span> When you trigger postbacks on 
                  <span className="font-semibold"> "Order Confirmed"</span> and <span className="font-semibold">"Delivered"</span>, 
                  TrafficStars algorithm automatically prioritizes higher-converting publisher sub-sources, lowering your acquisition cost!
                </div>
              </div>
            </div>

            {/* Campaign & Network Breakdown */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Ad Source Breakdown</h3>
              
              <div className="space-y-3">
                {['TrafficStars', 'ExoClick', 'PropellerAds', 'Direct / Other'].map((sourceName) => {
                  const count = leads.filter(l => {
                    const s = (l.adSource || l.source || '').toLowerCase();
                    if (sourceName === 'TrafficStars') return s.includes('traffic') || s.includes('ts');
                    if (sourceName === 'ExoClick') return s.includes('exo');
                    if (sourceName === 'PropellerAds') return s.includes('propeller');
                    return !s.includes('traffic') && !s.includes('exo') && !s.includes('propeller');
                  }).length;

                  const pct = leads.length > 0 ? ((count / leads.length) * 100).toFixed(0) : 0;

                  return (
                    <div key={sourceName} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                        <span>{sourceName}</span>
                        <span>{count} Leads ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs font-semibold border-slate-200 text-slate-700"
                onClick={() => setActiveTab('configs')}
              >
                Manage S2S Postbacks
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: POSTBACK CONFIGURATIONS */}
      {activeTab === 'configs' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Active Postback Integrations</h2>
              <p className="text-xs text-slate-500">Configure where conversion notifications are sent when leads move through statuses.</p>
            </div>

            <Button 
              size="sm" 
              onClick={() => handleOpenEdit()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Postback Integration
            </Button>
          </div>

          {/* Quick Preset Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PRESETS.slice(0, 3).map((preset) => (
              <div 
                key={preset.name} 
                className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold text-[10px]">
                    {preset.adNetwork} Preset
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs font-bold text-indigo-600 hover:bg-indigo-50 p-1.5"
                    onClick={() => handleApplyPreset(preset)}
                  >
                    Use Template
                  </Button>
                </div>
                <h4 className="text-xs font-bold text-slate-900">{preset.name}</h4>
                <p className="text-[11px] text-slate-500 line-clamp-2">{preset.description}</p>
                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                  {preset.events.map(e => (
                    <span key={e.event} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                      {e.actionName} {e.payout > 0 ? `(₹${e.payout})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Configured Integrations List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {configs.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Radio className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700">No Postbacks Configured Yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Click the button below or choose a template above to connect TrafficStars or your advertising network.
                </p>
                <Button 
                  size="sm" 
                  onClick={() => handleOpenEdit()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Create TrafficStars Postback
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {configs.map((config) => (
                  <div key={config.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className={cn(
                          "w-2.5 h-2.5 rounded-full",
                          config.isActive ? "bg-emerald-500 shadow-sm shadow-emerald-200" : "bg-slate-300"
                        )}></span>
                        <h4 className="text-sm font-bold text-slate-900">{config.name}</h4>
                        <Badge className="bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {config.adNetwork}
                        </Badge>
                        <Badge className={cn(
                          "text-[10px] font-medium",
                          config.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500"
                        )}>
                          {config.isActive ? 'Active & Firing' : 'Paused'}
                        </Badge>
                      </div>

                      <div className="font-mono text-[11px] text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 max-w-2xl break-all">
                        {config.postbackUrl}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[11px] font-semibold text-slate-500">Active Triggers:</span>
                        {config.events?.filter(e => e.enabled).map(e => (
                          <span key={e.event} className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full font-medium">
                            {e.event.replace('_', ' ').toUpperCase()} &rarr; <span className="font-bold font-mono">{e.actionName}</span> ({e.payout > 0 ? `₹${e.payout}` : 'Free'})
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTestUrl(config.postbackUrl);
                          setIsTestDialogOpen(true);
                        }}
                        className="text-xs font-semibold border-slate-200 text-slate-700 h-8"
                      >
                        <Play className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                        Ping Test
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(config.id, config.isActive)}
                        className={cn(
                          "text-xs font-semibold h-8",
                          config.isActive ? "text-amber-700 border-amber-200 hover:bg-amber-50" : "text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                        )}
                      >
                        {config.isActive ? 'Pause' : 'Activate'}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(config)}
                        className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteConfig(config.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TRACKING SETUP & URL GENERATOR */}
      {activeTab === 'setup' && (
        <div className="space-y-6">
          {/* Section 1: Campaign Link Builder */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Globe className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">TrafficStars Campaign URL Generator</h3>
                <p className="text-xs text-slate-500">Paste your landing page URL to attach dynamic ad network macro tokens automatically.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Landing Page / Store URL</label>
                <Input 
                  placeholder="https://myshop.com/product" 
                  value={landingBaseUrl}
                  onChange={(e) => setLandingBaseUrl(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Ad Network Macros</label>
                <select
                  value={selectedNetworkForUrl}
                  onChange={(e: any) => setSelectedNetworkForUrl(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold"
                >
                  <option value="TrafficStars">TrafficStars ({'{click_id}'}, {'{campaign_id}'})</option>
                  <option value="ExoClick">ExoClick ({'{conversions_tracking}'})</option>
                  <option value="PropellerAds">PropellerAds ({'{clickid}'})</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-slate-700">Ready Campaign Target URL (Paste into TrafficStars Ad Campaign)</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded-lg overflow-x-auto break-all border border-slate-800">
                  {generatedCampaignUrl}
                </div>
                <Button 
                  size="sm"
                  onClick={() => handleCopy(generatedCampaignUrl, 'campaign_url')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 text-xs font-semibold h-10 px-4"
                >
                  {copiedCode === 'campaign_url' ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  Copy Link
                </Button>
              </div>
            </div>
          </div>

          {/* Section 2: Universal Landing Page JS Snippet */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-violet-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Landing Page Click ID Capture Snippet</h3>
                  <p className="text-xs text-slate-500">Paste this script in your website / landing page &lt;head&gt; to store the visitor's Click ID.</p>
                </div>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleCopy(landingScriptSnippet, 'landing_script')}
                className="text-xs font-semibold border-slate-200 text-slate-700"
              >
                {copiedCode === 'landing_script' ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                Copy JavaScript
              </Button>
            </div>

            <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800 leading-relaxed">
              <code>{landingScriptSnippet}</code>
            </pre>
          </div>

          {/* Section 3: CRM Inbound Webhook API */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Inbound Lead Webhook Endpoint</h3>
                  <p className="text-xs text-slate-500">Send leads from your checkout form or backend API to create leads with instant ClickID postback tracking.</p>
                </div>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleCopy(`${window.location.origin}/api/webhook/lead`, 'webhook_url')}
                className="text-xs font-semibold border-slate-200 text-slate-700"
              >
                {copiedCode === 'webhook_url' ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                Copy API Endpoint
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 font-mono text-xs bg-slate-100 px-3 py-2 rounded-lg text-slate-800">
                <span className="font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">POST</span>
                <span>{window.location.origin}/api/webhook/lead</span>
              </div>

              <p className="text-xs font-bold text-slate-700 mt-2">Example JSON Payload:</p>
              <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800">
                <code>{webhookJsonExample}</code>
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: POSTBACK EXECUTION LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input 
                placeholder="Search Click ID, Lead name, or URL..." 
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={logStatusFilter}
                onChange={(e: any) => setLogStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold"
              >
                <option value="all">All Delivery Statuses</option>
                <option value="success">Success (200 OK)</option>
                <option value="failed">Failed / Errors</option>
              </select>

              <select
                value={logEventFilter}
                onChange={(e) => setLogEventFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold"
              >
                <option value="all">All Event Triggers</option>
                <option value="lead_created">Lead Created</option>
                <option value="order_confirmed">Order Confirmed</option>
                <option value="order_delivered">Order Delivered</option>
                <option value="order_dispatched">Order Dispatched</option>
              </select>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setLogSearch('');
                  setLogStatusFilter('all');
                  setLogEventFilter('all');
                }}
                className="h-9 text-xs text-slate-600"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Reset
              </Button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-xs font-bold text-slate-700">No Postback Activity Found</h4>
                <p className="text-[11px] text-slate-400">Postback execution requests and S2S delivery logs will appear here in real-time.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Status & Code</th>
                      <th className="py-3 px-4">Ad Network</th>
                      <th className="py-3 px-4">Event & Action</th>
                      <th className="py-3 px-4">Lead & Click ID</th>
                      <th className="py-3 px-4">Payout</th>
                      <th className="py-3 px-4">Fired Postback URL</th>
                      <th className="py-3 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.status === 'success' ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-[10px]">
                              <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                              HTTP {log.httpCode || 200}
                            </Badge>
                          ) : (
                            <Badge className="bg-red-50 text-red-700 border-red-200 font-mono text-[10px]">
                              <XCircle className="w-3 h-3 mr-1 text-red-600" />
                              {log.httpCode ? `HTTP ${log.httpCode}` : 'Failed'}
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-800">
                          {log.adNetwork || 'TrafficStars'}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold text-[10px]">
                            {log.actionName || log.event}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{log.leadName || 'Direct Lead'}</div>
                          <div className="font-mono text-[10px] text-slate-500 flex items-center gap-1">
                            <span className="truncate max-w-[140px]">{log.clickId}</span>
                            <button onClick={() => handleCopy(log.clickId, log.id)} className="hover:text-slate-900">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-900">
                          {log.payout > 0 ? `₹${log.payout}` : '-'}
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-mono text-[10px] text-slate-600 truncate bg-slate-50 p-1 rounded border border-slate-100">
                            {log.url}
                          </div>
                          {log.responseBody && (
                            <div className="text-[9px] text-slate-400 truncate mt-0.5">
                              Resp: {log.responseBody}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                          {new Date(log.timestamp).toLocaleString([], { 
                            month: 'short', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DIALOG 1: ADD / EDIT POSTBACK CONFIGURATION */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingConfig?.id ? 'Edit Postback Configuration' : 'New Postback Integration'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Set up your advertising network postback URL with dynamic macro tokens.
            </DialogDescription>
          </DialogHeader>

          {editingConfig && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Integration Name</label>
                  <Input 
                    placeholder="e.g. TrafficStars CPA Campaign"
                    value={editingConfig.name || ''}
                    onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Ad Network</label>
                  <select
                    value={editingConfig.adNetwork || 'TrafficStars'}
                    onChange={(e: any) => setEditingConfig({ ...editingConfig, adNetwork: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold"
                  >
                    <option value="TrafficStars">TrafficStars</option>
                    <option value="ExoClick">ExoClick</option>
                    <option value="PropellerAds">PropellerAds</option>
                    <option value="Custom">Custom S2S Endpoint</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Postback S2S URL (with macro tokens)
                </label>
                <Input 
                  placeholder="https://tsyndicate.com/api/v1/cpa/action?key=KEY&clickid={clickid}&action={action}&payout={payout}"
                  value={editingConfig.postbackUrl || ''}
                  onChange={(e) => setEditingConfig({ ...editingConfig, postbackUrl: e.target.value })}
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-slate-500">
                  Supported dynamic tokens: <span className="font-mono text-indigo-600">{'{clickid}'}</span>, <span className="font-mono text-indigo-600">{'{action}'}</span>, <span className="font-mono text-indigo-600">{'{payout}'}</span>, <span className="font-mono text-indigo-600">{'{lead_id}'}</span>, <span className="font-mono text-indigo-600">{'{campaign_id}'}</span>
                </p>
              </div>

              {/* Event Triggers & Payout Rules */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-900">Event Action Rules & Payouts</label>
                
                <div className="space-y-2">
                  {[
                    { event: 'lead_created' as PostbackEventTrigger, label: 'Lead Created (New Lead received)' },
                    { event: 'lead_interested' as PostbackEventTrigger, label: 'Lead Interested (Agent discussion positive)' },
                    { event: 'order_confirmed' as PostbackEventTrigger, label: 'Order Confirmed (Sale confirmed on call)' },
                    { event: 'order_dispatched' as PostbackEventTrigger, label: 'Order Dispatched / Shipped' },
                    { event: 'order_delivered' as PostbackEventTrigger, label: 'Order Delivered (Full CPA Conversion)' },
                  ].map((item) => {
                    const rule = editingConfig.events?.find(e => e.event === item.event) || {
                      event: item.event,
                      enabled: false,
                      actionName: item.event === 'order_delivered' ? 'sale' : item.event === 'order_confirmed' ? 'confirm' : 'lead',
                      payout: 0,
                      currency: 'INR'
                    };

                    const handleRuleChange = (updates: Partial<typeof rule>) => {
                      const existing = editingConfig.events || [];
                      const next = existing.filter(e => e.event !== item.event);
                      next.push({ ...rule, ...updates });
                      setEditingConfig({ ...editingConfig, events: next });
                    };

                    return (
                      <div key={item.event} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                          <input 
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={(e) => handleRuleChange({ enabled: e.target.checked })}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                          {item.label}
                        </label>

                        {rule.enabled && (
                          <div className="flex items-center gap-2 pl-6 sm:pl-0">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500 font-bold">Action Tag:</span>
                              <Input 
                                value={rule.actionName}
                                onChange={(e) => handleRuleChange({ actionName: e.target.value })}
                                className="h-7 w-24 text-[11px] font-mono"
                                placeholder="e.g. sale"
                              />
                            </div>

                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500 font-bold">Payout (₹):</span>
                              <Input 
                                type="number"
                                value={rule.payout}
                                onChange={(e) => handleRuleChange({ payout: Number(e.target.value) || 0 })}
                                className="h-7 w-20 text-[11px] font-mono"
                                placeholder="0"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveConfig} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
              Save Postback Integration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: LIVE POSTBACK TESTER / PING SIMULATOR */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Play className="w-4 h-4 text-indigo-600" />
              Live S2S Postback Ping Tester
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Test your TrafficStars postback URL right now to verify connectivity, HTTP response, and latency.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Target Postback URL</label>
              <Input 
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                className="font-mono text-xs"
                placeholder="https://tsyndicate.com/api/v1/cpa/action?key=KEY&clickid={clickid}&action={action}&payout={payout}"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Sample Click ID</label>
                <Input 
                  value={testClickId}
                  onChange={(e) => setTestClickId(e.target.value)}
                  className="font-mono text-xs h-8"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Action Tag</label>
                <Input 
                  value={testAction}
                  onChange={(e) => setTestAction(e.target.value)}
                  className="font-mono text-xs h-8"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Payout (₹)</label>
                <Input 
                  value={testPayout}
                  onChange={(e) => setTestPayout(e.target.value)}
                  className="font-mono text-xs h-8"
                />
              </div>
            </div>

            {testResult && (
              <div className={cn(
                "p-4 rounded-xl border text-xs font-mono space-y-2",
                testResult.success ? "bg-emerald-50/80 border-emerald-200 text-emerald-950" : "bg-red-50/80 border-red-200 text-red-950"
              )}>
                <div className="flex items-center justify-between font-bold">
                  <span>{testResult.success ? '✓ Ping Delivered Successfully' : '✗ Ping Failed / Connection Issue'}</span>
                  <span>HTTP {testResult.httpCode || 0} ({testResult.latency || 0}ms)</span>
                </div>
                
                <div className="text-[10px] text-slate-600 break-all">
                  <span className="font-bold">Fired URL:</span> {testResult.formattedUrl || testResult.url}
                </div>

                {testResult.responseBody && (
                  <div className="p-2 rounded bg-white/70 border border-slate-200 text-[10px]">
                    <span className="font-bold text-slate-800">Response Body:</span> {testResult.responseBody}
                  </div>
                )}

                {testResult.errorMessage && (
                  <div className="text-red-600 text-[10px]">
                    Error: {testResult.errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsTestDialogOpen(false)}>
              Close
            </Button>
            <Button 
              size="sm" 
              onClick={handleRunTest} 
              disabled={testRunning}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              {testRunning ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
              Send Ping Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
