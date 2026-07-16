// Preset mockups bundled in /public/presets. Vite serves /public at the base
// URL, so prefix with BASE_URL to work both locally and on GitHub Pages.
export const PRESETS = Array.from({ length: 15 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return { id: n, label: `M-${n}`, url: `${import.meta.env.BASE_URL}presets/preset-${n}.jpg` };
});
