import { useEffect, useRef } from 'react';
import { paintPreview, type MapPreviewData } from '../api';

/**
 * 地图雷达预览画布。
 *
 * 画布内部分辨率 = 预览的原始像素（一格一像素），CSS 按需缩放；
 * `image-rendering: pixelated` 保证放大后仍是清晰的色块而不是模糊插值。
 * 传入 `onClick` 时鼠标变放大镜（配合 PreviewLightbox 做「点击看大图」）。
 */
export default function MapPreviewCanvas({
  preview,
  maxWidth = 480,
  className,
  title,
  onClick,
}: {
  preview: MapPreviewData | null;
  maxWidth?: number;
  className?: string;
  /** 悬停提示 */
  title?: string;
  /** 点击回调（如打开大图查看器） */
  onClick?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current && preview) paintPreview(ref.current, preview);
  }, [preview]);

  if (!preview) return null;
  const scale = Math.min(1, maxWidth / preview.width);

  return (
    <canvas
      ref={ref}
      className={className}
      title={title}
      onClick={onClick}
      style={{
        width: Math.max(1, Math.round(preview.width * scale)),
        height: Math.max(1, Math.round(preview.height * scale)),
        imageRendering: 'pixelated',
        display: 'block',
        cursor: onClick ? 'zoom-in' : 'default',
      }}
    />
  );
}
