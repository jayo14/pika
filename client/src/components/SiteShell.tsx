// Pika visual system: persistent navigation, newsletter footer, and layout shell.
import { Link } from "wouter";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { navItems } from "@/data/site";

function ArrowPill() {
  return <span className="arrow-pill" aria-hidden="true"><ArrowUpRight size={14} strokeWidth={2.3} /></span>;
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hiddenOnScroll, setHiddenOnScroll] = useState(false);
  const previousScroll = useRef(0);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    previousScroll.current = window.scrollY;
    let frame = 0;
    const update = () => {
      const currentScroll = window.scrollY;
      if (currentScroll < 8 || currentScroll < previousScroll.current) {
        setHiddenOnScroll(false);
      } else if (currentScroll > previousScroll.current && currentScroll > 120) {
        setHiddenOnScroll(true);
      }
      previousScroll.current = currentScroll;
      frame = 0;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header className={`site-header ${hiddenOnScroll ? "is-scroll-hidden" : ""}`}>
      <div className="site-container navbar-wrapper">
        <Link className="brand pika-wordmark" href="/" aria-label="Pika home"><span className="pika-mark" aria-hidden="true" /><span>Pika</span></Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {navItems.map((item) => <Link key={item.href} className="nav-link" href={item.href}>{item.label}</Link>)}
        </nav>
        <Link className="contact-button" href="/sign-up"><span>Get started</span><ArrowPill /></Link>
        <button className="mobile-menu-button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</button>
      </div>
      {menuOpen && <nav className="mobile-menu" aria-label="Mobile navigation">
        {navItems.map((item) => <Link key={item.href} href={item.href} onClick={closeMenu}>{item.label}</Link>)}
        <Link href="/sign-in" onClick={closeMenu}>Sign in</Link>
        <Link href="/sign-up" onClick={closeMenu}>Get started</Link>
      </nav>}
    </header>
  );
}

function Newsletter() {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (email.includes("@")) setSuccess(true); };
  return <div className="footer-newsletter"><h3>Follow the signal.</h3>{success ? <p className="form-success">You are on the list.</p> : <form onSubmit={submit}><input aria-label="Email address" type="email" placeholder="Email address" value={email} required onChange={(event) => setEmail(event.target.value)} /><button type="submit" aria-label="Subscribe"><ArrowUpRight size={16} /></button></form>}<p>Occasional notes on community intelligence. Read our <Link href="/privacy-policy">Privacy Policy</Link>.</p></div>;
}

export function Footer() {
  return <footer className="site-footer">
    <div className="site-container footer-grid">
      <Newsletter />
      <div className="footer-contact"><p className="footer-label">Pika</p><p>Discord intelligence workspace.</p><p className="footer-label">Start here</p><Link href="/features">How Pika works</Link><Link href="/contact">Contact us</Link></div>
      <div className="footer-contact"><p className="footer-label">Explore</p><Link href="/about">Use cases</Link><Link href="/blog-articles">Insights</Link><Link href="/faq">FAQ</Link><p className="footer-label admin-label">Workspace</p><Link href="/admin-pages/style-guide">Design system</Link><Link href="/admin-pages/changelog">Changelog</Link></div>
      <div className="footer-company"><p className="footer-label">Pika workflow</p><Link href="/feature/discover">Discover</Link><Link href="/feature/monitor">Monitor</Link><Link href="/feature/search">Search</Link><Link href="/feature/detect">Detect</Link><Link href="/feature/understand">Understand</Link><Link href="/feature/act">Act</Link><Link href="/privacy-policy">Privacy Policy</Link><Link href="/terms-conditions">Terms &amp; Conditions</Link></div>
    </div>
    <div className="site-container footer-bottom"><p>© Pika</p><p>Discord is full of signals. Pika helps you find the ones that matter.</p></div>
  </footer>;
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const revealTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const parallaxTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      revealTargets.forEach((element) => element.classList.add("is-revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.16, rootMargin: "0px 0px -8%" },
    );
    revealTargets.forEach((element) => observer.observe(element));

    let frame = 0;
    const applyParallax = () => {
      parallaxTargets.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const range = Number(element.dataset.parallax ?? "0");
        const progress = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
        const offset = (progress - 0.5) * range * 2;
        element.style.setProperty("--scroll-offset", `${offset.toFixed(2)}px`);
      });
      frame = 0;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(applyParallax);
    };
    applyParallax();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <><SiteHeader /><main>{children}</main><Footer /></>;
}
