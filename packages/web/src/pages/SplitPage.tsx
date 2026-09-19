import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchTheaters,
  splitMap,
  detectSplitTheater,
  fetchMapPreviews,
  downloadText,
  type MapPreviewData,
  type MapSplitSlice,
  type SplitResult,
  type TheaterDetection,
  type TheaterInfo,
} from '../api';
import MapPreviewCanvas from '../components/MapPreviewCanvas';
import PreviewLightbox from '../components/PreviewLightbox';

// ============== 类型 ==============

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

const THEATER_LABELS: Record<string, string> = {
  DESERT: '沙漠 DESERT',
  NEWURBAN: '新城市 NEWURBAN',
  TEMPERATE: '温带 TEMPERATE',
  TEMPERATE_Islands: '温带岛屿 TEMPERATE_Islands'
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// ============== 组件 ==============

export default function SplitPage() {
  const [theaters, setTheaters] = useState<TheaterInfo[]>([]);
  const [theaterType, setTheaterType] = useState('');
  const [theatersError, setTheatersError] = useState<string | null>(null);

  const [mapContent, setMapContent] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [skipEmpty, setSkipEmpty] = useState(true);

  /** 默认按地图内容自动识别 theater —— 手动选错会导致单元尺寸不符、地形错位 */
  const [autoTheater, setAutoTheater] = useState(true);
  const [detection, setDetection] = useState<TheaterDetection | null>(null);
  const [detecting, setDetecting] = useState(false);

  /**
   * 窗外框：沿用手工单元的画法（empty.map 的框图块），只画在功能窗口之外，
   * 对生成器纯视觉（已由 verify-split 的惰性证明背书）。
   * 开了它，切片在地图编辑器里不再是一片空白。
   */
  const [frame, setFrame] = useState(true);

  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [result, setResult] = useState<SplitResult | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  /** 源图雷达预览（粘贴/上传后防抖渲染） */
  const [sourcePreview, setSourcePreview] = useState<MapPreviewData | null>(null);
  /** 每张切片的雷达缩略图（拆解成功后批量渲染） */
  const [slicePreviews, setSlicePreviews] = useState<Record<string, MapPreviewData>>({});
  /** 大图查看器（灯箱） */
  const [lightbox, setLightbox] = useState<{ preview: MapPreviewData; title: string } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchTheaters();
        if (cancelled) return;
        setTheaters(list);
        if (list.length > 0) setTheaterType(list[0].name);
      } catch (e) {
        if (!cancelled) setTheatersError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 内容变化 → 防抖识别（识别走服务端，避免前端重复实现解析规则）
  useEffect(() => {
    const text = mapContent;
    if (text.trim().length === 0) {
      setDetection(null);
      setDetecting(false);
      return;
    }
    let cancelled = false;
    setDetecting(true);
    const timer = setTimeout(async () => {
      try {
        const d = await detectSplitTheater(text);
        if (!cancelled) setDetection(d);
      } catch {
        if (!cancelled) setDetection(null);
      } finally {
        if (!cancelled) setDetecting(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mapContent]);

  // 源图雷达预览：内容变化后防抖渲染（与识别同一个防抖节奏）
  useEffect(() => {
    const text = mapContent;
    if (text.trim().length === 0) {
      setSourcePreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const [p] = await fetchMapPreviews([text]);
        if (!cancelled) setSourcePreview(p ?? null);
      } catch {
        if (!cancelled) setSourcePreview(null);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mapContent]);

  /** 自动模式下实际生效的 theater 目录 */
  const effectiveTheater = autoTheater ? (detection?.dir ?? '') : theaterType;

  const currentTheater = useMemo(
    () => theaters.find((t) => t.name === effectiveTheater) ?? null,
    [theaters, effectiveTheater]
  );

  const detectedTheaterInfo = useMemo(
    () => theaters.find((t) => t.name === detection?.dir) ?? null,
    [theaters, detection]
  );

  /** 自动识别可用（读到了 theater 且本地有对应目录） */
  const autoUsable = !!(detection && detection.dir);

  const selectedSlice = useMemo(
    () => result?.slices.find((s) => s.name === selected) ?? null,
    [result, selected]
  );

  const stats = useMemo(() => {
    if (!result) return null;
    const bytes = result.slices.reduce((sum, s) => sum + s.content.length, 0);
    return { bytes, avg: Math.round(bytes / Math.max(1, result.slices.length)) };
  }, [result]);

  /** 切片在网格里的布局范围 */
  const layout = useMemo(() => {
    if (!result || result.slices.length === 0) return null;
    const cols = Math.max(...result.slices.map((s) => s.gridX)) + 1;
    const rows = Math.max(...result.slices.map((s) => s.gridY)) + 1;
    const byKey = new Map<string, MapSplitSlice>();
    for (const s of result.slices) byKey.set(`${s.gridX},${s.gridY}`, s);
    return { cols, rows, byKey };
  }, [result]);

  /** 手动选择的目录是否与识别结果不符 */
  const manualMismatch = !autoTheater && !!detection?.dir && theaterType !== detection.dir;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setMapContent(text);
      setSourceName(file.name);
      setStatus({ kind: 'idle' });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  function clearAll() {
    setMapContent('');
    setSourceName('');
    setResult(null);
    setSelected(null);
    setDetection(null);
    setSourcePreview(null);
    setSlicePreviews({});
    setStatus({ kind: 'idle' });
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSplit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    setSelected(null);

    if (mapContent.trim().length === 0) {
      setStatus({ kind: 'error', message: '请粘贴或上传一张完整地图的文本内容' });
      return;
    }
    if (autoTheater && !autoUsable) {
      setStatus({
        kind: 'error',
        message: detection?.engineTheater
          ? `地图的 Theater=${detection.engineTheater} 在本仓库没有对应地形目录，请关闭自动识别并手动指定`
          : '没能从地图内容识别出地图类型，请确认内容完整，或关闭自动识别并手动指定',
      });
      return;
    }
    if (!autoTheater && !theaterType) {
      setStatus({ kind: 'error', message: '请选择地图类型（theater）' });
      return;
    }

    setStatus({ kind: 'loading' });
    try {
      const res = await splitMap({
        mapContent,
        autoTheater,
        theaterType: autoTheater ? undefined : theaterType,
        skipEmpty,
        frame,
      });
      setResult(res);
      if (res.slices.length > 0) setSelected(res.slices[0].name);
      // 批量渲染切片缩略图（一次请求把全部切片渲染完）
      fetchMapPreviews(res.slices.map((s) => s.content))
        .then((items) => {
          const map: Record<string, MapPreviewData> = {};
          res.slices.forEach((s, i) => { if (items[i]) map[s.name] = items[i]; });
          setSlicePreviews(map);
        })
        .catch(() => setSlicePreviews({}));
      setStatus({
        kind: 'success',
        message: res.count > 0
          ? `已按 ${res.theaterDir}（单元 ${res.unitSize}${res.theaterSource === 'auto' ? '，自动识别' : '，手动指定'}）拆解出 ${res.count} 张切片`
          : '拆解完成，但没有任何切片产出（可能全部为内部空地，试关闭「跳过内部空地」）',
      });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  function downloadSlice(slice: MapSplitSlice) {
    downloadText(`${slice.name}.map`, slice.content, 'text/plain');
  }

  async function downloadAll() {
    if (!result) return;
    for (const s of result.slices) {
      downloadSlice(s);
      // 浏览器对连续下载有节流，逐张错开
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  function downloadManifest() {
    if (!result) return;
    const manifest = {
      theater: result.theater,
      theaterDir: result.theaterDir,
      unitSize: result.unitSize,
      theaterSource: result.theaterSource,
      detectedTheater: result.detectedTheater,
      frame: result.frame,
      skipEmpty,
      count: result.count,
      slices: result.slices.map((s) => ({
        name: s.name,
        gridX: s.gridX,
        gridY: s.gridY,
        bytes: s.content.length,
      })),
    };
    downloadText('manifest.json', JSON.stringify(manifest, null, 2), 'application/json');
  }

  return (
    <form className="panel" onSubmit={handleSplit}>
      {/* ========== 输入区 ========== */}
      <section className="section">
        <h2 className="section-title">地图类型</h2>

        <div className="field field-inline">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={autoTheater}
              onChange={(e) => setAutoTheater(e.target.checked)}
            />
            <span>按地图内容自动识别地图类型（推荐）</span>
          </label>
        </div>

        {autoTheater ? (
          <div className={`detect-box ${autoUsable ? 'detect-ok' : 'detect-warn'}`}>
            {detecting && (
              <span className="detect-line">
                <span className="spinner" />
                正在识别地图类型...
              </span>
            )}
            {!detecting && !detection && mapContent.trim().length === 0 && (
              <span className="detect-line">粘贴或上传地图后自动识别</span>
            )}
            {!detecting && detection && (
              <>
                <span className="detect-line">
                  <span className="detect-k">地图 Theater</span>
                  <span className="detect-v">{detection.engineTheater ?? '（未找到 [Map] Theater 键）'}</span>
                  {detection.engineTheater && <span className="detect-tag">{detection.exactNameMatch ? '精确匹配' : '按 Theater 字段匹配'}</span>}
                </span>
                <span className="detect-line">
                  <span className="detect-k">使用目录</span>
                  <span className="detect-v">
                    {detection.dir
                      ? `${detection.dir}${detectedTheaterInfo ? `（单元 ${detectedTheaterInfo.mapUnitSize}）` : ''}`
                      : '本仓库没有对应地形目录'}
                  </span>
                </span>
                {detection.ambiguous && (
                  <span className="detect-line detect-note">
                    该 Theater 名在本地对应多个目录：{detection.candidates.join(' / ')}，已默认选 {detection.dir}
                  </span>
                )}
                {!detection.hasMapSection && (
                  <span className="detect-line detect-note">内容里没有 [Map] 段，识别可能不准</span>
                )}
                {!detection.dir && (
                  <span className="detect-line detect-note">
                    可用目录：{detection.available.join(' / ')}；请关闭自动识别后手动指定
                  </span>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid">
              <div className="field">
                <label htmlFor="splitTheater">手动指定地图类型 (theater)</label>
                <select
                  id="splitTheater"
                  value={theaterType}
                  onChange={(e) => setTheaterType(e.target.value)}
                  disabled={theaters.length === 0}
                >
                  {theaters.length === 0 && <option value="">{theatersError ? '(加载失败)' : '加载中...'}</option>}
                  {theaters.map((t) => (
                    <option key={t.name} value={t.name}>{THEATER_LABELS[t.name] || t.name}</option>
                  ))}
                </select>
                {currentTheater && (
                  <span className="field-hint">
                    单元 {currentTheater.mapUnitSize} · 顶角 {currentTheater.topCorner} · 图块 {currentTheater.mapUnitCount}
                  </span>
                )}
                {theatersError && <span className="field-hint error">{theatersError}</span>}
              </div>
            </div>
            {manualMismatch && (
              <div className="notice notice-warn" style={{ marginTop: 12 }}>
                地图自己的 Theater 是 <strong>{detection?.engineTheater}</strong>
                （本地目录 {detection?.dir}，单元 {detectedTheaterInfo?.mapUnitSize}），
                但你手动选的是 <strong>{theaterType}</strong>。
                单元尺寸不同会切出错位的地形，除非你明确知道为什么要覆盖。
              </div>
            )}
          </>
        )}

        <div className="grid" style={{ marginTop: 14 }}>
          <div className="field">
            <label htmlFor="splitFile">上传地图文件</label>
            <input
              id="splitFile"
              ref={fileRef}
              type="file"
              accept=".map,.yrm,.ini,.txt"
              onChange={handleFile}
            />
            <span className="field-hint">{sourceName ? `已载入：${sourceName}` : '选择 .map / .yrm 文本文件'}</span>
          </div>
        </div>

        <div className="field field-inline" style={{ marginTop: 14 }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={skipEmpty}
              onChange={(e) => setSkipEmpty(e.target.checked)}
            />
            <span>跳过内部空地（与 CLI 默认一致）</span>
          </label>
        </div>

        <div className="field field-inline" style={{ marginTop: 8 }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={frame}
              onChange={(e) => setFrame(e.target.checked)}
            />
            <span>绘制单元边框（沿用手工单元画法，只画在功能区之外，编辑器里不再大片空白）</span>
          </label>
        </div>
      </section>

      {/* ========== 内容区 ========== */}
      <section className="section">
        <h2 className="section-title">地图内容</h2>
        <div className="field">
          <label htmlFor="splitContent">完整地图 INI 文本</label>
          <textarea
            id="splitContent"
            className="code-input"
            rows={10}
            spellCheck={false}
            placeholder="粘贴完整地图（[Map] / [IsoMapPack5] / [OverlayPack] …）的文本内容，或从上方上传文件"
            value={mapContent}
            onChange={(e) => {
              setMapContent(e.target.value);
              if (sourceName) setSourceName('');
            }}
          />
          <span className="field-hint">
            {mapContent.length > 0 ? `${formatBytes(mapContent.length)}` : '等待输入'}
          </span>
          {sourcePreview && (
            <div className="preview-block">
              <span className="field-hint">雷达预览（minimap 配色，一格一像素，点击放大）</span>
              <MapPreviewCanvas
                preview={sourcePreview}
                maxWidth={560}
                className="preview-img"
                title="点击放大"
                onClick={() => setLightbox({ preview: sourcePreview, title: '源图预览' })}
              />
            </div>
          )}
        </div>
      </section>

      {/* ========== 操作区 ========== */}
      <section className="section action-section">
        <div className="button-row">
          <button type="submit" className="btn-generate" disabled={status.kind === 'loading'}>
            {status.kind === 'loading' ? '拆解中...' : '拆解为切片'}
          </button>
          <button type="button" className="btn-secondary" onClick={clearAll}>
            清空
          </button>
        </div>

        {status.kind === 'loading' && (
          <div className="status status-loading">
            <span className="spinner" />
            正在按 theater 单元尺寸切分地图...
          </div>
        )}
        {status.kind === 'success' && <div className="status status-success">{status.message}</div>}
        {status.kind === 'error' && <div className="status status-error">{status.message}</div>}
      </section>

      {/* ========== 结果区 ========== */}
      {result && stats && (
        <section className="section">
          <h2 className="section-title">拆解结果</h2>

          {result.warnings.length > 0 && (
            <div className="notice notice-warn" style={{ marginBottom: 12 }}>
              {result.warnings.map((w) => <div key={w}>{w}</div>)}
            </div>
          )}

          <div className="kv-grid">
            <div className="kv"><span className="kv-k">Theater</span><span className="kv-v">{result.theater}</span></div>
            <div className="kv">
              <span className="kv-k">使用目录 / 来源</span>
              <span className="kv-v">{result.theaterDir}（{result.theaterSource === 'auto' ? '自动识别' : '手动指定'}）</span>
            </div>
            <div className="kv"><span className="kv-k">单元尺寸</span><span className="kv-v">{result.unitSize}</span></div>
            <div className="kv"><span className="kv-k">切片数</span><span className="kv-v">{result.count}</span></div>
            <div className="kv"><span className="kv-k">总字节</span><span className="kv-v">{formatBytes(stats.bytes)}</span></div>
            <div className="kv"><span className="kv-k">平均切片</span><span className="kv-v">{formatBytes(stats.avg)}</span></div>
          </div>

          {layout && (
            <>
              <h3 className="sub-title">切片布局（gridX → 列，gridY → 行）</h3>
              <div
                className="slice-map"
                style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: layout.rows }).map((_, y) =>
                  Array.from({ length: layout.cols }).map((__, x) => {
                    const slice = layout.byKey.get(`${x},${y}`);
                    if (!slice) {
                      return <div key={`${x},${y}`} className="slice-cell empty">—</div>;
                    }
                    return (
                      <button
                        type="button"
                        key={slice.name}
                        className={`slice-cell ${selected === slice.name ? 'active' : ''}`}
                        onClick={() => setSelected(slice.name)}
                        title={`点击查看 ${slice.name}`}
                      >
                        <span className="slice-cell-name">{slice.name}</span>
                        {slicePreviews[slice.name] && (
                          <MapPreviewCanvas
                            preview={slicePreviews[slice.name]}
                            maxWidth={56}
                            className="slice-thumb"
                            title={`点击放大 ${slice.name}`}
                            onClick={() =>
                              setLightbox({
                                preview: slicePreviews[slice.name],
                                title: `切片 ${slice.name}（grid ${slice.gridX},${slice.gridY}）`,
                              })
                            }
                          />
                        )}
                        <span className="slice-cell-size">{formatBytes(slice.content.length)}</span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="field field-inline" style={{ marginTop: 12 }}>
              <button type="button" className="btn-secondary" onClick={downloadAll}>
                下载全部切片（{result.count}）
              </button>
              <button type="button" className="btn-secondary" onClick={downloadManifest}>
                下载 manifest.json
              </button>
              </div>
            </>
          )}

          {selectedSlice && (
            <>
              <h3 className="sub-title">
                {selectedSlice.name}.map
                <span className="sub-title-meta">
                  grid ({selectedSlice.gridX}, {selectedSlice.gridY}) · {formatBytes(selectedSlice.content.length)}
                </span>
              </h3>
              <div className="button-row">
                <button type="button" className="btn-secondary" onClick={() => downloadSlice(selectedSlice)}>
                  下载这一张
                </button>
              </div>
              {slicePreviews[selectedSlice.name] && (
                <div className="preview-block">
                  <span className="field-hint">本切片雷达预览（带窗外框，点击放大）</span>
                  <MapPreviewCanvas
                    preview={slicePreviews[selectedSlice.name]}
                    maxWidth={320}
                    className="preview-img"
                    title="点击放大"
                    onClick={() =>
                      setLightbox({
                        preview: slicePreviews[selectedSlice.name],
                        title: `切片 ${selectedSlice.name}（grid ${selectedSlice.gridX},${selectedSlice.gridY}）`,
                      })
                    }
                  />
                </div>
              )}
              <pre className="code-block">{selectedSlice.content.slice(0, 4000)}</pre>
              {selectedSlice.content.length > 4000 && (
                <span className="field-hint">仅显示前 4000 字符，共 {selectedSlice.content.length} 字符</span>
              )}
            </>
          )}
        </section>
      )}
      {lightbox && (
        <PreviewLightbox
          preview={lightbox.preview}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
        />
      )}
    </form>
  );
}
