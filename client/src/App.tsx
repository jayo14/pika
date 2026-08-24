// Pika: complete route map, shared shell, and client-side navigation behavior.
import { useEffect } from "react";
import { Route, Switch, useLocation, useRoute } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import { SiteShell } from "@/components/SiteShell";
import Home from "@/pages/Home";
import { AboutPage, AdminPage, BlogPage, ContactPage, FAQPage, FeaturesPage, LegalPage, PricingPage } from "@/pages/StaticPages";
import { ArticleDetail, FeatureDetail, PasswordPage, SourceNotFound } from "@/pages/DynamicPages";
import { ForgotPasswordPage, SignInPage, SignUpPage } from "@/pages/AuthPages";
import Dashboard from "@/pages/Dashboard";

function FeatureRoute() { const [, params] = useRoute("/feature/:slug"); return <FeatureDetail slug={params?.slug ?? "product"} />; }
function ArticleRoute() { const [, params] = useRoute("/articles/:slug"); return <ArticleDetail slug={params?.slug ?? "11-best-alternatives-to-power-up-your-workflow-in-2026"} />; }
function CategoryRoute() { const [, params] = useRoute("/category/:slug"); return <BlogPage category={params?.slug} />; }
function ScrollTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);

  return null;
}
function Wrapped({ children }: { children: React.ReactNode }) { return <SiteShell>{children}</SiteShell>; }

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
  <Route path="/dashboard"><Dashboard /></Route>
  <Route path="/privacy-policy"><Wrapped><LegalPage title="Privacy Policy" /></Wrapped></Route>
  <Route path="/terms-conditions"><Wrapped><LegalPage title="Terms & Conditions" /></Wrapped></Route>
  <Route path="/admin-pages/style-guide"><Wrapped><AdminPage type="style" /></Wrapped></Route>
  <Route path="/admin-pages/licenses"><Wrapped><AdminPage type="licenses" /></Wrapped></Route>
  <Route path="/admin-pages/changelog"><Wrapped><AdminPage type="changelog" /></Wrapped></Route>
  <Route path="/401"><PasswordPage /></Route>
  <Route path="/404"><Wrapped><SourceNotFound /></Wrapped></Route>
  <Route><Wrapped><SourceNotFound /></Wrapped></Route>
</Switch></>; }

export default function App() { return <ErrorBoundary><TooltipProvider><Toaster /><Router /></TooltipProvider></ErrorBoundary>; }
