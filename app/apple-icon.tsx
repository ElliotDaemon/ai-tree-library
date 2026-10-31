import { ImageResponse } from "next/og";
import { markDataUri } from "@/lib/mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Full-bleed square: iOS rounds the corners itself.
export default function AppleIcon() {
  // eslint-disable-next-line jsx-a11y/alt-text
  return new ImageResponse(<img src={markDataUri({ size: 180, tile: "square", canopy: true })} width={180} height={180} />, size);
}
