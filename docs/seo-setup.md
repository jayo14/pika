# SEO Setup

Pika now supplies route-specific page titles, descriptions, canonical URLs, Open Graph metadata, Twitter metadata, Organization/SoftwareApplication JSON-LD for the homepage, FAQ JSON-LD on `/faq`, and `noindex, nofollow` directives for workspace, authentication, administrative, password, and 404 routes.

## Publishing a Sitemap

Valid sitemap `<loc>` values require the final absolute public site URL. Before publishing or after connecting a custom domain, run the following command from the project root:

```bash
PIKA_PUBLIC_SITE_URL=https://your-domain.example node scripts/generate-sitemap.mjs
```

The command generates `frontend/public/sitemap.xml` and updates `frontend/public/robots.txt` with the correct sitemap URL. Do not use a temporary preview URL or an unverified production hostname; regenerate the files whenever the canonical domain changes.
