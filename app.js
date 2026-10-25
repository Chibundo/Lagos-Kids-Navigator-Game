import { advanceCoordinate, angleDifference, buildRoute, closestPoint, positionAt } from "./geo.mjs";

// These are public, approximate pilot coordinates. A local mapping audit is
// required before descriptions such as "exact location" are appropriate.
const PLACES = [
  { id: "lekki1", name: "Lekki Phase 1 (approx.)", point: [3.474, 6.444], icon: "📍" },
  { id: "admiralty", name: "Admiralty Way area (approx.)", point: [3.470, 6.444], icon: "🏙️" },
  { id: "nike", name: "Nike Art Gallery area (approx.)", point: [3.472, 6.430], icon: "🎨" },
  { id: "vi", name: "Victoria Island (approx.)", point: [3.426, 6.431], icon: "🏢" },
  { id: "oniru", name: "Oniru area (approx.)", point: [3.459, 6.426], icon: "🌴" },
  { id: "conservation", name: "Lekki Conservation area (approx.)", point: [3.535, 6.441], icon: "🌿" },
  { id: "vgc", name: "VGC area (approx.)", point: [3.574, 6.468], icon: "🏘️" },
  { id: "ajah", name: "Ajah area (approx.)", point: [3.597, 6.468], icon: "🛣️" }
];
const STOPS = [
  { label: "Lekki Phase 1 Gate — illustrative stop", point: [3.467, 6.442] },
  { label: "Jakande — illustrative stop", point: [3.514, 6.446] },
  { label: "VGC Gate — illustrative stop", point: [3.574, 6.468] },
  { label: "Ajah — illustrative stop", point: [3.593, 6.468] }
];
const $ = (id) => document.getElementById(id);
const config = window.LKP_CONFIG || {};
const state = {
  view: "map", mode: "car", guidance: "manual", route: null, routeSteps: [],
  pos: [...PLACES[0].point], heading: 0, speed: 0, progress: 0,
  playing: false, done: false, controls: { left: false, right: false, accelerate: false, brake: false },
  map: null, vehicle: null, mapReady: false, cameraTick: 0, messageTick: 0, stars: 0
};
const MAX_SPEED = { car: 16, walk: 2, bus: 10 };
const CRUISE_SPEED = { car: 11, walk: 1.7, bus: 8 };

function loadStars() {
  try {
    const n = Number(window.localStorage.getItem("lkp-stars-v1"));
    return Number.isFinite(n) ? Math.min(9999, Math.max(0, n)) : 0;
  } catch { return 0; }
}
function saveStars() {
  try { window.localStorage.setItem("lkp-stars-v1", String(state.stars)); } catch {}
}
state.stars = loadStars();
$("stars-earned").textContent = state.stars;

function notify(message) {
  $("mission-text").textContent = message;
}
function setControlMode(guidance) {
  state.guidance = guidance;
  $("manual").classList.toggle("selected", guidance === "manual");
  $("guided").classList.toggle("selected", guidance === "guided");
  $("manual").setAttribute("aria-pressed", String(guidance === "manual"));
  $("guided").setAttribute("aria-pressed", String(guidance === "guided"));
  if (guidance === "guided" && state.route) {
    const near = closestPoint(state.route, state.pos);
    state.progress = near.progress;
    const target = positionAt(state.route, state.progress);
    state.pos = target.coordinate;
    state.heading = target.bearing;
    if (state.playing) state.speed = CRUISE_SPEED[state.mode];
  }
  if (guidance === "manual" && state.mode === "bus") {
    state.guidance = "guided";
    $("manual").classList.remove("selected");
    $("guided").classList.add("selected");
    $("manual").setAttribute("aria-pressed", "false");
    $("guided").setAttribute("aria-pressed", "true");
    notify("Bus preview runs as a guided ride. Choose Drive for steering controls.");
  }
  $("control-hint").textContent = state.guidance === "manual"
    ? "Arrow keys / WASD to drive • Touch buttons on a phone"
    : "Guided: your explorer follows the planned route";
}
function setView(view) {
  state.view = view;
  $("map-view").classList.toggle("selected", view === "map");
  $("street-view").classList.toggle("selected", view === "street");
  $("map-view").setAttribute("aria-pressed", String(view === "map"));
  $("street-view").setAttribute("aria-pressed", String(view === "street"));
  if (state.mapReady) {
    if (state.map.getLayer("lkp-buildings")) {
      state.map.setLayoutProperty("lkp-buildings", "visibility", view === "street" ? "visible" : "none");
    }
    followVehicle(true);
  }
}
function setMode(mode) {
  state.mode = mode;
  for (const button of document.querySelectorAll(".travel")) {
    const selected = button.dataset.mode === mode;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  if (mode === "bus") setControlMode("guided");
  else setControlMode(state.guidance);
  if (mode === "walk") notify("Walking mode uses a driving-road demo route, not real-life pedestrian directions.");
  if (mode === "bus") notify("Bus preview is guided; stops shown are illustrative, not a verified timetable.");
  if (mode === "car") notify("Find your destination and earn a star!");
}

function populatePlaces() {
  for (const key of ["from", "to"]) {
    $(key).replaceChildren();
    for (const place of PLACES) {
      const opt = document.createElement("option");
      opt.value = place.id;
      opt.textContent = place.name;
      $(key).append(opt);
    }
  }
  $("from").value = "admiralty";
  $("to").value = "nike";
}
function placeById(id) { return PLACES.find(place => place.id === id); }
function routeGeoJSON(points = []) {
  return { type: "FeatureCollection", features: points.length >= 2 ? [{
    type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points }
  }] : [] };
}

