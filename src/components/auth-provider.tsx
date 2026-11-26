"use client";

import { type User, onIdTokenChanged, signOut as fbSignOut } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiClientError, api } from "@/lib/api";
import { candidateAuth, clientConfigured } from "@/lib/firebase/client";
import type { Profile } from "@/lib/types";

interface AuthState {
  configured: boolean;
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  /** Error loading the profile (e.g. server not configured). */
  profileError: string | null;
  refreshProfile: () => Promise<Profile | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(clientConfigured);
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadProfile = useCallback(async (): Promise<Profile | null> => {
    try {
      const r = await api<{ profile: Profile | null }>("/api/me");
      setProfile(r.profile);
      setProfileError(null);
      return r.profile;
    } catch (e) {
      setProfile(null);
      if (e instanceof ApiClientError && e.status === 401) return null;
      setProfileError(e instanceof Error ? e.message : "Profilni yuklab bo‘lmadi.");
      return null;
    }
  }, []);

  const loadedUid = useRef<string | null>(null);

  useEffect(() => {
    if (!clientConfigured) return;
    const unsub = onIdTokenChanged(candidateAuth(), async (u) => {
      if (u && loadedUid.current !== u.uid) setLoading(true); // batched with setUser below
      setUser(u);
      if (u) {
        // Only refetch the profile on sign-in / account switch, not on hourly token refresh.
        if (loadedUid.current !== u.uid) {
          loadedUid.current = u.uid;
          await loadProfile();
        }
      } else {
        loadedUid.current = null;
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    if (!clientConfigured) return;
    await fbSignOut(candidateAuth());
    setProfile(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ configured: clientConfigured, loading, user, profile, profileError, refreshProfile: loadProfile, signOut }),
    [loading, user, profile, profileError, loadProfile, signOut],
  );
  return <Ctx value={value}>{children}</Ctx>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
