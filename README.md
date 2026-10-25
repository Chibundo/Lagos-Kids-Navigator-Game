# Lagos Kids Project — Explorer MVP

An educational game for exploring real Lagos streets. Pilot area: Lekki, Ajah, VGC and Victoria Island. Runs on phones and laptops with manual steering, guided navigation and a top-down/street camera toggle.

**This is an initial prototype.** Roads and directions use map data, but the angled Street View is a cartographic 3D approximation, not live photographs. The buildings shown as 3D blocks are not verified replicas. Public landmark pins and bus stops are approximations pending local verification.

## Run locally

Node 18+ is recommended; no packages or secrets are needed to build:

```bash
node build.mjs
python3 -m http.server 5173 --directory dist
```

Open http://localhost:5173. Internet is required to load the map and routing service.

## Play

1. Choose two **public** destinations; click Plan journey.
2. Select Drive, Walk or Bus Preview.
3. Select Manual and use arrow keys/WASD (or touch buttons) to steer, accelerate and brake.
4. Select Guided to follow the calculated route automatically.
5. Toggle Map View and Street View anytime. See real photos opens the external Google Maps imagery viewer where coverage exists.
6. Earn stars by finishing journeys; progress stays in the browser.

## Render deployment

Upload the repository to GitHub, then create a Render **Blueprint** from it. The included `render.yaml` publishes the `dist` folder as a static site. Alternatively, select Static Site manually, Build Command `node build.mjs`, Publish Directory `dist`.

## Accuracy, providers and safeguarding

- MapLibre + OpenFreeMap render OpenStreetMap data, with attributions shown on the map.
- The prototype uses the public OSRM demonstration router. **Do not depend on it for a widely promoted public launch**; replace the endpoint in `config.js` with a production-approved service. If routing fails, the app shows an error rather than inventing a straight-line road.
- Walk mode currently adjusts avatar speed along a driving route, and **does not provide safe real-world walking directions**.
- Bus stops and public POIs are unverified pilot markers. Bus mode is only a route-ride preview, without real boarding, timetables or fares.
- Street View tilts the map and extrudes building footprints where data exists. Exact building facades, live trees, pedestrians, traffic and fully immersive 3D scenery are future phases.
- The Real Photos link opens Google Maps outside the game; no imagery is downloaded or stored.
- This public MVP collects no accounts, GPS, chats, names or private home addresses. Please use public landmarks, not family home addresses. Stars use browser-local storage.

## Next phases

Verify landmarks and stops on the ground; add real pedestrian routing and curated BRT/danfo lines; add parent-managed private pins; then model a compact real neighbourhood with recognisable facades, trees, traffic and animated people.

## Project files

`index.html`, `styles.css`, `app.js`, `geo.mjs`, `config.js`, `render.yaml`, `build.mjs`, `tests/geo.test.mjs`.

```bash
npm test
npm run build
```
