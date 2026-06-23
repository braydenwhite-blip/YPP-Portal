/**
 * Client helpers for the Board roll-up outputs: copy a clean HTML table to the
 * clipboard (pastes into Google Docs with formatting) and download a .docx via
 * the html-docx-js CDN bundle (matching the uploaded design's export).
 */

export async function copyHtmlToClipboard(html: string, plain: string): Promise<boolean> {
  try {
    if (navigator.clipboard && "write" in navigator.clipboard && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    await navigator.clipboard.writeText(plain);
    return true;
  } catch {
    return false;
  }
}

let htmlDocxPromise: Promise<unknown> | null = null;

function loadHtmlDocx(): Promise<unknown> {
  const w = window as unknown as { htmlDocx?: unknown };
  if (w.htmlDocx) return Promise.resolve(w.htmlDocx);
  if (htmlDocxPromise) return htmlDocxPromise;
  htmlDocxPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/html-docx-js/dist/html-docx.js";
    script.onload = () => resolve((window as unknown as { htmlDocx?: unknown }).htmlDocx);
    script.onerror = () => reject(new Error("Failed to load html-docx-js"));
    document.body.appendChild(script);
  });
  return htmlDocxPromise;
}

export async function downloadDocx(fullHtml: string, filename: string): Promise<boolean> {
  try {
    const htmlDocx = (await loadHtmlDocx()) as { asBlob: (html: string) => Blob };
    const blob = htmlDocx.asBlob(fullHtml);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
