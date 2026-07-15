// Export helpers. Images use canvas.toBlob; video uses MediaRecorder on the
// canvas's captured stream — no ffmpeg download, no backend. Output is WebM.

export function exportImage(canvas, filename = 'mockup.png') {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      triggerDownload(blob, filename);
      resolve(blob);
    }, 'image/png');
  });
}

/**
 * Record the live canvas to a WebM while the source video(s) play once through.
 * @param {Object} p
 * @param {HTMLCanvasElement} p.canvas
 * @param {HTMLVideoElement[]} p.videos  video elements to restart & play once
 * @param {number} p.durationMs          how long to record
 * @param {(t:number)=>void} [p.onProgress]  0..1
 */
export function exportVideo({ canvas, videos, durationMs, onProgress, filename = 'mockup.webm' }) {
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(30);
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime });
      triggerDownload(blob, filename);
      resolve(blob);
    };
    rec.onerror = reject;

    // Restart sources from the beginning, without looping, for a clean pass.
    const prevLoop = videos.map((v) => v.loop);
    videos.forEach((v) => { v.loop = false; v.currentTime = 0; });
    Promise.all(videos.map((v) => v.play())).catch(() => {});

    const start = performance.now();
    rec.start();

    const tick = () => {
      const elapsed = performance.now() - start;
      onProgress?.(Math.min(1, elapsed / durationMs));
      if (elapsed >= durationMs) {
        rec.stop();
        videos.forEach((v, i) => { v.loop = prevLoop[i]; v.play().catch(() => {}); });
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
