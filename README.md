 # Lash Try-On (demo)

Upload a photo or use the camera, and preview lash extension styles on your own eyes.
Built with React + Vite and Google MediaPipe Face Landmarker. Everything runs in the
browser: no API key, no server, and photos never leave the device.

## Features

- Photo upload (or drag and drop) and live camera with "Take photo"
- **Real millimetres**: lash length is scaled from the iris (about 11.7 mm across), so
  "10 mm" looks like 10 mm on that client's eye
- **Mapped like a lash artist maps**: lengths are set at the inner corner, where the iris
  starts, the pupil, where the iris ends, and the outer corner, found on each client's own eye.
  "Mapping guide" draws those points on the photo with their mm
- **Real placement**: the inner corner is left largely alone, and the set carries on past
  the outer corner of the white of the eye, along the lid, and tapers there
- **Real curl**: each lash leaves the lid and curls up along an arc, J to D
- **13 styles** drawn strand by strand: Natural, Cat Eye, Doll Eye, Open Eye, Squirrel,
  Fox Eye, Hybrid, Wispy, Volume, Mega Volume, Wet Look, Anime, Lash Lift
- **Lash map editor** in the units lash artists use: 5 mapping points in mm,
  curl J / B / C / CC / D, thickness 0.05–0.20 mm, Classic or 2D–8D fans
- **Spec card** under the photo, e.g. `8-9-10-12-13 mm · C curl · 0.15 mm · Classic`
- Colours (black, dark brown, brown), **colour accents** (blue, purple, pink, red,
  green) as tips, mixed in, or full colour, and optional **bottom lashes**
- **Saved looks** (kept on the device), **Save image** with the lash map printed
  under the photo, and **Share** on phones
- Eye-shape reading (almond/round, tilt, spacing) with suggested styles
- "See all styles": every style side by side on the client's own eyes
- Eyes / Face / Whole photo views (phones open on Eyes), before/after slider, warning
  when the face is too small in the photo
- On phones the photo stays pinned at the top while the settings scroll

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

Turn on **Eye points** in the app to see them on the photo while tuning.

## Settings for each salon (no code needed)

Add these to the link. Every salon can get its own link from the same deployment:

```
https://lashestryon.vercel.app/?salon=Glow%20Lash%20Studio&book=https://glow.example/book&accent=1f6f5c&styles=natural,cat-eye,hybrid,volume&style=hybrid&embed=1
```

| Param | What it does |
|---|---|
| `salon` | Name in the header and on saved images |
| `book` | Booking link (http/https). Shows "Book this look"; `?style=<name>` is added. No button without it |
| `accent` | Brand colour, 6-digit hex without `#` |
| `styles` | Only show these styles (ids: natural, cat-eye, doll-eye, open-eye, squirrel, fox-eye, hybrid, wispy, volume, mega-volume, wet-look, anime, lash-lift) |
| `style` | Style selected at the start |
| `embed=1` | Compact header, for putting the page inside the salon's website |

Embed in a website:

```html
<iframe src="https://lashestryon.vercel.app/?salon=Glow%20Lash%20Studio&embed=1"
        style="width:100%;height:900px;border:0" allow="camera"></iframe>
```

`MEDIAPIPE_VERSION` in `src/config.js` must match `@mediapipe/tasks-vision` in `package.json`.

## Files

```
src/
  App.jsx                 screens, upload, camera loop, before/after, save image
  config.js               salon link settings, MediaPipe URLs
  styles.css              all styling
  components/
    StylePicker.jsx       style cards with drawn previews
    LashMapEditor.jsx     mm per zone, curl, thickness, fan type
    Adjustments.jsx       colour, coloured tips, fullness, darkness, bottom lashes
    CompareAll.jsx        all styles side by side
  lib/
    faceLandmarker.js     MediaPipe setup and detection
    eyeGeometry.js        eyelid curves, directions, mm scale from the iris
    lashRenderer.js       draws the lashes
    lashStyles.js         style definitions (lash maps in mm), colours
    savedLooks.js         saved looks on the device
    eyeShape.js           eye shape and suggestions
scripts/
  copy-mediapipe.mjs      prepares public/mediapipe for build:selfhost
```

## Known limits

- It is a preview, not a photo-real result. Very angled faces, closed eyes,
  heavy glasses or very small faces in the photo give weaker results.
- The mm scale assumes an average iris (11.7 mm); real irises vary by about ±0.5 mm.
- Eye-shape suggestions are rules of thumb, tested on a handful of photos.
  Smiling narrows the eyes, so a neutral face gives the best reading.
- Live camera speed depends on the device. On weak devices the lashes can lag
  slightly behind fast head movement.
- The model (~3.7 MB) downloads from Google the first time; later visits use the
  browser cache.
