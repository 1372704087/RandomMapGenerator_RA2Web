import { useState } from 'react';
import {
  generateRmgCxx,
  fetchCncmapsPreview,
  downloadText,
  type CxxGenerateResult,
} from '../api';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export default function RmgPage() {
  const [seed, setSeed] = useState('38AD52F1');
  const [env, setEnv] = useState(1); // MapType：0 群岛 / 1 大陆 / 2 队伍大陆 / 3 内陆 / 4 山地
  const [size, setSize] = useState(1); // 尺寸档 0..3
  const [players, setPlayers] = useState(2); // playerIndex：0 → 2 人 … 6 → 8 人
  const [ore, setOre] = useState(1); // 矿密度 0..3
  const [theater, setTheater] = useState(0); // 0 温带 / 1 雪地 / 2 城市 / 3 沙漠 / 4 新城市 / 5 月球
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [result, setResult] = useState<CxxGenerateResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewNote, setPreviewNote] = useState<string | null>(null);

  async function handleGenerate() {
    setStatus({ kind: 'loading' });
    setResult(null);
    setPreviewNote(null);
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    try {
      const res = await generateRmgCxx({
        globalSeed: seed.trim(),
        environment: env,
        theater,
        mapSize: size,
        playerIndex: players,
        oreDensity: ore,
      });
      setResult(res);
      setStatus({
        kind: 'success',
        message: `产出 ${res.fileName} · ${res.width}×${res.height} · ${res.elapsedMs} ms`,
      });
      // cncmaps 全分辨率预览（真贴图，含悬崖立面）；用 mapKey 免重传地图文本
      try {
        const blob = await fetchCncmapsPreview(
          res.mapKey ? { mapKey: res.mapKey } : res.mapContent,
          res.fileName,
          1600,
        );
        setPreview(URL.createObjectURL(blob));
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        if (status === 413) {
          setPreviewNote('地图过大，已跳过实景预览（雷达预览与下载不受影响）');
        }
      }
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div className="panel">
      <h1 className="page-title">随机地图生成</h1>

      <section className="section">
        <div className="notice notice-ok">
          跑的是 <code>core/src/rmg/cxx/</code>：按 vera20k 逐函数对拍还原的 gamemd 管线，
          从一个全局种子产出完整 <code>.map</code>。16 个 MAPSEEDCLASS 字段<b>由种子摇出</b>，
          这里只给 exe WinMain 那一层参数（种子 / MapType / 地形 / 尺寸 / 玩家 / 矿）。
        </div>
        <ul className="notes">
          <li>离屏对拍（vera20k cliff oracle 向量）：mask 17/18 · select 10/10 · stamp 10/10 · variant 175/175</li>
          <li>仓库内回归：conformance 11 场逐格全等 · rmgBridgeOracle + rmgCxxParity 全绿</li>
          <li>同种子逐字节可复现；Tiberium / Width-Height / 城市阶段等残留见 README</li>
        </ul>

        <div className="grid">
          <div className="field">
            <label htmlFor="seed">全局种子（hex / 十进制）</label>
            <input
              id="seed"
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="0x38AD52F1"
            />
            <span className="field-hint">同种子 ⇒ 逐字节相同的地图</span>
          </div>
          <div className="field">
            <label htmlFor="env">MapType 地图类型</label>
            <select id="env" value={env} onChange={(e) => setEnv(+e.target.value)}>
              <option value={0}>0 群岛 Archipelago</option>
              <option value={1}>1 大陆 Continent</option>
              <option value={2}>2 队伍大陆 TeamContinent</option>
              <option value={3}>3 内陆 Inland</option>
              <option value={4}>4 山地 Mountainous</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="theater">Theater 地形</label>
            <select id="theater" value={theater} onChange={(e) => setTheater(+e.target.value)}>
              <option value={0}>温带 TEMPERATE</option>
              <option value={1}>雪地 SNOW</option>
              <option value={2}>城市 URBAN</option>
              <option value={3}>沙漠 DESERT</option>
              <option value={4}>新城市 NEWURBAN</option>
              <option value={5}>月球 LUNAR</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="size">Width 尺寸档</label>
            <select id="size" value={size} onChange={(e) => setSize(+e.target.value)}>
              <option value={0}>0 最小</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3 最大</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="players">NumPlayers 玩家档</label>
            <select id="players" value={players} onChange={(e) => setPlayers(+e.target.value)}>
              <option value={0}>0 → 2 人</option>
              <option value={1}>1 → 3 人</option>
              <option value={2}>2 → 4 人</option>
              <option value={3}>3 → 5 人</option>
              <option value={4}>4 → 6 人</option>
              <option value={5}>5 → 7 人</option>
              <option value={6}>6 → 8 人</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="ore">Tiberium 矿密度档</label>
            <select id="ore" value={ore} onChange={(e) => setOre(+e.target.value)}>
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>
        </div>

        <div className="button-row" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn-generate"
            disabled={status.kind === 'loading'}
            onClick={() => { void handleGenerate(); }}
          >
            {status.kind === 'loading' ? '生成中...' : '用种子生成'}
          </button>
        </div>

        {status.kind === 'loading' && (
          <div className="status status-loading"><span className="spinner" />正在跑管线并渲染预览...</div>
        )}
        {status.kind === 'success' && <div className="status status-success">{status.message}</div>}
        {status.kind === 'error' && <div className="status status-error">{status.message}</div>}

        {result && (
          <>
            <div className="kv-grid" style={{ marginTop: 12 }}>
              <div className="kv"><span className="kv-k">文件</span><span className="kv-v">{result.fileName}</span></div>
              <div className="kv"><span className="kv-k">[Map] Size</span><span className="kv-v">{result.width} × {result.height}</span></div>
              <div className="kv"><span className="kv-k">水格 / 总格</span><span className="kv-v">{result.waterAmount} / {result.cellCount.toLocaleString()}</span></div>
              <div className="kv"><span className="kv-k">摇出的选项</span><span className="kv-v">
                water {result.options.waterAmount} · rough {result.options.ruggedness} ·
                {' '}urban {result.options.urbanPresence} · access {result.options.accessibility}
              </span></div>
              <div className="kv"><span className="kv-k">区域 / 矿形 / 植被</span><span className="kv-v">
                {result.options.regionSize} / {result.options.tiberiumLayout} / {result.options.vegetation}
              </span></div>
            </div>
            <div className="button-row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => downloadText(result.fileName, result.mapContent, 'text/plain')}
              >
                下载 .map
              </button>
            </div>
            {preview && (
              <div style={{ marginTop: 12 }}>
                <img
                  src={preview}
                  alt="cncmaps 预览"
                  style={{ maxWidth: '100%', border: '1px solid #2a3648', borderRadius: 6 }}
                />
                <div className="field-hint">cncmaps 全分辨率渲染（真贴图，含悬崖立面）</div>
              </div>
            )}
            {previewNote && <div className="field-hint" style={{ marginTop: 8 }}>{previewNote}</div>}
          </>
        )}
      </section>
    </div>
  );
}
