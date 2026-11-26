// Share channel URL builders. Each builder returns the URL the social
// network expects when "share" is clicked, with a UTM-tagged shareUrl
// and (optionally) a prepopulated message.

const withUtm = (url, channel) => {
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.href : "https://localhost");
    u.searchParams.set("utm_source", channel);
    u.searchParams.set("utm_medium", "share");
    u.searchParams.set("utm_campaign", "video");
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}utm_source=${channel}&utm_medium=share&utm_campaign=video`;
  }
};

const appendStartAt = (url, startSeconds) => {
  if (!startSeconds || startSeconds < 1) return url;
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.href : "https://localhost");
    u.searchParams.set("t", String(Math.floor(startSeconds)));
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}t=${Math.floor(startSeconds)}`;
  }
};

export const BuildShareUrl = ({ baseUrl, channel, startSeconds }) => {
  const tagged = withUtm(baseUrl, channel);
  return appendStartAt(tagged, startSeconds);
};

const defaultTemplates = {
  facebook: ({ url }) =>
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  x: ({ url, title }) =>
    `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}${
      title ? `&text=${encodeURIComponent(title)}` : ""
    }`,
  linkedin: ({ url }) =>
    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  whatsapp: ({ url, title }) =>
    `https://wa.me/?text=${encodeURIComponent(`${title ? title + " " : ""}${url}`)}`,
  email: ({ url, title }) =>
    `mailto:?subject=${encodeURIComponent(title || "Watch this")}&body=${encodeURIComponent(
      `${title ? title + "\n\n" : ""}${url}`
    )}`,
};

export const ResolveChannelUrl = ({ channel, baseUrl, title, startSeconds, templates }) => {
  const merged = { ...defaultTemplates, ...(templates || {}) };
  const builder = merged[channel];
  if (!builder) return null;
  const taggedUrl = BuildShareUrl({ baseUrl, channel, startSeconds });
  return builder({ url: taggedUrl, title });
};

export const BuildEmbedCode = ({ embedSrc, startSeconds }) => {
  if (!embedSrc) return null;
  const src = appendStartAt(embedSrc, startSeconds);
  return `<iframe src="${src}" width="560" height="315" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen frameborder="0"></iframe>`;
};

// Channels rendered in order. `key` matches templates map; `label` is the
// visible name; `mode` is "social" (open in new tab) or "embed" (swap URL
// field for the iframe code), or "instagram" (see ShareToInstagram).
export const SHARE_CHANNELS = [
  { key: "embed", label: "Embed", mode: "embed" },
  { key: "facebook", label: "Facebook", mode: "social" },
  { key: "x", label: "X", mode: "social" },
  { key: "instagram", label: "Instagram", mode: "instagram" },
  { key: "linkedin", label: "LinkedIn", mode: "social" },
  { key: "whatsapp", label: "WhatsApp", mode: "social" },
  { key: "email", label: "Email", mode: "social" },
];

// Hiway#2285 — Instagram takes no shared URL on the web. A phone's share sheet
// lists Instagram when the app is installed, so use it where there is one.
// Otherwise copy the instagram-tagged link and open Instagram to paste it.
// The clipboard write starts before the tab opens, while this page still has
// focus, and the tab opens inside the click so it is not blocked.
// Resolves "shared", "cancelled", "copied" or "failed"; never rejects.
export const ShareToInstagram = async ({
  baseUrl,
  title,
  startSeconds,
  nav = typeof navigator !== "undefined" ? navigator : undefined,
  open = (...args) => window.open(...args),
}) => {
  const url = BuildShareUrl({ baseUrl, channel: "instagram", startSeconds });
  if (nav && typeof nav.share === "function") {
    try {
      await nav.share({ url, title: title || undefined });
      return "shared";
    } catch (err) {
      if (err && err.name === "AbortError") return "cancelled";
      // eslint-disable-next-line no-console
      console.error("[SharePopup] share sheet failed", err);
      return "failed";
    }
  }
  const write = nav?.clipboard?.writeText
    ? nav.clipboard.writeText(url)
    : Promise.reject(new Error("clipboard unavailable"));
  open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  try {
    await write;
    return "copied";
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[SharePopup] Instagram link copy failed", err);
    return "failed";
  }
};
