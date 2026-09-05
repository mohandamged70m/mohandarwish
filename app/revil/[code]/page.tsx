import { redirect } from "next/navigation";

// Legacy prefix — Trails links used to live under /revil/[code].
// Everything now lives under /mohanddarwish/[code]; old links follow along.
export default async function RevilLinkRedirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/mohanddarwish/${code}`);
}
