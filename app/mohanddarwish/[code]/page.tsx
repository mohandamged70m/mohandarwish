import type { Metadata } from "next";
import TailoredLanding from "./landing";

export const metadata: Metadata = {
  title: "Mohand Darwish | For you",
  description: "A personalised portfolio link from Mohand Darwish.",
  // Personalised, share-token URLs: near-duplicate thin content that is also
  // disallowed in robots.txt. robots.txt governs crawling, this meta tag
  // governs indexing of any URL that does get discovered (a shared link, a
  // referrer, a stale inbound) — without it those can fragment the canonical
  // profile across dozens of token variants.
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true, "max-image-preview": "large" },
  },
};

export default async function MohandDarwishLinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <TailoredLanding code={code} />;
}
