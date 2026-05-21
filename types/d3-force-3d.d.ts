// Minimal ambient types for d3-force-3d (no @types package published).
// Covers the subset we use in scripts/fetch-content.mjs and the scene layout.

declare module "d3-force-3d" {
  export interface SimulationNode {
    id?: string | number;
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
  }

  export interface SimulationLink<N extends SimulationNode = SimulationNode> {
    source: string | number | N;
    target: string | number | N;
  }

  export interface Force<N extends SimulationNode = SimulationNode> {
    (alpha: number): void;
    initialize?: (nodes: N[]) => void;
  }

  export interface Simulation<N extends SimulationNode = SimulationNode> {
    nodes(): N[];
    nodes(nodes: N[]): this;
    force(name: string): Force<N> | undefined;
    force<F extends Force<N>>(name: string, force: F | null): this;
    tick(iterations?: number): this;
    stop(): this;
    restart(): this;
    alpha(): number;
    alpha(alpha: number): this;
    alphaTarget(): number;
    alphaTarget(target: number): this;
  }

  export function forceSimulation<N extends SimulationNode = SimulationNode>(
    nodes?: N[],
    numDimensions?: number
  ): Simulation<N>;

  export function forceManyBody<N extends SimulationNode = SimulationNode>(): {
    strength(): number;
    strength(s: number | ((d: N) => number)): unknown;
  } & Force<N>;

  export function forceLink<N extends SimulationNode = SimulationNode, L extends SimulationLink<N> = SimulationLink<N>>(
    links?: L[]
  ): {
    id(): (d: N) => string | number;
    id(accessor: (d: N) => string | number): unknown;
    distance(): number;
    distance(d: number | ((l: L) => number)): unknown;
    strength(): number;
    strength(s: number | ((l: L) => number)): unknown;
    links(): L[];
    links(l: L[]): unknown;
  } & Force<N>;

  export function forceCenter<N extends SimulationNode = SimulationNode>(
    x?: number,
    y?: number,
    z?: number
  ): Force<N>;
}
