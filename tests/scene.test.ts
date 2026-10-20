import { describe, expect, it } from "vitest";
import { Scene } from "../src/core/scene";

const style = { color: "#000", size: 4 };

function drawLine(scene: Scene, y = 0): void {
  scene.beginStroke("pen", [0, y, 0.5], style, true);
  scene.extend([10, y, 0.5]);
  scene.endItem();
}

describe("Scene", () => {
  it("commits a stroke only when it ends", () => {
    const scene = new Scene();
    scene.beginStroke("pen", [0, 0, 0.5], style, true);
    expect(scene.items).toHaveLength(0);
    scene.endItem();
    expect(scene.items).toHaveLength(1);
  });

  it("undoes and redoes items and clears", () => {
    const scene = new Scene();
    drawLine(scene);
    drawLine(scene);
    scene.clear();
    expect(scene.items).toHaveLength(0);
    expect(scene.undo()).toBe(true);
    expect(scene.items).toHaveLength(2);
    expect(scene.undo()).toBe(true);
    expect(scene.items).toHaveLength(1);
    expect(scene.redo()).toBe(true);
    expect(scene.items).toHaveLength(2);
  });

  it("drops redo history after a new item", () => {
    const scene = new Scene();
    drawLine(scene);
    scene.undo();
    drawLine(scene);
    expect(scene.redo()).toBe(false);
  });

  it("discards a cancelled item", () => {
    const scene = new Scene();
    scene.beginStroke("pen", [0, 0, 0.5], style, true);
    scene.cancelItem();
    scene.endItem();
    expect(scene.items).toHaveLength(0);
  });

  it("moves a shape's free end and skips zero-size shapes", () => {
    const scene = new Scene();
    scene.beginShape("rect", [5, 5], style);
    scene.endItem();
    expect(scene.items).toHaveLength(0);

    scene.beginShape("arrow", [0, 0], style);
    scene.extend([20, 30, 0.5]);
    scene.endItem();
    expect(scene.items[0]).toMatchObject({ kind: "shape", tool: "arrow", start: [0, 0], end: [20, 30] });
  });

  it("erases touched items as a single undo step", () => {
    const scene = new Scene();
    drawLine(scene, 0);
    drawLine(scene, 100);
    drawLine(scene, 200);

    scene.beginErase();
    scene.eraseAt([5, 0], 4);
    scene.eraseAt([5, 100], 4);
    scene.endErase();
    expect(scene.items).toHaveLength(1);

    scene.undo();
    expect(scene.items).toHaveLength(3);
  });

  it("adds no history when the eraser touches nothing", () => {
    const scene = new Scene();
    drawLine(scene);
    scene.beginErase();
    scene.eraseAt([500, 500], 4);
    scene.endErase();
    scene.undo();
    expect(scene.items).toHaveLength(0);
  });
});
