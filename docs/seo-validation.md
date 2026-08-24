# SEO Validation Notes

## What's actually been verified

`Seo.tsx` and its usage across every route type-check and the production build succeeds
(`pnpm build`). The DOM-mutation logic (title, meta upsert-by-attribute, canonical link,
JSON-LD script injection/cleanup) was reviewed by reading the code, not by rendering it —
this session's environment has no browser automation tool available, so no live page was
actually loaded and inspected in a real browser or `view-source:`.

## What still needs a real browser check before relying on this

Before treating any of this as confirmed working in production:

1. Load `/` and confirm via devtools (not view-source, since tags are JS-injected) that
   `<title>`, `<meta name="description">`, `<link rel="canonical">`, the `og:*`/`twitter:*`
   tags, and the `Organization`/`SoftwareApplication` JSON-LD `<script>` are present with
   the expected values.
2. Load `/faq` and confirm the `FAQPage` JSON-LD lists all five questions from
   `faqItems` in `client/src/data/site.ts`.
3. Load `/dashboard` (signed in) and confirm `meta[name="robots"]` reads
   `noindex, nofollow` — this is the boundary that keeps private workspace data out of
   search results, so it's worth confirming directly rather than trusting the code.
4. Navigate between two routes client-side (not a hard reload) and confirm the previous
   route's JSON-LD `<script>` was removed, not left stacked alongside the new one.
5. Run `PIKA_PUBLIC_SITE_URL=https://<real-domain> node scripts/generate-sitemap.mjs` once
   the real domain is known, and spot-check `client/public/robots.txt` disallows every
   private route before it's ever deployed publicly.

## Known, accepted limitation

No server-side rendering — a crawler that doesn't execute JavaScript sees only
`client/index.html`'s static title/description, not the per-route values. See
`docs/seo-setup.md` for why that's an accepted trade-off for now, not an oversight.
