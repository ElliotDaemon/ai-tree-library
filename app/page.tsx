// Home — full-bleed 3D constellation with floating UI overlays.
// The scene itself is client-only (R3F needs WebGL), so we dynamic-import it
// to keep the server bundle small and avoid SSR errors.

import { promises as fs } from "node:fs";
import { join } from "node:path";
import HeroOverlay from "./components/HeroOverlay";
import SceneWrapper from "./SceneWrapper";

interface LibraryFile {
  generatedAt: string;
  stats: {
    categories: number;
    topLevel: number;
    entries: number;
    featured: number;
    gems: number;
  };
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    color: string;
    parentName: string;
    isTopLevel: boolean;
    displayOrder: number;
    v1ToolCount: number;
  }>;
  entries: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    description: string;
    categoryId: string | null;
    tags: string[];
    pricing: string;
    featured: boolean;
    gem: boolean;
    logoUrl: string;
    screenshotUrl: string;
    source: string;
  }>;
  layout: {
    nodes: Array<{
      id: string;
      kind: "trunk" | "category" | "subcategory" | "entry" | "ambient";
      name?: string;
      color: [number, number, number];
      rawColor?: string | null;
      featured?: boolean;
      gem?: boolean;
      parentId?: string | null;
      position: [number, number, number];
      size: number;
    }>;
    links: Array<{ source: string; target: string; kind: string }>;
  };
}

async function loadLibrary(): Promise<LibraryFile | null> {
  try {
    const raw = await fs.readFile(join(process.cwd(), "public", "library.json"), "utf8");
    return JSON.parse(raw) as LibraryFile;
  } catch {
    return null;
  }
}

export default async function Home() {
  const library = await loadLibrary();

  return (
    <main className="scene-container">
      {library ? <SceneWrapper library={library} /> : null}
      <HeroOverlay stats={library?.stats ?? null} />
    </main>
  );
}
