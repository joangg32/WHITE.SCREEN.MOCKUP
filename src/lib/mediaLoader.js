// Load a bundled preset image (served from /public) as a media object.
export function loadMediaFromUrl(url) {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve({ type: 'image', el, width: el.naturalWidth, height: el.naturalHeight, url });
    el.onerror = () => reject(new Error('No se pudo cargar el preset.'));
    el.src = url;
  });
}

// Load a user File into a ready-to-use media element.
// Returns { type: 'image'|'video', el, width, height, url }.
export function loadMedia(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    if (file.type.startsWith('video/')) {
      const el = document.createElement('video');
      el.src = url;
      el.loop = true;
      el.muted = true;
      el.playsInline = true;
      el.crossOrigin = 'anonymous';
      el.addEventListener('loadeddata', () => {
        resolve({ type: 'video', el, width: el.videoWidth, height: el.videoHeight, url });
      }, { once: true });
      el.addEventListener('error', () => reject(new Error('No se pudo cargar el vídeo.')));
    } else if (file.type.startsWith('image/')) {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve({ type: 'image', el, width: el.naturalWidth, height: el.naturalHeight, url });
      el.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
      el.src = url;
    } else {
      reject(new Error('Formato no soportado: ' + file.type));
    }
  });
}
