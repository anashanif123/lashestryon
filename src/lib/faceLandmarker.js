// Loads Google MediaPipe Face Landmarker once and finds 478 face points.
// Everything runs in the browser: no API key, no server, the photo never leaves the device.

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { WASM_URL, MODEL_URL } from "../config.js";

// A ".b64.txt" model is a base64 text copy (for hosts that only serve common file types).
async function modelSource() {
  if (!MODEL_URL.endsWith(".b64.txt")) return { modelAssetPath: MODEL_URL };
  const text = await (await fetch(MODEL_URL)).text();
  const bin = atob(text.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { modelAssetBuffer: bytes };
}

let landmarker = null;
let loading = null;
let currentMode = "IMAGE";

export async function getLandmarker() {
  if (landmarker) return landmarker;
  if (!loading) {
    loading = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const model = await modelSource();
      const options = (delegate) => ({
        baseOptions: { ...model, delegate },
        runningMode: "IMAGE",
        numFaces: 1,
      });
      try {
        // GPU is faster; some phones and old laptops do not support it.
        landmarker = await FaceLandmarker.createFromOptions(vision, options("GPU"));
      } catch {
        landmarker = await FaceLandmarker.createFromOptions(vision, options("CPU"));
      }
      currentMode = "IMAGE";
      return landmarker;
    })();
  }
  try {
    return await loading;
  } catch (err) {
    loading = null; // allow a retry after a network error
    throw err;
  }
}

async function setMode(mode) {
  const lm = await getLandmarker();
  if (currentMode !== mode) {
    await lm.setOptions({ runningMode: mode });
    currentMode = mode;
  }
  return lm;
}

/** Points for a still photo (img or canvas). Returns null when no face is found. */
export async function detectImage(source) {
  const lm = await setMode("IMAGE");
  const result = lm.detect(source);
  return result.faceLandmarks?.[0] ?? null;
}

/** Points for one camera frame. Call setVideoMode() once before the loop. */
export function detectVideoFrame(video, timestampMs) {
  if (!landmarker || currentMode !== "VIDEO") return null;
  const result = landmarker.detectForVideo(video, timestampMs);
  return result.faceLandmarks?.[0] ?? null;
}

export async function setVideoMode() {
  await setMode("VIDEO");
}
