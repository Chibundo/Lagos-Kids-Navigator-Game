const RAD = Math.PI / 180;
const METERS_PER_DEGREE = 111320;

export function metersBetween(a, b) {
  const lat = ((a[1] + b[1]) / 2) * RAD;
  const dx = (b[0] - a[0]) * METERS_PER_DEGREE * Math.cos(lat);
  const dy = (b[1] - a[1]) * METERS_PER_DEGREE;
  return Math.hypot(dx, dy);
}
export function bearingBetween(a, b) {
  const lat = ((a[1] + b[1]) / 2) * RAD;
  const east = (b[0] - a[0]) * Math.cos(lat);
  const north = b[1] - a[1];
  return (Math.atan2(east, north) / RAD + 360) % 360;
}
export function advanceCoordinate(point, headingDeg, distanceMeters) {
  const angle = headingDeg * RAD;
  return [
    point[0] + Math.sin(angle) * distanceMeters / (METERS_PER_DEGREE * Math.max(0.1, Math.cos(point[1] * RAD))),
    point[1] + Math.cos(angle) * distanceMeters / METERS_PER_DEGREE
  ];
}
export function angleDifference(from, to) {
  return ((to - from + 540) % 360) - 180;
}
export function buildRoute(coords) {
  if (!Array.isArray(coords) || coords.length < 2) throw new Error("Route requires two points.");
  const lengths = [0];
  for (let i = 1; i < coords.length; i++) lengths.push(lengths[i - 1] + metersBetween(coords[i - 1], coords[i]));
  return { coords, lengths, total: lengths.at(-1) };
}
export function positionAt(route, distance) {
  const d = Math.max(0, Math.min(route.total, distance));
  let i = 1;
  while (i < route.lengths.length - 1 && route.lengths[i] < d) i++;
  const start = route.lengths[i - 1], section = Math.max(0.001, route.lengths[i] - start);
  const t = (d - start) / section;
  const a = route.coords[i - 1], b = route.coords[i];
  return { coordinate: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    bearing: bearingBetween(a, b), distance: d };
}
export function closestPoint(route, point) {
  const latRad = point[1] * RAD, sx = METERS_PER_DEGREE * Math.cos(latRad);
  let best = { distance: Infinity, progress: 0, coordinate: route.coords[0], bearing: 0 };
  for (let i = 1; i < route.coords.length; i++) {
    const a = route.coords[i - 1], b = route.coords[i];
    const vx = (b[0] - a[0]) * sx, vy = (b[1] - a[1]) * METERS_PER_DEGREE;
    const wx = (point[0] - a[0]) * sx, wy = (point[1] - a[1]) * METERS_PER_DEGREE;
    const mag = vx * vx + vy * vy;
    const t = mag < 0.00001 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / mag));
    const c = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], dist = metersBetween(point, c);
    if (dist < best.distance) best = { distance: dist, coordinate: c,
      progress: route.lengths[i - 1] + (route.lengths[i] - route.lengths[i - 1]) * t,
      bearing: bearingBetween(a, b) };
  }
  return best;
}
