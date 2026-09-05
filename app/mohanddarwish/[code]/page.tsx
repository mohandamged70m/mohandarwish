import type { Metadata } from "next";
import TailoredLanding from "./landing";

export const metadata: Metadata = {
  title: "Mohand Darwish | For you",
  description: "A personalised portfolio link from Mohand Darwish.",
};

export default async function MohandDarwishLinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <TailoredLanding code={code} />;
}
