
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  or,
  and,
  orderBy, 
  onSnapshot,
  Timestamp,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';
import { Lead, InventoryItem, Order, User, HistoryItem, Task, AuditLog, OrderStatus, LeadStatus, Organization, PostbackConfig, PostbackLog, PostbackEventTrigger } from '@/src/types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
  EXTRACT = 'extract'
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

const handleFirestoreError = (error: any, operationType: OperationType | string, path: string | null) => {
  const user = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType: operationType as OperationType,
    path,
    authInfo: {
      userId: user?.uid || null,
      email: user?.email || null,
      emailVerified: user?.emailVerified || null,
      isAnonymous: user?.isAnonymous || null,
    }
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

// Helper to remove undefined values for Firestore
const sanitize = <T extends object>(obj: T): T => {
  const result: any = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) {
      result[key] = value;
    }
  });
  return result;
};

// Helper to get multi-tenant constraints
const getOrgConstraints = (user: User | null | { orgId?: string, role?: string, email?: string }) => {
  if (!user) return [where('orgId', '==', 'unauthenticated')];
  
  // SuperAdmin sees all
  const isSuperAdmin = user.role === 'SuperAdmin' || 
                       user.email?.toLowerCase() === 'tzsupportayurveda@gmail.com' ||
                       (auth.currentUser?.email?.toLowerCase() === 'tzsupportayurveda@gmail.com');
                       
  if (isSuperAdmin) return [];
  
  // If org exists, filter by it
  if (user.orgId) return [where('orgId', '==', user.orgId)];
  
  return [where('orgId', '==', 'root-admin')];
};

