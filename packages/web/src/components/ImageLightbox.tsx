import { useEffect } from 'react';

/** 渲染图灯箱：显示 cncmaps 返回的 PNG，Esc / 点击遮罩关闭。 */
export default function ImageLightbox({
  src,
  title,
  onClose,
}: {
  src: string;
  title?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="preview-lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <div className="preview-lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <div className="preview-lightbox-bar">
          <span className="preview-lightbox-title">{title ?? '预览'}</span>
          <button type="button" className="btn-secondary" onClick={onClose}>
            关闭 (Esc)
          </button>
        </div>
        <img
          src={src}
          alt={title ?? '预览'}
          style={{
            maxWidth: 'calc(100vw - 48px)',
            maxHeight: 'calc(100vh - 130px)',
            display: 'block',
            objectFit: 'contain',
            background: '#000',
          }}
        />
      </div>
    </div>
  );
}
