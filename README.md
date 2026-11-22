# Lash Try-On (demo)

Upload a photo or use the camera, and preview lash extension styles on your own eyes.
Built with React + Vite and Google MediaPipe Face Landmarker. Everything runs in the
browser: no API key, no server, and photos never leave the device.

## Features

- Photo upload (or drag and drop) and live camera with "Take photo"
- 6 styles drawn strand by strand: Natural, Cat Eye, Doll Eye, Hybrid, Volume, Wispy
- Eye-shape reading (almond/round, tilt, spacing) with suggested styles
- "See all styles": every style side by side on the client's own eyes
- Zoom to face, before/after slider, save image, "Book this style" link
- Sliders for length, curl, fullness, thickness and darkness
- Lashes stay below the brows, get finer on small/low-resolution faces, and are
  softened to match the photo

## Run it

```bash
npm install
npm run dev
```

Open the link Vite prints (usually http://localhost:5173).

- The camera only works on `localhost` or an `https://` site (browser rule).
- To test the camera on your phone, deploy it (e.g. Vercel) or use the Network URL
  over https.

Build for production:

```bash
npm run build            # output in dist/, loads MediaPipe from Google's CDN
npm run build:selfhost   # output in dist/, serves MediaPipe files from your own site
npm run preview          # check the build locally
```

## How it works

1. **Face points** – `src/lib/faceLandmarker.js` loads MediaPipe once and returns
   478 face points for a photo or a camera frame.
2. **Eyelid curve** – `src/lib/eyeGeometry.js` takes the upper and lower eyelid
   points of each eye, draws a smooth curve along the upper lid, and works out the
   direction pointing away from the eye at every spot.
3. **Lashes** – `src/lib/lashRenderer.js` draws each lash as a curved, tapering
   strand along that curve. Volume and wispy styles draw small fans of strands.
   No lash images are needed.
4. **Styles** – `src/lib/lashStyles.js` holds every style as plain numbers
   (length along the lid, thickness, curl, fans, spikes). Add a new style by
   copying one and changing the numbers.
5. **Eye shape** – `src/lib/eyeShape.js` measures tilt, openness and spacing and
   scores the styles. Thresholds are tuned to MediaPipe's points; adjust them there.

Eye point numbers used (MediaPipe face mesh):

| Eye | Upper lid (inner → outer) | Lower lid (inner → outer) |
|---|---|---|
| Left side of image | 133, 173, 157, 158, 159, 160, 161, 246, 33 | 133, 155, 154, 153, 145, 144, 163, 7, 33 |
| Right side of image | 362, 398, 384, 385, 386, 387, 388, 466, 263 | 362, 382, 381, 380, 374, 373, 390, 249, 263 |

Turn on **Show eye points** in the app to see them on the photo while tuning.

## Settings

Edit `src/config.js`:

- `SALON_NAME` – shown in the header
- `BOOKING_URL` – where "Book … lashes" goes; `?style=<name>` is added
- `MEDIAPIPE_VERSION` – must match `@mediapipe/tasks-vision` in `package.json`

## Files

```
src/
  App.jsx                 screens, upload, camera loop, before/after, save image
  config.js               salon name, booking link, MediaPipe URLs
  styles.css              all styling
  components/
    StylePicker.jsx       style cards with drawn previews
    Adjustments.jsx       length, curl, fullness, thickness, darkness sliders
    CompareAll.jsx        all styles side by side
  lib/
    faceLandmarker.js     MediaPipe setup and detection
    eyeGeometry.js        eyelid curves and directions
    lashRenderer.js       draws the lashes
    lashStyles.js         style definitions
    eyeShape.js           eye shape and suggestions
scripts/
  copy-mediapipe.mjs      prepares public/mediapipe for build:selfhost
```

## Known limits

- It is a preview, not a photo-real result. Very angled faces, closed eyes,
  heavy glasses or very small faces in the photo give weaker results.
- Lower lashes are not drawn.
- Eye-shape suggestions are rules of thumb, tested on a handful of photos.
  Smiling narrows the eyes, so a neutral face gives the best reading.
- Live camera speed depends on the device. On weak devices the lashes can lag
  slightly behind fast head movement.
- The model (~3.7 MB) downloads from Google the first time; later visits use the
  browser cache.
