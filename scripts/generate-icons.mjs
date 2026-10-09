// Renders the monochrome app icon (white glyph on a transparent background,
// as the Meta docs recommend for glasses icons) into public/icon-*.png.
// Usage: npm run icons
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// A calendar page: two rings on top, a header band and a grid of days.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g fill="#ffffff">
    <rect x="148" y="40" width="40" height="88" rx="20"/>
    <rect x="324" y="40" width="40" height="88" rx="20"/>
    <path fill-rule="evenodd" d="M120 84h8v44a40 40 0 0 0 80 0V84h96v44a40 40 0 0 0 80 0V84h8a80 80 0 0 1 80 80v232a80 80 0 0 1-80 80H120a80 80 0 0 1-80-80V164a80 80 0 0 1 80-80z
      M88 208v188a32 32 0 0 0 32 32h272a32 32 0 0 0 32-32V208z"/>
    <rect x="128" y="248" width="56" height="48" rx="12"/>
    <rect x="228" y="248" width="56" height="48" rx="12"/>
    <rect x="328" y="248" width="56" height="48" rx="12"/>
    <rect x="128" y="340" width="56" height="48" rx="12"/>
    <rect x="228" y="340" width="56" height="48" rx="12"/>
  </g>
</svg>`;

for (const size of [192, 512]) {
  const out = path.join(root, 'public', `icon-${size}.png`);
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log(`icon: ${path.relative(root, out)}`);
}
