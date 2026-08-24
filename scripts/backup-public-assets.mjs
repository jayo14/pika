import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = new URL("..", import.meta.url).pathname;
const outputDirectory = path.join(projectRoot, "frontend", "public", "assets", "pika");
const sourceBase = process.env.PIKA_ASSET_SOURCE ?? "http://localhost:3000";
const localFallbacks = new Map([
  ["brand-mark-white.svg", "/home/ubuntu/webdev-static-assets/slice-source/6981d1e0d94ebbd54cbf2f1c_5599bd1ea2bd3fd68d6bb31b63521221_SliceAI Logo White.svg"],
]);

const assets = [
  ["brand-mark.svg", "/manus-storage/slice-ai-logo_7befa260.svg"],
  ["brand-mark-white.svg", "/manus-storage/6981d1e0d94ebbd54cbf2f1c_5599bd1ea2bd3fd68d6bb31b63521221_SliceAI%20Logo%20White_86887816.svg"],
  ["hero-dashboard.avif", "/manus-storage/pika-hero-dashboard_4f90f240.avif"],
  ["community-search.png", "/manus-storage/pika-community-search_2b7b5e91.png"],
  ["monitoring-alerts.png", "/manus-storage/pika-monitoring-alerts_447dd00a.png"],
  ["conversation-context.png", "/manus-storage/pika-conversation-context_f7f95ddf.png"],
  ["workflow-question.png", "/manus-storage/pika-workflow-question_b9c44e9f.png"],
  ["workflow-results.png", "/manus-storage/pika-workflow-results_a18dbb91.png"],
  ["workflow-save.png", "/manus-storage/pika-workflow-save_9dfbf942.png"],
  ["community-atlas.png", "/manus-storage/pika-community-atlas_6d0d70f5.png"],
  ["start-search.png", "/manus-storage/pika-start-search_440f608b.png"],
  ["watch-orbit.png", "/manus-storage/pika-watch-orbit_2ea0bb6d.png"],
  ["guide-search.png", "/manus-storage/pika-guide-search_6cd85bf9.png"],
  ["guide-monitoring.png", "/manus-storage/pika-guide-monitoring_f5d51fcc.png"],
  ["guide-save.png", "/manus-storage/pika-guide-save_8be1c373.png"],
  ["guide-communities.png", "/manus-storage/pika-guide-communities-replacement_fdec4a41.png"],
  ["background-lines.svg", "/manus-storage/bg-lines_2009fdd9.svg"],
  ["system-graphic.svg", "/manus-storage/6985d3832866c8eeb0b92350_system_80c9991a.svg"],
  ["screen-one.png", "/manus-storage/screen-one_f337d35e.png"],
  ["screen-two.png", "/manus-storage/screen-two_42fb8254.png"],
  ["password-visual.png", "/manus-storage/slice-hero-orb_46e6a24a.png"],
  ["style-visual.png", "/manus-storage/slice-feature-workflow_86ee4b47.png"],
  ["article-one.jpg", "/manus-storage/article-one_5a0508a7.jpg"],
  ["article-two.jpg", "/manus-storage/article-two_cf690649.jpg"],
  ["article-three.avif", "/manus-storage/article-three_7c68bf03.avif"],
  ["feature-find.png", "/manus-storage/69874b5c21fc9070b5bc96cc_icons8-commercial-96_3b960442.png"],
  ["feature-communities.png", "/manus-storage/69874b16de2fccca4ed50b90_icons8-broadcasting-96_245df5a6.png"],
  ["feature-watch.png", "/manus-storage/6986070198a0b05d3ede1cfe_icons8-combo-chart-96_f5d58377.png"],
  ["feature-save.png", "/manus-storage/69874cbc32684aa70c703bc0_icons8-carton-96_18657653.png"],
  ["not-found-grid.png", "/manus-storage/slice-abstract-grid_79059e43.png"],
];

await mkdir(outputDirectory, { recursive: true });
const downloaded = [];

for (const [filename, route] of assets) {
  const response = await fetch(new URL(route, sourceBase));
  if (!response.ok) {
    const fallback = localFallbacks.get(filename);
    if (!fallback) throw new Error(`Unable to download ${route}: HTTP ${response.status}`);
    await copyFile(fallback, path.join(outputDirectory, filename));
    downloaded.push({ liveRoute: decodeURI(route), localBackupPath: `/assets/pika/${filename}`, bytes: null, source: "verified-local-fallback" });
    console.log(`Copied ${filename} from verified local source`);
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(path.join(outputDirectory, filename), bytes);
  downloaded.push({ liveRoute: decodeURI(route), localBackupPath: `/assets/pika/${filename}`, bytes: bytes.length, source: "managed-storage" });
  console.log(`Downloaded ${filename}`);
}

await writeFile(path.join(outputDirectory, "manifest.json"), `${JSON.stringify(downloaded, null, 2)}\n`);
console.log(`Completed ${downloaded.length} asset backups in ${outputDirectory}`);
