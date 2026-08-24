import { useEffect } from "react";

// Sets per-route document.title, meta description, canonical link, robots directive, and
// Open Graph/Twitter tags by mutating document.head — this is a client-rendered SPA with
// no server-side rendering, so these tags are only present after JavaScript runs. That's
// honest to disclose: a crawler that renders JS (Googlebot, most link-preview bots) sees
// correct per-page metadata; a crawler that only reads the raw HTML response sees only
// the static defaults in index.html. If that gap ever matters, the real fix is SSR/
// prerendering, not more client-side tag-juggling.

const SITE_NAME = "Pika";
const DEFAULT_OG_IMAGE = "/assets/hero-dashboard.avif";

function siteOrigin(): string {
  return import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin;
}

function upsertMeta(attr: "name" | "property", key: string, content: string | undefined): void {
  const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!content) {
    existing?.remove();
    return;
  }
  const tag = existing ?? document.createElement("meta");
  tag.setAttribute(attr, key);
  tag.setAttribute("content", content);
  if (!existing) document.head.appendChild(tag);
}

function upsertCanonical(href: string): void {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const tag = existing ?? document.createElement("link");
  tag.setAttribute("rel", "canonical");
  tag.setAttribute("href", href);
  if (!existing) document.head.appendChild(tag);
}

const JSON_LD_ID = "pika-seo-json-ld";

function upsertJsonLd(data: object | undefined): void {
  const existing = document.getElementById(JSON_LD_ID);
  if (!data) {
    existing?.remove();
    return;
  }
  const script = (existing as HTMLScriptElement) ?? document.createElement("script");
  script.id = JSON_LD_ID;
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(data);
  if (!existing) document.head.appendChild(script);
}

export type SeoProps = {
  /** Route path, e.g. "/pricing" — used to build the canonical URL and og:url. */
  path: string;
  title: string;
  description: string;
  /** Defaults to indexable. Set true for any workspace, auth, or admin route. */
  noindex?: boolean;
  ogImage?: string;
  jsonLd?: object;
};

export function Seo({ path, title, description, noindex = false, ogImage, jsonLd }: SeoProps) {
  useEffect(() => {
    const fullTitle = path === "/" ? title : `${title} | ${SITE_NAME}`;
    const url = `${siteOrigin()}${path}`;
    const image = `${siteOrigin()}${ogImage ?? DEFAULT_OG_IMAGE}`;

    document.title = fullTitle;
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    upsertCanonical(url);

    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:image", image);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image);

    upsertJsonLd(jsonLd);

    return () => upsertJsonLd(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, title, description, noindex, ogImage, jsonLd]);

  return null;
}
