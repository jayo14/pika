// Pika: complete route map, shared shell, and client-side navigation behavior.
import { useEffect } from "react";
import { Route, Switch, useLocation, useRoute } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import { SiteShell } from "@/components/SiteShell";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Home from "@/pages/Home";
import { AboutPage, AdminPage, BlogPage, ContactPage, FAQPage, FeaturesPage, LegalPage, PricingPage } from "@/pages/StaticPages";
import { ArticleDetail, FeatureDetail, PasswordPage, SourceNotFound } from "@/pages/DynamicPages";
import { ForgotPasswordPage, SignInPage, SignUpPage } from "@/pages/AuthPages";
import Dashboard from "@/pages/Dashboard";
import MonitorsPage from "@/pages/Monitors";
import SavedPage from "@/pages/Saved";
import SettingsPage from "@/pages/Settings";
import AdminOverviewPage from "@/pages/admin/Overview";
import AdminUsersPage from "@/pages/admin/Users";
import AdminUserDetailPage from "@/pages/admin/UserDetail";
import AdminWorkspacesPage from "@/pages/admin/Workspaces";
import AdminWorkspaceDetailPage from "@/pages/admin/WorkspaceDetail";
import AdminSystemPage from "@/pages/admin/System";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function FeatureRoute() { const [, params] = useRoute("/feature/:slug"); return <FeatureDetail slug={params?.slug ?? "product"} />; }
function ArticleRoute() { const [, params] = useRoute("/articles/:slug"); return <ArticleDetail slug={params?.slug ?? "11-best-alternatives-to-power-up-your-workflow-in-2026"} />; }
function CategoryRoute() { const [, params] = useRoute("/category/:slug"); return <BlogPage category={params?.slug} />; }
function AdminUserDetailRoute() { const [, params] = useRoute("/admin/users/:id"); return params?.id ? <AdminUserDetailPage userId={params.id} /> : null; }
function AdminWorkspaceDetailRoute() { const [, params] = useRoute("/admin/workspaces/:id"); return params?.id ? <AdminWorkspaceDetailPage workspaceId={params.id} /> : null; }
function ScrollTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);

  return null;
}
function Wrapped({ children }: { children: React.ReactNode }) { return <SiteShell>{children}</SiteShell>; }

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) setLocation("/sign-in");
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) return <div className="pika-route-loading">Loading workspace…</div>;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}

function RequireStaff({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) setLocation("/sign-in");
    else if (!user?.is_staff) setLocation("/404");
  }, [isLoading, isAuthenticated, user, setLocation]);

  if (isLoading || !isAuthenticated || !user?.is_staff) return null;
  return <>{children}</>;
}

function Router() { return <><ScrollTop /><Switch>
  <Route path="/"><Wrapped><Home /></Wrapped></Route>
  <Route path="/pricing"><Wrapped><PricingPage /></Wrapped></Route>
  <Route path="/features"><Wrapped><FeaturesPage /></Wrapped></Route>
  <Route path="/feature/:slug"><Wrapped><FeatureRoute /></Wrapped></Route>
  <Route path="/about"><Wrapped><AboutPage /></Wrapped></Route>
  <Route path="/faq"><Wrapped><FAQPage /></Wrapped></Route>
  <Route path="/blog-articles"><Wrapped><BlogPage /></Wrapped></Route>
  <Route path="/category/:slug"><Wrapped><CategoryRoute /></Wrapped></Route>
  <Route path="/articles/:slug"><Wrapped><ArticleRoute /></Wrapped></Route>
  <Route path="/contact"><Wrapped><ContactPage /></Wrapped></Route>
  <Route path="/sign-in"><SignInPage /></Route>
  <Route path="/sign-up"><SignUpPage /></Route>
  <Route path="/forgot-password"><ForgotPasswordPage /></Route>
  <Route path="/dashboard"><RequireAuth><Dashboard /></RequireAuth></Route>
  <Route path="/monitors"><RequireAuth><MonitorsPage /></RequireAuth></Route>
  <Route path="/saved"><RequireAuth><SavedPage /></RequireAuth></Route>
  <Route path="/settings"><RequireAuth><SettingsPage /></RequireAuth></Route>
  <Route path="/admin"><RequireStaff><AdminOverviewPage /></RequireStaff></Route>
  <Route path="/admin/users"><RequireStaff><AdminUsersPage /></RequireStaff></Route>
  <Route path="/admin/users/:id"><RequireStaff><AdminUserDetailRoute /></RequireStaff></Route>
  <Route path="/admin/workspaces"><RequireStaff><AdminWorkspacesPage /></RequireStaff></Route>
  <Route path="/admin/workspaces/:id"><RequireStaff><AdminWorkspaceDetailRoute /></RequireStaff></Route>
  <Route path="/admin/system"><RequireStaff><AdminSystemPage /></RequireStaff></Route>
  <Route path="/privacy-policy"><Wrapped><LegalPage title="Privacy Policy" /></Wrapped></Route>
  <Route path="/terms-conditions"><Wrapped><LegalPage title="Terms & Conditions" /></Wrapped></Route>
  <Route path="/admin-pages/style-guide"><Wrapped><AdminPage type="style" /></Wrapped></Route>
  <Route path="/admin-pages/licenses"><Wrapped><AdminPage type="licenses" /></Wrapped></Route>
  <Route path="/admin-pages/changelog"><Wrapped><AdminPage type="changelog" /></Wrapped></Route>
  <Route path="/401"><PasswordPage /></Route>
  <Route path="/404"><Wrapped><SourceNotFound /></Wrapped></Route>
  <Route><Wrapped><SourceNotFound /></Wrapped></Route>
</Switch></>; }

export default function App() {
  return <ErrorBoundary><QueryClientProvider client={queryClient}><AuthProvider><TooltipProvider><Toaster /><Router /></TooltipProvider></AuthProvider></QueryClientProvider></ErrorBoundary>;
}
