import { useEffect, useRef, useState } from 'react';
import { paintPreview, type MapPreviewData } from '../api';

/**
 * 预览大图查看器（灯箱）。
 *
 * - 按「铺满视口」的比例放大，`image-rendering: pixelated` 保证像素块清晰；
 * - Esc / 点击遮罩 / 点关闭按钮退出；
 * - 窗口尺寸变化时自动重算比例。
 */
export default function PreviewLightbox({
  preview,
  title,
  onClose,
}: {
  preview: MapPreviewData | null;
  title?: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (ref.current && preview) paintPreview(ref.current, preview);
  }, [preview]);

  if (!preview) return null;

  const availW = viewport.w - 96;
  const availH = viewport.h - 150;
  const scale = Math.max(1, Math.min(availW / preview.width, availH / preview.height));

  return (
    <div className="preview-lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <div className="preview-lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <div className="preview-lightbox-bar">
          <span className="preview-lightbox-title">
            {title ?? '预览'} · {preview.width}×{preview.height} 像素 · 放大 {scale.toFixed(1)}×
          </span>
          <button type="button" className="btn-secondary" onClick={onClose}>
            关闭 (Esc)
          </button>
        </div>
        <canvas
          ref={ref}
          style={{
            width: Math.round(preview.width * scale),
            height: Math.round(preview.height * scale),
            imageRendering: 'pixelated',
            display: 'block',
            background: '#000',
          }}
        />
      </div>
    </div>
  );
}
