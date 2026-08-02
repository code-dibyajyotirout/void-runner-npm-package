export interface Obstacle {
  z: number;
  lane: number;
  type: "train" | "coin";
  active: boolean;
}

export interface Bird {
  z: number;
  lane: number;
  x: number;
  y: number;
  active: boolean;
}

export interface Star {
  x: number;
  y: number;
  z: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
}

export interface Point {
  x: number;
  y: number;
}
