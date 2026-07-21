const IMAGE_PROXY_ROUTE = "/api/image-proxy";

type PresentationImageProxyInput = {
  embedType?: string;
  imageSource?: "generate" | "search" | "gif" | "upload";
  stockImageProvider?: string;
};

type RewriteOptions = {
  absolute?: boolean;
};

type ExportImageSourceInput = PresentationImageProxyInput;

export type ExportImageSource =
  | {
      type: "data";
      value: string;
    }
  | {
      type: "path";
      value: string;
    };

function getCurrentOrigin(): string | null {
  return typeof window === "undefined" ? null : window.location.origin;
}

function isRemoteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isProxiedImageUrl(value: string): boolean {
  if (value.startsWith(`${IMAGE_PROXY_ROUTE}?`)) {
    return true;
  }

  try {
    return (
      new URL(value, getCurrentOrigin() ?? "http://localhost").pathname ===
      IMAGE_PROXY_ROUTE
    );
  } catch {
    return false;
  }
}

function createImageProxyUrl(
  value: string | undefined,
  options: RewriteOptions = {},
): string | undefined {
  if (!value || !isRemoteHttpUrl(value) || isProxiedImageUrl(value)) {
    return value;
  }

  const params = new URLSearchParams({ url: value });
  const relativeUrl = `${IMAGE_PROXY_ROUTE}?${params.toString()}`;

  if (!options.absolute) {
    return relativeUrl;
  }

  const origin = getCurrentOrigin();
  return origin ? `${origin}${relativeUrl}` : relativeUrl;
}

function shouldProxyPresentationImage(
  url: string | undefined,
  input: PresentationImageProxyInput = {},
): boolean {
  if (!url || !isRemoteHttpUrl(url) || isProxiedImageUrl(url)) {
    return false;
  }

  if (input.embedType || input.imageSource === "upload") {
    return false;
  }

  if (
    input.imageSource === "search" ||
    input.imageSource === "generate" ||
    input.stockImageProvider === "google"
  ) {
    return true;
  }

  return !input.imageSource;
}

export function proxyPresentationImageUrl(
  url: string | undefined,
  input: PresentationImageProxyInput = {},
  options: RewriteOptions = {},
): string | undefined {
  return shouldProxyPresentationImage(url, input)
    ? createImageProxyUrl(url, options)
    : url;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to convert image to data URL."));
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Unable to read image data."));
    });
    reader.readAsDataURL(blob);
  });
}

export async function resolveExportImageSource(
  url: string,
  input: ExportImageSourceInput = {},
): Promise<ExportImageSource> {
  if (url.startsWith("data:")) {
    return { type: "data", value: url };
  }

  const proxiedUrl = proxyPresentationImageUrl(url, input, { absolute: true });
  if (!proxiedUrl || proxiedUrl === url) {
    return { type: "path", value: url };
  }

  try {
    const response = await fetch(proxiedUrl, { cache: "force-cache" });
    if (!response.ok) {
      throw new Error(
        `Image proxy request failed with status ${response.status}.`,
      );
    }

    return {
      type: "data",
      value: await blobToDataUrl(await response.blob()),
    };
  } catch (error) {
    // Fall back to the original URL, not the proxied one -- if the proxy
    // request itself failed, handing pptxgenjs the same broken proxied URL
    // would just fail again with no chance of the direct fetch succeeding.
    console.warn("Failed to prepare proxied image for export:", error);
    return { type: "path", value: url };
  }
}

function rewriteCssUrls(value: string, options: RewriteOptions): string {
  return value.replace(
    /url\(\s*(["']?)(https?:\/\/[^"')\s]+)\1\s*\)/gi,
    (match: string, quote: string, url: string) => {
      const proxiedUrl = createImageProxyUrl(url, options);
      if (!proxiedUrl || proxiedUrl === url) {
        return match;
      }

      const nextQuote = quote || '"';
      return `url(${nextQuote}${proxiedUrl}${nextQuote})`;
    },
  );
}

function rewriteSrcSet(value: string, options: RewriteOptions): string {
  return value
    .split(",")
    .map((candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return trimmed;
      }

      const [url, ...descriptors] = trimmed.split(/\s+/);
      if (!url) {
        return trimmed;
      }

      const proxiedUrl = createImageProxyUrl(url, options) ?? url;
      return [proxiedUrl, ...descriptors].join(" ");
    })
    .join(", ");
}

export function rewriteHtmlArtifactImageUrls(
  html: string,
  options: RewriteOptions = {},
): string {
  return rewriteCssUrls(html, options)
    .replace(
      /(<(?:img|source)\b[^>]*?\s(?:src)=)(["'])(https?:\/\/[^"']+)\2/gi,
      (match: string, prefix: string, quote: string, url: string) => {
        const proxiedUrl = createImageProxyUrl(url, options);
        return proxiedUrl ? `${prefix}${quote}${proxiedUrl}${quote}` : match;
      },
    )
    .replace(
      /(<(?:img|source)\b[^>]*?\s(?:srcset)=)(["'])([^"']+)\2/gi,
      (match: string, prefix: string, quote: string, srcset: string) => {
        const rewrittenSrcset = rewriteSrcSet(srcset, options);
        return rewrittenSrcset === srcset
          ? match
          : `${prefix}${quote}${rewrittenSrcset}${quote}`;
      },
    );
}
