import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchRmgMeta,
  deriveRmg,
  readSed,
  writeSed,
  generateRmg,
  downloadText,
  type DerivedDimensions,
  type RmgMeta,
  type RmgGenerateResult,
  type RmgOptionsPatch,
} from '../api';

// ============== 类型 ==============

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

const FILL_LABELS: Record<'unassigned' | 'clear', string> = {
  unassigned: '未赋值（TileNum = −1，管线初态）',
  clear: '清地 0（便于目视尺寸，非管线产物）',
};

// ============== 组件 ==============

export default function RmgPage() {
  const [meta, setMeta] = useState<RmgMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [values, setValues] = useState<Record<string, number>>({});
  const [description, setDescription] = useState('');
  const [derived, setDerived] = useState<DerivedDimensions | null>(null);
  /** 后端 clamp 之后的选项（用于提示哪些值会被收敛） */
  const [clampedOptions, setClampedOptions] = useState<Record<string, number> | null>(null);
  const [deriveError, setDeriveError] = useState<string | null>(null);

  const [sedText, setSedText] = useState('');
  const [sedInfo, setSedInfo] = useState<string | null>(null);

  const [mapName, setMapName] = useState('RMG Skeleton');
  const [fill, setFill] = useState<'unassigned' | 'clear'>('unassigned');
  const [withPreview, setWithPreview] = useState(true);

  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [genResult, setGenResult] = useState<RmgGenerateResult | null>(null);

  const sedFileRef = useRef<HTMLInputElement>(null);

  // 载入元数据
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await fetchRmgMeta();
        if (cancelled) return;
        const initial: Record<string, number> = {};
        const defaults = m.defaults as unknown as Record<string, number>;
        for (const f of m.fields) initial[f.key] = defaults[f.key];
        setMeta(m);
        setValues(initial);
        setDescription(m.defaults.description ?? '');
      } catch (e) {
        if (!cancelled) setMetaError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 选项变化 → 防抖后端推导（真实走 core 的 x87 契约，不在前端重算）
  useEffect(() => {
    if (!meta || Object.keys(values).length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await deriveRmg({ ...values, description });
        if (cancelled) return;
        setDerived(res.derived);
        setClampedOptions(res.options as unknown as Record<string, number>);
        setDeriveError(null);
      } catch (e) {
        if (!cancelled) setDeriveError(e instanceof Error ? e.message : String(e));
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [meta, values, description]);

  const payload = useMemo<RmgOptionsPatch>(
    () => ({ ...values, description }) as RmgOptionsPatch,
    [values, description]
  );

  const implementedCount = useMemo(
    () => (meta ? meta.stages.filter((s) => s.implemented).length : 0),
    [meta]
  );

  /**
   * 会被后端 clamp 收敛的字段。
   *
   * 构造器默认值本身就可能有落在范围外的（tiberium 默认 0，而 clamp 下限是 1），
   * 所以这里不阻止提交，而是如实提示「生成时会收敛为多少」。
   */
  const clampedFields = useMemo(() => {
    if (!meta || !clampedOptions) return [];
    const out: { key: string; label: string; from: number; to: number }[] = [];
    for (const f of meta.fields) {
      const from = values[f.key];
      const to = clampedOptions[f.key];
      if (typeof from === 'number' && typeof to === 'number' && from !== to) {
        out.push({ key: f.key, label: f.label, from, to });
      }
    }
    return out;
  }, [meta, clampedOptions, values]);

  function setField(key: string, raw: string) {
    setValues((prev) => {
      const n = raw === '' ? 0 : Number.parseInt(raw, 10);
      return { ...prev, [key]: Number.isFinite(n) ? n : 0 };
    });
  }

  function resetToDefaults() {
    if (!meta) return;
    const initial: Record<string, number> = {};
    const defaults = meta.defaults as unknown as Record<string, number>;
    for (const f of meta.fields) initial[f.key] = defaults[f.key];
    setValues(initial);
    setDescription(meta.defaults.description ?? '');
  }

  async function handleSedFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setSedText(text);
      setSedInfo(`已载入 ${file.name}（${text.length} 字符），点「还原为选项」应用`);
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleSedImport() {
    if (sedText.trim().length === 0) {
      setSedInfo('请先粘贴 .SED 文本或上传文件');
      return;
    }
    try {
      const res = await readSed(sedText, payload);
      const next: Record<string, number> = { ...values };
      for (const f of meta?.fields ?? []) {
        next[f.key] = (res.options as unknown as Record<string, number>)[f.key];
      }
      setValues(next);
      setDescription(res.options.description ?? '');
      const extra = res.ignoredKeys.length > 0 ? ` · 忽略键：${res.ignoredKeys.join(', ')}` : '';
      setSedInfo(
        res.sectionFound
          ? `已还原 [RandomMap] 段（carry-default：缺键保留原值）${extra}`
          : `未找到 [RandomMap] 段，选项保持原值${extra}`
      );
    } catch (err) {
      setSedInfo(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSedExport() {
    try {
      const res = await writeSed(payload);
      downloadText('RandomMap.sed', res.content, 'text/plain');
      setSedInfo('已导出 RandomMap.sed（键序与原生 writer 一致）');
    } catch (err) {
      setSedInfo(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleGenerate() {
    setStatus({ kind: 'loading' });
    setGenResult(null);
    try {
      const res = await generateRmg({ options: payload, fill, name: mapName.trim(), withPreview });
      setGenResult(res);
      downloadText(res.fileName, res.mapContent, 'text/plain');
      setStatus({ kind: 'success', message: `已产出 ${res.fileName} · ${res.outputLevel ?? '完整 RMG 产出'}` });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  if (metaError) {
    return (
      <div className="panel">
        <div className="status status-error">加载 RMG 元数据失败：{metaError}</div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="panel">
        <div className="status status-loading">
          <span className="spinner" />
          正在加载 RMG 元数据...
        </div>
      </div>
    );
  }

  return (
    <form className="panel" onSubmit={(e) => { e.preventDefault(); void handleGenerate(); }} noValidate>
      {/* ========== 管线状态提示 ========== */}
      <section className="section">
        <h2 className="section-title">管线状态</h2>
        <div className={`notice ${meta.terrainStagesImplemented ? 'notice-ok' : 'notice-warn'}`}>
          {meta.terrainStagesImplemented
            ? '全部 20 个阶段已实现，产出为完整 RMG 地图。'
            : `当前只有 ${implementedCount} / ${meta.stages.length} 个阶段实现（0–2：播种 RNG、map-prep、读 RMGMD.INI）。` +
              '地形阶段 3–19（水体 → 区域 → 台地 → 桥 → 绿地 → 起点 → 矿场 → 山丘 → LAT → 雷达）尚未落地，' +
              '因此生成产出是 **S1（map-prep）骨架**：尺寸 / Theater / cell 初态正确，地块还未经地形阶段赋值。'}
        </div>
        {meta.notes.length > 0 && (
          <ul className="notes">
            {meta.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        )}
      </section>

      {/* ========== 选项 ========== */}
      <section className="section">
        <h2 className="section-title">RMG 选项（MapSeedClass，16 字段）</h2>
        <div className="grid">
          {meta.fields.map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={`rmg-${f.key}`}>{f.label}</label>
              {f.kind === 'select' && f.choices ? (
                <select
                  id={`rmg-${f.key}`}
                  value={values[f.key] ?? 0}
                  onChange={(e) => setField(f.key, e.target.value)}
                >
                  {f.choices.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={`rmg-${f.key}`}
                  type="number"
                  min={f.min}
                  max={f.max}
                  value={values[f.key] ?? 0}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              )}
              <span className="field-hint">
                范围 {f.min}–{f.max}{f.clamped ? '' : '（原生不 clamp）'} · {f.hint}
              </span>
              {(values[f.key] < f.min || values[f.key] > f.max) && (
                <span className="field-hint error">
                  当前值 {values[f.key]} 超出范围，生成时会被 ClampFields 收敛为 {Math.min(f.max, Math.max(f.min, values[f.key]))}
                </span>
              )}
            </div>
          ))}

          <div className="field">
            <label htmlFor="rmg-description">Description 描述</label>
            <input
              id="rmg-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="写入 .SED 的 Description（UTF-16 hex-CSV 编码）"
            />
            <span className="field-hint">`.SED` 里以 UTF-16 code unit 的 hex-CSV 存储</span>
          </div>
        </div>

        <div className="button-row" style={{ marginTop: 14 }}>
          <button type="button" className="btn-secondary" onClick={resetToDefaults}>
            恢复构造器默认值
          </button>
        </div>
      </section>

      {/* ========== 派生几何 ========== */}
      <section className="section">
        <h2 className="section-title">派生几何（map-prep）</h2>
        {deriveError && <div className="status status-error">{deriveError}</div>}
        {derived ? (
          <div className="kv-grid">
            <div className="kv"><span className="kv-k">genW × genH</span><span className="kv-v">{derived.genW} × {derived.genH}</span></div>
            <div className="kv"><span className="kv-k">mapW × mapH（[Map] Size）</span><span className="kv-v">{derived.mapW} × {derived.mapH}</span></div>
            <div className="kv"><span className="kv-k">LocalSize</span><span className="kv-v">{derived.localSize.join(', ')}</span></div>
            <div className="kv"><span className="kv-k">菱形界</span><span className="kv-v">{derived.diamondMin} … {derived.diamondMax}</span></div>
            <div className="kv"><span className="kv-k">linearMapWidth</span><span className="kv-v">{derived.linearMapWidth}</span></div>
            <div className="kv"><span className="kv-k">playfield 格数</span><span className="kv-v">{derived.cells.toLocaleString()}</span></div>
            <div className="kv"><span className="kv-k">rawScale W / H</span><span className="kv-v">{derived.rawScaleW} / {derived.rawScaleH}</span></div>
          </div>
        ) : (
          <div className="status status-loading"><span className="spinner" />推导中...</div>
        )}
        {clampedFields.length > 0 && (
          <div className="notice notice-warn" style={{ marginTop: 12 }}>
            以下 {clampedFields.length} 个字段超出 ClampFields 范围，生成时会被收敛：
            {clampedFields.map((c) => ` ${c.label} ${c.from}→${c.to}`).join('；')}
          </div>
        )}
      </section>

      {/* ========== .SED ========== */}
      <section className="section">
        <h2 className="section-title">.SED 种子文件</h2>
        <div className="grid">
          <div className="field">
            <label htmlFor="sedFile">上传 .SED</label>
            <input id="sedFile" ref={sedFileRef} type="file" accept=".sed,.ini,.txt" onChange={handleSedFile} />
            <span className="field-hint">游戏「自定义地图生成」保存的随机地图设置</span>
          </div>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="sedContent">或粘贴 .SED 文本</label>
          <textarea
            id="sedContent"
            className="code-input"
            rows={6}
            spellCheck={false}
            placeholder="[RandomMap]&#10;Description=...&#10;Width=1&#10;Height=1"
            value={sedText}
            onChange={(e) => setSedText(e.target.value)}
          />
        </div>

        <div className="button-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn-secondary" onClick={handleSedImport}>
            还原为选项
          </button>
          <button type="button" className="btn-secondary" onClick={handleSedExport}>
            导出 .SED
          </button>
        </div>
        {sedInfo && <div className="status status-loading" style={{ marginTop: 10 }}>{sedInfo}</div>}
      </section>

      {/* ========== 生成 ========== */}
      <section className="section">
        <h2 className="section-title">生成地图</h2>
        <div className="grid">
          <div className="field">
            <label htmlFor="rmgName">地图名称</label>
            <input id="rmgName" type="text" value={mapName} onChange={(e) => setMapName(e.target.value)} />
            <span className="field-hint">写入 [Basic] Name，并作为下载文件名</span>
          </div>
          <div className="field">
            <label htmlFor="rmgFill">地块填充</label>
            <select id="rmgFill" value={fill} onChange={(e) => setFill(e.target.value as 'unassigned' | 'clear')}>
              <option value="unassigned">{FILL_LABELS.unassigned}</option>
              <option value="clear">{FILL_LABELS.clear}</option>
            </select>
          </div>
        </div>

        <div className="field field-inline" style={{ marginTop: 14 }}>
          <label className="checkbox-label">
            <input type="checkbox" checked={withPreview} onChange={(e) => setWithPreview(e.target.checked)} />
            <span>注入预览缩略图（PreviewPack）</span>
          </label>
        </div>
      </section>

      {/* ========== 操作区 ========== */}
      <section className="section action-section">
        <div className="notice notice-warn" style={{ marginBottom: 12 }}>
          ⚠ 实验性功能：完整管线已跑通（水体/区域/山丘/LAT/起点/矿场），
          但地形布局尚未与原生逐字节对拍，产出可能与游戏内随机图存在偏差。
        </div>
        <button type="button" className="btn-generate" disabled={status.kind === 'loading'} onClick={() => { void handleGenerate(); }}>
          {status.kind === 'loading' ? '生成中...' : '生成地图'}
        </button>

        {status.kind === 'loading' && (
          <div className="status status-loading"><span className="spinner" />正在跑管线并发射地图...</div>
        )}
        {status.kind === 'success' && <div className="status status-success">{status.message}</div>}
        {status.kind === 'error' && <div className="status status-error">{status.message}</div>}

        {genResult && (
          <>
            <div className={`notice ${genResult.terrainStagesImplemented ? 'notice-ok' : 'notice-warn'}`}>
              <strong>产出等级：</strong>{genResult.outputLevel ?? '完整 RMG 产出'}
            </div>
            <div className="kv-grid">
              <div className="kv"><span className="kv-k">文件</span><span className="kv-v">{genResult.fileName}</span></div>
              <div className="kv"><span className="kv-k">[Map] Size</span><span className="kv-v">{genResult.derived ? (genResult.derived.mapW + ' × ' + genResult.derived.mapH) : (genResult.width + ' × ' + genResult.height)}</span></div>
              <div className="kv"><span className="kv-k">内容长度</span><span className="kv-v">{genResult.mapContent.length.toLocaleString()} 字符</span></div>
              {genResult.stats && (
                <div className="kv"><span className="kv-k">管线产出</span><span className="kv-v">起点 {genResult.stats.waypoints} · 矿 {genResult.stats.ores} · 树 {genResult.stats.terrain} · 建筑 {genResult.stats.structures}（{genResult.elapsedMs} ms）</span></div>
              )}
            </div>
            {genResult.missing?.length > 0 && (
              <>
                <h3 className="sub-title">尚未实现、因此这一版产出里缺失的阶段（{genResult.missing.length}）</h3>
                <ul className="notes">
                  {genResult.missing.map((m) => <li key={m}>{m}</li>)}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      {/* ========== 阶段状态 ========== */}
      <section className="section">
        <h2 className="section-title">阶段实现状态</h2>
        <div className="stage-table-wrap">
          <table className="stage-table">
            <thead>
              <tr>
                <th>#</th>
                <th>阶段</th>
                <th>原生地址</th>
                <th>抽数</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {meta.stages.map((s) => (
                <tr key={s.id} className={s.implemented ? '' : 'stage-pending'}>
                  <td>{s.id}</td>
                  <td>{s.name}</td>
                  <td className="mono">{s.native}</td>
                  <td>{s.draws}</td>
                  <td>{s.implemented ? '✅ 已实现' : '⬜ 未实现'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </form>
  );
}