function addMapLayers() {
  const map = state.map;
  map.addSource("lkp-route", { type: "geojson", data: routeGeoJSON() });
  map.addLayer({ id: "lkp-route-halo", type: "line", source: "lkp-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffffff", "line-width": 11, "line-opacity": .9 } });
  map.addLayer({ id: "lkp-route-line", type: "line", source: "lkp-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#1688ef", "line-width": 6 } });
  try {
    const style = map.getStyle();
    const vectorId = Object.keys(style.sources).find(key => style.sources[key].type === "vector");
    if (vectorId) map.addLayer({
      id: "lkp-buildings", type: "fill-extrusion", source: vectorId,
      "source-layer": "building", minzoom: 15,
      layout: { visibility: "none" },
      paint: {
        "fill-extrusion-color": "#b5c9cf",
        "fill-extrusion-height": [
          "case", ["has", "render_height"], ["to-number", ["get", "render_height"], 12],
          ["has", "height"], ["to-number", ["get", "height"], 12], 12
        ],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": .77
      }
    });
  } catch (error) {
    // A provider style may not expose building polygons; the regular map still works.
    console.info("3D building layer unavailable:", error.message);
  }
}
function pin(point, label, icon, klass = "") {
  const element = document.createElement("div");
  element.className = `place-pin ${klass}`;
  element.textContent = icon;
  element.setAttribute("aria-label", label);
  return new maplibregl.Marker({ element, anchor: "bottom" }).setLngLat(point)
    .setPopup(new maplibregl.Popup({ offset: 18 }).setText(label + " (pilot position; verify locally)"))
    .addTo(state.map);
}
function initializeMap() {
  if (!window.maplibregl) {
    $("map-failure").hidden = false;
    notify("Map code could not load. Check your connection.");
    return;
  }
  const map = new maplibregl.Map({
    container: "map", style: config.mapStyle, center: [3.49, 6.452],
    zoom: 11.3, attributionControl: true, maxPitch: 85, pitch: 0
  });
  state.map = map;
  map.on("load", () => {
    state.mapReady = true;
    addMapLayers();
    for (const place of PLACES) pin(place.point, place.name, place.icon);
    for (const stop of STOPS) pin(stop.point, stop.label, "🚌", "bus-stop");
    const vehicle = document.createElement("div");
    vehicle.className = "vehicle";
    vehicle.textContent = "🚗";
    state.vehicle = new maplibregl.Marker({ element: vehicle, rotationAlignment: "map" })
      .setLngLat(state.pos).addTo(map);
    $("map-failure").hidden = true;
    notify("Choose a journey, or explore the real map by zooming and panning.");
  });
  map.on("error", (event) => console.warn("Map tile or style issue:", event?.error?.message || event));
}

