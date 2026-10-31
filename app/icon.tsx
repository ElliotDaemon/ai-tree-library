import { ImageResponse } from "next/og";
import { markDataUri } from "@/lib/mark";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  // eslint-disable-next-line jsx-a11y/alt-text
  return new ImageResponse(<img src={markDataUri({ size: 32 })} width={32} height={32} />, size);
}
