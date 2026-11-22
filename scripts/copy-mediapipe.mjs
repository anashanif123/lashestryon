// Copies the MediaPipe WASM files and downloads the face model into public/mediapipe,
// for `npm run build:selfhost`.
import { cpSync, mkdirSync, existsSync, writeFileSync } from "node:fs";

const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

mkdirSync("public/mediapipe", { recursive: true });
cpSync("node_modules/@mediapipe/tasks-vision/wasm", "public/mediapipe/wasm", { recursive: true });
if (!existsSync("public/mediapipe/face_landmarker.task")) {
  const res = await fetch(MODEL);
  if (!res.ok) throw new Error(`Model download failed: ${res.status}`);
  writeFileSync("public/mediapipe/face_landmarker.task", Buffer.from(await res.arrayBuffer()));
}
console.log("MediaPipe files ready in public/mediapipe");
