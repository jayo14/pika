import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api, type SessionResponse, type User, type WorkspaceMembership } from "@/lib/api";

const ACTIVE_WORKSPACE_KEY = "pika-active-workspace-id";

type AuthContextValue = {
  user: User | null;
  workspaces: WorkspaceMembership[];
  isWorkspaceOwner: boolean;
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string) => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInError: string | null;
  signUpError: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(ACTIVE_WORKSPACE_KEY);
    } catch {
      return null;
    }
  });

  const meQuery = useQuery<SessionResponse, ApiError>({
    queryKey: ["me"],
    queryFn: api.auth.me,
    retry: false,
    staleTime: 60_000,
  });

  const session = meQuery.data;
  const workspaces = useMemo(() => session?.workspaces ?? [], [session]);

  useEffect(() => {
    if (workspaces.length === 0) return;
    const stillValid = activeWorkspaceId && workspaces.some((w) => w.id === activeWorkspaceId);
    if (!stillValid) setActiveWorkspaceId(workspaces[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces]);

  const setActiveWorkspaceId = (id: string) => {
    setActiveWorkspaceIdState(id);
    try {
      window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
    } catch {
      /* localStorage may be unavailable (private mode); the selection just won't persist */
    }
  };

  const signInMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.auth.signin({ email, password }),
    onSuccess: (data) => queryClient.setQueryData(["me"], data),
  });

  const signUpMutation = useMutation({
    mutationFn: (body: { email: string; password: string; display_name?: string }) => api.auth.signup(body),
    onSuccess: (data) => queryClient.setQueryData(["me"], data),
  });

  const signOutMutation = useMutation({
    mutationFn: api.auth.signout,
    onSuccess: () => {
      queryClient.setQueryData(["me"], null);
      queryClient.clear();
    },
  });

  const value: AuthContextValue = {
    user: session?.user ?? null,
    workspaces,
    isWorkspaceOwner: workspaces.find((w) => w.id === activeWorkspaceId)?.role === "owner",
    activeWorkspaceId,
    setActiveWorkspaceId,
    isLoading: meQuery.isLoading,
    isAuthenticated: Boolean(session?.user),
    signIn: async (email, password) => {
      await signInMutation.mutateAsync({ email, password });
    },
    signUp: async (email, password, display_name) => {
      await signUpMutation.mutateAsync({ email, password, display_name });
    },
    signOut: async () => {
      await signOutMutation.mutateAsync();
    },
    signInError: signInMutation.error instanceof ApiError ? signInMutation.error.detail : null,
    signUpError: signUpMutation.error instanceof ApiError ? signUpMutation.error.detail : null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
