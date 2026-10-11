import { expect, it } from "vitest";
import { classifySource, canonicalSocial } from "../lib/analytics/source";

it("normalizes full URLs to one host row", () => {
  expect(
    classifySource({ Utm: { source: "https://chatgpt.com/share/abc?x=1" } }),
  ).toEqual({ Name: "ChatGPT", Kind: "ai" });
  expect(classifySource({ Ref: "chatgpt.com" })).toEqual({
    Name: "ChatGPT",
    Kind: "ai",
  });
  expect(classifySource({ Referrer: "https://www.google.com/search?q=x" })).toEqual({
    Name: "Google",
    Kind: "search",
  });
});

it("keeps unknown origins unknown instead of inventing a direct visit", () => {
  expect(classifySource({})).toEqual({ Name: "Direct", Kind: "direct" });
  // A bare unknown host stays a referral row under its own name.
  expect(classifySource({ Ref: "some-blog.example" }).Kind).toBe("referral");
});

it("folds social spellings onto one canonical name", () => {
  expect(canonicalSocial("Github")).toBe("GitHub");
  expect(canonicalSocial("GITHUB")).toBe("GitHub");
  expect(canonicalSocial("x")).toBe("X");
});

it('folds social hostnames and full outbound URLs into network names', () => {
  expect(canonicalSocial('github.com')).toBe('GitHub');
  expect(canonicalSocial('https://www.linkedin.com/in/example')).toBe('LinkedIn');
  expect(canonicalSocial('wa.me')).toBe('WhatsApp');
  expect(canonicalSocial('t.me')).toBe('Telegram');
  expect(canonicalSocial('github.com.attacker.example')).not.toBe('GitHub');
});
