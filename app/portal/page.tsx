import type { Metadata } from "next";
import Portal from "@/components/Portal";
import "./portal.css";

export const metadata: Metadata = { title: "Portal", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function PortalPage() {
  return <Portal />;
}
