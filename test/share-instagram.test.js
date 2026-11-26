// Hiway#2285 — Instagram in the player's share pop-up. Instagram takes no
// shared URL on the web, so ShareToInstagram uses the share sheet where there
// is one, and otherwise copies the instagram-tagged link and opens Instagram.
import { describe, it, expect, vi } from "vitest";
import { SHARE_CHANNELS, ShareToInstagram } from "../lib/ui/share/channels.js";

const BASE = "https://watch.example.com/push";

describe("Instagram share channel (Hiway#2285)", () => {
  it("sits between X and LinkedIn", () => {
    expect(SHARE_CHANNELS.map((c) => c.key)).toEqual([
      "embed", "facebook", "x", "instagram", "linkedin", "whatsapp", "email",
    ]);
    expect(SHARE_CHANNELS.find((c) => c.key === "instagram")).toMatchObject({ label: "Instagram", mode: "instagram" });
  });

  it("without a share sheet: copies the instagram-tagged link and opens Instagram in a new tab", async () => {
    const writeText = vi.fn(async () => {});
    const open = vi.fn();
    const result = await ShareToInstagram({ baseUrl: BASE, title: "Push", startSeconds: 0, nav: { clipboard: { writeText } }, open });
    expect(result).toBe("copied");
    const copied = new URL(writeText.mock.calls[0][0]);
    expect(copied.origin + copied.pathname).toBe(BASE);
    expect(copied.searchParams.get("utm_source")).toBe("instagram");
    expect(copied.searchParams.get("utm_medium")).toBe("share");
    expect(open).toHaveBeenCalledWith("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  });

  it("keeps Start at in the copied link", async () => {
    const writeText = vi.fn(async () => {});
    await ShareToInstagram({ baseUrl: BASE, startSeconds: 95, nav: { clipboard: { writeText } }, open: vi.fn() });
    expect(new URL(writeText.mock.calls[0][0]).searchParams.get("t")).toBe("95");
  });

  it("with a share sheet: hands it the tagged link and title, opens no tab and copies nothing", async () => {
    const share = vi.fn(async () => {});
    const writeText = vi.fn();
    const open = vi.fn();
    const result = await ShareToInstagram({ baseUrl: BASE, title: "Push", startSeconds: 0, nav: { share, clipboard: { writeText } }, open });
    expect(result).toBe("shared");
    expect(share.mock.calls[0][0].title).toBe("Push");
    expect(new URL(share.mock.calls[0][0].url).searchParams.get("utm_source")).toBe("instagram");
    expect(open).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("cancelling the share sheet is reported as cancelled, not an error", async () => {
    const share = vi.fn(async () => { throw Object.assign(new Error("cancelled"), { name: "AbortError" }); });
    await expect(ShareToInstagram({ baseUrl: BASE, nav: { share }, open: vi.fn() })).resolves.toBe("cancelled");
  });

  it("a refused copy is reported as failed, so the pop-up can select the link instead", async () => {
    const writeText = vi.fn(async () => { throw new Error("denied"); });
    const open = vi.fn();
    await expect(ShareToInstagram({ baseUrl: BASE, nav: { clipboard: { writeText } }, open })).resolves.toBe("failed");
    expect(open).toHaveBeenCalled();
  });
});
