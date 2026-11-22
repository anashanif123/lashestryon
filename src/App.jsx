import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StylePicker from "./components/StylePicker.jsx";
import Adjustments from "./components/Adjustments.jsx";
import CompareAll from "./components/CompareAll.jsx";
import { analyseEyes } from "./lib/eyeShape.js";
import { LASH_STYLES, DEFAULT_ADJUSTMENTS } from "./lib/lashStyles.js";
import { getEyes } from "./lib/eyeGeometry.js";
import { drawLashes, drawDebugPoints } from "./lib/lashRenderer.js";
import { getLandmarker, detectImage, detectVideoFrame, setVideoMode } from "./lib/faceLandmarker.js";
import { BOOKING_URL, MAX_PHOTO_SIDE, SALON_NAME } from "./config.js";

// ---------- drawing helpers ----------

// view = the part of the image shown on the canvas ({ x, y, w, h } in image pixels, plus scale).
function drawScene(ctx, source, w, h, landmarks, opts, view = { x: 0, y: 0, w, h, scale: 1 }) {
  const { style, adj, compare, split, showPoints, mirror } = opts;
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const toView = () => ctx.setTransform(view.scale, 0, 0, view.scale, -view.x * view.scale, -view.y * view.scale);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);

  // The photo or camera frame
  ctx.save();
  toView();
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, w, h);
  ctx.restore();

  // Lashes (only on the "after" side when comparing)
  const eyes = getEyes(landmarks, w, h);
  if (eyes) {
    ctx.save();
    if (compare) {
      ctx.beginPath();
      ctx.rect(split * cw, 0, cw - split * cw, ch);
      ctx.clip();
    }
    toView();
    if (mirror) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    drawLashes(ctx, eyes, style, adj);
    if (showPoints) drawDebugPoints(ctx, landmarks, w, h);
    ctx.restore();
  }

  // Before / after divider (drawn in canvas pixels)
  if (compare) {
    const x = split * cw;
    const unit = Math.max(cw, ch) / 100;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = Math.max(2, unit * 0.35);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ch);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(x, ch / 2, unit * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `600 ${Math.round(unit * 2.4)}px Manrope, Arial, sans-serif`;
    ctx.textBaseline = "top";
    const pad = unit * 1.6;
    const label = (text, lx, align) => {
      ctx.textAlign = align;
      ctx.fillStyle = "rgba(20,12,16,0.55)";
      const tw = ctx.measureText(text).width;
      const bx = align === "left" ? lx : lx - tw;
      ctx.fillRect(bx - unit * 0.8, pad - unit * 0.6, tw + unit * 1.6, unit * 3.6);
      ctx.fillStyle = "#fff";
      ctx.fillText(text, lx, pad);
    };
    if (x > unit * 14) label("Before", x - pad, "right");
    if (cw - x > unit * 14) label("After", x + pad, "left");
    ctx.restore();
  }
}

// Area around the face, so the lashes are big enough to judge.
function faceView(landmarks, w, h) {
  const xs = landmarks.map((p) => p.x * w);
  const ys = landmarks.map((p) => p.y * h);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const fw = maxX - minX;
  const fh = maxY - minY;
  const x = Math.max(0, minX - fw * 0.25);
  const y = Math.max(0, minY - fh * 0.3);
  const vw = Math.min(w, maxX + fw * 0.25) - x;
  const vh = Math.min(h, maxY + fh * 0.15) - y;
  const scale = Math.min(2.5, Math.max(1, 1000 / vw));
  return { x, y, w: vw, h: vh, scale };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = url;
  });
}

