import { describe, expect, it } from "vitest";
import { Scene } from "../src/core/scene";

const pen = { color: "#000", size: 4 };

function drawLine(scene: Scene): void {
  scene.beginStroke([0, 0, 0.5], pen, true);
  scene.extendStroke([10, 10, 0.5]);
  scene.endStroke();
}

describe("Scene", () => {
  it("commits a stroke only when it ends", () => {
    const scene = new Scene();
    scene.beginStroke([0, 0, 0.5], pen, true);
    expect(scene.items).toHaveLength(0);
    scene.endStroke();
    expect(scene.items).toHaveLength(1);
  });

  it("undoes and redoes strokes and clears", () => {
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

  it("drops redo history after a new stroke", () => {
    const scene = new Scene();
    drawLine(scene);
    scene.undo();
    drawLine(scene);
    expect(scene.redo()).toBe(false);
  });

  it("discards a cancelled stroke", () => {
    const scene = new Scene();
    scene.beginStroke([0, 0, 0.5], pen, true);
    scene.cancelStroke();
    scene.endStroke();
    expect(scene.items).toHaveLength(0);
  });
});
