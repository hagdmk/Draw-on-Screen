import { hitTest } from "./geometry";
import type { FreehandTool, InputPoint, Item, Point, ShapeTool } from "./types";

interface Style {
  color: string;
  size: number;
}

/**
 * Holds every drawn item plus undo/redo history.
 * History stores whole snapshots of the item list; items are immutable once committed,
 * so snapshots share item objects and stay cheap.
 */
export class Scene {
  private list: Item[] = [];
  private undoStack: Item[][] = [];
  private redoStack: Item[][] = [];
  private nextId = 1;
  private active: Item | null = null;
  /** The item list as it was when the current eraser gesture began. */
  private eraseBase: Item[] | null = null;

  get items(): readonly Item[] {
    return this.list;
  }

  get activeItem(): Item | null {
    return this.active;
  }

  beginStroke(tool: FreehandTool, point: InputPoint, style: Style, simulatePressure: boolean): void {
    this.active = { kind: "stroke", id: this.nextId++, tool, points: [point], simulatePressure, ...style };
  }

  beginShape(tool: ShapeTool, point: Point, style: Style): void {
    this.active = { kind: "shape", id: this.nextId++, tool, start: point, end: point, ...style };
  }

  /** Adds a point to the stroke being drawn, or moves the free end of the shape. */
  extend(point: InputPoint): void {
    if (!this.active) return;
    if (this.active.kind === "stroke") this.active.points.push(point);
    else this.active.end = [point[0], point[1]];
  }

  endItem(): void {
    const item = this.active;
    this.active = null;
    if (!item) return;
    // A click with a shape tool would leave an invisible zero-size shape.
    if (item.kind === "shape" && item.start[0] === item.end[0] && item.start[1] === item.end[1]) return;
    this.commit([...this.list, item]);
  }

  cancelItem(): void {
    this.active = null;
  }

  beginErase(): void {
    this.eraseBase = this.list;
  }

  /** Removes every item touching the eraser; the whole gesture is one undo step. */
  eraseAt(point: Point, radius: number): boolean {
    if (!this.eraseBase) return false;
    const remaining = this.list.filter((item) => !hitTest(item, point, radius));
    if (remaining.length === this.list.length) return false;
    this.list = remaining;
    return true;
  }

  endErase(): void {
    const base = this.eraseBase;
    this.eraseBase = null;
    if (!base || base.length === this.list.length) return;
    this.undoStack.push(base);
    this.redoStack = [];
  }

  clear(): void {
    if (this.list.length === 0) return;
    this.commit([]);
  }

  undo(): boolean {
    const previous = this.undoStack.pop();
    if (!previous) return false;
    this.redoStack.push(this.list);
    this.list = previous;
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(this.list);
    this.list = next;
    return true;
  }

  private commit(next: Item[]): void {
    this.undoStack.push(this.list);
    this.redoStack = [];
    this.list = next;
  }
}
