// Client wrapper that dynamic-imports the R3F scene with ssr:false.
// Next.js 16 forbids ssr:false in Server Components, hence this thin client boundary.

"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const Scene = dynamic(() => import("./scene/Scene"), { ssr: false });

export default function SceneWrapper(props: ComponentProps<typeof Scene>) {
  return <Scene {...props} />;
}
