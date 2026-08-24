// Pika access pages: real signup/signin against the FastAPI backend (HttpOnly session cookie).
import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { ASSETS } from "@/data/site";
import { useAuth } from "@/contexts/AuthContext";

function AuthFrame({ children, caption, title, description, visual, visualAlt, visualClass }: { children: React.ReactNode; caption: string; title: string; description: string; visual: string; visualAlt: string; visualClass: string }) {
  return <main className="auth-page"><aside className="auth-art-panel"><Link className="pika-wordmark auth-brand" href="/" aria-label="Pika home"><span className="pika-mark" aria-hidden="true" /><span>Pika</span></Link><div className="auth-art-copy"><span className="auth-kicker">{caption}</span><h1>{title}</h1><p>{description}</p></div><div className={`auth-visual-frame ${visualClass}`}><img src={visual} alt={visualAlt} /></div></aside><section className="auth-form-panel"><Link className="auth-back" href="/"><ArrowLeft size={15} />Back to Pika</Link><div className="auth-card">{children}</div></section></main>;
}

function AuthSubmit({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) { return <button className={`source-button primary auth-submit ${wide ? "auth-submit-wide" : ""}`} type="submit"><span>{children}</span><span className="button-round"><ArrowUpRight size={14} /></span></button>; }

function PasswordField({ value, onChange, autoComplete = "current-password" }: { value: string; onChange: (value: string) => void; autoComplete?: "current-password" | "new-password" }) {
  const [visible, setVisible] = useState(false);
  return <label>Password<span className="password-control"><input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} minLength={10} required autoComplete={autoComplete} aria-describedby="password-help" /><button type="button" aria-label={visible ? "Hide password" : "Show password"} title={visible ? "Hide password" : "Show password"} onClick={() => setVisible((state) => !state)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span><small id="password-help">At least 10 characters.</small></label>;
}

export function SignInPage() {
  const [, setLocation] = useLocation();
  const { signIn, signInError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password);
      setLocation("/dashboard");
    } catch {
      /* signInError below reflects the failure */
    } finally {
      setSubmitting(false);
    }
  };
  return <AuthFrame caption="Welcome back" title="Pick up where you left off." description="Sign in to continue searching, monitoring, and saving useful conversations." visual={ASSETS.workflowResults} visualAlt="Geometric 3D results sculpture for returning to Pika" visualClass="auth-visual-signin"><span className="auth-eyebrow">Sign in</span><h2>Access your Pika workspace.</h2><p className="auth-intro">Sign in with your Pika account email and password.</p><form className="auth-form" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><PasswordField value={password} onChange={setPassword} />{signInError && <p className="auth-error" role="alert">{signInError}</p>}<div className="auth-row"><span /><Link href="/forgot-password">Forgot password?</Link></div><AuthSubmit>{submitting ? "Signing in…" : "Sign in"}</AuthSubmit></form><p className="auth-switch">New to Pika? <Link href="/sign-up">Create an account</Link></p></AuthFrame>;
}

export function SignUpPage() {
  const [, setLocation] = useLocation();
  const { signUp, signUpError } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await signUp(email, password, name || undefined);
      setLocation("/dashboard");
    } catch {
      /* signUpError below reflects the failure */
    } finally {
      setSubmitting(false);
    }
  };
  return <AuthFrame caption="Start with a question" title="Create your Pika account." description="Keep useful conversations, people, and topics in one place." visual={ASSETS.communityAtlas} visualAlt="Geometric 3D community sculpture for creating a Pika account" visualClass="auth-visual-signup"><span className="auth-eyebrow">Create account</span><h2>Start finding useful conversations.</h2><p className="auth-intro">Create your Pika account. We never ask for your Discord password or a raw Discord token.</p><form className="auth-form" onSubmit={submit}><label>Name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><PasswordField value={password} onChange={setPassword} autoComplete="new-password" /><p className="auth-legal">By continuing, you agree Pika will only process Discord data from servers you explicitly authorize.</p>{signUpError && <p className="auth-error" role="alert">{signUpError}</p>}<AuthSubmit wide>{submitting ? "Creating account…" : "Create account"}</AuthSubmit></form><p className="auth-switch">Already have an account? <Link href="/sign-in">Sign in</Link></p></AuthFrame>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSent(true); };
  return <AuthFrame caption="Password help" title="Get back into Pika." description="Tell us where to send password-recovery instructions." visual={ASSETS.workflowSave} visualAlt="Geometric 3D bookmark sculpture for recovering Pika access" visualClass="auth-visual-recovery"><span className="auth-eyebrow">Forgot password</span><h2>Reset your password.</h2><p className="auth-intro">For this browser-only demo, we will simply confirm the request—no email is sent.</p>{sent ? <div className="auth-success" role="status"><CheckCircle2 size={19} /><div><b>Recovery request received.</b><span>No email was sent because this is a local demo.</span></div><Link href="/sign-in">Back to sign in</Link></div> : <form className="auth-form" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><AuthSubmit>Send recovery link</AuthSubmit></form>}<p className="auth-switch">Remembered it? <Link href="/sign-in">Sign in</Link></p></AuthFrame>;
}
