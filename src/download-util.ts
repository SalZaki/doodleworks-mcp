/**
 * download-util.ts — pure helpers for the viewer's download path. No DOM / host deps,
 * so they're unit-testable in Node.
 *
 * MCP Apps render the View in a sandboxed iframe where a browser `<a download>` click is
 * blocked. The supported path is the host bridge's `ui/download-file` request, which takes
 * an embedded MCP resource carrying base64 `blob` bytes — so a page's `data:` URI has to be
 * split back into its mime type and base64 payload.
 */

/** Split a `data:<mime>;base64,<payload>` URI into the parts `app.downloadFile` needs. */
export function dataUriToBlob(dataUri: string): { mimeType: string; blob: string } | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUri);
  if (!match) return null;
  const mimeType = match[1] || "image/png";
  if (match[2]) return { mimeType, blob: match[3] };

  // Non-base64 payload: each `%XX` is one raw byte (RFC 2397). `btoa(decodeURIComponent(...))`
  // is wrong here — decodeURIComponent collapses UTF-8 sequences into JS code points that may
  // exceed 0xFF, which btoa rejects. Decode straight to bytes, then base64 those.
  const payload = match[3];
  const bytes: number[] = [];
  for (let i = 0; i < payload.length; i++) {
    if (payload[i] === "%" && i + 2 < payload.length) {
      const byte = parseInt(payload.slice(i + 1, i + 3), 16);
      if (Number.isNaN(byte)) return null;
      bytes.push(byte);
      i += 2;
    } else {
      const code = payload.charCodeAt(i);
      if (code > 0xff) return null; // unencoded non-Latin-1 char isn't valid in a non-base64 data URI
      bytes.push(code);
    }
  }
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return { mimeType, blob: btoa(binary) };
}
