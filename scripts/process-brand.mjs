// One-off asset pipeline: trims/resizes the source brand art in assets/ into
// web-ready files under public/brand/ and the Next app icon. Run with:
//   node scripts/process-brand.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "assets");
const outPublic = join(root, "public", "brand");
const outApp = join(root, "src", "app");
mkdirSync(outPublic, { recursive: true });

const mark = join(src, "comply-quick-mark.png");
const full = join(src, "comply-quick-logo.png");

async function run() {
  // Full horizontal lockup (light bg) — trim surrounding whitespace, cap width.
  await sharp(full)
    .trim({ threshold: 10 })
    .resize({ width: 1200, withoutEnlargement: true })
    .png()
    .toFile(join(outPublic, "logo-full.png"));

  // Read the source mark into a buffer once, then trim it once. Each output
  // starts from a fresh sharp() instance over the trimmed buffer — sharp
  // discourages reusing/cloning one file-based instance for multiple pipelines.
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  const trimmedMark = await sharp(mark).trim().png().toBuffer();
  const squareMark = (size) =>
    sharp(trimmedMark).resize({ width: size, height: size, fit: "contain", background: transparent }).png();

  // Transparent icon mark — square-ish, a few sizes.
  await squareMark(512).toFile(join(outPublic, "mark.png"));
  await squareMark(64).toFile(join(outPublic, "mark-64.png"));

  // Next.js app icon (favicon). 256px PNG named icon.png in app dir.
  await squareMark(256).toFile(join(outApp, "icon.png"));

  // Apple touch icon on a solid dark tile (transparent looks bad on iOS).
  await sharp({
    create: { width: 180, height: 180, channels: 4, background: { r: 3, g: 7, b: 18, alpha: 1 } },
  })
    .composite([{ input: await squareMark(132).toBuffer(), gravity: "center" }])
    .png()
    .toFile(join(outApp, "apple-icon.png"));

  // Open Graph / social share image (1200×630). White canvas so the charcoal
  // wordmark reads; full lockup centered.
  const lockup = await sharp(full)
    .trim({ threshold: 10 })
    .resize({ width: 820, withoutEnlargement: true })
    .png()
    .toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: lockup, gravity: "center" }])
    .png()
    .toFile(join(outApp, "opengraph-image.png"));

  console.log("brand assets written");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
