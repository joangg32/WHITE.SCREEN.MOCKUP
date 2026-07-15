export default function Uploader({ label, accept, media, onFile }) {
  return (
    <label className="uploader">
      <span className="uploader-btn">{label}</span>
      <input
        type="file"
        accept={accept}
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); }}
      />
      <span className="uploader-status">
        {media ? `${media.type} · ${media.width}×${media.height}` : 'sin archivo'}
      </span>
    </label>
  );
}