export const dataService = {
  // --- User Profiles ---
  async getUserProfile(uid: string): Promise<User | null> {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as User : null;
    } catch (e) {
      return handleFirestoreError(e, 'get', `users/${uid}`);
    }
  },

  async createUserProfile(user: User): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', user.id), { ...user });
    } catch (e) {
      // If it doesn't exist, use setDoc or similar logic
      try {
        const { id, ...data } = user;
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'users', id), data);
      } catch (innerE) {
        handleFirestoreError(innerE, 'create', `users/${user.id}`);
      }
    }
  },

  // --- Organizations ---
  async createOrganization(name: string, ownerId: string): Promise<string> {
    try {
      const orgRef = await addDoc(collection(db, 'organizations'), {
        name,
        ownerId,
        createdAt: new Date().toISOString(),
        subscription: 'Free',
        plan: '5-Seat Trial',
        status: 'Active',
        maxSeats: 5,
        roleLimits: {
          Manager: 1,
          TeamLeader: 1,
          Sales: 3
        },
        pincodeLookupEnabled: true
      });
      
      // Update the user with the new Org ID and set them as Manager with active status
      await updateDoc(doc(db, 'users', ownerId), { 
        orgId: orgRef.id,
        role: 'Manager',
        status: 'active'
      });
      
      return orgRef.id;
    } catch (e) {
      return handleFirestoreError(e, 'create', 'organizations');
    }
  },

  async getOrganization(orgId: string): Promise<Organization | null> {
    try {
      const snap = await getDoc(doc(db, 'organizations', orgId));
      return snap.exists() ? { id: snap.id, ...snap.data() } as Organization : null;
    } catch (e) {
      return handleFirestoreError(e, 'get', `organizations/${orgId}`);
    }
  },

  // --- Utility for Sequential IDs (Org-Scoped) ---
  async getNextId(orgId: string, counterPath: string, startFrom: number): Promise<string> {
    try {
      const { runTransaction } = await import('firebase/firestore');
      // Org-specific counter path
      const counterRef = doc(db, 'organizations', orgId, 'metadata', 'counters');
      const nextId = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let count = startFrom;
        
        if (!counterDoc.exists()) {
          transaction.set(counterRef, { [counterPath]: startFrom + 1 });
        } else {
          const data = counterDoc.data();
          count = data && data[counterPath] ? data[counterPath] : startFrom;
          transaction.update(counterRef, { [counterPath]: count + 1 });
        }
        return count;
      });
      
      if (counterPath === 'leads') {
        return nextId.toString().padStart(2, '0');
      }
      return `${nextId}`;
    } catch (e) {
      console.error("Failed to generate sequential ID:", e);
      return Math.floor(Math.random() * 1000).toString().padStart(2, '0');
    }
  },

  // --- Notifications ---
  async addNotification(orgId: string, userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    try {
      await addDoc(collection(db, 'notifications'), {
        orgId,
        userId,
        title,
        message,
        type,
        read: false,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("Notification failed:", e);
    }
  },

  async notifyStaff(orgId: string, roles: string[], title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    try {
      const q = query(
        collection(db, 'users'), 
        where('orgId', '==', orgId),
        where('role', 'in', roles), 
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      const timestamp = new Date().toISOString();
      snapshot.docs.forEach(userDoc => {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          orgId,
          userId: userDoc.id,
          title,
          message,
          type,
          read: false,
          timestamp
        });
      });
      
      await batch.commit();
    } catch (e) {
      console.error("Notify staff failed:", e);
    }
  },

  subscribeNotifications(userId: string, callback: (notifications: any[]) => void) {
    if (!userId) {
      callback([]);
      return () => {};
    }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );
    return onSnapshot(q, 
      (snapshot) => {
        const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Client-side sort to avoid index requirement
        const sorted = notifications.sort((a: any, b: any) => {
          return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
        });
        callback(sorted);
      },
      (error) => {
        console.error("Notifications subscription error:", error);
        // Not throwing to avoid crashing the top-level app, but let's at least log more
        try {
          handleFirestoreError(error, OperationType.LIST, 'notifications');
        } catch (e) {
          // just for logging
        }
        callback([]);
      }
    );
  },

  async markNotificationRead(id: string) {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) {
      console.error("Failed to mark notification read:", e);
    }
  },

  async clearNotifications(userId: string) {
    try {
      const q = query(collection(db, 'notifications'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (e) {
      console.error("Failed to clear notifications:", e);
    }
  },

  // --- Leads ---
  subscribeLeads(user: User | null, callback: (leads: Lead[]) => void) {
    if (!user || !user.id) {
      callback([]);
      return () => {};
    }
    
    let q;
    const orgConstraints = getOrgConstraints(user);
    const isSpecialist = ['Admin', 'Manager', 'TeamLeader', 'Marketer', 'SuperAdmin', 'Inventory', 'Delivery'].includes(user.role || '') || user.email?.toLowerCase() === 'tzsupportayurveda@gmail.com';
    const isSalesAgent = user.role === 'Sales' || user.role === 'Agent';

    try {
      // Use a simpler query to avoid complex index requirements that might error out for agents
      // We will filter the results on the client side for consistency
      q = query(
        collection(db, 'leads'), 
        ...orgConstraints,
      );
      
      const unsub = onSnapshot(q, 
        (snapshot) => {
          const leads = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Lead));
          
          // Client-side filtering based on role
          let filteredLeads = leads;
          if (!isSpecialist && isSalesAgent) {
            filteredLeads = leads.filter(lead => {
              return lead.assignedToId === user.id;
            });
          }

          // Sort by createdAt DESC
          const sorted = filteredLeads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          callback(sorted);
        },
        (error) => {
          console.error("Leads subscription error:", error);
          handleFirestoreError(error, 'list', 'leads');
        }
      );
      return unsub;
    } catch (e: any) {
      console.error("Leads query/snapshot creation error:", e);
      callback([]);
      return () => {};
    }
  },

  async addLead(orgId: string, lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'history'>): Promise<string> {
    try {
      const serialId = await this.getNextId(orgId, 'leads', 1);
      let finalAffiliateId = lead.affiliateId;
      if (!finalAffiliateId) {
        finalAffiliateId = await this.getNextId(orgId, 'affiliates', 101);
      }

      // Automatically assign if no assignment provided
      let finalAssignedTo = lead.assignedTo;
      let finalAssignedToId = lead.assignedToId;

      if (!finalAssignedToId) {
        const assignment = await this.assignLeadRoundRobin(orgId);
        if (assignment) {
          finalAssignedTo = assignment.name;
          finalAssignedToId = assignment.id;
        }
      }

      const docRef = await addDoc(collection(db, 'leads'), {
        ...lead,
        orgId,
        assignedTo: finalAssignedTo || 'Unassigned',
        assignedToId: finalAssignedToId || '',
        serialId,
        affiliateId: finalAffiliateId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: []
      });
      return docRef.id;
    } catch (e) {
      return handleFirestoreError(e, 'create', 'leads');
    }
  },

  async bulkAddLeads(orgId: string, leads: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'orgId'>[]): Promise<void> {
    try {
      const { writeBatch, runTransaction } = await import('firebase/firestore');
      const counterRef = doc(db, 'organizations', orgId, 'metadata', 'counters');
      
      // Check if we need affiliate IDs
      const needsAffiliateCount = leads.filter(l => !l.affiliateId).length;

      // Get necessary count of IDs in one transaction
      const ids = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        const data = counterDoc.data() || {};
        const startLeadId = data.leads || 1;
        const startAffiliateIdValue = data.affiliates || 101;

        const updates: any = { 
          leads: startLeadId + leads.length 
        };
        
        if (needsAffiliateCount > 0) {
          updates.affiliates = startAffiliateIdValue + needsAffiliateCount;
        }

        transaction.set(counterRef, updates, { merge: true });
        return { startLeadId, startAffiliateId: startAffiliateIdValue };
      });

      let currentAffiliateOffset = 0;

      // Split leads into batches of 500
      for (let i = 0; i < leads.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = leads.slice(i, i + 500);
        const timestamp = new Date().toISOString();

        chunk.forEach((lead, index) => {
          const leadRef = doc(collection(db, 'leads'));
          const serialId = (ids.startLeadId + i + index).toString().padStart(2, '0');
          
          let finalAffiliateId = lead.affiliateId;
          if (!finalAffiliateId) {
            finalAffiliateId = (ids.startAffiliateId + currentAffiliateOffset).toString();
            currentAffiliateOffset++;
          }
          
          batch.set(leadRef, {
            ...lead,
            orgId,
            serialId,
            affiliateId: finalAffiliateId,
            createdAt: timestamp,
            updatedAt: timestamp,
            history: []
          });
        });

        await batch.commit();
      }
    } catch (e) {
      return handleFirestoreError(e, 'write', 'leads_bulk');
    }
  },

  async assignLeadRoundRobin(orgId: string): Promise<{ id: string; name: string } | null> {
    try {
      const salesQuery = query(
        collection(db, 'users'), 
        where('orgId', '==', orgId),
        where('role', '==', 'Sales'), 
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(salesQuery);
      const salesMembers = snapshot.docs.map(d => ({ id: d.id, name: (d.data() as User).name }));
      
      if (salesMembers.length === 0) return null;

      const counterRef = doc(db, 'organizations', orgId, 'metadata', 'round_robin');
      const { runTransaction } = await import('firebase/firestore');
      
      const assignedMember = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let currentIndex = 0;
        
        if (counterDoc.exists()) {
          const data = counterDoc.data();
          currentIndex = data?.lastIndex ?? 0;
        }

        const nextIndex = (currentIndex + 1) % salesMembers.length;
        transaction.set(counterRef, { lastIndex: nextIndex }, { merge: true });
        
        return salesMembers[currentIndex];
      });

      return assignedMember;
    } catch (e) {
      console.error("Round Robin Assignment failed:", e);
      return null;
    }
  },

  async bulkUpdateLeads(orgId: string, leadIds: string[], updates: Partial<Lead>): Promise<void> {
    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      const timestamp = new Date().toISOString();
      const currentUser = auth.currentUser;
      
      leadIds.forEach(id => {
        const ref = doc(db, 'leads', id);
        const updatePayload: any = { 
          ...updates, 
          updatedAt: timestamp 
        };

        if (updates.status || updates.assignedToId) {
          const historyItem: HistoryItem = sanitize({
            id: Math.random().toString(36).substring(2, 9),
            type: updates.status ? 'status_change' : 'assignment',
            updatedBy: currentUser?.displayName || currentUser?.email || 'System',
            updatedById: currentUser?.uid || 'system',
            timestamp,
            note: `Bulk action: ${updates.status ? `Status to ${updates.status}` : (updates.assignedToId ? `Assigned to ${updates.assignedTo}` : 'Updated')}`
          });
          updatePayload.history = arrayUnion(historyItem);
        }

        // If status is Call Back, create a default task for tomorrow
        if (updates.status === 'Call Back') {
          const callbackDate = new Date();
          callbackDate.setDate(callbackDate.getDate() + 1); // Default to tomorrow
          updatePayload.callbackTime = callbackDate.toISOString();
          
          const taskRef = doc(collection(db, 'tasks'));
          batch.set(taskRef, {
            orgId,
            title: `Bulk Callback Task`,
            description: `Scheduled callback for lead.`,
            dueDate: callbackDate.toISOString(),
            userId: updates.assignedToId || currentUser?.uid || 'system',
            leadId: id,
            status: 'pending',
            type: 'callback'
          });
        }

        batch.update(ref, updatePayload);
      });
      
      await batch.commit();

      if (updates.assignedToId) {
        await this.addNotification(
          orgId,
          updates.assignedToId,
          'Bulk leads assigned',
          `${leadIds.length} leads have been assigned to you via bulk action.`,
          'info'
        );
      }
    } catch (e) {
      handleFirestoreError(e, 'bulk_update', 'leads');
    }
  },

  async getCustomerHistory(orgId: string, phone?: string, email?: string): Promise<{ leads: Lead[], orders: Order[] }> {
    try {
      let leads: Lead[] = [];
      let orders: Order[] = [];
      const effectiveOrgId = orgId || 'root-admin';
      const orgConstraints = [where('orgId', '==', effectiveOrgId)];

      if (phone) {
        const leadQ = query(collection(db, 'leads'), ...orgConstraints, where('phone', '==', phone));
        const orderQ = query(collection(db, 'orders'), ...orgConstraints, where('phone', '==', phone));
        const [leadSnap, orderSnap] = await Promise.all([getDocs(leadQ), getDocs(orderQ)]);
        leads = leadSnap.docs.map(d => ({ id: d.id, ...d.data() } as Lead));
        orders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      } else if (email) {
        const leadQ = query(collection(db, 'leads'), ...orgConstraints, where('email', '==', email));
        const orderQ = query(collection(db, 'orders'), ...orgConstraints, where('customerId', '==', email)); 
        const [leadSnap, orderSnap] = await Promise.all([getDocs(leadQ), getDocs(orderQ)]);
        leads = leadSnap.docs.map(d => ({ id: d.id, ...d.data() } as Lead));
        orders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      }

      return { leads, orders };
    } catch (e) {
      console.error("History fetch failed:", e);
      return { leads: [], orders: [] };
    }
  },

  async getInventoryList(orgId: string): Promise<InventoryItem[]> {
    try {
      const effectiveOrgId = orgId || 'root-admin';
      const orgConstraints = [where('orgId', '==', effectiveOrgId)];
      const q = query(collection(db, 'inventory'), ...orgConstraints);
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
    } catch (e) {
      return handleFirestoreError(e, 'list', 'inventory');
    }
  },

  // --- Audit Logs ---
  async addAuditLog(orgId: string, action: string, entityId: string, entityType: string, details: string) {
    try {
      const user = auth.currentUser;
      const userData = user ? await this.getUserProfile(user.uid) : null;
      
      await addDoc(collection(db, 'logs'), {
        orgId,
        userId: user?.uid || 'system',
        userName: userData?.name || user?.email || 'System',
        userEmail: user?.email || '',
        action,
        entityId,
        entityType,
        details,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("Audit log failed:", e);
    }
  },

  subscribeAuditLogs(orgId: string, callback: (logs: AuditLog[]) => void) {
    const effectiveOrgId = orgId || 'root-admin';
    const orgConstraints = [where('orgId', '==', effectiveOrgId)];
    const q = query(
      collection(db, 'logs'),
      ...orgConstraints
    );
    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));
      // Client-side sort
      const sorted = logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      callback(sorted);
    });
  },

  // --- Tasks & Refills ---
  async addTask(task: Omit<Task, 'id'>) {
    try {
      await addDoc(collection(db, 'tasks'), task);
    } catch (e) {
      handleFirestoreError(e, 'create', 'tasks');
    }
  },

  subscribeTasks(orgId: string, userId: string, callback: (tasks: Task[]) => void) {
    const orgConstraints = orgId ? [where('orgId', '==', orgId)] : [];
    const q = query(
      collection(db, 'tasks'), 
      ...orgConstraints,
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );
    return onSnapshot(q, 
      (snapshot) => {
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
        // Client-side sort
        const sorted = tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        callback(sorted);
      },
      (error) => {
        console.error("Tasks subscription error:", error);
        callback([]);
      }
    );
  },

  async updateTask(id: string, updates: Partial<Task>) {
    try {
      await updateDoc(doc(db, 'tasks', id), updates);
    } catch (e) {
      handleFirestoreError(e, 'update', `tasks/${id}`);
    }
  },

  async fetchLocationByPincode(pincode: string): Promise<{ city: string; state: string } | null> {
    if (!pincode || pincode.length !== 6) return null;
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      
      if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
        const postOffice = data[0].PostOffice[0];
        return {
          city: postOffice.District,
          state: postOffice.State
        };
      }
      return null;
    } catch (e) {
      console.error("Pincode lookup failed:", e);
      return null;
    }
  },

  // --- Lead Status Change with Stock & Tasks ---
  async handleOrderConfirmation(orgId: string, lead: Lead) {
    try {
      const { runTransaction } = await import('firebase/firestore');
      let lowStockAlert: { name: string; stock: number; minStock: number } | null = null;
      
      await runTransaction(db, async (transaction) => {
        // 1. Find the product in inventory
        const invQuery = query(
          collection(db, 'inventory'), 
          where('orgId', '==', lead.orgId),
          where('name', '==', lead.product)
        );
        const invSnapshot = await getDocs(invQuery);
        
        if (!invSnapshot.empty) {
          const invDoc = invSnapshot.docs[0];
          const invData = invDoc.data() as InventoryItem;
          const newStock = invData.stock - (lead.quantity || 1);
          
          // 2. Deduct Stock
          transaction.update(invDoc.ref, { stock: Math.max(0, newStock) });
          
          if (newStock <= invData.minStock) {
            lowStockAlert = { name: invData.name, stock: newStock, minStock: invData.minStock };
          }
        }

        // 3. Create Order
        const commission = (lead.value * 0.05); // 5% Commission
        const orderRef = doc(collection(db, 'orders'));
        transaction.set(orderRef, {
          orgId: lead.orgId,
          leadId: lead.id,
          customerId: lead.email || lead.phone,
          customerName: lead.name,
          phone: lead.phone,
          address: lead.address || '',
          city: lead.city || '',
          pincode: lead.pincode || '',
          product: lead.product || 'Advanced Gel Formula',
          quantity: lead.quantity || 1,
          total: lead.value,
          status: 'Pending',
          paymentMode: lead.paymentMode,
          commission,
          assignedToId: lead.assignedToId,
          assignedTo: lead.assignedTo,
          createdAt: new Date().toISOString()
        });

        // 4. Update Sales Rep Earnings
        const userRef = doc(db, 'users', lead.assignedToId);
        const userDoc = await transaction.get(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          const earnings = userData.earnings || { daily: 0, monthly: 0, total: 0 };
          transaction.update(userRef, {
            earnings: {
              daily: earnings.daily + commission,
              monthly: earnings.monthly + commission,
              total: earnings.total + commission
            }
          });
        }

        // 5. Create Refill Task (25 days later)
        const refillDate = new Date();
        refillDate.setDate(refillDate.getDate() + 25);
        
        const taskRef = doc(collection(db, 'tasks'));
        transaction.set(taskRef, {
          orgId: lead.orgId,
          title: `Refill Reminder: ${lead.name}`,
          description: `Customer purchased ${lead.product} 25 days ago. Call for refill.`,
          dueDate: refillDate.toISOString(),
          userId: lead.assignedToId,
          leadId: lead.id,
          status: 'pending',
          type: 'refill'
        });

        // 6. Update Lead status and LTV and History
        const leadRef = doc(db, 'leads', lead.id);
        const timestamp = new Date().toISOString();
        const currentUser = auth.currentUser;
        const historyItem: HistoryItem = {
          id: Math.random().toString(36).substring(2, 9),
          type: 'status_change',
          from: lead.status,
          to: 'Order Confirmed',
          updatedBy: currentUser?.displayName || currentUser?.email || 'System',
          updatedById: currentUser?.uid || 'system',
          timestamp,
          note: 'Order confirmed and stock deducted'
        };

        transaction.update(leadRef, {
          status: 'Order Confirmed',
          ltv: (lead.ltv || 0) + lead.value,
          updatedAt: timestamp,
          history: arrayUnion(sanitize(historyItem))
        });
      });

      // Notify outside transaction to avoid issues with retries and async writes
      if (lowStockAlert) {
        this.notifyStaff(
          lead.orgId,
          ['Admin', 'Manager', 'Inventory'],
          'Critical Inventory Alert',
          `Low Stock: "${lowStockAlert.name}" is down to ${lowStockAlert.stock} units. (Thresh: ${lowStockAlert.minStock})`,
          'warning'
        );
      }
      
      await this.addAuditLog(lead.orgId, 'Order Confirmed', lead.id, 'Lead', `Order created and stock deducted for ${lead.name}`);
    } catch (e) {
      handleFirestoreError(e, 'confirm_order', `leads/${lead.id}`);
    }
  },

  async updateLead(orgId: string, id: string, updates: Partial<Lead>): Promise<void> {
    try {
      const docRef = doc(db, 'leads', id);
      const oldSnap = await getDoc(docRef);
      if (!oldSnap.exists()) return;
      
      const oldData = oldSnap.data() as Lead;
      const currentUser = auth.currentUser;
      const timestamp = new Date().toISOString();
      
      // Sanitizing payload: Remove any keys with undefined values
      const sanitizedUpdates = sanitize(updates);

      const updatePayload: any = {
        ...sanitizedUpdates,
        updatedAt: timestamp
      };

      // Automatically assign if currently unassigned or system-assigned, or if taking action on a New Lead
      const isUnassigned = !oldData.assignedToId || 
                          oldData.assignedToId === 'unassigned' || 
                          oldData.assignedToId === 'system' || 
                          oldData.assignedToId === 'CRM User' ||
                          oldData.status === 'New Lead';

      if (isUnassigned && currentUser && !updates.assignedToId) {
        const userData = await this.getUserProfile(currentUser.uid);
        updatePayload.assignedToId = currentUser.uid;
        updatePayload.assignedTo = userData?.name || currentUser.displayName || currentUser.email || 'Agent';
      }

      // Track significant changes for history
      const historyItems: HistoryItem[] = [];

      // 1. Status Change
      if (updates.status && updates.status !== oldData.status) {
        historyItems.push(sanitize({
          id: Math.random().toString(36).substring(2, 9),
          type: 'status_change',
          from: oldData.status,
          to: updates.status,
          updatedBy: currentUser?.displayName || currentUser?.email || 'System',
          updatedById: currentUser?.uid || 'system',
          timestamp,
          note: updates.notes ? `Note: ${updates.notes}` : undefined
        }));

        // Audit log for status change
        await this.addAuditLog(oldData.orgId, 'Status Change', id, 'Lead', `Status: ${oldData.status} -> ${updates.status} (Lead: ${oldData.name})`);

        // Trigger automated postback if clickId exists
        const mergedLead = { ...oldData, ...updates, id };
        if (mergedLead.clickId) {
          if (updates.status === 'Order Confirmed') {
            this.triggerPostbackForLead(oldData.orgId, mergedLead, 'order_confirmed').catch(err => console.warn('Postback error:', err));
          } else if (updates.status === 'Interested') {
            this.triggerPostbackForLead(oldData.orgId, mergedLead, 'lead_interested').catch(err => console.warn('Postback error:', err));
          }
        }
      }

      // 2. Assignment Change
      if (updates.assignedToId && updates.assignedToId !== oldData.assignedToId) {
        historyItems.push({
          id: Math.random().toString(36).substring(2, 9),
          type: 'assignment',
          from: oldData.assignedTo || 'Unassigned',
          to: updates.assignedTo || 'Unassigned',
          updatedBy: currentUser?.displayName || currentUser?.email || 'System',
          updatedById: currentUser?.uid || 'system',
          timestamp,
          note: `Reassigned: ${oldData.assignedTo || 'Unassigned'} → ${updates.assignedTo || 'Unassigned'}`
        });
        await this.addAuditLog(oldData.orgId, 'Reassigned', id, 'Lead', `Assigned: ${oldData.assignedTo} -> ${updates.assignedTo} (Lead: ${oldData.name})`);
      }

      // 3. Other updates (General info)
      const tracks = ['name', 'phone', 'product', 'value', 'address'];
      const changedFields = tracks.filter(field => (updates as any)[field] !== undefined && (updates as any)[field] !== (oldData as any)[field]);
      
      if (changedFields.length > 0 && historyItems.length === 0) {
        historyItems.push({
          id: Math.random().toString(36).substring(2, 9),
          type: 'other',
          updatedBy: currentUser?.displayName || currentUser?.email || 'System',
          updatedById: currentUser?.uid || 'system',
          timestamp,
          note: `Updated: ${changedFields.join(', ')}`
        });
      }

      if (historyItems.length > 0) {
        const sanitizedHistoryItems = historyItems.map(item => sanitize(item));
        updatePayload.history = arrayUnion(...sanitizedHistoryItems);
      }

      // If status is Call Back, ensure task and callbackTime
      if (updates.status === 'Call Back') {
        const callbackTime = updates.callbackTime || new Date(Date.now() + 86400000).toISOString();
        updatePayload.callbackTime = callbackTime;

        // Create the callback task
        await addDoc(collection(db, 'tasks'), {
          orgId: oldData.orgId,
          title: `Callback: ${oldData.name}`,
          description: `Automatically created follow-up task for ${oldData.name}. Phone: ${oldData.phone}`,
          dueDate: callbackTime,
          userId: updates.assignedToId || oldData.assignedToId || currentUser?.uid || 'system',
          leadId: id,
          status: 'pending',
          type: 'callback'
        });
      }

      await updateDoc(docRef, updatePayload);
    } catch (e) {
      handleFirestoreError(e, 'update', `leads/${id}`);
    }
  },

  async addLeadHistory(orgId: string, id: string, historyItem: Omit<HistoryItem, 'id' | 'timestamp'>): Promise<void> {
    try {
      const docRef = doc(db, 'leads', id);
      const newItem: HistoryItem = sanitize({
        ...historyItem,
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString()
      });
      await updateDoc(docRef, {
        history: arrayUnion(newItem)
      });
    } catch (e) {
      handleFirestoreError(e, 'update_history', `leads/${id}`);
    }
  },

  async deleteLead(orgId: string, id: string): Promise<void> {
    try {
      const docRef = doc(db, 'leads', id);
      const snap = await getDoc(docRef);
      const data = snap.data() as Lead | undefined;
      
      await deleteDoc(docRef);

      if (data) {
        await this.addAuditLog(
          data.orgId,
          'Delete Lead', 
          id, 
          'Lead', 
          `Lead Purged: ${data.name} (Phone: ${data.phone}, Serial: ${data.serialId}). Deletion by agent/staff.`
        );
      }
    } catch (e) {
      handleFirestoreError(e, 'delete', `leads/${id}`);
    }
  },

  async bulkDeleteLeads(orgId: string, leadIds: string[]): Promise<void> {
    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      // We'll try to get names if possible for the log, but bulk might be many.
      // At least we log the count and the IDs.
      leadIds.forEach(id => {
        batch.delete(doc(db, 'leads', id));
      });
      await batch.commit();
      await this.addAuditLog(orgId, 'Bulk Delete', 'multiple', 'Lead', `Purged ${leadIds.length} leads from database. IDs: ${leadIds.slice(0, 5).join(', ')}${leadIds.length > 5 ? '...' : ''}`);
    } catch (e) {
      handleFirestoreError(e, 'bulk_delete', 'leads');
    }
  },

  // --- Inventory ---
  subscribeInventory(orgId: string | undefined, callback: (items: InventoryItem[]) => void) {
    const orgConstraints = orgId ? [where('orgId', '==', orgId)] : [];
    const q = query(collection(db, 'inventory'), ...orgConstraints);
    return onSnapshot(q, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as InventoryItem));
        callback(items);
      },
      (error) => handleFirestoreError(error, 'list', 'inventory')
    );
  },

  async updateStock(orgId: string, itemId: string, newStock: number): Promise<void> {
    try {
      const itemRef = doc(db, 'inventory', itemId);
      const itemSnap = await getDoc(itemRef);
      if (itemSnap.exists()) {
        const itemData = itemSnap.data() as InventoryItem;
        await updateDoc(itemRef, { stock: newStock });

        if (newStock <= itemData.minStock) {
          this.notifyStaff(
            itemData.orgId,
            ['Admin', 'Manager', 'Inventory'],
            'Inventory Threshold Breached',
            `Manual adjustment: "${itemData.name}" is now at ${newStock} units.`,
            'warning'
          );
        }
      }
    } catch (e) {
      handleFirestoreError(e, 'update', `inventory/${itemId}`);
    }
  },

  async updateInventoryItem(itemId: string, updates: Partial<InventoryItem>): Promise<void> {
    try {
      const docRef = doc(db, 'inventory', itemId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, 'update', `inventory/${itemId}`);
    }
  },

  async deleteInventoryItem(orgId: string, itemId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'inventory', itemId));
    } catch (e) {
      handleFirestoreError(e, 'delete', `inventory/${itemId}`);
    }
  },

  async addInventoryItem(orgId: string, item: Omit<InventoryItem, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'inventory'), {
        ...item,
        orgId
      });
      return docRef.id;
    } catch (e) {
      return handleFirestoreError(e, 'create', 'inventory');
    }
  },

  async updateOrderStatus(orgId: string, orderId: string, status: OrderStatus, extras: Partial<Order> = {}): Promise<void> {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      const orderData = orderSnap.data() as Order;
      const timestamp = new Date().toISOString();
      const currentUser = auth.currentUser;

      await updateDoc(orderRef, { 
        status, 
        ...extras,
        updatedAt: timestamp
      });

      // If leadId exists, update the lead status too
      if (orderData.leadId) {
        const leadRef = doc(db, 'leads', orderData.leadId);
        const leadSnap = await getDoc(leadRef);
        if (leadSnap.exists()) {
          const leadData = leadSnap.data() as Lead;
          const historyItem: HistoryItem = {
            id: Math.random().toString(36).substring(2, 9),
            type: 'status_change',
            from: leadData.status,
            to: status as any, // Cast since LeadStatus might not have all Order statuses but usually they overlap
            updatedBy: currentUser?.displayName || currentUser?.email || 'System',
            updatedById: currentUser?.uid || 'system',
            timestamp,
            note: `Order status updated to ${status}. ${extras.deliveryNotes || ''}`
          };
          await updateDoc(leadRef, {
            status: status as any,
            updatedAt: timestamp,
            history: arrayUnion(historyItem)
          });
        }
      }

      await this.addAuditLog(orderData.orgId, 'Order Update', orderId, 'Order', `Status updated to ${status}`);

      // Postback Trigger on Delivery / Shipped
      const clickId = orderData.clickId || (orderData.leadId ? (await (async () => {
        try {
          const lSnap = await getDoc(doc(db, 'leads', orderData.leadId));
          return lSnap.exists() ? (lSnap.data() as Lead).clickId : undefined;
        } catch { return undefined; }
      })()) : undefined);

      if (clickId) {
        const leadPayload: Partial<Lead> = {
          id: orderData.leadId || orderId,
          name: orderData.customerName,
          phone: orderData.phone,
          product: orderData.product,
          value: orderData.total,
          clickId,
          campaignId: orderData.campaignId,
          adSource: orderData.adSource
        };

        if (status === 'Delivered') {
          this.triggerPostbackForLead(orderData.orgId, leadPayload, 'order_delivered', orderData.total).catch(e => console.warn('Postback error:', e));
        } else if (status === 'Dispatched' || status === 'Shipped') {
          this.triggerPostbackForLead(orderData.orgId, leadPayload, 'order_dispatched').catch(e => console.warn('Postback error:', e));
        }
      }
    } catch (e) {
      handleFirestoreError(e, 'update', `orders/${orderId}`);
    }
  },

  async toggleUserStatus(uid: string, currentStatus: string, orgId?: string): Promise<void> {
    try {
      const newStatus = currentStatus === 'active' ? 'pending' : 'active';
      const updates: any = { status: newStatus };
      if (newStatus === 'active' && orgId) {
        updates.orgId = orgId;
      }
      await updateDoc(doc(db, 'users', uid), updates);
    } catch (e) {
      handleFirestoreError(e, 'update', `users/${uid}`);
    }
  },

  async deleteUser(uid: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (e) {
      handleFirestoreError(e, 'delete', `users/${uid}`);
    }
  },

  async updateUserRole(uid: string, role: User['role'], orgId?: string): Promise<void> {
    try {
      const updates: any = { role };
      if (orgId) updates.orgId = orgId;
      await updateDoc(doc(db, 'users', uid), updates);
    } catch (e) {
      handleFirestoreError(e, 'update', `users/${uid}`);
    }
  },

  async updateUserProfile(uid: string, updates: Partial<User>): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', uid), updates);
    } catch (e) {
      handleFirestoreError(e, 'update', `users/${uid}`);
    }
  },

  subscribeLead(leadId: string, callback: (lead: Lead | null) => void) {
    if (!leadId) {
      callback(null);
      return () => {};
    }
    const docRef = doc(db, 'leads', leadId);
    return onSnapshot(docRef, 
      (snapshot) => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() } as Lead);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error("Single lead subscription error:", error);
        // Safely call callback with null to allow UI to exit loading state
        callback(null);
      }
    );
  },

  async updateUserPresence(uid: string, context?: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      await updateDoc(doc(db, 'users', uid), { 
        lastSeen: timestamp,
        isOnline: true,
        currentAction: context || 'Active'
      });
    } catch (e) {
      // Don't throw for presence to avoid disrupting experience
      console.error("Presence update failed:", e);
    }
  },

  async updateLoginSession(uid: string, browser: string, device: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', uid);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return;

      const userData = snap.data() as User;
      const timestamp = new Date().toISOString();
      const isNewBrowser = userData.lastBrowser && userData.lastBrowser !== browser;
      const isNewDevice = userData.lastDevice && userData.lastDevice !== device;

      await updateDoc(docRef, {
        lastLogin: timestamp,
        lastBrowser: browser,
        lastDevice: device
      });

      if (isNewBrowser || isNewDevice) {
        await this.addAuditLog(
          userData.orgId || 'no-org',
          'Security Alert',
          uid,
          'User',
          `Agent ${userData.name} logged in from a ${isNewBrowser ? 'new browser' : ''} ${isNewDevice ? 'new device' : ''}. Browser: ${browser}, Device: ${device}. Previous known: ${userData.lastBrowser || 'N/A'}`
        );
      }
    } catch (e) {
      console.error("Login session update failed:", e);
    }
  },

  subscribeUsersPresence(user: User | null, callback: (users: User[]) => void) {
    if (!user) return () => {};
    const orgConstraints = getOrgConstraints(user);
    const q = query(collection(db, 'users'), ...orgConstraints);
    return onSnapshot(q, (snapshot) => {
      const now = new Date().getTime();
      const users = snapshot.docs.map(doc => {
        const data = doc.data() as User;
        const lastSeen = data.lastSeen ? new Date(data.lastSeen).getTime() : 0;
        // If last seen more than 5 minutes ago, consider offline
        const isOnline = data.isOnline && (now - lastSeen < 5 * 60 * 1000);
        return { ...data, id: doc.id, isOnline } as User;
      });
      callback(users);
    });
  },

  async getTeamMembers(user: User | null): Promise<User[]> {
    try {
      if (!user) return [];
      const orgConstraints = getOrgConstraints(user);
      const q = query(collection(db, 'users'), ...orgConstraints);
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    } catch (e) {
      return handleFirestoreError(e, 'list', 'users');
    }
  },

  // --- Orders ---
  subscribeOrders(user: User | null, callback: (orders: Order[]) => void) {
    if (!user || !user.id) {
      callback([]);
      return () => {};
    }
    
    let q;
    const orgConstraints = getOrgConstraints(user);
    const isSpecialist = ['Admin', 'Manager', 'Inventory', 'Delivery', 'Marketer', 'SuperAdmin'].includes(user.role || '') || user.email?.toLowerCase() === 'tzsupportayurveda@gmail.com';
    const isAgent = user.role === 'Sales' || user.role === 'Agent';

    try {
      q = query(
        collection(db, 'orders'), 
        ...orgConstraints
      );
  
      return onSnapshot(q, 
        (snapshot) => {
          const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Order));
          
          let filteredOrders = orders;
          if (!isSpecialist && isAgent) {
            filteredOrders = orders.filter(order => order.assignedToId === user.id);
          }

          // Sort by createdAt DESC
          const sorted = filteredOrders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          callback(sorted);
        },
        (error) => {
          console.error("Orders subscription error:", error);
          callback([]);
        }
      );
    } catch (e) {
      console.error("Orders query creation error:", e);
      callback([]);
      return () => {};
    }
  },

  async addOrder(orgId: string, order: Omit<Order, 'id' | 'createdAt'>): Promise<string> {
    try {
      const orderSerial = await this.getNextId(orgId, 'order_serial', 1);
      const docRef = await addDoc(collection(db, 'orders'), {
        ...order,
        orgId,
        orderSerial, // Adding a unique sequential serial for orders
        createdAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (e) {
      return handleFirestoreError(e, 'create', 'orders');
    }
  },

  // --- Postback & Traffic Integration Methods ---
  subscribePostbacks(user: User | null, callback: (configs: PostbackConfig[]) => void) {
    if (!user) {
      callback([]);
      return () => {};
    }
    const orgConstraints = getOrgConstraints(user);
    const q = query(collection(db, 'postbacks'), ...orgConstraints);
    return onSnapshot(q, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as PostbackConfig));
        callback(items);
      },
      (error) => {
        console.error("Postback configs subscription error:", error);
        callback([]);
      }
    );
  },

  async savePostbackConfig(orgId: string, config: Partial<PostbackConfig>): Promise<string> {
    try {
      const timestamp = new Date().toISOString();
      if (config.id) {
        const ref = doc(db, 'postbacks', config.id);
        const { id, ...data } = config;
        await updateDoc(ref, sanitize({ ...data, updatedAt: timestamp }));
        return config.id;
      } else {
        const docRef = await addDoc(collection(db, 'postbacks'), sanitize({
          ...config,
          orgId: orgId || 'root-admin',
          isActive: config.isActive !== undefined ? config.isActive : true,
          createdAt: timestamp,
          updatedAt: timestamp
        }));
        return docRef.id;
      }
    } catch (e) {
      return handleFirestoreError(e, 'write', 'postbacks');
    }
  },

  async deletePostbackConfig(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'postbacks', id));
    } catch (e) {
      handleFirestoreError(e, 'delete', `postbacks/${id}`);
    }
  },

  async togglePostbackStatus(id: string, isActive: boolean): Promise<void> {
    try {
      await updateDoc(doc(db, 'postbacks', id), {
        isActive,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, 'update', `postbacks/${id}`);
    }
  },

  subscribePostbackLogs(user: User | null, callback: (logs: PostbackLog[]) => void) {
    if (!user) {
      callback([]);
      return () => {};
    }
    const orgConstraints = getOrgConstraints(user);
    const q = query(collection(db, 'postbackLogs'), ...orgConstraints);
    return onSnapshot(q, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as PostbackLog));
        const sorted = items.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        callback(sorted);
      },
      (error) => {
        console.error("Postback logs subscription error:", error);
        callback([]);
      }
    );
  },

  async triggerPostbackForLead(orgId: string, lead: Partial<Lead>, eventTrigger: PostbackEventTrigger, customPayout?: number, customAction?: string) {
    if (!lead.clickId) return { success: false, reason: 'No clickId on lead' };

    try {
      const effectiveOrgId = orgId || 'root-admin';
      const q = query(
        collection(db, 'postbacks'), 
        where('orgId', '==', effectiveOrgId), 
        where('isActive', '==', true)
      );
      const snap = await getDocs(q);
      
      const results = [];
      for (const pDoc of snap.docs) {
        const config = { id: pDoc.id, ...pDoc.data() } as PostbackConfig;
        const matchingRule = config.events?.find(r => r.event === eventTrigger && r.enabled);
        if (matchingRule || customAction) {
          const res = await fetch('/api/postback/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orgId: effectiveOrgId,
              postbackConfig: config,
              lead,
              event: eventTrigger,
              customAction: customAction || matchingRule?.actionName,
              customPayout: customPayout !== undefined ? customPayout : (matchingRule?.payout || 0)
            })
          });
          const json = await res.json();
          results.push(json);
        }
      }
      return results.length > 0 ? results[0] : { success: false, reason: 'No matching active postback rule configured' };
    } catch (e) {
      console.error('Failed to trigger postback for lead:', e);
      return { success: false, error: String(e) };
    }
  },

  async testPostbackUrl(postbackUrl: string, testParams?: any) {
    try {
      const res = await fetch('/api/postback/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postbackUrl, testParams })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, errorMessage: e?.message || 'Failed to connect to postback test endpoint' };
    }
  },

  // --- Team Member Provisioning & Seat Usage ---
  async createTeamMember(payload: {
    orgId: string;
    name: string;
    email: string;
    password: string;
    role: 'TeamLeader' | 'Sales' | 'Manager';
  }) {
    // 1. Quota checks in Firestore
    const teamMembers = await this.getTeamMembers({ orgId: payload.orgId } as any);
    if (teamMembers.length >= 5) {
      throw new Error("Trial Quota Exceeded: Aapka 5-seat limit full ho chuka hai.");
    }

    if (payload.role === 'TeamLeader') {
      const tlCount = teamMembers.filter(m => m.role === 'TeamLeader').length;
      if (tlCount >= 1) {
        throw new Error("Team Leader slot is already filled (1 max in trial).");
      }
    } else if (payload.role === 'Sales') {
      const salesCount = teamMembers.filter(m => m.role === 'Sales' || m.role === 'Agent').length;
      if (salesCount >= 3) {
        throw new Error("All 3 Sales Agent slots are already filled in your trial.");
      }
    }

    // 2. Initialize temporary secondary app to create credentials without signing out current user
    const { initializeApp, deleteApp } = await import('firebase/app');
    const { getAuth: getSecondaryAuth, createUserWithEmailAndPassword, updateProfile, signOut: secondarySignOut } = await import('firebase/auth');
    const { setDoc, doc: fsDoc } = await import('firebase/firestore');
    const firebaseConfigModule = await import('@/firebase-applet-config.json');
    const firebaseConfig = firebaseConfigModule.default || firebaseConfigModule;

    const tempAppName = `AddMember_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tempApp = initializeApp(firebaseConfig as any, tempAppName);
    const tempAuth = getSecondaryAuth(tempApp);

    try {
      const cred = await createUserWithEmailAndPassword(tempAuth, payload.email, payload.password);
      await updateProfile(cred.user, { displayName: payload.name });
      const newUid = cred.user.uid;

      // 3. Create active User document in Firestore linked to this business
      await setDoc(fsDoc(db, 'users', newUid), {
        id: newUid,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        orgId: payload.orgId,
        status: 'active',
        createdAt: new Date().toISOString(),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newUid}`
      });

      // 4. Add Audit Log
      await this.addAuditLog(
        payload.orgId, 
        'Member Enrolled', 
        newUid, 
        'User', 
        `New member ${payload.name} added as ${payload.role} (5-Seat Trial).`
      );

      // Clean up temporary app instance
      await secondarySignOut(tempAuth).catch(() => {});
      await deleteApp(tempApp).catch(() => {});

      return {
        success: true,
        member: {
          id: newUid,
          name: payload.name,
          email: payload.email,
          role: payload.role,
          tempPassword: payload.password
        }
      };
    } catch (err: any) {
      await deleteApp(tempApp).catch(() => {});
      if (err.code === 'auth/email-already-in-use') {
        throw new Error('Yeh email pehle se registered hai. Kripya dusra email use karein.');
      } else if (err.code === 'auth/weak-password') {
        throw new Error('Password kam se kam 6 characters ka hona chahiye.');
      }
      throw err;
    }
  },

  async getSeatUsage(orgId: string) {
    const res = await fetch(`/api/team/seat-usage/${encodeURIComponent(orgId)}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch seat usage');
    }
    return data;
  },

  async registerBusiness(payload: {
    businessName: string;
    ownerName: string;
    userId: string;
  }) {
    return await this.createOrganization(payload.businessName, payload.userId);
  }
};
