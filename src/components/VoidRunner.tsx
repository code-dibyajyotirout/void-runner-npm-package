"use client";

import React, { useState, useEffect, useRef } from "react";
import { Obstacle, Bird, Star, Particle, FloatingText, Point, VoidRunnerProps } from "../types";
import { LANE_WIDTH, JUMP_FORCE, GRAVITY, VOID_BLACK, DEEP_PURPLE, ELECTRIC_VIOLET, HOT_PINK, NEON_CYAN, GLITCH_RED, GOLD, SUNSET_ORANGE } from "../utils/constants";
import { project, pointLineDistance } from "../utils/math";
import { playSound } from "../utils/audio";
import { loadMediaPipeScripts } from "../utils/mediapipeLoader";
import "../styles.css";

export const VoidRunner: React.FC<VoidRunnerProps> = ({
  onExit,
  onGameOver,
  onScoreChange,
  className = "",
  style = {},
}) => {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);

  const gameCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlDotRef = useRef<HTMLDivElement>(null);
  const cameraPreviewRef = useRef<HTMLDivElement>(null);
  const cameraSelectRef = useRef<HTMLSelectElement>(null);
  const backBtnRef = useRef<HTMLButtonElement>(null);
  const modeIndicatorRef = useRef<HTMLDivElement>(null);
  const loadingOverlayRef = useRef<HTMLDivElement>(null);
  const calibrationOverlayRef = useRef<HTMLDivElement>(null);
  const mobileStartBtnRef = useRef<HTMLButtonElement>(null);
  const mobileMenuBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const cancelLoader = loadMediaPipeScripts(
      (count) => setLoadedCount(count),
      () => setScriptLoaded(true)
    );
    return () => cancelLoader();
  }, []);

  useEffect(() => {
    if (!scriptLoaded) return;

    const gameCanvas = gameCanvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    const video = videoRef.current;
    const controlDot = controlDotRef.current;
    const cameraPreview = cameraPreviewRef.current;
    const modeIndicator = modeIndicatorRef.current;
    const calibrationOverlay = calibrationOverlayRef.current;
    const select = cameraSelectRef.current;
    const mobileStartBtn = mobileStartBtnRef.current;
    const mobileMenuBtn = mobileMenuBtnRef.current;
    const backBtn = backBtnRef.current;

    const resize = () => {
      if (gameCanvas) {
        gameCanvas.width = window.innerWidth;
        gameCanvas.height = window.innerHeight;
      }
      if (previewCanvas) {
        previewCanvas.width = 320;
        previewCanvas.height = 240;
      }
    };
    resize();
    window.addEventListener("resize", resize);

    let highscore = 0;
    if (typeof window !== "undefined") {
      try {
        const savedScore = localStorage.getItem("void_runner_highscore");
        if (savedScore) highscore = parseInt(savedScore, 10);
      } catch (e) { }
    }

    let state: "MENU" | "TUTORIAL" | "PLAYING" | "GAMEOVER" = "MENU";
    let gameMode: "NORMAL" | "SWORD" = "NORMAL";
    let speed = 25;
    let distance = 0;
    let score = 0;
    let coinsCollected = 0;
    let playerX = 0;
    let playerY = 0;
    let targetLane = 0;
    let currentLane = 0;
    let isJumping = false;
    let jumpVy = 0;
    let health = 3;
    let invulnerableTimer = 0;

    let noseX = 0;
    let noseY = 0;
    let baselineY: number | null = null;
    let isCalibrating = false;
    let calibrationFrames = 0;
    let calibrationSumY = 0;

    let isHandPresent = false;
    let handX = 0;
    let handY = 0;
    let prevHandX: number | null = null;
    let prevHandY: number | null = null;
    let handSlashTrail: Point[] = [];
    let isSlashing = false;
    let slashCooldown = 0;

    let touchStartX = 0;
    let touchStartY = 0;

    let screenShake = 0;
    let hitStop = 0;

    let obstacles: Obstacle[] = [];
    let birds: Bird[] = [];
    let particles: Particle[] = [];
    let floatingTexts: FloatingText[] = [];

    const stars: Star[] = Array.from({ length: 200 }, () => ({
      x: (Math.random() - 0.5) * 200,
      y: (Math.random() - 0.5) * 200,
      z: Math.random() * 500,
    }));

    const cameraUtils = (window as any).Camera;
    const FaceMeshClass = (window as any).FaceMesh;
    const HandsClass = (window as any).Hands;

    let camera: any = null;

    const stopWebcam = () => {
      if (camera) {
        try { camera.stop(); } catch (e) { }
        camera = null;
      }
      if (video && video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
    };

    const handleBackClick = () => {
      if (state === "MENU") {
        stopWebcam();
        if (onExit) onExit();
      } else {
        state = "MENU";
        screenShake = 0;
        hitStop = 0;
        stopWebcam();
      }
    };
    if (backBtn) backBtn.addEventListener("click", handleBackClick);

    const updateMobileButton = () => {
      if (!mobileStartBtn || !mobileMenuBtn) return;
      if (state === "MENU") {
        mobileStartBtn.style.display = "none";
        mobileMenuBtn.style.display = "none";
      } else if (state === "TUTORIAL") {
        mobileStartBtn.textContent = "PLAY";
        mobileStartBtn.style.display = "block";
        mobileMenuBtn.style.display = "none";
      } else if (state === "PLAYING") {
        mobileStartBtn.style.display = "none";
        mobileMenuBtn.style.display = "none";
      } else if (state === "GAMEOVER") {
        mobileStartBtn.textContent = "RETRY";
        mobileStartBtn.style.display = "block";
        mobileMenuBtn.style.display = "block";
      }
    };

    const startCalibration = () => {
      isCalibrating = true;
      calibrationFrames = 0;
      calibrationSumY = 0;
      baselineY = null;
      if (calibrationOverlay) calibrationOverlay.style.display = "flex";
    };

    const initWebcam = async (deviceId?: string) => {
      if (!video || !cameraUtils || !FaceMeshClass) return;

      if (camera) stopWebcam();

      const faceMesh = new FaceMeshClass({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults((results: any) => {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;
        const landmarks = results.multiFaceLandmarks[0];
        const nose = landmarks[1];

        noseX = (nose.x - 0.5) * 2;
        noseY = nose.y;

        if (isCalibrating) {
          calibrationSumY += noseY;
          calibrationFrames++;
          if (calibrationFrames >= 30) {
            baselineY = calibrationSumY / 30;
            isCalibrating = false;
            if (calibrationOverlay) calibrationOverlay.style.display = "none";
          }
        }

        if (controlDot) {
          controlDot.style.left = `${(1 - nose.x) * 100}%`;
          controlDot.style.top = `${nose.y * 100}%`;
        }

        if (baselineY !== null && !isCalibrating) {
          if (noseX > 0.15) targetLane = -1;
          else if (noseX < -0.15) targetLane = 1;
          else targetLane = 0;

          if (baselineY - noseY > 0.08 && !isJumping) {
            isJumping = true;
            jumpVy = JUMP_FORCE;
            playSound("jump");
          }
        }

        if (previewCanvas) {
          const ctx = previewCanvas.getContext("2d");
          if (ctx) {
            ctx.save();
            ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            ctx.drawImage(results.image, 0, 0, previewCanvas.width, previewCanvas.height);
            ctx.restore();
          }
        }
      });

      let hands: any = null;
      if (HandsClass) {
        hands = new HandsClass({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        hands.onResults((results: any) => {
          if (gameMode !== "SWORD") {
            isHandPresent = false;
            return;
          }

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            isHandPresent = true;
            const landmarks = results.multiHandLandmarks[0];
            const indexTip = landmarks[8];

            const screenX = (1 - indexTip.x) * window.innerWidth;
            const screenY = indexTip.y * window.innerHeight;

            handX = screenX;
            handY = screenY;

            handSlashTrail.push({ x: screenX, y: screenY });
            if (handSlashTrail.length > 10) handSlashTrail.shift();

            if (prevHandX !== null && prevHandY !== null) {
              const dist = Math.hypot(screenX - prevHandX, screenY - prevHandY);
              if (dist > 40 && slashCooldown <= 0) {
                isSlashing = true;
                slashCooldown = 5;
                playSound("slash");

                for (let i = 0; i < 8; i++) {
                  particles.push({
                    x: screenX,
                    y: screenY,
                    vx: (Math.random() - 0.5) * 300,
                    vy: (Math.random() - 0.5) * 300,
                    life: 0.3,
                    color: HOT_PINK,
                  });
                }
              }
            }

            prevHandX = screenX;
            prevHandY = screenY;
          } else {
            isHandPresent = false;
            prevHandX = null;
            prevHandY = null;
            handSlashTrail = [];
          }
        });
      }

      camera = new cameraUtils.Camera(video, {
        onFrame: async () => {
          if (video) {
            await faceMesh.send({ image: video });
            if (hands && gameMode === "SWORD") {
              await hands.send({ image: video });
            }
          }
        },
        width: 320,
        height: 240,
        deviceId: deviceId || undefined,
      });

      startCalibration();
      camera.start();
    };

    const getCameraDevices = async () => {
      if (!select || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((device) => device.kind === "videoinput");

        select.innerHTML = "";
        videoDevices.forEach((device, index) => {
          const option = document.createElement("option");
          option.value = device.deviceId;
          option.text = device.label || `Camera ${index + 1}`;
          select.appendChild(option);
        });

        select.onchange = () => {
          initWebcam(select.value);
        };
      } catch (err) {
        console.warn("Camera enumeration error:", err);
      }
    };

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => getCameraDevices())
        .catch(() => { });
    }

    const resetGame = (mode: "NORMAL" | "SWORD") => {
      gameMode = mode;
      state = "TUTORIAL";
      speed = 25;
      distance = 0;
      score = 0;
      coinsCollected = 0;
      playerX = 0;
      playerY = 0;
      targetLane = 0;
      currentLane = 0;
      isJumping = false;
      jumpVy = 0;
      health = 3;
      invulnerableTimer = 0;
      screenShake = 0;
      hitStop = 0;
      obstacles = [];
      birds = [];
      particles = [];
      floatingTexts = [];

      if (modeIndicator) {
        modeIndicator.textContent = gameMode === "SWORD" ? "SWORD SLASH MODE" : "NORMAL MODE";
      }

      initWebcam();
    };

    const spawnObstacle = () => {
      const lane = Math.floor(Math.random() * 3) - 1;
      const type = Math.random() > 0.4 ? "train" : "coin";
      obstacles.push({ z: 400, lane, type, active: true });
    };

    const spawnBird = () => {
      const lane = Math.floor(Math.random() * 3) - 1;
      birds.push({
        z: 400,
        lane,
        x: lane * LANE_WIDTH,
        y: 1.5 + Math.random() * 0.5,
        active: true,
      });
    };

    let nextSpawnZ = 100;
    let nextBirdZ = 150;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (state === "PLAYING" || state === "TUTORIAL") {
        if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
          targetLane = Math.max(-1, targetLane - 1);
        } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
          targetLane = Math.min(1, targetLane + 1);
        } else if ((e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W") && !isJumping) {
          isJumping = true;
          jumpVy = JUMP_FORCE;
          playSound("jump");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 0) return;
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;

      if (state === "PLAYING" || state === "TUTORIAL") {
        if (gameMode === "SWORD" && Math.hypot(dx, dy) > 50 && slashCooldown <= 0) {
          isSlashing = true;
          slashCooldown = 5;
          playSound("slash");
          for (let i = 0; i < 8; i++) {
            particles.push({
              x: touchEndX,
              y: touchEndY,
              vx: (Math.random() - 0.5) * 300,
              vy: (Math.random() - 0.5) * 300,
              life: 0.3,
              color: HOT_PINK,
            });
          }
          return;
        }

        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 30) targetLane = Math.min(1, targetLane + 1);
          else if (dx < -30) targetLane = Math.max(-1, targetLane - 1);
        } else {
          if (dy < -30 && !isJumping) {
            isJumping = true;
            jumpVy = JUMP_FORCE;
            playSound("jump");
          }
        }
      }
    };

    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchend", handleTouchEnd);

    if (mobileStartBtn) {
      mobileStartBtn.onclick = () => {
        if (state === "TUTORIAL") state = "PLAYING";
        else if (state === "GAMEOVER") resetGame(gameMode);
      };
    }

    if (mobileMenuBtn) {
      mobileMenuBtn.onclick = () => {
        state = "MENU";
        stopWebcam();
      };
    }

    let animationFrameId: number;
    let lastTime = performance.now();

    const gameLoop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (slashCooldown > 0) slashCooldown--;

      if (hitStop > 0) {
        hitStop -= dt;
      } else {
        if (state === "PLAYING") {
          distance += speed * dt;
          score = Math.floor(distance) + coinsCollected * 50;
          if (onScoreChange) onScoreChange(score);

          speed += dt * 0.5;

          const targetX = targetLane * LANE_WIDTH;
          playerX += (targetX - playerX) * 15 * dt;

          if (isJumping) {
            playerY += jumpVy * dt;
            jumpVy -= GRAVITY * dt;
            if (playerY <= 0) {
              playerY = 0;
              isJumping = false;
            }
          }

          if (distance > nextSpawnZ) {
            spawnObstacle();
            nextSpawnZ = distance + 30 + Math.random() * 40;
          }

          if (gameMode === "SWORD" && distance > nextBirdZ) {
            spawnBird();
            nextBirdZ = distance + 50 + Math.random() * 60;
          }

          if (invulnerableTimer > 0) invulnerableTimer -= dt;

          obstacles.forEach((obs) => {
            if (!obs.active) return;
            obs.z -= speed * dt;

            const dz = obs.z;
            if (dz > -2 && dz < 4 && Math.abs(obs.lane * LANE_WIDTH - playerX) < 1.2) {
              if (obs.type === "train" && playerY < 1.5) {
                if (invulnerableTimer <= 0) {
                  health--;
                  screenShake = 0.4;
                  hitStop = 0.15;
                  invulnerableTimer = 1.0;
                  playSound("damage");

                  for (let i = 0; i < 20; i++) {
                    particles.push({
                      x: window.innerWidth / 2,
                      y: window.innerHeight / 2,
                      vx: (Math.random() - 0.5) * 500,
                      vy: (Math.random() - 0.5) * 500,
                      life: 0.5,
                      color: GLITCH_RED,
                    });
                  }

                  if (health <= 0) {
                    state = "GAMEOVER";
                    playSound("gameover");
                    if (score > highscore) {
                      highscore = score;
                      try { localStorage.setItem("void_runner_highscore", highscore.toString()); } catch (e) { }
                    }
                    if (onGameOver) onGameOver(score, coinsCollected);
                  }
                }
              } else if (obs.type === "coin") {
                obs.active = false;
                coinsCollected++;
                playSound("coin");
                floatingTexts.push({
                  x: window.innerWidth / 2 + (Math.random() - 0.5) * 100,
                  y: window.innerHeight / 2 - 50,
                  text: "+50",
                  life: 1.0,
                });
              }
            }
          });

          birds.forEach((bird) => {
            if (!bird.active) return;
            bird.z -= speed * dt;

            if (isSlashing && bird.z > 0 && bird.z < 50) {
              const proj = project(bird.x, bird.y, bird.z, playerX, playerY + 1, 0, window.innerWidth, window.innerHeight);
              if (proj) {
                const distToHand = Math.hypot(proj.x - handX, proj.y - handY);
                if (distToHand < 100) {
                  bird.active = false;
                  score += 100;
                  playSound("slash");
                  playSound("combo");
                  floatingTexts.push({
                    x: proj.x,
                    y: proj.y,
                    text: "SLASH! +100",
                    life: 1.0,
                  });

                  for (let i = 0; i < 15; i++) {
                    particles.push({
                      x: proj.x,
                      y: proj.y,
                      vx: (Math.random() - 0.5) * 400,
                      vy: (Math.random() - 0.5) * 400,
                      life: 0.4,
                      color: GOLD,
                    });
                  }
                }
              }
            }

            if (bird.z > -2 && bird.z < 4 && Math.abs(bird.x - playerX) < 1.2 && Math.abs(bird.y - playerY) < 1.5) {
              if (invulnerableTimer <= 0) {
                health--;
                screenShake = 0.3;
                invulnerableTimer = 1.0;
                playSound("damage");
                if (health <= 0) {
                  state = "GAMEOVER";
                  playSound("gameover");
                  if (score > highscore) {
                    highscore = score;
                    try { localStorage.setItem("void_runner_highscore", highscore.toString()); } catch (e) { }
                  }
                  if (onGameOver) onGameOver(score, coinsCollected);
                }
              }
            }
          });

          obstacles = obstacles.filter((o) => o.z > -10 && o.active);
          birds = birds.filter((b) => b.z > -10 && b.active);
        }
      }

      isSlashing = false;
      updateMobileButton();

      if (gameCanvas) {
        const ctx = gameCanvas.getContext("2d");
        if (ctx) {
          ctx.save();

          let shakeX = 0, shakeY = 0;
          if (screenShake > 0) {
            screenShake -= dt;
            shakeX = (Math.random() - 0.5) * 20;
            shakeY = (Math.random() - 0.5) * 20;
          }
          ctx.translate(shakeX, shakeY);

          ctx.fillStyle = VOID_BLACK;
          ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

          const camX = playerX;
          const camY = playerY + 1.8;
          const camZ = 0;

          // Stars
          ctx.fillStyle = "#ffffff";
          stars.forEach((star) => {
            const p = project(star.x, star.y, star.z, camX, camY, camZ, gameCanvas.width, gameCanvas.height);
            if (p) {
              const sz = Math.max(1, 3 * p.scale);
              ctx.fillRect(p.x, p.y, sz, sz);
            }
          });

          // Horizon & Track
          ctx.strokeStyle = ELECTRIC_VIOLET;
          ctx.lineWidth = 2;

          for (let l = -1.5; l <= 1.5; l += 1) {
            const p1 = project(l * LANE_WIDTH, 0, 1, camX, camY, camZ, gameCanvas.width, gameCanvas.height);
            const p2 = project(l * LANE_WIDTH, 0, 400, camX, camY, camZ, gameCanvas.width, gameCanvas.height);
            if (p1 && p2) {
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }

          const gridOffset = distance % 10;
          for (let z = 10 - gridOffset; z < 400; z += 10) {
            const pLeft = project(-1.5 * LANE_WIDTH, 0, z, camX, camY, camZ, gameCanvas.width, gameCanvas.height);
            const pRight = project(1.5 * LANE_WIDTH, 0, z, camX, camY, camZ, gameCanvas.width, gameCanvas.height);
            if (pLeft && pRight) {
              ctx.beginPath();
              ctx.moveTo(pLeft.x, pLeft.y);
              ctx.lineTo(pRight.x, pRight.y);
              ctx.stroke();
            }
          }

          // Obstacles
          obstacles.forEach((obs) => {
            const ox = obs.lane * LANE_WIDTH;
            const oz = obs.z;
            const p = project(ox, 0, oz, camX, camY, camZ, gameCanvas.width, gameCanvas.height);
            if (p) {
              if (obs.type === "train") {
                const w = 1.6 * p.scale * 100;
                const h = 2.0 * p.scale * 100;
                ctx.fillStyle = HOT_PINK;
                ctx.fillRect(p.x - w / 2, p.y - h, w, h);
                ctx.strokeStyle = NEON_CYAN;
                ctx.strokeRect(p.x - w / 2, p.y - h, w, h);
              } else if (obs.type === "coin") {
                const r = 0.5 * p.scale * 100;
                ctx.fillStyle = GOLD;
                ctx.beginPath();
                ctx.arc(p.x, p.y - r, r, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          });

          // Birds
          birds.forEach((bird) => {
            const p = project(bird.x, bird.y, bird.z, camX, camY, camZ, gameCanvas.width, gameCanvas.height);
            if (p) {
              const sz = 1.0 * p.scale * 100;
              ctx.fillStyle = SUNSET_ORANGE;
              ctx.beginPath();
              ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = GOLD;
              ctx.stroke();
            }
          });

          // Player
          const pPlayer = project(playerX, playerY, 5, camX, camY, camZ, gameCanvas.width, gameCanvas.height);
          if (pPlayer) {
            const pw = 0.8 * pPlayer.scale * 100;
            const ph = 1.2 * pPlayer.scale * 100;

            if (invulnerableTimer <= 0 || Math.floor(now / 100) % 2 === 0) {
              ctx.fillStyle = NEON_CYAN;
              ctx.beginPath();
              ctx.moveTo(pPlayer.x, pPlayer.y - ph);
              ctx.lineTo(pPlayer.x - pw / 2, pPlayer.y);
              ctx.lineTo(pPlayer.x + pw / 2, pPlayer.y);
              ctx.closePath();
              ctx.fill();
            }
          }

          // Particles
          particles.forEach((part) => {
            part.x += part.vx * dt;
            part.y += part.vy * dt;
            part.life -= dt;
            ctx.fillStyle = part.color;
            ctx.globalAlpha = Math.max(0, part.life / 0.5);
            ctx.fillRect(part.x, part.y, 4, 4);
            ctx.globalAlpha = 1.0;
          });
          particles = particles.filter((p) => p.life > 0);

          // Floating Texts
          floatingTexts.forEach((txt) => {
            txt.y -= 30 * dt;
            txt.life -= dt;
            ctx.fillStyle = GOLD;
            ctx.font = "bold 20px Impact";
            ctx.globalAlpha = Math.max(0, txt.life);
            ctx.fillText(txt.text, txt.x, txt.y);
            ctx.globalAlpha = 1.0;
          });
          floatingTexts = floatingTexts.filter((t) => t.life > 0);

          // Sword Trail
          if (gameMode === "SWORD" && isHandPresent && handSlashTrail.length > 1) {
            ctx.strokeStyle = HOT_PINK;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(handSlashTrail[0].x, handSlashTrail[0].y);
            for (let i = 1; i < handSlashTrail.length; i++) {
              ctx.lineTo(handSlashTrail[i].x, handSlashTrail[i].y);
            }
            ctx.stroke();
          }

          // UI Overlays depending on state
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 24px Impact";

          if (state === "MENU") {
            ctx.textAlign = "center";
            ctx.fillStyle = HOT_PINK;
            ctx.font = "bold 48px Impact";
            ctx.fillText("VOID RUNNER", gameCanvas.width / 2, gameCanvas.height / 3);

            ctx.fillStyle = NEON_CYAN;
            ctx.font = "20px Impact";
            ctx.fillText(`HIGH SCORE: ${highscore}`, gameCanvas.width / 2, gameCanvas.height / 3 + 50);

            const btnWidth = 220;
            const btnHeight = 50;

            // Normal Mode Button
            const b1X = gameCanvas.width / 2 - btnWidth / 2;
            const b1Y = gameCanvas.height / 2;
            ctx.fillStyle = ELECTRIC_VIOLET;
            ctx.fillRect(b1X, b1Y, btnWidth, btnHeight);
            ctx.fillStyle = "#ffffff";
            ctx.font = "20px Impact";
            ctx.fillText("PLAY NORMAL MODE", gameCanvas.width / 2, b1Y + 32);

            // Sword Mode Button
            const b2Y = gameCanvas.height / 2 + 70;
            ctx.fillStyle = HOT_PINK;
            ctx.fillRect(b1X, b2Y, btnWidth, btnHeight);
            ctx.fillStyle = "#ffffff";
            ctx.fillText("PLAY SWORD MODE", gameCanvas.width / 2, b2Y + 32);

            const handleMenuClick = (e: MouseEvent) => {
              const rect = gameCanvas.getBoundingClientRect();
              const mx = e.clientX - rect.left;
              const my = e.clientY - rect.top;

              if (mx >= b1X && mx <= b1X + btnWidth && my >= b1Y && my <= b1Y + btnHeight) {
                gameCanvas.removeEventListener("click", handleMenuClick);
                resetGame("NORMAL");
              } else if (mx >= b1X && mx <= b1X + btnWidth && my >= b2Y && my <= b2Y + btnHeight) {
                gameCanvas.removeEventListener("click", handleMenuClick);
                resetGame("SWORD");
              }
            };
            gameCanvas.addEventListener("click", handleMenuClick, { once: true });
          } else if (state === "TUTORIAL") {
            ctx.textAlign = "center";
            ctx.fillStyle = NEON_CYAN;
            ctx.font = "bold 36px Impact";
            ctx.fillText("CAMERA CALIBRATION & CONTROLS", gameCanvas.width / 2, gameCanvas.height / 4);

            ctx.font = "20px Impact";
            ctx.fillStyle = "#ffffff";
            ctx.fillText("1. Align face in center camera preview", gameCanvas.width / 2, gameCanvas.height / 4 + 60);
            ctx.fillText("2. Lean head Left/Right to swap lanes", gameCanvas.width / 2, gameCanvas.height / 4 + 95);
            ctx.fillText("3. Lift head up to Jump", gameCanvas.width / 2, gameCanvas.height / 4 + 130);
            if (gameMode === "SWORD") {
              ctx.fillStyle = HOT_PINK;
              ctx.fillText("4. Swipe hand in view to SLASH targets!", gameCanvas.width / 2, gameCanvas.height / 4 + 165);
            }
            ctx.fillStyle = GOLD;
            ctx.fillText("Press Space / Click START to begin", gameCanvas.width / 2, gameCanvas.height / 4 + 220);
          } else if (state === "PLAYING") {
            ctx.textAlign = "left";
            ctx.fillStyle = NEON_CYAN;
            ctx.font = "24px Impact";
            ctx.fillText(`SCORE: ${score}`, 30, 50);
            ctx.fillText(`COINS: ${coinsCollected}`, 30, 85);
            ctx.fillText(`HEALTH: ${"❤️".repeat(health)}`, 30, 120);
          } else if (state === "GAMEOVER") {
            ctx.textAlign = "center";
            ctx.fillStyle = GLITCH_RED;
            ctx.font = "bold 56px Impact";
            ctx.fillText("GAME OVER", gameCanvas.width / 2, gameCanvas.height / 3);

            ctx.fillStyle = "#ffffff";
            ctx.font = "24px Impact";
            ctx.fillText(`FINAL SCORE: ${score}`, gameCanvas.width / 2, gameCanvas.height / 3 + 60);
            ctx.fillText(`COINS COLLECTED: ${coinsCollected}`, gameCanvas.width / 2, gameCanvas.height / 3 + 95);
            ctx.fillText(`HIGH SCORE: ${highscore}`, gameCanvas.width / 2, gameCanvas.height / 3 + 130);
          }

          ctx.restore();
        }
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
      if (backBtn) backBtn.removeEventListener("click", handleBackClick);
      cancelAnimationFrame(animationFrameId);
      stopWebcam();
    };
  }, [scriptLoaded, onExit, onGameOver, onScoreChange]);

  return (
    <div className={`game-page-container ${className}`} style={style}>
      {!scriptLoaded && (
        <div ref={loadingOverlayRef} className="loading-overlay" id="loading">
          <div className="loading-text">Loading MediaPipe AI Libraries ({loadedCount}/4)...</div>
          <div className="loading-bar">
            <div
              className="loading-fill"
              style={{ width: `${(loadedCount / 4) * 100}%`, animation: "none" }}
            ></div>
          </div>
        </div>
      )}

      <button ref={backBtnRef} className="back-btn" id="back-btn">
        BACK
      </button>
      <div ref={modeIndicatorRef} className="mode-indicator" id="mode-indicator">
        AI VR MODE
      </div>

      <div ref={calibrationOverlayRef} className="calibration-overlay" id="calibration">
        <div className="calibration-text">Calibrating AI Vision...</div>
        <div className="calibration-spinner"></div>
        <div style={{ color: "#888", marginTop: "20px", fontSize: "14px" }}>
          Look at the camera and hold still
        </div>
      </div>

      <canvas ref={gameCanvasRef} id="game-canvas"></canvas>
      <video ref={videoRef} id="video" autoPlay playsInline style={{ display: "none" }}></video>

      <div ref={cameraPreviewRef} className="camera-preview">
        <div className="camera-select-container">
          <select ref={cameraSelectRef} id="camera-select">
            <option value="">Default Camera</option>
          </select>
        </div>
        <canvas ref={previewCanvasRef} id="preview-canvas" width="320" height="240"></canvas>
      </div>

      <div className="control-box">
        <div className="control-line"></div>
        <div className="jump-line"></div>
        <div className="vertical-line"></div>
        <div ref={controlDotRef} className="control-dot" id="control-dot"></div>
      </div>

      <button ref={mobileStartBtnRef} className="mobile-start-btn" id="mobile-start">
        START
      </button>
      <button ref={mobileMenuBtnRef} className="mobile-menu-btn" id="mobile-menu">
        MENU
      </button>
    </div>
  );
};

export default VoidRunner;
