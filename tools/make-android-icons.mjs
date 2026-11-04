/* make-android-icons.mjs: draws the Android launcher icons, the same green dumbbell on the app's dark
   background as icon-192.png / icon-512.png (no image tools needed: a tiny PNG encoder, 4x4 supersampled).
   Run once after changing the colours or the art:  node tools/make-android-icons.mjs
   Writes android/app/src/main/res/mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher{,_round,_foreground}.png;
   the adaptive icon's background colour is res/values/ic_launcher_background.xml. */
import zlib from "zlib";
import { writeFileSync } from "fs";
import { join } from "path";
import { ROOT } from "./app-files.mjs";

const BG = [12, 15, 18];      /* #0c0f12, tracker.css --bg */
const FG = [52, 211, 153];    /* #34d399, tracker.css --acc */
const ART = [[0.27, 0.455, 0.73, 0.545], [0.28, 0.34, 0.37, 0.66], [0.63, 0.34, 0.72, 0.66]];   /* bar + two caps */
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const t = Buffer.from(type, "ascii"), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};
function png(size, rgba) {
  const stride = size * 4, raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
/* shape: "square" (legacy icon), "circle" (round icon), "none" (adaptive foreground: art only, scaled into
   the 72/108 safe zone so it keeps the PWA icon's proportions after the launcher's mask) */
function draw(size, shape) {
  const k = shape === "none" ? 72 / 108 : 1, S = 4, out = Buffer.alloc(size * size * 4);
  const inArt = (x, y) => ART.some(([x0, y0, x1, y1]) => {
    const a = 0.5 + (x0 - 0.5) * k, b = 0.5 + (y0 - 0.5) * k, c = 0.5 + (x1 - 0.5) * k, d = 0.5 + (y1 - 0.5) * k;
    return x >= a && x < c && y >= b && y < d;
  });
  const inBg = (x, y) => shape === "square" || (shape === "circle" && (x - 0.5) ** 2 + (y - 0.5) ** 2 <= 0.25);
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const x = (px + (sx + 0.5) / S) / size, y = (py + (sy + 0.5) / S) / size;
      const c = inArt(x, y) && (shape === "none" || inBg(x, y)) ? FG : inBg(x, y) ? BG : null;
      if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
    }
    const i = (py * size + px) * 4;
    if (a) { out[i] = Math.round(r / a); out[i + 1] = Math.round(g / a); out[i + 2] = Math.round(b / a); }
    out[i + 3] = Math.round((a / (S * S)) * 255);
  }
  return out;
}
const res = join(ROOT, "android/app/src/main/res");
for (const [d, m] of Object.entries(DENSITIES)) {
  const dir = join(res, "mipmap-" + d), legacy = Math.round(48 * m), fg = Math.round(108 * m);
  writeFileSync(join(dir, "ic_launcher.png"), png(legacy, draw(legacy, "square")));
  writeFileSync(join(dir, "ic_launcher_round.png"), png(legacy, draw(legacy, "circle")));
  writeFileSync(join(dir, "ic_launcher_foreground.png"), png(fg, draw(fg, "none")));
}
console.log("wrote launcher icons for " + Object.keys(DENSITIES).join(", "));
