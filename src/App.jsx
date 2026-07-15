import { useEffect, useRef, useState } from 'react';
import Uploader from './components/Uploader.jsx';
import Controls from './components/Controls.jsx';
import ContentAdjust from './components/ContentAdjust.jsx';
import MockupAdjust from './components/MockupAdjust.jsx';
import PresetPicker from './components/PresetPicker.jsx';
import PreviewStage from './components/PreviewStage.jsx';
import { loadMedia, loadMediaFromUrl } from './lib/mediaLoader.js';
import { exportImage, exportVideo } from './lib/exporter.js';
import { effectiveDims } from './lib/dims.js';

const DEFAULT_ADJUST = {
  rotation: 0, flipH: false, flipV: false, scale: 1, offsetX: 0, offsetY: 0, fitMode: 'fill',
};
const DEFAULT_MOCK_ADJUST = { rotation: 0, flipH: false, flipV: false };

export default function App() {
  const [mockup, setMockup] = useState(null);
  const [content, setContent] = useState(null);
  const [corners, setCorners] = useState(null);
  const [keying, setKeying] = useState({ threshold: 0.8, softness: 0.05, satMax: 0.15 });
  const [adjust, setAdjust] = useState(DEFAULT_ADJUST);
  const [mockAdjust, setMockAdjust] = useState(DEFAULT_MOCK_ADJUST);
  const [mode, setMode] = useState('composite');
  const [busy, setBusy] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);

  // Reset mockup orientation when a brand-new mockup is loaded.
  useEffect(() => { setMockAdjust(DEFAULT_MOCK_ADJUST); }, [mockup]);

  // Seed the 4 corners to an inset rectangle, re-seeding when the mockup or its
  // rotation changes the output dimensions (orientation changed, so old corner
  // positions no longer make sense).
  useEffect(() => {
    if (!mockup) return;
    const { w, h } = effectiveDims(mockup, mockAdjust.rotation);
    const mx = w * 0.25, my = h * 0.25;
    setCorners([[mx, my], [w - mx, my], [w - mx, h - my], [mx, h - my]]);
  }, [mockup, mockAdjust.rotation]);

  const handleFile = (setter) => async (file) => {
    setError('');
    try { setter(await loadMedia(file)); } catch (e) { setError(e.message); }
  };

  const pickPreset = async (preset) => {
    setError('');
    try { setMockup(await loadMediaFromUrl(preset.url)); } catch (e) { setError(e.message); }
  };

  const onCornerChange = (i, pt) =>
    setCorners((c) => c.map((p, j) => (j === i ? pt : p)));

  const isVideoExport = mockup?.type === 'video' || content?.type === 'video';

  const handleExport = async () => {
    if (!mockup || !canvasRef.current) return;
    setBusy('exporting');
    setProgress(0);
    try {
      if (!isVideoExport) {
        await exportImage(canvasRef.current, 'mockup.png');
      } else {
        const videos = [];
        if (mockup.type === 'video') videos.push(mockup.el);
        if (content?.type === 'video') videos.push(content.el);
        const durMs = 1000 * Math.max(
          mockup.type === 'video' ? mockup.el.duration : 0,
          content?.type === 'video' ? content.el.duration : 0,
          0.5,
        );
        await exportVideo({
          canvas: canvasRef.current, videos, durationMs: durMs,
          onProgress: setProgress, filename: 'mockup.webm',
        });
      }
    } catch (e) {
      setError('Error al exportar: ' + e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="app">
      <header className="masthead">
        <nav className="topbar">
          <span className="topbar-mark"><i className="dot" />Mockup.Studio</span>
          <span className="topbar-center">Basic.White.Screen</span>
          <span className="topbar-right">{mockup ? `${mockup.width}×${mockup.height}` : 'No source'} · WebGL</span>
        </nav>
        <h1 className="hero">White.Screen.<span className="accent">Mockup</span></h1>
        <div className="viewrow">
          <button className={`vlink ${mode === 'composite' ? 'on' : ''}`} onClick={() => setMode('composite')}>Composición</button>
          <span className="vsep">/</span>
          <button className={`vlink ${mode === 'mask' ? 'on' : ''}`} onClick={() => setMode('mask')}>Máscara</button>
        </div>
      </header>

      <div className="layout">
        <aside className="panel">
          <fieldset className="block">
            <legend>Mockup</legend>
            <Uploader label="Subir mockup" accept="image/*,video/*"
              media={mockup} onFile={handleFile(setMockup)} />
            <p className="micro">o elige uno predefinido</p>
            <PresetPicker activeUrl={mockup?.url} onPick={pickPreset} />
            <p className="micro">Orientación del mockup</p>
            <MockupAdjust mockAdjust={mockAdjust} setMockAdjust={setMockAdjust} disabled={!mockup} />
            <Uploader label="Subir contenido" accept="image/*,video/*"
              media={content} onFile={handleFile(setContent)} />
          </fieldset>

          <ContentAdjust adjust={adjust} setAdjust={setAdjust} disabled={!content} />
          <Controls keying={keying} setKeying={setKeying} disabled={!mockup} />

          <button className="export" disabled={!mockup || busy} onClick={handleExport}>
            {busy === 'exporting'
              ? (isVideoExport ? `Grabando ${Math.round(progress * 100)}%` : 'Exportando…')
              : (isVideoExport ? 'Exportar vídeo · WebM' : 'Exportar imagen · PNG')}
          </button>

          {error && <p className="error">{error}</p>}
        </aside>

        <main className="viewport">
          {corners ? (
            <PreviewStage
              mockup={mockup} content={content} corners={corners}
              keying={keying} adjust={adjust} mockAdjust={mockAdjust} mode={mode} showHandles={!busy}
              onCornersChange={onCornerChange}
              registerCanvas={(c) => { canvasRef.current = c; }}
            />
          ) : (
            <div className="stage stage-placeholder">
              <span>Carga o elige un mockup para empezar</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
