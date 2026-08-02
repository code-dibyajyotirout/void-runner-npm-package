import React$1 from 'react';

interface Obstacle {
    z: number;
    lane: number;
    type: "train" | "coin";
    active: boolean;
}
interface Bird {
    z: number;
    lane: number;
    x: number;
    y: number;
    active: boolean;
}
interface Star {
    x: number;
    y: number;
    z: number;
}
interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}
interface FloatingText {
    x: number;
    y: number;
    text: string;
    life: number;
}
interface Point {
    x: number;
    y: number;
}
type GameMode = "NORMAL" | "SWORD";
interface VoidRunnerProps {
    onExit?: () => void;
    onGameOver?: (finalScore: number, coins: number) => void;
    onScoreChange?: (score: number) => void;
    className?: string;
    style?: React.CSSProperties;
}

declare const VoidRunner: React$1.FC<VoidRunnerProps>;

declare function project(x: number, y: number, z: number, camX: number, camY: number, camZ: number, canvasWidth: number, canvasHeight: number): {
    x: number;
    y: number;
    scale: number;
} | null;
declare function pointLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number;

declare function playSound(type: string): void;

declare const LANE_WIDTH = 2;
declare const JUMP_FORCE = 16;
declare const GRAVITY = 32;
declare const VOID_BLACK = "#0f0a23";
declare const DEEP_PURPLE = "#1e1b4b";
declare const ELECTRIC_VIOLET = "#8b5cf6";
declare const HOT_PINK = "#ec4899";
declare const NEON_CYAN = "#06b6d4";
declare const GLITCH_RED = "#ef4444";
declare const GOLD = "#f59e0b";
declare const SUNSET_ORANGE = "#fb923c";

declare function loadMediaPipeScripts(onProgress?: (loadedCount: number) => void, onComplete?: () => void): () => void;

export { type Bird, DEEP_PURPLE, ELECTRIC_VIOLET, type FloatingText, GLITCH_RED, GOLD, GRAVITY, type GameMode, HOT_PINK, JUMP_FORCE, LANE_WIDTH, NEON_CYAN, type Obstacle, type Particle, type Point, SUNSET_ORANGE, type Star, VOID_BLACK, VoidRunner, type VoidRunnerProps, VoidRunner as default, loadMediaPipeScripts, playSound, pointLineDistance, project };
