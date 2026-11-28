"use client";

import type { User as SbUser } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiClientError, api } from "@/lib/api";
import { clientConfigured, supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

/** The signed-in user as the UI needs it (kept small and provider-neutral). */
export interface AppUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  /** Profile fields entered at registration (kept in auth metadata until the profile exists). */
  pendingProfile: Record<string, string> | null;
}

function toAppUser(u: SbUser): AppUser {
  const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string; profile?: Record<string, string> };
  return {
    uid: u.id,
    email: u.email ?? "",
    emailVerified: !!u.email_confirmed_at,
    displayName: meta.full_name ?? meta.name ?? null,
    pendingProfile: meta.profile && typeof meta.profile === "object" ? meta.profile : null,
  };
}

interface AuthState {
  configured: boolean;
  loading: boolean;
  user: AppUser | null;
  profile: Profile | null;
  /** Error loading the profile (e.g. server not configured). */
  profileError: string | null;
  refreshProfile: () => Promise<Profile | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
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
  // The profile request in flight. Supabase often fires two auth events on page load
  // (INITIAL_SESSION + SIGNED_IN / TOKEN_REFRESHED); the second must wait for the same
  // request instead of finishing "loading" early with no profile (which redirected
  // signed-in candidates to the profile form).
  const pending = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    if (!clientConfigured) return;
    const { data } = supabase().auth.onAuthStateChange((_event, session) => {
      const u = session?.user ? toAppUser(session.user) : null;
      if (u && loadedUid.current !== u.uid) setLoading(true);
      setUser(u);
      // Defer: Supabase must not be called synchronously inside this callback.
      setTimeout(async () => {
        if (u) {
          // Only refetch the profile on sign-in / account switch, not on token refresh.
          if (loadedUid.current !== u.uid) {
            loadedUid.current = u.uid;
            pending.current = (async () => {
              const p = await loadProfile();
              // First login after e-mail confirmation: create the profile from the registration data.
              if (!p && u.pendingProfile?.firstName && u.pendingProfile?.lastName) {
                try {
                  const r = await api<{ profile: Profile }>("/api/me", { method: "POST", body: u.pendingProfile });
                  setProfile(r.profile);
                } catch {
                  /* fall back to the profile form */
                }
              }
            })();
          }
          await pending.current;
        } else {
          loadedUid.current = null;
          pending.current = null;
          setProfile(null);
        }
        setLoading(false);
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    if (!clientConfigured) return;
    await supabase().auth.signOut();
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
