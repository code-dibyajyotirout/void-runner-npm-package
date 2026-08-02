"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

import { Obstacle, Bird, Star, Particle, FloatingText, Point } from "./types";
import {
  LANE_WIDTH,
  JUMP_FORCE,
  GRAVITY,
  VOID_BLACK,
  DEEP_PURPLE,
  ELECTRIC_VIOLET,
  HOT_PINK,
  NEON_CYAN,
  GLITCH_RED,
  GOLD,
  SUNSET_ORANGE,
} from "./constants";
import { project as projectUtil, pointLineDistance } from "./utils/math";
import { playSound } from "./utils/audio";

declare const FaceMesh: any;
declare const Hands: any;

export default function GamePage() {
  const router = useRouter();
  const [loadedCount, setLoadedCount] = useState(0);
  const [scriptsReady, setScriptsReady] = useState(false);

  // DOM Refs
  const gameCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const controlDotRef = useRef<HTMLDivElement>(null);
  const controlBoxRef = useRef<HTMLDivElement>(null);
  const loadingOverlayRef = useRef<HTMLDivElement>(null);
  const calibrationOverlayRef = useRef<HTMLDivElement>(null);
  const modeIndicatorRef = useRef<HTMLDivElement>(null);
  const mobileStartBtnRef = useRef<HTMLButtonElement>(null);
  const mobileMenuBtnRef = useRef<HTMLButtonElement>(null);
  const swordSvgRef = useRef<SVGSVGElement>(null);
  const backBtnRef = useRef<HTMLButtonElement>(null);
  const cameraSelectRef = useRef<HTMLSelectElement>(null);

  const handleScriptLoad = () => {
    setLoadedCount((prev) => {
      if (prev >= 4) return prev;
      const next = prev + 1;
      if (next === 4) {
        setScriptsReady(true);
      }
      return next;
    });
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";

    // Polling check to monitor script global injections (guarantees loader progress and bypasses Next.js onLoad gotchas)
    let interval: NodeJS.Timeout;
    const checkGlobals = () => {
      if (typeof window === "undefined") return;
      
      let count = 0;
      if ((window as any).Camera) count++;
      if ((window as any).FaceMesh) count++;
      if ((window as any).Hands) count++;
      
      if (count === 3) {
        setLoadedCount(4);
        setScriptsReady(true);
        if (interval) clearInterval(interval);
      } else if (count > 0) {
        // Map 1-2 detected globals to the corresponding loader count
        setLoadedCount(count);
      }
    };

    checkGlobals();
    interval = setInterval(checkGlobals, 100);

    return () => {
      document.body.style.overflow = "auto";
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!scriptsReady) return;

    // Game Variables
    let state = "MENU"; // MENU, TUTORIAL, GAME, GAME_OVER
    let cameraActive = false;
    let highScore = 0;
    let gameMode: "SWORD" | "NORMAL" = "SWORD";
    let score = 0;
    let coins = 0;
    let lives = 3;
    let speed = 28;
    let zPos = 0;
    let runTime = 0;
    let combo = 0;
    let comboTimer = 0;
    let maxCombo = 0;

    // VFX & UI State
    let screenShake = 0;
    let hitStop = 0;
    let floatingTexts: FloatingText[] = [];

    // Player Movement
    let targetLane = 0;
    let laneX = -1;
    let yPos = 0;
    let yVel = 0;
    let isJumping = false;

    // Tracking Coordinates
    let headX = 0.5;
    let headY = 0.5;
    let swordActive = false;
    let swordBase: Point | null = null;
    let swordTip: Point | null = null;
    let smoothTip: Point | null = null;
    let swordTrail: Point[] = [];
    let lastHand: any = null;

    // Game Objects
    let obstacles: Obstacle[] = [];
    let birds: Bird[] = [];
    let nextSpawnZ = 50;
    let starfield: Star[] = [];
    let pulsePhase = 0;
    let particles: Particle[] = [];

    // Initialize Starfield
    for (let i = 0; i < 80; i++) {
      starfield.push({
        x: (Math.random() - 0.5) * 30,
        y: Math.random() * 10 - 2,
        z: Math.random() * 120,
      });
    }



    // Canvas contexts
    const gameCanvas = gameCanvasRef.current!;
    if (!gameCanvas) return;
    const ctx = gameCanvas.getContext("2d")!;
    if (!ctx) return;

    const video = videoRef.current;
    const previewVideo = previewVideoRef.current;
    const previewCanvas = previewCanvasRef.current!;
    if (!previewCanvas) return;
    const previewCtx = previewCanvas.getContext("2d")!;
    if (!previewCtx) return;

    const controlDot = controlDotRef.current;
    const loadingOverlay = loadingOverlayRef.current;
    const modeIndicator = modeIndicatorRef.current;
    const calibrationOverlay = calibrationOverlayRef.current;
    const select = cameraSelectRef.current;
    const mobileStartBtn = mobileStartBtnRef.current;
    const mobileMenuBtn = mobileMenuBtnRef.current;
    const backBtn = backBtnRef.current;

    // Resize Handler
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

    // Load high score from localStorage
    if (typeof window !== "undefined") {
      try {
        const savedScore = localStorage.getItem("void_runner_highscore");
        if (savedScore) {
          highScore = parseInt(savedScore, 10) || 0;
        }
      } catch (e) {
        console.error("Failed to load high score:", e);
      }
    }

    // Hitboxes for canvas-drawn main menu buttons
    let normalBtnRect = { x: 0, y: 0, w: 0, h: 0 };
    let swordBtnRect = { x: 0, y: 0, w: 0, h: 0 };
    let currentDeviceId: string | null = null;
    let isProcessing = false;

    // Keyboard Fallback Input
    const keys: { [key: string]: boolean } = {};
    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;

      if (state === "MENU") {
        if (e.code === "Digit1" || e.code === "Numpad1") {
          gameMode = "NORMAL";
          state = "TUTORIAL";
        }
        if (e.code === "Digit2" || e.code === "Numpad2") {
          gameMode = "SWORD";
          state = "TUTORIAL";
        }
        if (e.code === "Space") {
          gameMode = "NORMAL";
          state = "TUTORIAL";
        }
      } else if (state === "TUTORIAL" && e.code === "Space") {
        startGame();
      } else if (state === "GAME_OVER" && e.code === "Space") {
        startGame();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    // Canvas click input (Main Menu Mode Select)
    const handleCanvasClick = (e: MouseEvent) => {
      if (state !== "MENU") return;

      const rect = gameCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (mx >= normalBtnRect.x && mx <= normalBtnRect.x + normalBtnRect.w &&
          my >= normalBtnRect.y && my <= normalBtnRect.y + normalBtnRect.h) {
        gameMode = "NORMAL";
        state = "TUTORIAL";
      }

      if (mx >= swordBtnRect.x && mx <= swordBtnRect.x + swordBtnRect.w &&
          my >= swordBtnRect.y && my <= swordBtnRect.y + swordBtnRect.h) {
        gameMode = "SWORD";
        state = "TUTORIAL";
      }
    };
    gameCanvas.addEventListener("click", handleCanvasClick);

    // Back Button Click Handler
    const handleBackClick = () => {
      if (state === "MENU") {
        return;
      } else {
        state = "MENU";
        screenShake = 0;
        hitStop = 0;
      }
    };
    if (backBtn) backBtn.addEventListener("click", handleBackClick);

    // Mobile buttons visibility and logic
    const updateMobileButton = () => {
      if (!mobileStartBtn || !mobileMenuBtn) return;
      if (state === "MENU") {
        mobileStartBtn.style.display = "none";
        mobileMenuBtn.style.display = "none";
      } else if (state === "TUTORIAL") {
        mobileStartBtn.textContent = "PLAY";
        mobileStartBtn.style.display = "block";
        mobileMenuBtn.style.display = "none";
      } else if (state === "GAME_OVER") {
        mobileStartBtn.textContent = "RESTART";
        mobileStartBtn.style.display = "block";
        mobileMenuBtn.style.display = "block";
      } else {
        mobileStartBtn.style.display = "none";
        mobileMenuBtn.style.display = "none";
      }
    };

    const handleMobileStartClick = () => {
      if (state === "MENU") {
        gameMode = "SWORD";
        state = "TUTORIAL";
      } else if (state === "TUTORIAL") {
        startGame();
      } else if (state === "GAME_OVER") {
        startGame();
      }
      updateMobileButton();
    };

    const handleMobileMenuClick = () => {
      state = "MENU";
      updateMobileButton();
    };

    if (mobileStartBtn) mobileStartBtn.addEventListener("click", handleMobileStartClick);
    if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", handleMobileMenuClick);

    // Touch Controls Fallback (For Mobile when camera is off/missing)
    const handleTouchStart = (e: TouchEvent) => {
      // Prevent scrolling / default touch behaviors when in active gameplay
      if (state === "GAME") {
        e.preventDefault();
      }

      if (state === "TUTORIAL") {
        startGame();
        return;
      } else if (state === "GAME_OVER") {
        startGame();
        return;
      }

      if (state !== "GAME") return;

      const touch = e.touches[0];
      const mx = touch.clientX;
      const my = touch.clientY;

      if (gameMode === "NORMAL") {
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;

        if (my < screenH * 0.4) {
          // Upper 40% of the screen triggers a jump
          if (!isJumping) {
            yVel = JUMP_FORCE;
            isJumping = true;
            playSound("jump");
          }
        } else {
          // Bottom 60% of the screen controls lanes
          if (mx < screenW / 2) {
            targetLane = 0;
          } else {
            targetLane = 1;
          }
        }
      } else if (gameMode === "SWORD") {
        const rect = gameCanvas.getBoundingClientRect();
        const tx = (mx - rect.left) / rect.width;
        const ty = (my - rect.top) / rect.height;

        swordActive = true;
        swordBase = { x: tx, y: ty };
        swordTip = { x: tx, y: ty - 0.2 };
        smoothTip = { x: tx, y: ty - 0.2 };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (state !== "GAME") return;
      e.preventDefault();

      const touch = e.touches[0];
      const mx = touch.clientX;
      const my = touch.clientY;

      if (gameMode === "SWORD") {
        const rect = gameCanvas.getBoundingClientRect();
        const tx = (mx - rect.left) / rect.width;
        const ty = (my - rect.top) / rect.height;

        swordActive = true;
        swordBase = { x: tx, y: ty };
        swordTip = { x: tx, y: ty - 0.2 };
        smoothTip = { x: tx, y: ty - 0.2 };
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (state !== "GAME") return;
      if (gameMode === "SWORD") {
        swordActive = false;
        swordTrail = [];
      }
    };

    gameCanvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    gameCanvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    gameCanvas.addEventListener("touchend", handleTouchEnd, { passive: false });

    // MediaPipe Tracking Logic
    let lastFaceLandmarks: any = null;

    function onFaceResults(results: any) {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const nose = landmarks[1];
        headX = 1 - nose.x;
        headY = nose.y;

        lastFaceLandmarks = landmarks;

        if (headX < 0.5) targetLane = 0;
        else targetLane = 1;

        if (headY < 0.40 && !isJumping && state === "GAME") {
          yVel = JUMP_FORCE;
          isJumping = true;
          playSound("jump");
        }

        if (controlDot) {
          controlDot.style.left = headX * 100 + "%";
          controlDot.style.top = headY * 100 + "%";
        }
      } else {
        lastFaceLandmarks = null;
      }
    }

    function onHandResults(results: any) {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const hand = results.multiHandLandmarks[0];
        const wrist = hand[0];
        const middle = hand[9];

        const dx = middle.x - wrist.x;
        const dy = middle.y - wrist.y;
        const scaleMultiplier = 5.0;
        const targetTip = {
          x: wrist.x + dx * scaleMultiplier,
          y: wrist.y + dy * scaleMultiplier,
        };

        if (!smoothTip) {
          smoothTip = { ...targetTip };
        } else {
          smoothTip.x += (targetTip.x - smoothTip.x) * 0.25;
          smoothTip.y += (targetTip.y - smoothTip.y) * 0.25;
        }

        swordBase = { x: 1 - wrist.x, y: wrist.y };
        swordTip = { x: 1 - smoothTip.x, y: smoothTip.y };
        lastHand = hand;

        if (gameMode === "SWORD") {
          swordActive = true;
        } else {
          swordActive = false;
          swordTrail = [];
          lastHand = null;
        }
      } else {
        swordActive = false;
        swordTrail = [];
        lastHand = null;
      }
    }

    // MediaPipe Instances
    const faceMesh = new FaceMesh({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    faceMesh.onResults(onFaceResults);

    const hands = new Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    hands.onResults(onHandResults);

    // Camera Management
    async function initCameraSystem() {
      try {
        if (calibrationOverlay) calibrationOverlay.style.display = "flex";
        if (loadingOverlay) loadingOverlay.style.display = "none";

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (video) {
          video.srcObject = stream;
          video.onloadedmetadata = () => {
            video.width = video.videoWidth;
            video.height = video.videoHeight;
          };
          await video.play();
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((device) => device.kind === "videoinput");

        if (select) {
          select.innerHTML = "";

          if (videoDevices.length === 0) {
            const option = document.createElement("option");
            option.text = "No Camera Found";
            select.appendChild(option);
          }

          videoDevices.forEach((device, index) => {
            const option = document.createElement("option");
            option.value = device.deviceId;
            option.text = device.label || `Camera ${index + 1}`;
            select.appendChild(option);
          });

          const activeTrack = stream.getVideoTracks()[0];
          if (activeTrack) {
            const settings = activeTrack.getSettings();
            if (settings.deviceId) {
              select.value = settings.deviceId;
              currentDeviceId = settings.deviceId;
            }
          }
        }

        isProcessing = true;
        cameraActive = true;
        processFrame();

        setTimeout(() => {
          if (calibrationOverlay) calibrationOverlay.style.display = "none";
        }, 2500);

        if (select) {
          select.addEventListener("change", (e) => {
            const target = e.target as HTMLSelectElement;
            if (target.value) {
              startCamera(target.value);
            }
          });
        }
      } catch (err: any) {
        console.error("Error initializing camera system:", err);
        if (calibrationOverlay) calibrationOverlay.style.display = "none";
        if (loadingOverlay) {
          loadingOverlay.style.display = "flex";
          loadingOverlay.innerHTML = `
              <div class="loading-text" style="color:#ff003c;text-shadow:0 0 10px #ff003c;">Camera Not Found</div>
              <div style="color:#888;margin-top:10px;text-align:center;font-size:14px;font-family:sans-serif;">
                ${err.name}: ${err.message}<br>Check permissions or connectivity.
              </div>
              <button id="fallback-play-btn" style="
                margin-top: 30px;
                padding: 12px 24px;
                background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 0 15px rgba(236,72,153,0.5);
                font-family: sans-serif;
              ">
                PLAY WITH TOUCH / KEYBOARD
              </button>
          `;
          const fallbackBtn = document.getElementById("fallback-play-btn");
          if (fallbackBtn) {
            fallbackBtn.onclick = () => {
              loadingOverlay.style.display = "none";
              if (modeIndicator) modeIndicator.textContent = "TOUCH / KEYBOARD";
            };
          }
        }
        if (modeIndicator) modeIndicator.textContent = "TOUCH / KEYBOARD";
      }
    }

    async function startCamera(deviceId: string) {
      const oldStream = video ? (video.srcObject as MediaStream) : null;
      const oldDeviceId = currentDeviceId;

      try {
        if (calibrationOverlay) calibrationOverlay.style.display = "flex";
        if (loadingOverlay) loadingOverlay.style.display = "none";

        const constraints = {
          video: {
            width: 640,
            height: 480,
            deviceId: deviceId ? { exact: deviceId } : undefined,
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (oldStream) {
          oldStream.getTracks().forEach((track) => track.stop());
        }

        if (video) {
          video.srcObject = stream;
          currentDeviceId = deviceId;
          video.onloadedmetadata = () => {
            video.width = video.videoWidth;
            video.height = video.videoHeight;
          };
          await video.play();
        }

        isProcessing = false;
        if (!isProcessing) {
          isProcessing = true;
          cameraActive = true;
          processFrame();
        }

        setTimeout(() => {
          if (calibrationOverlay) calibrationOverlay.style.display = "none";
        }, 2500);
      } catch (err: any) {
        console.error("Camera switch error:", err);
        if (calibrationOverlay) calibrationOverlay.style.display = "none";

        if (oldStream && oldStream.active) {
          if (video) {
            video.srcObject = oldStream;
            video.play().catch(console.error);
          }
          if (oldDeviceId && select) {
            select.value = oldDeviceId;
          }

          const toast = document.createElement("div");
          toast.style.cssText =
            "position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#ff4444;color:#fff;padding:10px 20px;border-radius:8px;z-index:9999;";
          toast.textContent = `Camera "${select ? select.options[select.selectedIndex]?.text : deviceId}" unavailable`;
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 3000);
        } else {
          if (loadingOverlay) {
            loadingOverlay.style.display = "flex";
            loadingOverlay.innerHTML = `
                <div class="loading-text">Camera Unavailable</div>
                <div style="color:#888;margin-top:20px;">${err.name}: ${err.message}<br>Using keyboard fallback</div>
            `;
          }
          if (modeIndicator) modeIndicator.textContent = "KEYBOARD MODE";
          setTimeout(() => {
            if (loadingOverlay) loadingOverlay.style.display = "none";
          }, 3000);
        }
      }
    }

    let frameCount = 0;
    async function processFrame() {
      if (!isProcessing || !previewCtx || !previewCanvas) return;
      if (video && video.readyState >= 2) {
        previewCtx.drawImage(video, 0, 0, previewCanvas.width, previewCanvas.height);

        if (lastFaceLandmarks) {
          drawFaceMask(lastFaceLandmarks);
        }

        if (swordActive && lastHand) {
          drawHandOnPreview(lastHand);
        }

        try {
          frameCount++;
          if (frameCount & 1) {
            await hands.send({ image: video });
          } else {
            await faceMesh.send({ image: video });
          }
        } catch (e) {
          console.error("Tracking error:", e);
        }
      }

      if (isProcessing) {
        requestAnimationFrame(processFrame);
      }
    }

    // UI overlays on webcam feed
    function drawHandOnPreview(hand: any) {
      if (!previewCtx || !previewCanvas) return;
      const wrist = hand[0];
      const middle = hand[9];

      const bx = wrist.x * previewCanvas.width;
      const by = wrist.y * previewCanvas.height;

      const dx = middle.x - wrist.x;
      const dy = middle.y - wrist.y;

      const swordLen = 5.5;
      const tx = (wrist.x + dx * swordLen) * previewCanvas.width;
      const ty = (wrist.y + dy * swordLen) * previewCanvas.height;

      previewCtx.save();
      previewCtx.lineCap = "round";

      // Electric core beam - cyan glow
      previewCtx.shadowBlur = 25;
      previewCtx.shadowColor = "#06b6d4";
      previewCtx.beginPath();
      previewCtx.moveTo(bx, by);
      previewCtx.lineTo(tx, ty);
      previewCtx.lineWidth = 10;
      previewCtx.strokeStyle = "rgba(6, 182, 212, 0.6)";
      previewCtx.stroke();

      // White core
      previewCtx.shadowBlur = 10;
      previewCtx.shadowColor = "#ffffff";
      previewCtx.beginPath();
      previewCtx.moveTo(bx, by);
      previewCtx.lineTo(tx, ty);
      previewCtx.lineWidth = 3;
      previewCtx.strokeStyle = "#ffffff";
      previewCtx.stroke();

      // Lightning branches
      for (let i = 0; i < 4; i++) {
        const t = 0.2 + Math.random() * 0.6;
        const px = bx + (tx - bx) * t;
        const py = by + (ty - by) * t;
        const angle = Math.random() * Math.PI * 2;
        const branchLen = 15 + Math.random() * 20;
        const ex = px + Math.cos(angle) * branchLen;
        const ey = py + Math.sin(angle) * branchLen;

        previewCtx.shadowBlur = 8;
        previewCtx.shadowColor = "#06b6d4";
        previewCtx.beginPath();
        previewCtx.moveTo(px, py);
        previewCtx.lineTo(ex, ey);
        previewCtx.lineWidth = 1;
        previewCtx.strokeStyle = "#0ff";
        previewCtx.stroke();
      }

      // Sparks
      for (let i = 0; i < 3; i++) {
        const t = Math.random();
        const sx = bx + (tx - bx) * t + (Math.random() - 0.5) * 10;
        const sy = by + (ty - by) * t + (Math.random() - 0.5) * 10;

        previewCtx.beginPath();
        previewCtx.arc(sx, sy, 2 + Math.random() * 2, 0, Math.PI * 2);
        previewCtx.fillStyle = Math.random() > 0.5 ? "#fff" : "#0ff";
        previewCtx.fill();
      }

      previewCtx.restore();
    }

    function drawFaceMask(landmarks: any) {
      if (!landmarks || landmarks.length < 10 || !previewCtx || !previewCanvas) return;

      const canvasW = previewCanvas.width;
      const canvasH = previewCanvas.height;

      let minX = 1, maxX = 0, minY = 1, maxY = 0;
      const facePoints = [10, 152, 234, 454];
      for (let i = 0; i < 4; i++) {
        const lm = landmarks[facePoints[i]];
        const lmX = lm.x;
        const lmY = lm.y;
        if (lmX < minX) minX = lmX;
        if (lmX > maxX) maxX = lmX;
        if (lmY < minY) minY = lmY;
        if (lmY > maxY) maxY = lmY;
      }

      const padding = 0.03;
      minX = minX > padding ? minX - padding : 0;
      maxX = maxX < 1 - padding ? maxX + padding : 1;
      minY = minY > padding ? minY - padding : 0;
      maxY = maxY < 1 - padding ? maxY + padding : 1;

      const x = minX * canvasW;
      const y = minY * canvasH;
      const w = (maxX - minX) * canvasW;
      const h = (maxY - minY) * canvasH;
      const cornerSize = 10;

      previewCtx.save();
      previewCtx.strokeStyle = "#06b6d4";
      previewCtx.shadowBlur = 10;
      previewCtx.shadowColor = "#06b6d4";

      previewCtx.lineWidth = 2;
      previewCtx.strokeRect(x, y, w, h);

      previewCtx.lineWidth = 3;
      previewCtx.beginPath();
      // TL
      previewCtx.moveTo(x, y + cornerSize);
      previewCtx.lineTo(x, y);
      previewCtx.lineTo(x + cornerSize, y);
      // TR
      previewCtx.moveTo(x + w - cornerSize, y);
      previewCtx.lineTo(x + w, y);
      previewCtx.lineTo(x + w, y + cornerSize);
      // BL
      previewCtx.moveTo(x, y + h - cornerSize);
      previewCtx.lineTo(x, y + h);
      previewCtx.lineTo(x + cornerSize, y + h);
      // BR
      previewCtx.moveTo(x + w - cornerSize, y + h);
      previewCtx.lineTo(x + w, y + h);
      previewCtx.lineTo(x + w, y + h - cornerSize);
      previewCtx.stroke();

      previewCtx.restore();
    }

    // GAME STATE & MECHANICS
    function startGame() {
      state = "GAME";
      score = 0;
      coins = 0;
      lives = 3;
      speed = 28;
      zPos = 0;
      runTime = 0;
      combo = 0;
      comboTimer = 0;
      maxCombo = 0;
      targetLane = 0;
      laneX = -1;
      yPos = 0;
      yVel = 0;
      isJumping = false;
      obstacles = [];
      birds = [];
      nextSpawnZ = 50;
      particles = [];
      screenShake = 0;
      hitStop = 0;
      floatingTexts = [];
    }

    function triggerGameOver() {
      state = "GAME_OVER";
      playSound("gameover");
      if (score > highScore) {
        highScore = score;
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("void_runner_highscore", Math.floor(highScore).toString());
          } catch (e) {
            console.error("Failed to save high score:", e);
          }
        }
      }
    }

    function spawnFloatingText(x: number, y: number, text: string) {
      floatingTexts.push({ x, y, text, life: 1.0 });
    }

    // Delegate projection to the imported modular math utility
    function project(x: number, y: number, z: number, camX: number, camY: number, camZ: number) {
      if (!gameCanvas) return null;
      return projectUtil(x, y, z, camX, camY, camZ, gameCanvas.width, gameCanvas.height);
    }

    // Physics & Logic Update Loop
    function update(dt: number) {
      runTime += dt;
      pulsePhase += dt * 4;

      if (screenShake > 0) {
        screenShake -= dt * 2;
        if (screenShake < 0) screenShake = 0;
      }

      if (hitStop > 0) {
        hitStop -= dt;
        return; // Pause execution during freeze-frames
      }

      // Update Floating HUD texts in-place (avoid GC allocations)
      let activeTexts = 0;
      for (let i = 0; i < floatingTexts.length; i++) {
        const t = floatingTexts[i];
        t.y -= 50 * dt;
        t.life -= dt;
        if (t.life > 0) {
          floatingTexts[activeTexts++] = t;
        }
      }
      floatingTexts.length = activeTexts;

      // Starfield
      for (const s of starfield) {
        s.z -= speed * dt * 0.8;
        if (s.z < 0) {
          s.z = 120;
          s.x = (Math.random() - 0.5) * 30;
          s.y = Math.random() * 10 - 2;
        }
      }

      if (combo > 0) {
        comboTimer -= dt;
        if (comboTimer <= 0) combo = 0;
      }

      // Particles in-place update (avoid GC allocations)
      let activeParticles = 0;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life > 0) {
          particles[activeParticles++] = p;
        }
      }
      particles.length = activeParticles;

      if (state !== "GAME") return;

      // Keyboard movement inputs
      if (keys["ArrowLeft"] || keys["KeyA"]) targetLane = 0;
      if (keys["ArrowRight"] || keys["KeyD"]) targetLane = 1;
      if ((keys["ArrowUp"] || keys["Space"] || keys["KeyW"]) && !isJumping) {
        yVel = JUMP_FORCE;
        isJumping = true;
        playSound("jump");
      }

      speed = 28 + runTime * 0.5;
      zPos += speed * dt;
      score += speed * dt;

      const targetX = (targetLane - 0.5) * LANE_WIDTH;
      laneX += (targetX - laneX) * 20 * dt;

      if (isJumping) {
        yPos += yVel * dt;
        yVel -= GRAVITY * dt;
        if (yPos <= 0) {
          yPos = 0;
          isJumping = false;
          yVel = 0;
        }
      }

      // Aggressive flying enemy tracking (sword mode only)
      const playerX = laneX;
      const headHeight = yPos + 4;
      for (const b of birds) {
        if (!b.active) continue;
        b.z -= 120 * dt;
        if (b.z > zPos) {
          const distFactor = Math.max(0.1, (b.z - zPos) / 30);
          b.x += (playerX - b.x) * (15 / distFactor) * dt;
          b.y += (headHeight - b.y) * (10 / distFactor) * dt;
        }
      }

      // Obstacle Spawner
      if (zPos + 100 > nextSpawnZ) {
        const spawnLane = Math.random() < 0.5 ? 0 : 1;
        if (Math.random() < 0.6) {
          const type = Math.random() < 0.5 ? "train" : "coin";
          if (type === "train") {
            obstacles.push({ z: zPos + 120, lane: spawnLane, type: "train", active: true });
          } else {
            for (let i = 0; i < 5; i++) {
              obstacles.push({ z: zPos + 120 + i * 3, lane: spawnLane, type: "coin", active: true });
            }
          }
          nextSpawnZ += 30;
        } else {
          nextSpawnZ += 15;
        }

        if (gameMode === "SWORD" && Math.random() < 0.4) {
          const bLane = Math.random() < 0.5 ? 0 : 1;
          birds.push({
            z: zPos + 120 + Math.random() * 50,
            lane: bLane,
            x: (bLane - 0.5) * LANE_WIDTH + (Math.random() - 0.5) * 20,
            y: 5 + Math.random() * 10,
            active: true,
          });
        }
      }

      // Obstacles in-place filter (avoid GC allocations)
      let activeObstacles = 0;
      for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        if (o.z > zPos - 10) {
          obstacles[activeObstacles++] = o;
        }
      }
      obstacles.length = activeObstacles;

      // Birds in-place filter (avoid GC allocations)
      let activeBirds = 0;
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i];
        if (b.z > zPos - 10) {
          birds[activeBirds++] = b;
        }
      }
      birds.length = activeBirds;

      // Collisions - Obstacles
      for (const obs of obstacles) {
        if (!obs.active) continue;
        const dist = obs.z - zPos;
        if (dist > 0 && dist < 1.5 && obs.lane === targetLane) {
          if (obs.type === "train" && yPos < 1.5) {
            lives--;
            obs.active = false;
            screenShake = 0.5;
            playSound("damage");
            spawnParticles(laneX, yPos + 2, 20, GLITCH_RED);
            if (lives <= 0) {
              triggerGameOver();
            }
          } else if (obs.type === "coin") {
            coins++;
            score += 50;
            obs.active = false;
            playSound("coin");
          }
        }
      }

      // Collisions - Birds (Laser sword hit check)
      for (const bird of birds) {
        if (!bird.active) continue;
        const dist = bird.z - zPos;

        if (dist > 0 && dist < 1) {
          bird.active = false;
          lives--;
          combo = 0;
          screenShake = 0.5;
          playSound("damage");
          spawnParticles(bird.x, bird.y, 30, GLITCH_RED);
          if (lives <= 0) {
            triggerGameOver();
          }
        }

        // Sword slashing collisions
        if (swordActive && dist > 0 && dist < 25) {
          const camX = laneX * 0.8;
          const camY = yPos + 2;
          const bScreen = project(bird.x, bird.y, bird.z, camX, camY, zPos);

          if (bScreen && swordBase && swordTip) {
            const sx1 = swordBase.x * gameCanvas!.width;
            const sy1 = swordBase.y * gameCanvas!.height;
            const sx2 = swordTip.x * gameCanvas!.width;
            const sy2 = swordTip.y * gameCanvas!.height;

            const hitDist = pointLineDistance(bScreen.x, bScreen.y, sx1, sy1, sx2, sy2);
            const threshold = 100 + (25 / (dist + 0.1)) * 10;

            if (hitDist < threshold) {
              bird.active = false;
              combo++;
              comboTimer = 2;
              if (combo > maxCombo) maxCombo = combo;

              const multiplier = Math.min(combo, 5);
              score += 100 * multiplier;

              playSound("slash");
              if (combo >= 3) playSound("combo");
              screenShake = 0.15 + combo * 0.05;
              hitStop = 0.03 + combo * 0.02;

              spawnParticles(bird.x, bird.y, 20 + combo * 5, ELECTRIC_VIOLET);

              if (combo >= 5) {
                spawnFloatingText(bScreen.x, bScreen.y, `${combo}x COMBO!`);
              } else if (combo >= 3) {
                spawnFloatingText(bScreen.x, bScreen.y, `${combo}x CHAIN!`);
              } else {
                spawnFloatingText(bScreen.x, bScreen.y, "SLICED!");
              }
            }
          }
        }
      }
    }

    function spawnParticles(x: number, y: number, count: number, color: string) {
      for (let i = 0; i < count; i++) {
        particles.push({
          x: gameCanvas.width / 2 + x * 50,
          y: gameCanvas.height / 2 - y * 50,
          vx: (Math.random() - 0.5) * 300,
          vy: (Math.random() - 0.5) * 300,
          life: 0.5 + Math.random() * 0.3,
          color,
        });
      }
    }



    // Canvas drawing
    function draw() {
      if (!ctx) return;
      ctx.save();
      if (screenShake > 0) {
        const dx = (Math.random() - 0.5) * screenShake * 30;
        const dy = (Math.random() - 0.5) * screenShake * 30;
        ctx.translate(dx, dy);
      }

      // Background
      const gradient = ctx.createLinearGradient(0, 0, 0, gameCanvas.height);
      gradient.addColorStop(0, VOID_BLACK);
      gradient.addColorStop(1, DEEP_PURPLE);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

      // Starfield
      for (const s of starfield) {
        const sx = gameCanvas.width / 2 + s.x * 50;
        const sy = gameCanvas.height / 2 + s.y * 50;
        const b = 100 + 50 * Math.sin(runTime * 2 + s.z);
        ctx.fillStyle = `rgb(${b}, ${b}, ${b + 50})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      if (state === "MENU") drawMenu();
      else if (state === "TUTORIAL") drawTutorial();
      else if (state === "GAME") {
        drawWorld();
        drawSword();
        drawSpeedLines();
        drawHUD();
        drawFloatingTexts();
      } else if (state === "GAME_OVER") drawGameOver();

      updateMobileButton();

      // Draw Particles
      for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // DRAW MENU
    function drawMenu() {
      ctx.textAlign = "center";
      const isMobile = gameCanvas.width < 768;
      const titleSize = isMobile ? 42 : 72;
      const subSize = isMobile ? 18 : 28;
      const btnFont = isMobile ? 16 : 24;
      const bw = isMobile ? 160 : 240;
      const bh = isMobile ? 45 : 60;

      ctx.fillStyle = ELECTRIC_VIOLET;
      ctx.font = `bold ${titleSize}px Impact`;
      ctx.fillText("VOID RUNNER", gameCanvas.width / 2, gameCanvas.height / 2 - (isMobile ? 120 : 180));

      ctx.fillStyle = HOT_PINK;
      ctx.font = `bold ${subSize}px Impact`;
      ctx.fillText("FEEL THE VOID", gameCanvas.width / 2, gameCanvas.height / 2 - (isMobile ? 85 : 130));

      const cx = gameCanvas.width / 2;
      const cy = gameCanvas.height / 2;

      let b1x, b1y, b2x, b2y;
      if (isMobile) {
        b1x = cx - bw / 2;
        b1y = cy - bh - 10;
        b2x = cx - bw / 2;
        b2y = cy + 10;
      } else {
        b1x = cx - bw - 20;
        b1y = cy;
        b2x = cx + 20;
        b2y = cy;
      }

      normalBtnRect = { x: b1x, y: b1y, w: bw, h: bh };
      swordBtnRect = { x: b2x, y: b2y, w: bw, h: bh };

      // Normal mode button
      ctx.fillStyle = NEON_CYAN;
      ctx.globalAlpha = 0.2;
      ctx.fillRect(b1x, b1y, bw, bh);
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = NEON_CYAN;
      ctx.lineWidth = 2;
      ctx.strokeRect(b1x, b1y, bw, bh);
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${btnFont}px Impact`;
      ctx.fillText("NORMAL MODE", b1x + bw / 2, b1y + (isMobile ? 30 : 38));

      // Sword mode button
      ctx.fillStyle = ELECTRIC_VIOLET;
      ctx.globalAlpha = 0.2;
      ctx.fillRect(b2x, b2y, bw, bh);
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = ELECTRIC_VIOLET;
      ctx.lineWidth = 2;
      ctx.strokeRect(b2x, b2y, bw, bh);
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${btnFont}px Impact`;
      ctx.fillText("SWORD MODE", b2x + bw / 2, b2y + (isMobile ? 30 : 38));

      // Draw High Score on Menu
      ctx.fillStyle = GOLD;
      ctx.font = `bold ${subSize}px Impact`;
      ctx.fillText(`HIGH SCORE: ${Math.floor(highScore)}`, gameCanvas.width / 2, gameCanvas.height / 2 + (isMobile ? 120 : 150));
    }

    function drawTutorial() {
      ctx.textAlign = "center";
      const isMobile = gameCanvas.width < 768;
      const titleSize = isMobile ? 36 : 52;
      const subSize = isMobile ? 22 : 32;
      const instructionTitleSize = isMobile ? 16 : 24;
      const instructionDescSize = isMobile ? 12 : 16;
      const lineHeight = isMobile ? 45 : 65;

      ctx.fillStyle = NEON_CYAN;
      ctx.font = `bold ${titleSize}px Impact`;
      ctx.fillText("TUTORIAL", gameCanvas.width / 2, isMobile ? 50 : 80);

      const modeColor = gameMode === "SWORD" ? ELECTRIC_VIOLET : NEON_CYAN;
      ctx.fillStyle = modeColor;
      ctx.font = `bold ${subSize}px Impact`;
      ctx.fillText(gameMode + " MODE", gameCanvas.width / 2, isMobile ? 85 : 130);

      let instructions: [string, string, string][] = [];
      if (cameraActive) {
        instructions =
          gameMode === "SWORD"
            ? [
                ["Move LEFT/RIGHT", "Switch lanes", NEON_CYAN],
                ["Head ABOVE threshold", "Jump over trains!", SUNSET_ORANGE],
                ["Show hand", "Summon laser!", ELECTRIC_VIOLET],
                ["Slash enemies", "Build combos!", HOT_PINK],
                ["3 Lives", "Be careful!", GLITCH_RED],
              ]
            : [
                ["Look LEFT/RIGHT", "Switch lanes", NEON_CYAN],
                ["Head ABOVE threshold", "Jump!", SUNSET_ORANGE],
                ["Avoid obstacles", "Or switch lanes!", GLITCH_RED],
                ["Collect Coins", "Score bonus!", GOLD],
                ["3 Lives", "Be careful!", HOT_PINK],
              ];
      } else {
        const isTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (isTouchScreen) {
          instructions =
            gameMode === "SWORD"
              ? [
                  ["Swipe on screen", "Slice incoming enemies!", ELECTRIC_VIOLET],
                  ["Avoid obstacles", "Or switch lanes!", GLITCH_RED],
                  ["Build combos", "Score higher!", HOT_PINK],
                  ["3 Lives", "Be careful!", GLITCH_RED],
                ]
              : [
                  ["Tap LEFT/RIGHT side", "Switch lanes", NEON_CYAN],
                  ["Tap TOP half", "Jump over obstacles!", SUNSET_ORANGE],
                  ["Avoid obstacles", "Do not crash!", GLITCH_RED],
                  ["Collect Coins", "Score bonus!", GOLD],
                  ["3 Lives", "Be careful!", HOT_PINK],
                ];
        } else {
          instructions =
            gameMode === "SWORD"
              ? [
                  ["Press A/D or Left/Right", "Switch lanes", NEON_CYAN],
                  ["Press W / Space", "Jump over obstacles!", SUNSET_ORANGE],
                  ["Camera Off", "Sword slashing disabled", ELECTRIC_VIOLET],
                  ["3 Lives", "Be careful!", GLITCH_RED],
                ]
              : [
                  ["Press A/D or Left/Right", "Switch lanes", NEON_CYAN],
                  ["Press W / Space", "Jump over obstacles!", SUNSET_ORANGE],
                  ["Avoid obstacles", "Do not crash!", GLITCH_RED],
                  ["Collect Coins", "Score bonus!", GOLD],
                  ["3 Lives", "Be careful!", HOT_PINK],
                ];
        }
      }

      let y = isMobile ? 120 : 180;
      for (const [title, desc, color] of instructions) {
        ctx.fillStyle = color;
        ctx.font = `bold ${instructionTitleSize}px Arial`;
        ctx.fillText(title, gameCanvas.width / 2, y);
        ctx.fillStyle = "#aaa";
        ctx.font = `${instructionDescSize}px Arial`;
        ctx.fillText(desc, gameCanvas.width / 2, y + (isMobile ? 18 : 25));
        y += lineHeight;
      }
    }

    function drawSpeedLines() {
      const speedFactor = Math.min(1, (speed - 28) / 30);
      const numLines = Math.floor(20 * speedFactor);
      for (let i = 0; i < numLines; i++) {
        const angle = Math.random() * Math.PI * 2;
        const len = (50 + Math.random() * 100) * speedFactor;
        const startDist = 100 + Math.random() * 200;
        const sx = gameCanvas.width / 2 + Math.cos(angle) * startDist;
        const sy = gameCanvas.height / 2 + Math.sin(angle) * startDist;
        const ex = gameCanvas.width / 2 + Math.cos(angle) * (startDist + len);
        const ey = gameCanvas.height / 2 + Math.sin(angle) * (startDist + len);
        ctx.strokeStyle = `rgba(150, 150, 200, ${0.4 * speedFactor})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    }

    function drawFloatingTexts() {
      for (const t of floatingTexts) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 24px Impact";
        ctx.textAlign = "center";
        ctx.globalAlpha = t.life;
        ctx.fillText(t.text, t.x, t.y);
        ctx.globalAlpha = 1;
      }
    }

    function drawGameOver() {
      ctx.textAlign = "center";
      const isMobile = gameCanvas.width < 768;
      const titleSize = isMobile ? 36 : 64;
      const scoreSize = isMobile ? 22 : 36;
      const lineSpacing = isMobile ? 35 : 45;
      const startY = isMobile ? gameCanvas.height / 2 - 100 : gameCanvas.height / 2 - 80;

      ctx.fillStyle = GLITCH_RED;
      ctx.font = `bold ${titleSize}px Impact`;
      ctx.fillText("VOID COLLAPSE", gameCanvas.width / 2, startY);

      ctx.fillStyle = GOLD;
      ctx.font = `bold ${scoreSize}px Impact`;
      ctx.fillText(`DISTANCE: ${Math.floor(score)}`, gameCanvas.width / 2, startY + lineSpacing);
      ctx.fillText(`MAX COMBO: ${maxCombo}x`, gameCanvas.width / 2, startY + lineSpacing * 2);
      ctx.fillText(`COINS: ${coins}`, gameCanvas.width / 2, startY + lineSpacing * 3);

      ctx.fillStyle = NEON_CYAN;
      ctx.fillText(`HIGH SCORE: ${Math.floor(highScore)}`, gameCanvas.width / 2, startY + lineSpacing * 4);

      if (!isMobile) {
        ctx.fillStyle = NEON_CYAN;
        const pulse = 0.7 + 0.3 * Math.sin(runTime * 5);
        ctx.globalAlpha = pulse;
        ctx.font = "bold 24px Impact";
        ctx.fillText("PRESS SPACE TO RESTART", gameCanvas.width / 2, gameCanvas.height / 2 + 160);
        ctx.globalAlpha = 1;
      }
    }

    function drawWorld() {
      const camX = laneX * 0.8;
      const camY = yPos + 2;
      const camZ = zPos;
      const pulse = 0.7 + 0.3 * Math.sin(pulsePhase);

      // Perspective Grid
      const gridSpacing = 10;
      const startZ = Math.floor(camZ / gridSpacing) * gridSpacing;

      for (let z = startZ; z < startZ + 200; z += gridSpacing) {
        const pL = project(-50, 0, z, camX, camY, camZ);
        const pR = project(50, 0, z, camX, camY, camZ);
        if (pL && pR) {
          const fade = Math.max(0.2, 1 - (z - camZ) / 150);
          ctx.strokeStyle = `rgba(236, 72, 153, ${fade * pulse})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(pL.x, pL.y);
          ctx.lineTo(pR.x, pR.y);
          ctx.stroke();
        }
      }

      for (let x = -20; x <= 20; x += 5) {
        const pS = project(x, 0, camZ + 1, camX, camY, camZ);
        const pE = project(x, 0, camZ + 200, camX, camY, camZ);
        if (pS && pE) {
          ctx.strokeStyle = "rgba(139, 92, 246, 0.4)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pS.x, pS.y);
          ctx.lineTo(pE.x, pE.y);
          ctx.stroke();
        }
      }

      // Rails
      for (let l = 0; l < 2; l++) {
        const xC = (l - 0.5) * LANE_WIDTH;
        const rOff = LANE_WIDTH * 0.3;
        const pLS = project(xC - rOff, 0, camZ + 1, camX, camY, camZ);
        const pLE = project(xC - rOff, 0, camZ + 100, camX, camY, camZ);
        const pRS = project(xC + rOff, 0, camZ + 1, camX, camY, camZ);
        const pRE = project(xC + rOff, 0, camZ + 100, camX, camY, camZ);
        if (pLS && pLE) {
          ctx.strokeStyle = "#ff00ff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(pLS.x, pLS.y);
          ctx.lineTo(pLE.x, pLE.y);
          ctx.stroke();
        }
        if (pRS && pRE) {
          ctx.beginPath();
          ctx.moveTo(pRS.x, pRS.y);
          ctx.lineTo(pRE.x, pRE.y);
          ctx.stroke();
        }
      }

      // Obstacles
      const visObs = obstacles.filter((o) => o.z > camZ && o.active).sort((a, b) => b.z - a.z);
      for (const obs of visObs) {
        if (obs.type === "train") drawTrain(obs.lane, obs.z, camX, camY, camZ);
        else if (obs.type === "coin") drawCoin(obs.lane, obs.z, camX, camY, camZ);
      }

      // Birds
      for (const b of birds.filter((b) => b.active && b.z > camZ)) {
        drawBird(b, camX, camY, camZ);
      }
    }

    function drawTrain(lane: number, zWorld: number, camX: number, camY: number, camZ: number) {
      const xWorld = (lane - 0.5) * LANE_WIDTH;
      const w = LANE_WIDTH * 0.9, h = 2.5;
      const p1 = project(xWorld - w / 2, 0, zWorld, camX, camY, camZ);
      const p2 = project(xWorld + w / 2, 0, zWorld, camX, camY, camZ);
      const p3 = project(xWorld + w / 2, h, zWorld, camX, camY, camZ);
      const p4 = project(xWorld - w / 2, h, zWorld, camX, camY, camZ);
      if (p1 && p2 && p3 && p4) {
        ctx.fillStyle = "#2d1f4d";
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = HOT_PINK;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Train Front Window
        const wp1 = project(xWorld - w / 4, h * 0.4, zWorld - 0.05, camX, camY, camZ);
        const wp2 = project(xWorld + w / 4, h * 0.4, zWorld - 0.05, camX, camY, camZ);
        const wp3 = project(xWorld + w / 4, h * 0.75, zWorld - 0.05, camX, camY, camZ);
        const wp4 = project(xWorld - w / 4, h * 0.75, zWorld - 0.05, camX, camY, camZ);
        if (wp1 && wp2 && wp3 && wp4) {
          ctx.fillStyle = NEON_CYAN;
          ctx.beginPath();
          ctx.moveTo(wp1.x, wp1.y);
          ctx.lineTo(wp2.x, wp2.y);
          ctx.lineTo(wp3.x, wp3.y);
          ctx.lineTo(wp4.x, wp4.y);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    function drawCoin(lane: number, zWorld: number, camX: number, camY: number, camZ: number) {
      const xWorld = (lane - 0.5) * LANE_WIDTH;
      const rot = (runTime * 5 + zWorld) % (Math.PI * 2);
      const w = 0.5 * Math.abs(Math.cos(rot));
      const h = 0.5, yOff = 1;
      const p1 = project(xWorld - w, yOff - h, zWorld, camX, camY, camZ);
      const p2 = project(xWorld + w, yOff - h, zWorld, camX, camY, camZ);
      const p3 = project(xWorld + w, yOff + h, zWorld, camX, camY, camZ);
      const p4 = project(xWorld - w, yOff + h, zWorld, camX, camY, camZ);
      if (p1 && p2 && p3 && p4) {
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    function drawBird(b: Bird, camX: number, camY: number, camZ: number) {
      const p = project(b.x, b.y, b.z, camX, camY, camZ);
      if (!p) return;
      const dist = b.z - zPos;
      let size = 40 * (30 / Math.max(1, dist));
      if (dist < 10) size = 80 * (30 / Math.max(1, dist));
      if (dist < 5) size = 150 * (30 / Math.max(1, dist));

      const jitter = 5;
      const p1 = [p.x + (Math.random() - 0.5) * jitter, p.y - size + (Math.random() - 0.5) * jitter];
      const p2 = [p.x - size / 2 + (Math.random() - 0.5) * jitter, p.y + size / 2 + (Math.random() - 0.5) * jitter];
      const p3 = [p.x + size / 2 + (Math.random() - 0.5) * jitter, p.y + size / 2 + (Math.random() - 0.5) * jitter];

      ctx.fillStyle = "#320032";
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.lineTo(p3[0], p3[1]);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = Math.random() < 0.1 ? "#fff" : HOT_PINK;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = NEON_CYAN;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size / 4, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawSword() {
      if (gameMode !== "SWORD") return;
      if (!swordActive || !swordBase || !swordTip) return;

      const bx = swordBase.x * gameCanvas.width;
      const by = swordBase.y * gameCanvas.height;
      const tx = swordTip.x * gameCanvas.width;
      const ty = swordTip.y * gameCanvas.height;

      swordTrail.push({ x: tx, y: ty });
      if (swordTrail.length > 15 + combo * 2) swordTrail.shift();

      // Render neon blade trail
      for (let i = 0; i < swordTrail.length - 1; i++) {
        const progress = i / swordTrail.length;
        const width = 3 + 12 * progress;
        const r = Math.floor(30 + (236 - 30) * progress);
        const g = Math.floor(27 + (72 - 27) * progress);
        const b = Math.floor(75 + (153 - 75) * progress);
        ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(swordTrail[i].x, swordTrail[i].y);
        ctx.lineTo(swordTrail[i + 1].x, swordTrail[i + 1].y);
        ctx.stroke();
      }

      // Jittery laser core
      const segments = 12;
      const jitter = 8 + combo * 3;
      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        let px = bx + (tx - bx) * t;
        let py = by + (ty - by) * t;
        if (i > 0 && i < segments) {
          const len = Math.hypot(tx - bx, ty - by);
          if (len > 0) {
            const perpX = -(ty - by) / len;
            const perpY = (tx - bx) / len;
            const off = (Math.random() - 0.5) * jitter * 2;
            px += perpX * off;
            py += perpY * off;
          }
        }
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      ctx.strokeStyle = DEEP_PURPLE;
      ctx.lineWidth = 18;
      ctx.stroke();
      ctx.strokeStyle = ELECTRIC_VIOLET;
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.strokeStyle = HOT_PINK;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    function drawHUD() {
      const isMobile = gameCanvas.width < 768;
      
      const scoreFontSize = isMobile ? 32 : 42;
      const coinFontSize = isMobile ? 18 : 24;
      const comboFontSize = isMobile ? 36 : 48;
      const speedFontSize = isMobile ? 14 : 20;
      const jumpFontSize = isMobile ? 32 : 48;
      
      const scoreY = isMobile ? 35 : 45;
      const coinY = isMobile ? 60 : 75;
      const livesY = isMobile ? 80 : 105;
      const livesSpacing = isMobile ? 22 : 35;
      const livesRadius = isMobile ? 7 : 10;
      
      // Lives
      const startX = gameCanvas.width / 2 - livesSpacing;
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < lives ? GLITCH_RED : "#333";
        ctx.beginPath();
        ctx.arc(startX + i * livesSpacing, livesY, livesRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Score
      ctx.textAlign = "center";
      ctx.fillStyle = GOLD;
      ctx.font = `bold ${scoreFontSize}px Impact`;
      ctx.fillText(Math.floor(score).toLocaleString(), gameCanvas.width / 2, scoreY);

      // Coins
      ctx.font = `bold ${coinFontSize}px Arial`;
      ctx.fillStyle = "#ffd700";
      ctx.fillText(`COINS: ${coins} `, gameCanvas.width / 2, coinY);

      // Combos
      if (combo > 0) {
        ctx.fillStyle = combo >= 5 ? "#fb923c" : combo >= 3 ? HOT_PINK : ELECTRIC_VIOLET;
        ctx.font = `bold ${comboFontSize}px Impact`;
        ctx.fillText(`${combo}x COMBO!`, gameCanvas.width / 2, gameCanvas.height / 2 - 100);
      }

      // Speed
      ctx.textAlign = "left";
      ctx.font = `bold ${speedFontSize}px Arial`;
      ctx.fillStyle = NEON_CYAN;
      ctx.fillText(`${Math.floor(speed)} km / h`, isMobile ? 15 : 20, gameCanvas.height - (isMobile ? 15 : 20));

      // Jump text indicator
      if (isJumping) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#fb923c";
        ctx.font = `bold ${jumpFontSize}px Arial`;
        ctx.fillText("JUMP!", gameCanvas.width / 2, gameCanvas.height / 2 - 50);
      }
    }

    // GAME LOOP HOOKS
    let lastTime = 0;
    let animationFrameId = 0;
    function gameLoop(timestamp: number) {
      const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
      lastTime = timestamp;
      update(dt);
      draw();
      animationFrameId = requestAnimationFrame(gameLoop);
    }

    // Start everything
    initCameraSystem();
    animationFrameId = requestAnimationFrame(gameLoop);

    // CLEANUP MEMORY ON UNMOUNT (Essential Next.js page cleanup)
    return () => {
      isProcessing = false;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      gameCanvas.removeEventListener("click", handleCanvasClick);
      gameCanvas.removeEventListener("touchstart", handleTouchStart);
      gameCanvas.removeEventListener("touchmove", handleTouchMove);
      gameCanvas.removeEventListener("touchend", handleTouchEnd);
      if (backBtn) backBtn.removeEventListener("click", handleBackClick);
      if (mobileStartBtn) mobileStartBtn.removeEventListener("click", handleMobileStartClick);
      if (mobileMenuBtn) mobileMenuBtn.removeEventListener("click", handleMobileMenuClick);

      // Release video streams to close the camera light
      if (video && video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      if (previewVideo && previewVideo.srcObject) {
        const stream = previewVideo.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [scriptsReady]);

  return (
    <div className="game-page-container">
      {!scriptsReady && (
        <div className="loading-overlay" style={{ display: "flex", zIndex: 99999 }}>
          <div className="loading-text">Loading MediaPipe AI Libraries ({loadedCount}/4)...</div>
          <div className="loading-bar">
            <div
              className="loading-fill"
              style={{ width: `${(loadedCount / 4) * 100}%`, animation: "none" }}
            ></div>
          </div>
        </div>
      )}

      {/* MediaPipe Asynchronous script imports */}
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />

      <button ref={backBtnRef} className="back-btn" id="back-btn">
        BACK
      </button>
      <div ref={modeIndicatorRef} className="mode-indicator" id="mode-indicator">
        AI VR MODE
      </div>

      <div ref={loadingOverlayRef} className="loading-overlay" id="loading">
        <div className="loading-text">Loading Game...</div>
        <div className="loading-bar">
          <div className="loading-fill"></div>
        </div>
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

      <div className="camera-preview">
        <div className="camera-select-container">
          <select ref={cameraSelectRef} id="camera-select" defaultValue="">
            <option value="" disabled>
              Select Camera...
            </option>
          </select>
        </div>
        <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
          <span className="camera-label">CAMERA VIEW</span>
          <video ref={previewVideoRef} id="preview-video" autoPlay playsInline muted></video>
          <canvas ref={previewCanvasRef} id="preview-canvas"></canvas>
        </div>
      </div>

      <div ref={controlBoxRef} className="control-box" id="control-box">
        <div className="control-line"></div>
        <div className="vertical-line"></div>
        <div className="jump-line"></div>
        <div ref={controlDotRef} className="control-dot" id="control-dot"></div>
      </div>

      <button ref={mobileStartBtnRef} className="mobile-start-btn" id="mobile-start">
        START
      </button>
      <button ref={mobileMenuBtnRef} className="mobile-menu-btn" id="mobile-menu">
        MAIN MENU
      </button>

      <svg
        ref={swordSvgRef}
        className="sword-trail"
        id="sword-svg"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 50,
        }}
      ></svg>
    </div>
  );
}
