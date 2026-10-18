export type Pos = 'GK' | 'DF' | 'MF' | 'FW';
export type Pt = { x: number; y: number };

export interface Player {
  id: string;
  number: string;
  name: string;
  pos: Pos;
}

export type DrawKind = 'run' | 'pass' | 'zone';

/** Annotation on a frame. For `zone`, `a` is the centre and `b` a point on its edge. */
export interface Drawing {
  id: string;
  kind: DrawKind;
  a: Pt;
  b: Pt;
}

export interface Frame {
  id: string;
  note: string;
  drawings: Drawing[];
  /**
   * Curved movement: token id (or `ball`) -> the point the path from the previous
   * frame passes through halfway. Missing = straight line.
   */
  via: Record<string, Pt>;
  /** token id -> normalized (0..1) pitch position */
  positions: Record<string, Pt>;
  ball: Pt;
}

export interface UsTeam {
  name: string;
  color: string;
  formation: string;
  /** token id (u0..u10) -> roster player id */
  assign: Record<string, string | null>;
}

export interface OppTeam {
  name: string;
  color: string;
  formation: string;
  /** token id (o0..o10) -> free-form label */
  labels: Record<string, { number: string; name: string }>;
}

export interface Tactic {
  id: string;
  name: string;
  updatedAt: number;
  us: UsTeam;
  opp: OppTeam | null;
  frames: Frame[];
}

export type TokenSide = 'us' | 'opp';

/** Everything needed to draw one player marker, independent of SVG/canvas. */
export interface SceneToken {
  id: string;
  side: TokenSide;
  x: number;
  y: number;
  number: string;
  name: string;
  color: string;
  role: string;
  empty: boolean;
}

export interface SceneDrawing extends Drawing {
  alpha: number;
}

export interface SceneTrail {
  /** token id or `ball` */
  id: string;
  from: Pt;
  to: Pt;
  /** halfway point of a curved path; undefined = straight */
  via?: Pt;
  color: string;
}

export interface Scene {
  tokens: SceneToken[];
  ball: Pt | null;
  trails: SceneTrail[];
  drawings: SceneDrawing[];
}
