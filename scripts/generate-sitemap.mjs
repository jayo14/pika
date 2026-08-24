import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const configuredUrl = process.env.PIKA_PUBLIC_SITE_URL;
if (!configuredUrl) {
  throw new Error("Set PIKA_PUBLIC_SITE_URL to the published absolute site URL before generating sitemap.xml.");
}

const baseUrl = configuredUrl.replace(/\/$/, "");
const routes = [
  "/",
  "/features",
  "/pricing",
  "/about",
  "/faq",
  "/blog-articles",
  "/category/search",
  "/category/monitoring",
  "/contact",
  "/privacy-policy",
  "/terms-conditions",
  "/feature/find",
  "/feature/communities",
  "/feature/watch",
  "/feature/save",
  "/articles/find-people-looking-for-a-developer",
  "/articles/follow-a-topic-without-reading-every-post",
  "/articles/save-conversations-worth-following",
  "/articles/find-communities-about-a-topic",
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `  <url><loc>${baseUrl}${route}</loc></url>`).join("\n")}\n</urlset>\n`;
// Kept in sync with the noindex routes declared in client/src/App.tsx — every private
// (workspace, auth, admin) route gets both a robots.txt Disallow (stops crawling) and a
// per-page `noindex` meta tag (stops indexing if it's ever fetched some other way).
const disallowedRoutes = [
  "/dashboard",
  "/monitors",
  "/saved",
  "/settings",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/admin",
  "/admin-pages/",
  "/401",
  "/404",
];
const robots = `# Pika public crawl policy. Private workspaces, authentication, and admin routes are excluded from crawling.\nUser-agent: *\nAllow: /\n${disallowedRoutes.map((route) => `Disallow: ${route}`).join("\n")}\nSitemap: ${baseUrl}/sitemap.xml\n`;
const publicDirectory = path.resolve("client/public");
await mkdir(publicDirectory, { recursive: true });
await writeFile(path.join(publicDirectory, "sitemap.xml"), xml);
await writeFile(path.join(publicDirectory, "robots.txt"), robots);
console.log(`Generated sitemap.xml and robots.txt for ${baseUrl}`);
