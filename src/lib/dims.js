// Output canvas dimensions after a mockup rotation. 90°/270° swap width/height
// so the rotated mockup fills the canvas exactly.
export function effectiveDims(mockup, rotation) {
  if (!mockup) return { w: 1, h: 1 };
  const turned = rotation === 90 || rotation === 270;
  return turned
    ? { w: mockup.height, h: mockup.width }
    : { w: mockup.width, h: mockup.height };
}
