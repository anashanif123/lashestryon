// App settings. Change these to fit the salon you are demoing for.

export const SALON_NAME = "Your Lash Studio";

// Where the "Book this style" button goes (Acuity, Fresha, your own site...).
// The chosen style name is added to the link as ?style=<name>.
export const BOOKING_URL = "https://example.com/book";

// MediaPipe files. The version must match "@mediapipe/tasks-vision" in package.json.
export const MEDIAPIPE_VERSION = "0.10.21";

// Default: load MediaPipe from Google's CDN.
// `npm run build:selfhost` instead serves the files from this site (public/mediapipe),
// so the app works without reaching jsDelivr or Google Storage.
const SELF_HOST = import.meta.env.VITE_SELF_HOST_MEDIAPIPE === "1";
const here = (path) => new URL(path, document.baseURI).href;

export const WASM_URL = SELF_HOST
  ? here("mediapipe/wasm")
  : `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
// Some hosts only serve common file types; VITE_MODEL_B64=1 loads a base64 text copy of the model.
const MODEL_B64 = import.meta.env.VITE_MODEL_B64 === "1";
export const MODEL_URL = SELF_HOST
  ? here(MODEL_B64 ? "mediapipe/face_landmarker.b64.txt" : "mediapipe/face_landmarker.task")
  : "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Largest side of an uploaded photo, in pixels. Bigger photos are scaled down
// so drawing stays fast on phones.
export const MAX_PHOTO_SIDE = 1600;