async function planJourney() {
  const origin = placeById($("from").value);
  const destination = placeById($("to").value);
  if (!origin || !destination || origin.id === destination.id) {
    notify("Choose two different public places first.");
    return;
  }
  const button = $("plan");
  button.disabled = true;
  button.textContent = "Finding real roads…";
  state.playing = false;
  state.route = null;
  state.done = false;
  $("start").disabled = true;
  try {
    const base = String(config.routingBaseUrl || "").replace(/\/$/, "");
    if (!base.startsWith("https://")) throw new Error("A secure routing endpoint is required.");
    const pair = [origin, destination].map(p => p.point.join(",")).join(";");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.routeTimeoutMs || 14000);
    let response;
    try {
      response = await fetch(`${base}/route/v1/driving/${pair}?overview=full&geometries=geojson&steps=true`,
        { signal: controller.signal });
    } finally { clearTimeout(timeout); }
    if (!response.ok) throw new Error(`Routing service returned ${response.status}`);
    const data = await response.json();
    const result = data.routes?.[0];
    if (data.code !== "Ok" || !result?.geometry?.coordinates?.length) throw new Error("No road route was found.");
    state.route = buildRoute(result.geometry.coordinates);
    state.routeSteps = [];
    let cumulative = 0;
    for (const leg of (result.legs || [])) {
      for (const step of (leg.steps || [])) {
        state.routeSteps.push({ start: cumulative, name: step.name || "" });
        cumulative += step.distance || 0;
      }
    }
    state.progress = 0;
    state.pos = [...state.route.coords[0]];
    state.heading = positionAt(state.route, 0).bearing;
    state.speed = 0;
    state.done = false;
    updateVehicle();
    if (state.mapReady) {
      state.map.getSource("lkp-route")?.setData(routeGeoJSON(state.route.coords));
      const bounds = new maplibregl.LngLatBounds();
      state.route.coords.forEach(pt => bounds.extend(pt));
      state.map.fitBounds(bounds, { padding: { top: 90, bottom: 180, left: 380, right: 50 }, maxZoom: 14, duration: 850 });
    }
    $("distance-label").textContent = `${(state.route.total / 1000).toFixed(1)} km`;
    $("start").disabled = false;
    $("start").textContent = "▶ Start adventure";
    notify("Route ready! Start and drive, or switch to guided mode.");
    renderProgress();
  } catch (error) {
    console.warn("Routing unavailable", error);
    notify("Could not load a road route. Check internet or routing-service availability, then retry.");
    $("distance-label").textContent = "Route unavailable";
    if (state.mapReady) state.map.getSource("lkp-route")?.setData(routeGeoJSON());
  } finally {
    button.disabled = false;
    button.textContent = "↗ Plan journey";
  }
}

function startAdventure() {
  if (!state.route) return;
  if (state.done) {
    state.progress = 0;
    state.pos = [...state.route.coords[0]];
    state.heading = positionAt(state.route, 0).bearing;
    state.done = false;
  }
  state.playing = !state.playing;
  state.speed = state.playing && state.guidance === "guided" ? CRUISE_SPEED[state.mode] : 0;
  $("start").textContent = state.playing ? "Ⅱ Pause journey" : "▶ Resume adventure";
  notify(state.playing ? "You’re exploring Lagos! Watch for street names and landmarks." : "Journey paused.");
  followVehicle(true);
}
function updateVehicle() {
  state.vehicle?.setLngLat(state.pos).setRotation(state.heading);
}
function currentStreetName() {
  const steps = state.routeSteps.filter(step => step.start <= state.progress + 10);
  const name = steps.at(-1)?.name?.trim();
  return name || "Exploring Lagos streets";
}
function renderProgress() {
  const percentage = state.route ? Math.round(state.progress / Math.max(1, state.route.total) * 100) : 0;
  $("progress-label").textContent = `${percentage}%`;
  $("progress-fill").style.width = `${percentage}%`;
  $("speed-label").textContent = Math.round(state.speed * 3.6);
  $("street-name").textContent = currentStreetName();
}
function followVehicle(animate = false) {
  if (!state.mapReady) return;
  const camera = state.view === "street"
    ? { center: state.pos, zoom: 17.7, pitch: 73, bearing: state.heading }
    : { center: state.pos, zoom: state.route ? 14.7 : 12.0, pitch: 0, bearing: 0 };
  if (animate) state.map.easeTo({ ...camera, duration: 850 });
  else state.map.jumpTo(camera);
}
function completeJourney() {
  state.playing = false;
  state.done = true;
  state.speed = 0;
  state.stars += 1;
  saveStars();
  $("stars-earned").textContent = state.stars;
  $("start").textContent = "↻ Play again";
  notify("Adventure complete! ⭐ You earned a Lagos Explorer star.");
  renderProgress();
}

