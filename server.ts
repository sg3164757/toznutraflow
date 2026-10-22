
import express from 'express';
import path from 'path';
import cors from 'cors';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

const app = express();
const PORT = 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
app.use(express.json());

// Initialize Firebase Admin
import fs from 'fs';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId);

async function getNextId(counterPath: string, startFrom: number) {
  try {
    const counterRef = db.collection('metadata').doc('counters');
    const result = await db.runTransaction(async (t) => {
      const doc = await t.get(counterRef);
      let count = startFrom;
      
      if (!doc.exists) {
        t.set(counterRef, { [counterPath]: startFrom + 1 });
      } else {
        const data = doc.data();
        count = data && data[counterPath] ? data[counterPath] : startFrom;
        t.update(counterRef, { [counterPath]: count + 1 });
      }
      return count;
    });
    return result;
  } catch (error) {
    console.error(`Error generating ID for ${counterPath}:`, error);
    return Math.floor(Math.random() * 1000); // Fallback
  }
}

async function replacePostbackMacros(urlTemplate: string, params: {
  clickId?: string;
  action?: string;
  payout?: number | string;
  currency?: string;
  leadId?: string;
  campaignId?: string;
  subId?: string;
  phone?: string;
  product?: string;
  status?: string;
}) {
  let url = urlTemplate;
  const clickId = params.clickId || '';
  const action = params.action || 'lead';
  const payout = params.payout !== undefined ? String(params.payout) : '0';
  const currency = params.currency || 'INR';
  const leadId = params.leadId || '';
  const campaignId = params.campaignId || '';
  const subId = params.subId || '';
  const phone = params.phone || '';
  const product = params.product || '';
  const status = params.status || '';

  const replacements: Record<string, string> = {
    '{clickid}': encodeURIComponent(clickId),
    '{click_id}': encodeURIComponent(clickId),
    '{CLICK_ID}': encodeURIComponent(clickId),
    '{ts_clickid}': encodeURIComponent(clickId),
    '{action}': encodeURIComponent(action),
    '{event}': encodeURIComponent(action),
    '{ACTION}': encodeURIComponent(action),
    '{payout}': encodeURIComponent(payout),
    '{PAYOUT}': encodeURIComponent(payout),
    '{currency}': encodeURIComponent(currency),
    '{CURRENCY}': encodeURIComponent(currency),
    '{lead_id}': encodeURIComponent(leadId),
    '{leadid}': encodeURIComponent(leadId),
    '{order_id}': encodeURIComponent(leadId),
    '{campaign_id}': encodeURIComponent(campaignId),
    '{subid}': encodeURIComponent(subId),
    '{sub_id}': encodeURIComponent(subId),
    '{phone}': encodeURIComponent(phone),
    '{product}': encodeURIComponent(product),
    '{status}': encodeURIComponent(status),
  };

  for (const [token, value] of Object.entries(replacements)) {
    url = url.split(token).join(value);
  }

  return url;
}

async function executePostbackCall(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'TozFlow-CRM-PostbackEngine/1.0',
        'Accept': 'application/json, text/plain, */*'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const httpCode = response.status;
    const latency = Date.now() - startTime;
    let responseText = '';
    try {
      responseText = await response.text();
    } catch {
      responseText = '';
    }

    const isSuccess = httpCode >= 200 && httpCode < 300;
    return {
      success: isSuccess,
      httpCode,
      latency,
      responseBody: responseText.slice(0, 1000), // Cap response size
      url
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      success: false,
      httpCode: 0,
      latency: Date.now() - startTime,
      responseBody: '',
      errorMessage: err?.message || 'Network request failed or timed out',
      url
    };
  }
}

