// Preset mockups bundled in /public/presets. Vite serves /public at the root,
// so these resolve at runtime without imports/bundling.
export const PRESETS = Array.from({ length: 15 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return { id: n, label: `M-${n}`, url: `/presets/preset-${n}.jpg` };
});
