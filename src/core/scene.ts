import type { InputPoint, PenStyle, Stroke } from "./types";

/**
 * Holds every drawn object plus undo/redo history.
 * History stores whole snapshots of the stroke list; strokes are immutable once committed,
 * so snapshots share stroke objects and stay cheap.
 */
export class Scene {
  private strokes: Stroke[] = [];
  private undoStack: Stroke[][] = [];
  private redoStack: Stroke[][] = [];
  private nextId = 1;
  private active: Stroke | null = null;

  get items(): readonly Stroke[] {
    return this.strokes;
  }

  get activeStroke(): Stroke | null {
    return this.active;
  }

  beginStroke(point: InputPoint, style: PenStyle, simulatePressure: boolean): void {
    this.active = {
      id: this.nextId++,
      points: [point],
      color: style.color,
      size: style.size,
      simulatePressure,
    };
  }

  extendStroke(point: InputPoint): void {
    this.active?.points.push(point);
  }

  endStroke(): void {
    if (!this.active) return;
    this.commit([...this.strokes, this.active]);
    this.active = null;
  }

  cancelStroke(): void {
    this.active = null;
  }

  clear(): void {
    if (this.strokes.length === 0) return;
    this.commit([]);
  }

  undo(): boolean {
    const previous = this.undoStack.pop();
    if (!previous) return false;
    this.redoStack.push(this.strokes);
    this.strokes = previous;
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(this.strokes);
    this.strokes = next;
    return true;
  }

  private commit(next: Stroke[]): void {
    this.undoStack.push(this.strokes);
    this.redoStack = [];
    this.strokes = next;
  }
}
