// /portal — admin dashboard. Gated by middleware.ts via ADMIN_USER +
// ADMIN_PASSWORD with a signed httpOnly session cookie (see lib/portal-auth).
//
// Server component — fetches all data once (Notion + Articles + Vercel
// Analytics) then hands off to the client component PortalClient for the
// interactive surface (drilldowns, approve/hide buttons, in-list search).
//
// Cache: 60 sec server-side. Lower than before because the curator may want
// to see action results quickly after approving/hiding; the mutations also
// don't yet invalidate the cache, so 60s gives a max-1-minute lag.

import type { Metadata } from "next";
import { getDashboardData } from "../../lib/portal-data";
import PortalClient from "./PortalClient";

export const metadata: Metadata = {
  title: "Portal — AI Tree Library",
  description: "Admin dashboard for AI Tree Library.",
  robots: { index: false, follow: false },
};

export const revalidate = 60;

export default async function PortalPage() {
  const data = await getDashboardData();
  return <PortalClient data={data} />;
}
