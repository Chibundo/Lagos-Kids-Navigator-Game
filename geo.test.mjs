import test from "node:test";
import assert from "node:assert/strict";
import { advanceCoordinate, angleDifference, bearingBetween, buildRoute, closestPoint, metersBetween, positionAt } from "../geo.mjs";
test("metres calculation", () => {
  assert.ok(metersBetween([3.47, 6.44], [3.48, 6.44]) > 1000);
  assert.ok(metersBetween([3.47, 6.44], [3.48, 6.44]) < 1200);
});
test("bearing and coordinate movement", () => {
  assert.ok(Math.abs(bearingBetween([3, 6], [3.01, 6]) - 90) < 0.01);
  assert.ok(advanceCoordinate([3, 6], 0, 100)[1] > 6);
});
test("route interpolation and proximity", () => {
  const route = buildRoute([[3, 6], [3.01, 6], [3.01, 6.01]]);
  assert.ok(Math.abs(positionAt(route, route.lengths[1] / 2).coordinate[0] - 3.005) < 0.00001);
  const near = closestPoint(route, [3.005, 6.001]);
  assert.ok(near.distance > 100 && near.distance < 120);
});
test("angle wraps", () => {
  assert.equal(angleDifference(350, 10), 20);
  assert.equal(angleDifference(10, 350), -20);
});
