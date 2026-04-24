/**
 * pdfFontLoader.ts
 *
 * Loads TTF font files from /public/fonts/ and registers them with a jsPDF
 * document so that Vietnamese (and any Unicode) text renders correctly.
 *
 * WHY THIS IS NEEDED
 * ──────────────────
 * jsPDF ships with three "standard" PDF fonts (Helvetica, Times, Courier).
 * These are not embedded in the PDF — the viewer is expected to supply them.
 * All three fonts only cover the Windows-1252 / Latin-1 character set.
 * Vietnamese characters (e.g. "ệ", "ắ", "ồ") fall outside that range, so
 * jsPDF silently replaces them with "?" or drops them entirely.
 *
 * The fix is to embed a real TTF that contains the full Unicode BMP.
 * Noto Sans is a good choice because:
 *   • Designed by Google specifically for multi-language coverage.
 *   • Has a dedicated Vietnamese subset.
 *   • Free / OFL licensed.
 *
 * SETUP (one-time, per project)
 * ──────────────────────────────
 * 1. Download the TTF files:
 *    • https://fonts.google.com/noto/specimen/Noto+Sans
 *      → "Download family" → unzip → grab NotoSans-Regular.ttf and NotoSans-Bold.ttf
 *
 * 2. Place them in your project's public folder:
 *    public/
 *      fonts/
 *        NotoSans-Regular.ttf
 *        NotoSans-Bold.ttf
 *
 * 3. Import and call `registerVietnameseFont(doc)` before any doc.text() call.
 */

import type jsPDF from "jspdf";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Convert an ArrayBuffer to a Base64 string without hitting the
 * call-stack size limit that a naive `btoa(String.fromCharCode(...bytes))`
 * would cause for large font files (> ~300 KB).
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 8192; // process 8 KB at a time
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Fetch a font file from the given URL, convert it to Base64, and return the
 * result.  Throws if the network request fails.
 */
async function fetchFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `[pdfFontLoader] Failed to load font from "${url}": ${response.status} ${response.statusText}`,
    );
  }
  const buffer = await response.arrayBuffer();
  return arrayBufferToBase64(buffer);
}

// ─── Simple in-memory cache so the fetch only happens once per session ────────

const _fontCache: Map<string, string> = new Map();

async function loadCachedFont(url: string): Promise<string> {
  if (_fontCache.has(url)) return _fontCache.get(url)!;
  const base64 = await fetchFontAsBase64(url);
  _fontCache.set(url, base64);
  return base64;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const VIET_FONT_NAME = "NotoSans";

/**
 * Download Noto Sans Regular + Bold from `/public/fonts/`, embed them in the
 * jsPDF document, and set NotoSans as the active font.
 *
 * Call this once after `new jsPDF(...)` and before any `doc.text()` calls.
 *
 * @param doc  The jsPDF instance to register the fonts on.
 * @param basePath  Base URL for font files. Defaults to `/fonts/`.
 *                  Override to e.g. `https://mycdn.com/fonts/` for CDN hosting.
 */
export async function registerVietnameseFont(
  doc: jsPDF,
  basePath = "/fonts/",
): Promise<void> {
  const regularUrl = `${basePath}NotoSans-Regular.ttf`;
  const boldUrl = `${basePath}NotoSans-Bold.ttf`;

  const [regularBase64, boldBase64] = await Promise.all([
    loadCachedFont(regularUrl),
    loadCachedFont(boldUrl),
  ]);

  // Register with jsPDF's virtual file system
  doc.addFileToVFS("NotoSans-Regular.ttf", regularBase64);
  doc.addFont("NotoSans-Regular.ttf", VIET_FONT_NAME, "normal");

  doc.addFileToVFS("NotoSans-Bold.ttf", boldBase64);
  doc.addFont("NotoSans-Bold.ttf", VIET_FONT_NAME, "bold");

  // Set as default so every subsequent doc.text() uses it
  doc.setFont(VIET_FONT_NAME, "normal");
}