async function startServer() {
  // API Routes
  
  // 1. Postback Test Endpoint (Ping simulator)
  app.post('/api/postback/test', async (req, res) => {
    try {
      const { postbackUrl, testParams = {} } = req.body;
      if (!postbackUrl) {
        return res.status(400).json({ error: 'postbackUrl is required' });
      }

      const formattedUrl = await replacePostbackMacros(postbackUrl, {
        clickId: testParams.clickId || 'ts_test_click_998877',
        action: testParams.action || 'lead',
        payout: testParams.payout !== undefined ? testParams.payout : '10.00',
        currency: testParams.currency || 'INR',
        leadId: testParams.leadId || 'LEAD-TEST-001',
        campaignId: testParams.campaignId || 'CAMP_TS_101',
        phone: testParams.phone || '9999999999',
        product: testParams.product || 'Test Ayurvedic Package'
      });

      const result = await executePostbackCall(formattedUrl);
      return res.json({
        ...result,
        formattedUrl
      });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Failed to test postback' });
    }
  });

  // 2. Postback Trigger Endpoint (S2S Execution & Log Storage)
  app.post('/api/postback/trigger', async (req, res) => {
    try {
      const { 
        orgId = 'root-admin', 
        postbackConfig, 
        lead, 
        event = 'lead_created', 
        customAction, 
        customPayout 
      } = req.body;

      if (!lead || (!lead.clickId && !req.body.clickId)) {
        return res.status(400).json({ error: 'Click ID is required for Postback execution' });
      }

      const clickId = lead.clickId || req.body.clickId;
      
      // Determine URL template
      let urlTemplate = postbackConfig?.postbackUrl;
      let adNetwork = postbackConfig?.adNetwork || 'TrafficStars';
      let postbackName = postbackConfig?.name || 'Manual Postback';
      let actionName = customAction || 'lead';
      let payout = Number(customPayout) || 0;

      if (postbackConfig?.events && Array.isArray(postbackConfig.events)) {
        const matchingRule = postbackConfig.events.find((r: any) => r.event === event && r.enabled);
        if (matchingRule) {
          actionName = customAction || matchingRule.actionName || 'lead';
          payout = customPayout !== undefined ? Number(customPayout) : (matchingRule.payout || 0);
        }
      }

      if (!urlTemplate) {
        // Fallback default TrafficStars URL format
        urlTemplate = `https://tsyndicate.com/api/v1/cpa/action?key=YOUR_KEY&clickid={clickid}&action={action}&payout={payout}`;
      }

      const finalUrl = await replacePostbackMacros(urlTemplate, {
        clickId,
        action: actionName,
        payout,
        currency: 'INR',
        leadId: lead.serialId || lead.id || '',
        campaignId: lead.campaignId || '',
        subId: lead.subId || '',
        phone: lead.phone || '',
        product: lead.product || '',
        status: lead.status || ''
      });

      const callResult = await executePostbackCall(finalUrl);

      // Save to Firestore postbackLogs
      const logData = {
        orgId,
        postbackId: postbackConfig?.id || 'manual',
        postbackName,
        adNetwork,
        leadId: lead.id || 'direct',
        leadName: lead.name || lead.customerName || '',
        leadPhone: lead.phone || '',
        clickId,
        event,
        actionName,
        url: finalUrl,
        httpCode: callResult.httpCode,
        responseBody: callResult.responseBody || '',
        status: callResult.success ? 'success' : 'failed',
        payout,
        errorMessage: callResult.errorMessage || '',
        timestamp: new Date().toISOString()
      };

      const logDoc = await db.collection('postbackLogs').add(logData);

      // Update lead with postback status if lead has an ID
      if (lead.id) {
        try {
          await db.collection('leads').doc(lead.id).set({
            postbackFired: true,
            postbackStatus: callResult.success ? 'success' : 'failed',
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (updateErr) {
          console.warn('Could not update lead postback flag:', updateErr);
        }
      }

      return res.json({
        success: callResult.success,
        httpCode: callResult.httpCode,
        responseBody: callResult.responseBody,
        url: finalUrl,
        logId: logDoc.id,
        errorMessage: callResult.errorMessage
      });
    } catch (error: any) {
      console.error('Postback trigger error:', error);
      return res.status(500).json({ error: error?.message || 'Server error triggering postback' });
    }
  });

  // 3. Webhook for Inbound Leads (Extended with TrafficStars Click Tracking)
  app.post('/api/webhook/lead', async (req, res) => {
    try {
      // Simple API Key Security
      const apiKey = req.headers['x-api-key'] || req.query['api_key'];
      const expectedKey = process.env.SYNC_API_KEY || 'crm_sync_default_key_123';
      
      // Also allow direct web forms if origin header or query param present
      if (apiKey && apiKey !== expectedKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
      }

      const { 
        name, 
        phone, 
        source = 'TrafficStars Ads', 
        address = '', 
        city = '', 
        pincode = '', 
        product = '',
        package: leadPackage = '',
        price = 0,
        method = 'COD',
        // Dynamic ad tracking tokens from TrafficStars / Landing page
        clickid,
        click_id,
        ts_clickid,
        campaign_id,
        campaignId,
        ad_source,
        adSource,
        subid,
        sub_id,
        utm_source,
        utm_campaign,
        utm_medium,
        utm_content,
        orgId = 'root-admin'
      } = { ...req.query, ...req.body };
      
      if (!name || !phone) {
        return res.status(400).json({ error: 'Name and Phone are required' });
      }

      const finalClickId = clickid || click_id || ts_clickid || '';
      const finalCampaignId = campaign_id || campaignId || utm_campaign || '';
      const finalAdSource = ad_source || adSource || utm_source || source || 'TrafficStars';
      const finalSubId = subid || sub_id || utm_content || '';

      // Generate Sequential IDs
      const nextSerial = await getNextId('leads', 1);
      const serialId = nextSerial < 10 ? `0${nextSerial}` : `${nextSerial}`;
      
      const leadData: any = {
        serialId,
        customerName: name,
        name,
        phone,
        value: Number(price) || 0,
        source: finalAdSource,
        address,
        city,
        pincode,
        product: product || leadPackage || 'Auto-Imported',
        status: 'New Lead',
        paymentMode: method || 'COD',
        assignedTo: 'Unassigned',
        assignedToId: '',
        package: leadPackage || product || '',
        orgId,
        clickId: finalClickId,
        campaignId: finalCampaignId,
        adSource: finalAdSource,
        subId: finalSubId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: [{
          id: Math.random().toString(36).substring(2, 9),
          type: 'other',
          updatedBy: finalClickId ? 'TrafficStars Webhook' : 'Excel/Web Sync',
          updatedById: 'api',
          timestamp: new Date().toISOString(),
          note: finalClickId 
            ? `Lead captured via TrafficStars (ClickID: ${finalClickId}, Campaign: ${finalCampaignId || 'N/A'})`
            : 'Lead automatically synced from API'
        }]
      };

      const docRef = await db.collection('leads').add(leadData);
      console.log('Lead Saved:', docRef.id, 'ClickID:', finalClickId);

      // If clickId exists, check if any active Postback Config is set for 'lead_created'
      let postbackTriggerResult = null;
      if (finalClickId) {
        try {
          const postbacksSnap = await db.collection('postbacks')
            .where('isActive', '==', true)
            .get();

          for (const pDoc of postbacksSnap.docs) {
            const pConfig = pDoc.data();
            const leadRule = pConfig.events?.find((e: any) => e.event === 'lead_created' && e.enabled);
            if (leadRule && pConfig.postbackUrl) {
              const postbackUrl = await replacePostbackMacros(pConfig.postbackUrl, {
                clickId: finalClickId,
                action: leadRule.actionName || 'lead',
                payout: leadRule.payout || 0,
                currency: 'INR',
                leadId: serialId,
                campaignId: finalCampaignId,
                subId: finalSubId,
                phone,
                product: leadData.product,
                status: 'New Lead'
              });

              const pResult = await executePostbackCall(postbackUrl);
              await db.collection('postbackLogs').add({
                orgId,
                postbackId: pDoc.id,
                postbackName: pConfig.name || 'TrafficStars Auto Lead Postback',
                adNetwork: pConfig.adNetwork || 'TrafficStars',
                leadId: docRef.id,
                leadName: name,
                leadPhone: phone,
                clickId: finalClickId,
                event: 'lead_created',
                actionName: leadRule.actionName || 'lead',
                url: postbackUrl,
                httpCode: pResult.httpCode,
                responseBody: pResult.responseBody || '',
                status: pResult.success ? 'success' : 'failed',
                payout: leadRule.payout || 0,
                errorMessage: pResult.errorMessage || '',
                timestamp: new Date().toISOString()
              });

              postbackTriggerResult = {
                fired: true,
                status: pResult.success ? 'success' : 'failed',
                httpCode: pResult.httpCode
              };
              break;
            }
          }
        } catch (pbErr) {
          console.error('Auto postback fire error:', pbErr);
        }
      }
      
      res.status(201).json({ 
        success: true, 
        message: 'Lead received and saved successfully!',
        leadId: docRef.id,
        serialId,
        clickId: finalClickId,
        value: leadData.value,
        postback: postbackTriggerResult
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Server Error';
      console.error('Webhook Error:', errorMessage);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        details: errorMessage 
      });
    }
  });

  // 4. Get Business Seat Usage & Trial Quota
  app.get('/api/team/seat-usage/:orgId', async (req, res) => {
    try {
      const { orgId } = req.params;
      if (!orgId) {
        return res.status(400).json({ error: 'orgId is required' });
      }

      let maxSeats = 5;
      let roleLimits: Record<string, number> = {
        Manager: 1,
        TeamLeader: 1,
        Sales: 3
      };
      let plan = '5-Seat Trial';

      const orgDoc = await db.collection('organizations').doc(orgId).get();
      if (orgDoc.exists) {
        const data = orgDoc.data();
        if (data?.maxSeats) maxSeats = data.maxSeats;
        if (data?.plan) plan = data.plan;
        if (data?.roleLimits) roleLimits = { ...roleLimits, ...data.roleLimits };
      }

      const usersSnap = await db.collection('users')
        .where('orgId', '==', orgId)
        .get();

      const users = usersSnap.docs.map(d => d.data());
      const totalUsed = users.length;

      const breakdown = {
        Manager: {
          count: users.filter(u => u.role === 'Manager' || u.role === 'Admin').length,
          limit: roleLimits.Manager || 1
        },
        TeamLeader: {
          count: users.filter(u => u.role === 'TeamLeader').length,
          limit: roleLimits.TeamLeader || 1
        },
        Sales: {
          count: users.filter(u => u.role === 'Sales' || u.role === 'Agent').length,
          limit: roleLimits.Sales || 3
        }
      };

      res.json({
        orgId,
        plan,
        maxSeats,
        totalUsed,
        availableSeats: Math.max(0, maxSeats - totalUsed),
        breakdown
      });
    } catch (error: any) {
      console.error('Error fetching seat usage:', error);
      res.status(500).json({ error: error?.message || 'Failed to fetch seat usage' });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
