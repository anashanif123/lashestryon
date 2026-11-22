// App settings. Defaults below; each salon can override them in the link, e.g.
//   https://your-site.vercel.app/?salon=Hi-Lash%20Lounge&book=https://acuity.../&accent=8c3b5e
//   &styles=natural,cat-eye,volume&style=volume&embed=1
//
// salon   name shown in the header and on saved images
// book    booking link for the "Book" button (the style is added as ?style=...)
// accent  brand colour as a hex code without #
// styles  only show these style ids (comma separated)
// style   style selected at the start
// embed   1 = compact header, for placing the page inside a salon's website (iframe)

const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
const safeUrl = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
};
const hex = (value) => (/^[0-9a-f]{6}$/i.test(value || "") ? `#${value}` : null);

export const SALON_NAME = (params.get("salon") || "").trim().slice(0, 60) || "Lash Try-On";
export const BOOKING_URL = safeUrl(params.get("book") || "") || null; // no button when not set
export const ACCENT = hex(params.get("accent"));
export const ONLY_STYLES = (params.get("styles") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
export const START_STYLE = params.get("style") || null;
export const EMBED = params.get("embed") === "1";

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
