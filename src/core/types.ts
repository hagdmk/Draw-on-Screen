/** A sampled input point: x, y in CSS pixels and pen pressure in [0, 1]. */
export type InputPoint = [x: number, y: number, pressure: number];

/** A freehand stroke stored as vector data, so it can be selected, erased or faded later. */
export interface Stroke {
  id: number;
  points: InputPoint[];
  color: string;
  size: number;
  /** True for mouse/touch input, where pressure is derived from speed instead of the device. */
  simulatePressure: boolean;
}

export interface PenStyle {
  color: string;
  size: number;
}
