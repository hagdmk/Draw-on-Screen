import { describe, expect, it } from "vitest";
import { applyOp, type SceneOp } from "../src/core/ops";
import { Scene } from "../src/core/scene";

const style = { color: "#000", size: 4 };

describe("applyOp", () => {
  it("keeps two scenes identical when both apply the same ops", () => {
    const ops: SceneOp[] = [
      { op: "stroke", tool: "pen", point: [0, 0, 0.5], style, simulatePressure: true },
      { op: "extend", points: [[10, 0, 0.5], [20, 0, 0.5]] },
      { op: "end" },
      { op: "shape", tool: "rect", point: [0, 50], style },
      { op: "extend", points: [[30, 80, 0.5]] },
      { op: "end" },
      { op: "erase-begin" },
      { op: "erase", point: [10, 0], radius: 5 },
      { op: "erase-end" },
    ];
    const local = new Scene();
    const remote = new Scene();
    for (const op of ops) {
      applyOp(local, op);
      applyOp(remote, op);
    }
    expect(remote.items).toEqual(local.items);
    expect(local.items).toHaveLength(1);
    expect(local.items[0].kind).toBe("shape");
    // The eraser gesture is one undo step on both copies.
    local.undo();
    remote.undo();
    expect(remote.items).toEqual(local.items);
    expect(local.items).toHaveLength(2);
  });

  it("reports when an eraser pass removes nothing", () => {
    const scene = new Scene();
    applyOp(scene, { op: "erase-begin" });
    expect(applyOp(scene, { op: "erase", point: [0, 0], radius: 5 })).toBe(false);
  });
});
