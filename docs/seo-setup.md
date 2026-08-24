# SEO Setup

`client/src/components/Seo.tsx` sets a per-route document title, meta description,
canonical URL, `robots` directive, Open Graph/Twitter tags, and optional JSON-LD by
mutating `document.head` on mount. It's wired into every route in `client/src/App.tsx`
(marketing pages set their own `<Seo>` inline from `client/src/data/site.ts`'s copy;
private routes — `/dashboard`, `/monitors`, `/saved`, `/settings`, `/admin*`,
`/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/401`, `/404` — pass
`noindex`). The homepage carries `Organization`/`SoftwareApplication` JSON-LD; `/faq`
carries `FAQPage` JSON-LD built from the real `faqItems` list, so it can never drift out
of sync with the visible FAQ content.

**Real limitation, stated plainly**: this is a client-rendered SPA with no
server-side rendering. A crawler that executes JavaScript (Googlebot, most link-preview
bots) sees the correct per-page metadata; a crawler that only reads the raw HTTP
response sees only the static fallback in `client/index.html`. If that gap ever matters
for a specific consumer, the actual fix is SSR or prerendering — not more client-side
tag-juggling.

## Publishing a sitemap

Valid sitemap `<loc>` values require the final absolute public site URL. Before
publishing, or after connecting a custom domain, run from the project root:

```bash
PIKA_PUBLIC_SITE_URL=https://your-domain.example node scripts/generate-sitemap.mjs
```

This writes `client/public/sitemap.xml` and `client/public/robots.txt` (both
gitignored — they bake in a specific domain and must be regenerated per deployment, never
committed with a placeholder). `robots.txt`'s `Disallow` list is kept in sync by hand with
the `noindex` routes declared in `App.tsx`; if you add a new private route, add it to both
`disallowedRoutes` in `scripts/generate-sitemap.mjs` and its `<Seo noindex>` in `App.tsx`.

Both deployment paths in `docs/deployment.md` run this automatically when
`PIKA_PUBLIC_SITE_URL` is set: `client/Dockerfile` takes it as a build arg, and
`render.yaml`'s `pika-client` static site takes it as a build-time env var. Never use a
temporary preview URL or an unverified hostname.
