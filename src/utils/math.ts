export function project(
  x: number,
  y: number,
  z: number,
  camX: number,
  camY: number,
  camZ: number,
  canvasWidth: number,
  canvasHeight: number
) {
  const relX = x - camX;
  const relY = y - camY;
  const relZ = z - camZ;
  if (relZ <= 0.1) return null;
  const fov = 500;
  const scale = fov / relZ;
  return {
    x: canvasWidth / 2 + relX * scale,
    y: canvasHeight / 2 - relY * scale,
    scale,
  };
}

export function pointLineDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