function toScaledCanvas(source, sw, sh, maxSide, mirror = false) {
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d");
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// ---------- app ----------

export default function App() {
  const [mode, setMode] = useState("start"); // start | photo | camera
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [photo, setPhoto] = useState(null);
  const [landmarks, setLandmarks] = useState(null);
  const [styleId, setStyleId] = useState(LASH_STYLES[0].id);
  const [adj, setAdj] = useState(DEFAULT_ADJUSTMENTS);
  const [compare, setCompare] = useState(false);
  const [split, setSplit] = useState(0.5);
  const [showPoints, setShowPoints] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [zoom, setZoom] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const lastVideoTime = useRef(-1);
  const lastLandmarks = useRef(null);
  const dragging = useRef(false);

  const style = LASH_STYLES.find((s) => s.id === styleId) ?? LASH_STYLES[0];

  // Eye shape and suggested styles (photos only).
  const analysis = useMemo(
    () => (mode === "photo" && photo && landmarks ? analyseEyes(landmarks, photo.width, photo.height) : null),
    [mode, photo, landmarks]
  );
  const LABELS = { almond: "Almond", round: "Round", upturned: "Upturned", downturned: "Downturned", straight: "Straight", "close-set": "Close-set", "wide-set": "Wide-set", balanced: "Balanced spacing" };
  const styleName = (id) => LASH_STYLES.find((s) => s.id === id)?.name ?? id;

  // The camera loop reads the latest settings from here without restarting.
  const live = useRef({});
  live.current = { style, adj, compare, split, showPoints };

  // ---------- camera ----------

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const cameraLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    if (video.readyState >= 2 && video.videoWidth) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      if (video.currentTime !== lastVideoTime.current) {
        lastVideoTime.current = video.currentTime;
        const fresh = detectVideoFrame(video, performance.now());
        const prev = lastLandmarks.current;
        // Light smoothing so lashes don't shake with tiny detection jitter.
        lastLandmarks.current =
          fresh && prev && prev.length === fresh.length
            ? fresh.map((p, i) => ({ x: prev[i].x * 0.35 + p.x * 0.65, y: prev[i].y * 0.35 + p.y * 0.65, z: p.z }))
            : fresh;
      }
      drawScene(canvas.getContext("2d"), video, w, h, lastLandmarks.current, { ...live.current, mirror: true });
    }
    rafRef.current = requestAnimationFrame(cameraLoop);
  }, []);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus({ type: "error", message: "This browser can't open the camera. Upload a photo instead." });
      return;
    }
    stopCamera();
    setPhoto(null);
    setLandmarks(null);
    setMode("camera");
    setStatus({ type: "loading", message: "Loading face model…" });
    try {
      await getLandmarker();
      await setVideoMode();
      setStatus({ type: "loading", message: "Opening camera…" });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      lastVideoTime.current = -1;
      setStatus({ type: "ready", message: "" });
      rafRef.current = requestAnimationFrame(cameraLoop);
    } catch (err) {
      stopCamera();
      setMode("start");
      const blocked = err?.name === "NotAllowedError" || err?.name === "SecurityError";
      setStatus({
        type: "error",
        message: blocked
          ? "Camera access was blocked. Allow the camera in your browser settings, or upload a photo instead."
          : "Couldn't start the camera or load the face model. Check your connection and try again.",
      });
    }
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    // Keep the mirrored selfie view the person was looking at.
    const canvas = toScaledCanvas(video, video.videoWidth, video.videoHeight, MAX_PHOTO_SIDE, true);
    stopCamera();
    setMode("photo");
    setPhoto(canvas);
    analyse(canvas);
  }

  // ---------- photo ----------

  async function analyse(canvas) {
    setLandmarks(null);
    setStatus({ type: "loading", message: "Loading face model…" });
    try {
      await getLandmarker();
      setStatus({ type: "loading", message: "Finding your eyes…" });
      const lm = await detectImage(canvas);
      setLandmarks(lm);
      setShowAll(false);
      setStatus(
        lm
          ? { type: "ready", message: "" }
          : {
              type: "warn",
              message: "We couldn't find a face. Try a clear, front-facing photo with your eyes open and good light.",
            }
      );
    } catch {
      setStatus({
        type: "error",
        message: "Couldn't load the face model. Check your internet connection and try again.",
      });
    }
  }

  async function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus({ type: "error", message: "That file isn't an image. Choose a JPG, PNG or HEIC photo." });
      return;
    }
    stopCamera();
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const canvas = toScaledCanvas(img, img.naturalWidth, img.naturalHeight, MAX_PHOTO_SIDE);
      setMode("photo");
      setPhoto(canvas);
      await analyse(canvas);
    } catch {
      setStatus({ type: "error", message: "Couldn't open that photo. Try another one." });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Dev only: lets automated tests read the detected points.
  useEffect(() => {
    if (import.meta.env.DEV) window.__lashDebug = { landmarks, photo };
  }, [landmarks, photo]);

  // Redraw the photo whenever a setting changes.
  useEffect(() => {
    if (mode !== "photo" || !photo || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const view =
      zoom && landmarks
        ? faceView(landmarks, photo.width, photo.height)
        : { x: 0, y: 0, w: photo.width, h: photo.height, scale: 1 };
    canvas.width = Math.round(view.w * view.scale);
    canvas.height = Math.round(view.h * view.scale);
    drawScene(
      canvas.getContext("2d"),
      photo,
      photo.width,
      photo.height,
      landmarks,
      { style, adj, compare, split, showPoints, mirror: false },
      view
    );
  }, [mode, photo, landmarks, style, adj, compare, split, showPoints, zoom]);

  // ---------- compare slider by dragging on the image ----------

  function splitFromEvent(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    setSplit(Math.min(Math.max(x, 0.02), 0.98));
  }

  // ---------- actions ----------

  function download() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `lash-try-on-${style.id}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  }

  function reset() {
    stopCamera();
    setMode("start");
    setPhoto(null);
    setLandmarks(null);
    setStatus({ type: "idle", message: "" });
  }

  const bookHref = `${BOOKING_URL}${BOOKING_URL.includes("?") ? "&" : "?"}style=${encodeURIComponent(style.name)}`;
  const showStage = mode !== "start";
  const busy = status.type === "loading";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <div className="brand-name">Lash Try-On</div>
            <div className="brand-sub">{SALON_NAME}</div>
          </div>
        </div>
        {showStage && (
          <button type="button" className="ghost-btn" onClick={reset}>
            Start again
          </button>
        )}
      </header>

      <main className="layout">
        <section className="stage-col">
          {!showStage ? (
            <div
              className={`dropzone${dragOver ? " is-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
            >
              <h1>Find your perfect lash look</h1>
              <p>Upload a front-facing photo or use your camera, then try each style before you book.</p>
              <div className="cta-row">
                <button type="button" className="primary-btn" onClick={() => fileRef.current?.click()}>
                  Upload a photo
                </button>
                <button type="button" className="secondary-btn" onClick={startCamera}>
                  Use camera
                </button>
              </div>
              <p className="hint">Tip: face the camera, eyes open, good light, no sunglasses.</p>
            </div>
          ) : (
            <div className={`stage${showAll ? " is-hidden" : ""}`}>
              <canvas
                ref={canvasRef}
                className={`stage-canvas${compare ? " is-comparing" : ""}`}
                onPointerDown={(e) => {
                  if (!compare) return;
                  dragging.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  splitFromEvent(e);
                }}
                onPointerMove={(e) => dragging.current && splitFromEvent(e)}
                onPointerUp={() => (dragging.current = false)}
                onPointerCancel={() => (dragging.current = false)}
              />
              {busy && (
                <div className="overlay">
                  <span className="spinner" aria-hidden="true" />
                  <span>{status.message}</span>
                </div>
              )}
            </div>
          )}

          {showAll && mode === "photo" && photo && landmarks && (
            <CompareAll
              photo={photo}
              landmarks={landmarks}
              adj={adj}
              activeId={styleId}
              recommended={analysis?.recommended}
              onPick={(id) => {
                setStyleId(id);
                setShowAll(false);
              }}
            />
          )}

          {(status.type === "error" || status.type === "warn") && (
            <p className={`notice notice-${status.type}`} role="alert">
              {status.message}
            </p>
          )}

          {showStage && (
            <div className="stage-tools">
              {mode === "camera" ? (
                <button type="button" className="primary-btn" onClick={takePhoto} disabled={busy}>
                  Take photo
                </button>
              ) : (
                <button type="button" className="secondary-btn" onClick={() => fileRef.current?.click()}>
                  Change photo
                </button>
              )}
              {mode === "photo" && landmarks && (
                <button type="button" className={showAll ? "primary-btn" : "secondary-btn"} onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Back to photo" : "See all styles"}
                </button>
              )}
              {mode === "photo" && landmarks && !showAll && (
                <label className="check" htmlFor="opt-zoom">
                  <input id="opt-zoom" type="checkbox" checked={zoom} onChange={(e) => setZoom(e.target.checked)} />
                  <span>Zoom to face</span>
                </label>
              )}
              <label className="check" htmlFor="opt-compare">
                <input
                  id="opt-compare"
                  type="checkbox"
                  checked={compare}
                  onChange={(e) => setCompare(e.target.checked)}
                />
                <span>Before / after</span>
              </label>
              <label className="check" htmlFor="opt-points">
                <input
                  id="opt-points"
                  type="checkbox"
                  checked={showPoints}
                  onChange={(e) => setShowPoints(e.target.checked)}
                />
                <span>Show eye points</span>
              </label>
              {mode === "photo" && landmarks && (
                <button type="button" className="ghost-btn" onClick={download}>
                  Save image
                </button>
              )}
            </div>
          )}

          {compare && showStage && (
            <label className="slider compare-slider" htmlFor="opt-split">
              <span className="slider-head">
                <span>Drag to compare</span>
              </span>
              <input
                id="opt-split"
                type="range"
                min="0.02"
                max="0.98"
                step="0.01"
                value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
              />
            </label>
          )}

          <p className="privacy">Your photo stays on this device. Nothing is uploaded or saved.</p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <video ref={videoRef} playsInline muted hidden />
        </section>

        <aside className="panel">
          {analysis && (
            <div className="shape-card">
              <div className="shape-title">Your eye shape</div>
              <div className="shape-tags">
                <span>{LABELS[analysis.shape]}</span>
                <span>{LABELS[analysis.tilt]}</span>
                <span>{LABELS[analysis.spacing]}</span>
              </div>
              <p>
                Suggested for you: <strong>{analysis.recommended.map(styleName).join(" or ")}</strong>
              </p>
              <button type="button" className="link-btn" onClick={() => setStyleId(analysis.recommended[0])}>
                Try {styleName(analysis.recommended[0])}
              </button>
            </div>
          )}

          <h2>Choose a style</h2>
          <StylePicker value={styleId} onChange={setStyleId} recommended={analysis?.recommended} />

          <h2>Adjust</h2>
          <Adjustments value={adj} onChange={setAdj} onReset={() => setAdj(DEFAULT_ADJUSTMENTS)} />

          <a className="book-btn" href={bookHref} target="_blank" rel="noreferrer">
            Book {style.name} lashes
          </a>
          <p className="disclaimer">Preview only. Your lash artist will tailor the final set to your eyes.</p>
        </aside>
      </main>
    </div>
  );
}
