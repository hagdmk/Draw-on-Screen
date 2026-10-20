import { describe, expect, it } from "vitest";
import { constrainEnd, distanceToSegment, hitTest } from "../src/core/geometry";
import type { Shape } from "../src/core/types";

const shape = (tool: Shape["tool"], end: [number, number]): Shape => ({
  kind: "shape",
  id: 1,
  tool,
  start: [0, 0],
  end,
  color: "#000",
  size: 2,
});

describe("geometry", () => {
  it("measures distance to a segment, including its ends", () => {
    expect(distanceToSegment([5, 3], [0, 0], [10, 0])).toBeCloseTo(3);
    expect(distanceToSegment([-4, 3], [0, 0], [10, 0])).toBeCloseTo(5);
  });

  it("hits rectangles on their edges, not their empty middle", () => {
    const rect = shape("rect", [100, 100]);
    expect(hitTest(rect, [50, 1], 2)).toBe(true);
    expect(hitTest(rect, [50, 50], 2)).toBe(false);
  });

  it("hits ellipses near their outline", () => {
    const ellipse = shape("ellipse", [100, 50]);
    expect(hitTest(ellipse, [100, 25], 2)).toBe(true);
    expect(hitTest(ellipse, [50, 25], 2)).toBe(false);
  });

  it("snaps lines to 45 degrees and boxes to squares", () => {
    const [x, y] = constrainEnd("line", [0, 0], [100, 90]);
    expect(x).toBeCloseTo(y);
    expect(constrainEnd("rect", [0, 0], [100, -40])).toEqual([100, -100]);
  });
});
