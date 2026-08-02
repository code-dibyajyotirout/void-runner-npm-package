let audioCtx: AudioContext | null = null;

const getAudioCtx = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
};

export function playSound(type: string) {
  try {
    const ctxNode = getAudioCtx();
    if (!ctxNode) return;
    const osc = ctxNode.createOscillator();
    const gain = ctxNode.createGain();
    osc.connect(gain);
    gain.connect(ctxNode.destination);

    if (type === "slash") {
      osc.frequency.setValueAtTime(800, ctxNode.currentTime);
      osc.frequency.linearRampToValueAtTime(200, ctxNode.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctxNode.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctxNode.currentTime + 0.15);
      osc.start();
      osc.stop(ctxNode.currentTime + 0.15);
    } else if (type === "coin") {
      osc.frequency.setValueAtTime(880, ctxNode.currentTime);
      gain.gain.setValueAtTime(0.2, ctxNode.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctxNode.currentTime + 0.2);
      osc.start();
      osc.stop(ctxNode.currentTime + 0.2);
    } else if (type === "damage") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(80, ctxNode.currentTime);
      gain.gain.setValueAtTime(0.4, ctxNode.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctxNode.currentTime + 0.3);
      osc.start();
      osc.stop(ctxNode.currentTime + 0.3);
    } else if (type === "jump") {
      osc.frequency.setValueAtTime(200, ctxNode.currentTime);
      osc.frequency.linearRampToValueAtTime(600, ctxNode.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctxNode.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctxNode.currentTime + 0.1);
      osc.start();
      osc.stop(ctxNode.currentTime + 0.1);
    } else if (type === "combo") {
      osc.frequency.setValueAtTime(523, ctxNode.currentTime);
      gain.gain.setValueAtTime(0.15, ctxNode.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctxNode.currentTime + 0.25);
      osc.start();
      osc.stop(ctxNode.currentTime + 0.25);
    } else if (type === "gameover") {
      osc.frequency.setValueAtTime(400, ctxNode.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctxNode.currentTime + 0.8);
      gain.gain.setValueAtTime(0.3, ctxNode.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctxNode.currentTime + 0.8);
      osc.start();
      osc.stop(ctxNode.currentTime + 0.8);
    }
  } catch (err) {
    console.warn("Web Audio API error:", err);
  }
}
