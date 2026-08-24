// Pika access pages: distinct geometric visuals, accessible password controls, and explicitly local demonstration access flows.
import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { ASSETS } from "@/data/site";

const DEMO_ADMIN = { email: "admin@pika.io", password: "Pika@00" };
const STORAGE_KEY = "pika-demo-account";

type DemoAccount = { email: string; password: string; name?: string };
type Provider = "Google" | "Discord";

function readCreatedAccount(): DemoAccount | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as DemoAccount : null;
  } catch {
    return null;
  }
}

function AuthFrame({ children, caption, title, description, visual, visualAlt, visualClass }: { children: React.ReactNode; caption: string; title: string; description: string; visual: string; visualAlt: string; visualClass: string }) {
  return <main className="auth-page"><aside className="auth-art-panel"><Link className="pika-wordmark auth-brand" href="/" aria-label="Pika home"><span className="pika-mark" aria-hidden="true" /><span>Pika</span></Link><div className="auth-art-copy"><span className="auth-kicker">{caption}</span><h1>{title}</h1><p>{description}</p></div><div className={`auth-visual-frame ${visualClass}`}><img src={visual} alt={visualAlt} /></div></aside><section className="auth-form-panel"><Link className="auth-back" href="/"><ArrowLeft size={15} />Back to Pika</Link><div className="auth-card">{children}</div></section></main>;
}

function AuthSubmit({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) { return <button className={`source-button primary auth-submit ${wide ? "auth-submit-wide" : ""}`} type="submit"><span>{children}</span><span className="button-round"><ArrowUpRight size={14} /></span></button>; }

function PasswordField({ value, onChange, autoComplete = "current-password" }: { value: string; onChange: (value: string) => void; autoComplete?: "current-password" | "new-password" }) {
  const [visible, setVisible] = useState(false);
  return <label>Password<span className="password-control"><input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} minLength={6} required autoComplete={autoComplete} aria-describedby="password-help" /><button type="button" aria-label={visible ? "Hide password" : "Show password"} title={visible ? "Hide password" : "Show password"} onClick={() => setVisible((state) => !state)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span><small id="password-help">At least 6 characters.</small></label>;
}

function SocialAccess({ onPick }: { onPick: (provider: Provider) => void }) {
  return <><div className="auth-divider"><span>or continue with</span></div><div className="social-access"><button type="button" onClick={() => onPick("Google")}><span className="google-g" aria-hidden="true">G</span>Google</button><button type="button" onClick={() => onPick("Discord")}><span className="discord-mark" aria-hidden="true">⌁</span>Discord</button></div><p className="social-demo-note">Google and Discord are visual demo options in this browser-only prototype.</p></>;
}

function ProviderSuccess({ provider }: { provider: Provider }) { return <div className="auth-success" role="status"><CheckCircle2 size={19} /><div><b>{provider} demo connected.</b><span>No third-party account was accessed in this prototype.</span></div><Link href="/dashboard">Open workspace</Link></div>; }

export function SignInPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState(DEMO_ADMIN.email);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "error">("idle");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = readCreatedAccount();
    const demoMatch = email.trim().toLowerCase() === DEMO_ADMIN.email && password === DEMO_ADMIN.password;
    const createdMatch = created?.email.toLowerCase() === email.trim().toLowerCase() && created.password === password;
    if (demoMatch || createdMatch) setLocation("/dashboard");
    else setStatus("error");
  };
  return <AuthFrame caption="Welcome back" title="Pick up where you left off." description="Sign in to continue searching, watching, and saving useful conversations." visual={ASSETS.workflowResults} visualAlt="Geometric 3D results sculpture for returning to Pika" visualClass="auth-visual-signin"><span className="auth-eyebrow">Sign in</span><h2>Access your Pika workspace.</h2><p className="auth-intro">Use the demo account or sign in with an account you created in this browser.</p><form className="auth-form" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><PasswordField value={password} onChange={setPassword} />{status === "error" && <p className="auth-error" role="alert">That email and password do not match this demo.</p>}<div className="auth-row"><label className="auth-check"><input type="checkbox" />Remember me</label><Link href="/forgot-password">Forgot password?</Link></div><AuthSubmit>Sign in</AuthSubmit></form><SocialAccess onPick={() => setLocation("/dashboard")} /><p className="auth-switch">New to Pika? <Link href="/sign-up">Create an account</Link></p><p className="auth-demo-note"><b>Demo access</b><span>{DEMO_ADMIN.email} · {DEMO_ADMIN.password}</span></p></AuthFrame>;
}

export function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState(false);
  const [provider, setProvider] = useState<Provider | null>(null);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, email, password })); } catch { /* The account remains usable for the current page even if storage is unavailable. */ }
    setProvider(null);
    setCreated(true);
  };
  return <AuthFrame caption="Start with a question" title="Create your Pika account." description="Keep useful conversations, people, and topics in one place." visual={ASSETS.communityAtlas} visualAlt="Geometric 3D community sculpture for creating a Pika account" visualClass="auth-visual-signup"><span className="auth-eyebrow">Create account</span><h2>Start finding useful conversations.</h2><p className="auth-intro">Create a local demo account to try the flow. No information is sent anywhere.</p>{provider ? <ProviderSuccess provider={provider} /> : created ? <div className="auth-success" role="status"><CheckCircle2 size={19} /><div><b>Your demo account is ready.</b><span>Sign in with the email and password you just chose.</span></div><Link href="/sign-in">Sign in</Link></div> : <><form className="auth-form" onSubmit={submit}><label>Name<input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" /></label><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><PasswordField value={password} onChange={setPassword} autoComplete="new-password" /><p className="auth-legal">By continuing, you agree this is a browser-only product demonstration.</p><AuthSubmit wide>Create account</AuthSubmit></form><SocialAccess onPick={setProvider} /></>}<p className="auth-switch">Already have an account? <Link href="/sign-in">Sign in</Link></p></AuthFrame>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSent(true); };
  return <AuthFrame caption="Password help" title="Get back into Pika." description="Tell us where to send password-recovery instructions." visual={ASSETS.workflowSave} visualAlt="Geometric 3D bookmark sculpture for recovering Pika access" visualClass="auth-visual-recovery"><span className="auth-eyebrow">Forgot password</span><h2>Reset your password.</h2><p className="auth-intro">For this browser-only demo, we will simply confirm the request—no email is sent.</p>{sent ? <div className="auth-success" role="status"><CheckCircle2 size={19} /><div><b>Recovery request received.</b><span>No email was sent because this is a local demo.</span></div><Link href="/sign-in">Back to sign in</Link></div> : <form className="auth-form" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><AuthSubmit>Send recovery link</AuthSubmit></form>}<p className="auth-switch">Remembered it? <Link href="/sign-in">Sign in</Link></p></AuthFrame>;
}
