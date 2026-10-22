
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, signInWithGoogle } from '@/src/lib/firebase';
import { dataService } from '@/src/services/dataService';
import { User, Organization } from '@/src/types';
import { toast } from 'sonner';

const ADMIN_EMAILS = ['tzsupportayurveda@gmail.com'];

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name: string) => Promise<void>;
  registerBusiness: (businessName: string, name: string, email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  impersonate: (user: User | null) => void;
  isImpersonating: boolean;
  adminUser: User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      setLoading(true);
      setFirebaseUser(fbUser);
      
      if (fbUser) {
        setError(null);
      }
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      try {
        if (fbUser) {
          const isRootEmail = fbUser.email?.toLowerCase() === 'tzsupportayurveda@gmail.com';
          const isAdminUser = fbUser.email ? ADMIN_EMAILS.map(e => e.toLowerCase()).includes(fbUser.email.toLowerCase()) : false;
          const isSuperAdmin = isRootEmail;
          
          const { doc, onSnapshot } = await import('firebase/firestore');
          const { db } = await import('@/src/lib/firebase');

          // Org Detail subscription
          let unsubOrg: (() => void) | null = null;
          
          // Detect Browser and Device
          const ua = navigator.userAgent;
          let browser = "Unknown Browser";
          if (ua.indexOf("Firefox") > -1) browser = "Firefox";
          else if (ua.indexOf("SamsungBrowser") > -1) browser = "Samsung Browser";
          else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) browser = "Opera";
          else if (ua.indexOf("Trident") > -1) browser = "Internet Explorer";
          else if (ua.indexOf("Edge") > -1) browser = "Edge";
          else if (ua.indexOf("Chrome") > -1) browser = "Chrome";
          else if (ua.indexOf("Safari") > -1) browser = "Safari";

          let device = "Desktop";
          if (/Mobi|Android/i.test(ua)) device = "Mobile";
          if (/Tablet|iPad/i.test(ua)) device = "Tablet";

          // Track if we've already updated the session this app load
          let sessionUpdated = false;
          
          unsubscribeProfile = onSnapshot(doc(db, 'users', fbUser.uid), (snapshot) => {
            if (snapshot.exists()) {
              let profile = { id: snapshot.id, ...snapshot.data() } as User;
              
              // Force SuperAdmin role and active status for the root admin email
              if (isSuperAdmin) {
                profile.role = 'SuperAdmin';
                profile.status = 'active';
              }
              
              if (isSuperAdmin || profile.role === 'SuperAdmin' || profile.role === 'Admin' || profile.role === 'Manager') setAdminUser(profile);
              setUser(profile);

              // Update session once per login/refresh
              if (!sessionUpdated) {
                dataService.updateLoginSession(fbUser.uid, browser, device);
                sessionUpdated = true;
              }
              
              if (profile.orgId && !unsubOrg) {
                unsubOrg = onSnapshot(doc(db, 'organizations', profile.orgId), (orgSnap) => {
                  if (orgSnap.exists()) {
                    setOrganization({ id: orgSnap.id, ...orgSnap.data() } as Organization);
                  }
                });
              }

              if (profile.role !== 'Admin' && profile.role !== 'SuperAdmin' && profile.role !== 'Manager' && profile.status !== 'active' && !isSuperAdmin) {
                setError('Account approval pending. Kripya admin se sampark karein.');
              }
            } else {
              const defaultProfile: User = {
                id: fbUser.uid,
                name: fbUser.displayName || fbUser.email?.split('@')[0] || 'CRM User',
                email: fbUser.email || '',
                role: isSuperAdmin ? 'SuperAdmin' : (isAdminUser ? 'Admin' : 'Sales'),
                avatar: fbUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fbUser.uid}`,
                status: (isAdminUser || isSuperAdmin) ? 'active' : 'pending',
                createdAt: new Date().toISOString()
              };
              dataService.createUserProfile(defaultProfile);
            }
            setLoading(false);
          });
        } else {
          setUser(null);
          setAdminUser(null);
          setImpersonatedUser(null);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Auth flow error:", err);
        setError("Login failed. Check connection.");
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const impersonate = (targetUser: User | null) => {
    const isRootAdmin = firebaseUser?.email?.toLowerCase() === 'tzsupportayurveda@gmail.com';
    if (isRootAdmin || adminUser?.role === 'Admin' || adminUser?.role === 'SuperAdmin' || adminUser?.role === 'Manager') {
      setImpersonatedUser(targetUser);
      if (targetUser) {
        toast.success(`Active Session: Switched to ${targetUser.name}`, {
          description: "Aap ab is agent ke view mein hain.",
          icon: "🔐"
        });
      } else {
        toast.info("Session Reset: Back to Administrator view");
      }
    }
  };

  const activeUser = impersonatedUser || user;

  const signIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Google login failed:", err);
      // Handle various forms of the "popup closed" error
      const errorMsg = err.message || "";
      const errorCode = err.code || "";
      if (errorCode === 'auth/popup-closed-by-user' || errorMsg.includes('popup-closed-by-user') || errorMsg.includes('closed the popup')) {
        return;
      }
      setError("Google login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, pass: string) => {
    try {
      setLoading(true);
      setError(null);
      await signInWithEmailAndPassword(auth, email, pass);
      toast.success("Login request processed...");
    } catch (err: any) {
      console.error("Login failed:", err);
      setError("Aapka login fail ho gaya hai. Kripya email aur password check karein.");
      toast.error("Login failed");
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, pass: string, name: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(res.user, { displayName: name });
      toast.success("Account request sent for approval!");
    } catch (err: any) {
      console.error("Signup failed:", err);
      setError("Registration fail ho gaya. Shaayad ye email pehle se exist karta hai.");
      toast.error("Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const registerBusiness = async (businessName: string, name: string, email: string, pass: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(res.user, { displayName: name });
      
      // Create Organization with 5-Seat Trial preset
      await dataService.createOrganization(businessName, res.user.uid);
      
      toast.success("Business Workspace Launched! Welcome to TOZ Flow.");
    } catch (err: any) {
      console.error("Business registration failed:", err);
      let errMsg = err.message || "Registration fail ho gaya. Kripya details check karein.";
      if (err.code === 'auth/email-already-in-use') {
        errMsg = "Yeh email pehle se registered hai. Kripya login karein.";
      } else if (err.code === 'auth/weak-password') {
        errMsg = "Password kam se kam 6 characters ka hona chahiye.";
      }
      setError(errMsg);
      toast.error(errMsg);
      throw new Error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const actionCodeSettings = {
        url: window.location.href, 
        handleCodeInApp: true,
      };

      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      toast.success("Password reset link aapke email par bhej diya gaya hai! Kripya Spam folder bhi check karein.");
    } catch (err: any) {
      console.error("Password reset failed:", err);
      let errorMessage = "Password reset fail ho gaya. Kripya details check karein.";
      
      if (err.code === 'auth/user-not-found') {
        errorMessage = "Ye email ID hamare system mein nahi mili.";
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = "Email ID galat hai.";
      }
      
      setError(errorMessage);
      toast.error("Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setImpersonatedUser(null);
      await firebaseSignOut(auth);
      setError(null);
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user: activeUser, 
      firebaseUser, 
      loading, 
      error, 
      signIn, 
      login, 
      signup, 
      registerBusiness,
      resetPassword,
      signOut,
      impersonate,
      isImpersonating: !!impersonatedUser,
      adminUser,
      organization
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