function updateGame(dt, now) {
  if (!state.playing || !state.route) return;
  if (state.guidance === "guided") {
    state.speed = CRUISE_SPEED[state.mode];
    state.progress = Math.min(state.route.total, state.progress + state.speed * dt);
    const target = positionAt(state.route, state.progress);
    state.pos = target.coordinate;
    state.heading = target.bearing;
  } else {
    const c = state.controls;
    const forward = c.accelerate ? 1 : 0;
    const braking = c.brake ? 1 : 0;
    const accelerate = state.mode === "walk" ? 1.3 : 4.5;
    state.speed = Math.max(0, Math.min(MAX_SPEED[state.mode],
      state.speed + (forward * accelerate - braking * 10 - (forward ? 0 : 1.5)) * dt));
    const steer = (c.right ? 1 : 0) - (c.left ? 1 : 0);
    state.heading = (state.heading + steer * (state.mode === "walk" ? 90 : 66) * dt + 360) % 360;
    const candidate = advanceCoordinate(state.pos, state.heading, state.speed * dt);
    const near = closestPoint(state.route, candidate);
    if (near.distance > 45) {
      state.pos = [...near.coordinate];
      state.heading = near.bearing;
      state.speed = Math.min(state.speed, 3);
      if (now - state.messageTick > 2800) {
        notify("Oops, off the planned road! We've brought you back to the route.");
        state.messageTick = now;
      }
    } else {
      state.pos = candidate;
      // Small steering assist so young players can follow a complex road.
      if (state.speed > 0.1 && steer === 0) {
        state.heading = (state.heading + angleDifference(state.heading, near.bearing) * Math.min(0.025, dt * .18) + 360) % 360;
      }
    }
    state.progress = Math.max(state.progress, closestPoint(state.route, state.pos).progress);
  }
  updateVehicle();
  renderProgress();
  if (now - state.cameraTick > 80) {
    followVehicle();
    state.cameraTick = now;
  }
  if (state.progress >= state.route.total - 12) completeJourney();
}

function bindControl(button) {
  const action = button.dataset.control;
  const release = () => { state.controls[action] = false; button.classList.remove("pressed"); };
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    if (state.guidance !== "manual" || state.mode === "bus") return;
    button.setPointerCapture?.(event.pointerId);
    state.controls[action] = true;
    button.classList.add("pressed");
  });
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}
function bindEvents() {
  $("plan").addEventListener("click", planJourney);
  $("start").addEventListener("click", startAdventure);
  $("map-view").addEventListener("click", () => setView("map"));
  $("street-view").addEventListener("click", () => setView("street"));
  $("manual").addEventListener("click", () => setControlMode("manual"));
  $("guided").addEventListener("click", () => setControlMode("guided"));
  $("reset-camera").addEventListener("click", () => followVehicle(true));
  $("help-button").addEventListener("click", () => $("help-dialog").showModal());
  $("real-photo").addEventListener("click", () => {
    const [lng, lat] = state.pos;
    const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  });
  for (const button of document.querySelectorAll(".travel")) {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  }
  for (const button of document.querySelectorAll("[data-control]")) bindControl(button);
  const keyMap = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
    ArrowUp: "accelerate", KeyW: "accelerate", ArrowDown: "brake", KeyS: "brake", Space: "brake" };
  window.addEventListener("keydown", event => {
    const action = keyMap[event.code];
    if (!action || ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
    if (state.guidance !== "manual" || state.mode === "bus") return;
    event.preventDefault();
    state.controls[action] = true;
  });
  window.addEventListener("keyup", event => {
    const action = keyMap[event.code];
    if (action) state.controls[action] = false;
  });
  window.addEventListener("blur", () => Object.keys(state.controls).forEach(key => state.controls[key] = false));
  for (const id of ["from", "to"]) {
    $(id).addEventListener("change", () => {
      state.playing = false;
      state.route = null;
      $("start").disabled = true;
      $("start").textContent = "▶ Start adventure";
      $("distance-label").textContent = "Choose a route";
      if (state.mapReady) state.map.getSource("lkp-route")?.setData(routeGeoJSON());
      notify("Destination changed. Plan a new journey.");
      renderProgress();
    });
  }
}

function boot() {
  populatePlaces();
  bindEvents();
  initializeMap();
  renderProgress();
  let previous = performance.now();
  function tick(now) {
    const dt = Math.min(0.055, Math.max(0, (now - previous) / 1000));
    previous = now;
    updateGame(dt, now);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
boot();
