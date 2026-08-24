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
const robots = `# Pika public crawl policy. Private workspaces and authentication routes are excluded from crawling.\nUser-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /sign-in\nDisallow: /sign-up\nDisallow: /forgot-password\nDisallow: /admin-pages/\nDisallow: /401\nDisallow: /404\nSitemap: ${baseUrl}/sitemap.xml\n`;
const publicDirectory = path.resolve("frontend/public");
await mkdir(publicDirectory, { recursive: true });
await writeFile(path.join(publicDirectory, "sitemap.xml"), xml);
await writeFile(path.join(publicDirectory, "robots.txt"), robots);
console.log(`Generated sitemap.xml and robots.txt for ${baseUrl}`);
