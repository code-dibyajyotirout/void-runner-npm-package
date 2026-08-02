const MEDIAPIPE_SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js",
];

const loadedScripts = new Set<string>();

export function loadMediaPipeScripts(
  onProgress?: (loadedCount: number) => void,
  onComplete?: () => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  let cancelled = false;
  let count = 0;

  MEDIAPIPE_SCRIPTS.forEach((src) => {
    if (loadedScripts.has(src) || (window as any).Camera && (window as any).FaceMesh && (window as any).Hands) {
      count++;
      if (onProgress) onProgress(count);
      if (count === MEDIAPIPE_SCRIPTS.length && onComplete) {
        onComplete();
      }
      return;
    }

    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (cancelled) return;
        loadedScripts.add(src);
        count++;
        if (onProgress) onProgress(count);
        if (count === MEDIAPIPE_SCRIPTS.length && onComplete) {
          onComplete();
        }
      });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      if (cancelled) return;
      loadedScripts.add(src);
      count++;
      if (onProgress) onProgress(count);
      if (count === MEDIAPIPE_SCRIPTS.length && onComplete) {
        onComplete();
      }
    };
    script.onerror = (err) => {
      console.warn(`Failed to load MediaPipe script: ${src}`, err);
    };
    document.head.appendChild(script);
  });

  return () => {
    cancelled = true;
  };
}
