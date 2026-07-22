import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';

// ============== 类型定义 ==============
type Direction = 'N' | 'S' | 'W' | 'E' | 'NE' | 'SE' | 'NW' | 'SW';

type Players = Record<Direction, number>;

type GenerateRequest = {
  width: number;
  height: number;
  theaterType: string;
  name: string;
  gamemode: string;
  players: Record<string, number>;
  totalRandom: boolean;
  damagedBuilding: boolean;
  smudge: number;
};

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

// ============== 常量 ==============

const DIRECTIONS: Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const DIRECTION_LABELS: Record<Direction, string> = {
  N: '北 N',
  NE: '东北 NE',
  E: '东 E',
  SE: '东南 SE',
  S: '南 S',
  SW: '西南 SW',
  W: '西 W',
  NW: '西北 NW'
};

const THEATER_LABELS: Record<string, string> = {
  DESERT: '沙漠 DESERT',
  NEWURBAN: '新城市 NEWURBAN',
  TEMPERATE: '温带 TEMPERATE',
  TEMPERATE_Islands: '温带岛屿 TEMPERATE_Islands'
};

const GAMEMODES: { value: string; label: string }[] = [
  { value: 'standard', label: '标准' },
  { value: 'meatgrinder', label: '绞肉机' },
  { value: 'navalwar', label: '海战' },
  { value: 'nuke war', label: '核战争' },
  { value: 'air war', label: '空战' },
  { value: 'megawealth', label: '巨富' },
  { value: 'tournament', label: '锦标赛' },
  { value: 'coop', label: '合作' },
  { value: 'freeforall', label: '自由混战' }
];

const WIDTH_MIN = 90;
const WIDTH_MAX = 200;
const HEIGHT_MIN = 90;
const HEIGHT_MAX = 200;
const SMUDGE_MIN = 0;
const SMUDGE_MAX = 0.1;
const SMUDGE_STEP = 0.01;
const PLAYERS_MIN = 0;
const PLAYERS_MAX = 8;
const MAX_PLAYERS_PER_DIR = 8;
const MAX_TOTAL_PLAYERS = 8;

const EMPTY_PLAYERS: Players = {
  N: 0, S: 0, W: 0, E: 0, NE: 0, SE: 0, NW: 0, SW: 0
};

// ============== 工具函数 ==============
function parseFilenameFromHeader(disposition: string | null): string | null {
  if (!disposition) return null;
  // 优先匹配 filename*=UTF-8''xxx
  const utf8Match = /filename\*=([^;]+)/i.exec(disposition);
  if (utf8Match) {
    const raw = utf8Match[1].trim();
    const parts = raw.split("'");
    if (parts.length === 3) {
      try { return decodeURIComponent(parts[2]); } catch { return parts[2]; }
    }
    return raw;
  }
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return match ? match[1] : null;
}

function safeParseInt(value: string, fallback: number): number {
  if (value.trim() === '') return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function safeParseFloat(value: string, fallback: number): number {
  if (value.trim() === '') return fallback;
  const n = Number.parseFloat(value);
  return Number.isNaN(n) ? fallback : n;
}

// ============== 组件 ==============
export default function App() {
  const [theaters, setTheaters] = useState<string[]>([]);
  const [theatersLoading, setTheatersLoading] = useState(true);
  const [theatersError, setTheatersError] = useState<string | null>(null);

  const [theaterType, setTheaterType] = useState('');
  const [width, setWidth] = useState(150);
  const [height, setHeight] = useState(150);
  const [mapName, setMapName] = useState('Random Map');
  const [gamemode, setGamemode] = useState('standard');
  const [totalPlayers, setTotalPlayers] = useState(0); // 0 = random
  const [totalRandom, setTotalRandom] = useState(false);
  const [players, setPlayers] = useState<Players>(EMPTY_PLAYERS);
  const [damageEnabled, setDamageEnabled] = useState(false);
  const [damageMin, setDamageMin] = useState(10);
  const [damageMax, setDamageMax] = useState(50);
  const [destroyP, setDestroyP] = useState(5);
  const [smudge, setSmudge] = useState(0);

  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [validationError, setValidationError] = useState<string | null>(null);

  // 加载 theater 列表
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTheatersLoading(true);
      setTheatersError(null);
      try {
        const res = await fetch('/api/theaters');
        if (!res.ok) throw new Error(`获取地图类型失败: ${res.status}`);
        const data = await res.json() as { theaters: string[] };
        const theaterList = data.theaters || [];
        if (cancelled) return;
        const theaterNames = theaterList.map((t: any) => typeof t === 'string' ? t : t.name);
        setTheaters(theaterNames);
        if (theaterNames.length > 0 && !theaterNames.includes(theaterType)) {
          setTheaterType(theaterNames[0]);
        }
      } catch (e) {
        if (cancelled) return;
        setTheatersError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setTheatersLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalFromDirs = useMemo(
    () => DIRECTIONS.reduce((sum, d) => sum + (players[d] || 0), 0),
    [players]
  );

  const playersValid = totalFromDirs <= MAX_TOTAL_PLAYERS;

  function handlePlayerChange(dir: Direction, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === '') {
      setPlayers(prev => ({ ...prev, [dir]: 0 }));
      return;
    }
    let n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) n = 0;
    n = Math.max(0, Math.min(MAX_PLAYERS_PER_DIR, n));
    setPlayers(prev => ({ ...prev, [dir]: n }));
  }

  function handlePlayersChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    let n = raw === '' ? 0 : Number.parseInt(raw, 10);
    if (Number.isNaN(n)) n = 0;
    setTotalPlayers(Math.max(PLAYERS_MIN, Math.min(PLAYERS_MAX, n)));
  }

  function handleWidthChange(e: ChangeEvent<HTMLInputElement>) {
    const n = safeParseInt(e.target.value, 0);
    setWidth(Math.max(0, Math.min(WIDTH_MAX, n)));
  }

  function handleHeightChange(e: ChangeEvent<HTMLInputElement>) {
    const n = safeParseInt(e.target.value, 0);
    setHeight(Math.max(0, Math.min(HEIGHT_MAX, n)));
  }

  function handleSmudgeChange(e: ChangeEvent<HTMLInputElement>) {
    const n = safeParseFloat(e.target.value, 0);
    setSmudge(Math.max(SMUDGE_MIN, Math.min(SMUDGE_MAX, n)));
  }

  function validate(): string | null {
    if (theaters.length === 0) return '没有可用的地图类型，请检查后端服务';
    if (!theaterType) return '请选择地图类型';
    if (!mapName.trim()) return '地图名称不能为空';
    // width/height 允许 0 (随机) 或 90-200
    if (width !== 0 && (width < WIDTH_MIN || width > WIDTH_MAX)) {
      return `地图宽度需为 0(随机) 或 ${WIDTH_MIN}-${WIDTH_MAX}`;
    }
    if (height !== 0 && (height < HEIGHT_MIN || height > HEIGHT_MAX)) {
      return `地图高度需为 0(随机) 或 ${HEIGHT_MIN}-${HEIGHT_MAX}`;
    }
    if (!totalRandom) {
      if (totalFromDirs > MAX_TOTAL_PLAYERS) {
        return `玩家总数 ${totalFromDirs} 超过上限 ${MAX_TOTAL_PLAYERS}`;
      }
      for (const d of DIRECTIONS) {
        if (players[d] < 0 || players[d] > MAX_PLAYERS_PER_DIR) {
          return `${DIRECTION_LABELS[d]} 玩家数需在 0-${MAX_PLAYERS_PER_DIR} 之间`;
        }
      }
    }
    if (smudge < SMUDGE_MIN || smudge > SMUDGE_MAX) {
      return `污迹密度需在 ${SMUDGE_MIN}-${SMUDGE_MAX} 之间`;
    }
    return null;
  }

  /** Distribute N players evenly across 8 directions. */
  function distributePlayers(total: number): Record<string, number> {
    if (total <= 0) return {};
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const result: Record<string, number> = {};
    for (let i = 0; i < total; i++) {
      const d = dirs[i % 8];
      result[d] = (result[d] || 0) + 1;
    }
    return result;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setValidationError(null);

    const err = validate();
    if (err) {
      setValidationError(err);
      setStatus({ kind: 'error', message: err });
      return;
    }

    const isRandom = totalRandom || totalPlayers === 0;
    const payload: GenerateRequest = {
      width,
      height,
      theaterType,
      name: mapName.trim(),
      gamemode,
      players: totalRandom
        ? EMPTY_PLAYERS
        : (totalPlayers > 0 ? distributePlayers(totalPlayers) : players),
      damagedBuilding: damageEnabled ? { min: damageMin, max: damageMax, destroyP } : false,
      totalRandom: isRandom,
      smudge
    };

    setStatus({ kind: 'loading' });
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let msg = `生成失败 (HTTP ${res.status})`;
        try {
          const text = await res.text();
          if (text) msg = `${msg}: ${text}`;
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const filename =
        parseFilenameFromHeader(res.headers.get('Content-Disposition')) ||
        `${mapName.trim() || 'map'}.yrm`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // 释放 URL
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setStatus({ kind: 'success', message: `地图已生成: ${filename}` });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : String(e)
      });
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">红色警戒 II 尤里的复仇 随机地图生成器</h1>
        <p className="app-subtitle">YURI'S REVENGE RANDOM MAP GENERATOR</p>
      </header>

      <main className="app-main">
        <form className="panel" onSubmit={handleSubmit}>
          {/* ========== 基本参数区 ========== */}
          <section className="section">
            <h2 className="section-title">基本参数</h2>
            <div className="grid">
              <div className="field">
                <label htmlFor="theaterType">地图类型</label>
                <select
                  id="theaterType"
                  value={theaterType}
                  onChange={e => setTheaterType(e.target.value)}
                  disabled={theatersLoading || !!theatersError}
                >
                  {theatersLoading && <option value="">加载中...</option>}
                  {theatersError && <option value="">(加载失败)</option>}
                  {!theatersLoading && !theatersError &&
                    theaters.map(t => (
                      <option key={t} value={t}>{THEATER_LABELS[t] || t}</option>
                    ))}
                </select>
                {theatersError && (
                  <span className="field-hint error">{theatersError}</span>
                )}
              </div>

              <div className="field">
                <label htmlFor="width">地图宽度</label>
                <input
                  id="width"
                  type="number"
                  min={0}
                  max={WIDTH_MAX}
                  value={width}
                  onChange={handleWidthChange}
                />
                <span className="field-hint">0=随机，范围 {WIDTH_MIN}-{WIDTH_MAX}</span>
              </div>

              <div className="field">
                <label htmlFor="height">地图高度</label>
                <input
                  id="height"
                  type="number"
                  min={0}
                  max={HEIGHT_MAX}
                  value={height}
                  onChange={handleHeightChange}
                />
                <span className="field-hint">0=随机，范围 {HEIGHT_MIN}-{HEIGHT_MAX}</span>
              </div>

              <div className="field">
                <label htmlFor="mapName">地图名称</label>
                <input
                  id="mapName"
                  type="text"
                  value={mapName}
                  onChange={e => setMapName(e.target.value)}
                  placeholder="Enter map name"
                />
              </div>

              <div className="field">
                <label htmlFor="gamemode">游戏模式</label>
                <select
                  id="gamemode"
                  value={gamemode}
                  onChange={e => setGamemode(e.target.value)}
                >
                  {GAMEMODES.map(g => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="smudge">污迹密度</label>
                <input
                  id="smudge"
                  type="number"
                  min={SMUDGE_MIN}
                  max={SMUDGE_MAX}
                  step={SMUDGE_STEP}
                  value={smudge}
                  onChange={handleSmudgeChange}
                />
                <span className="field-hint">范围 {SMUDGE_MIN}-{SMUDGE_MAX}，步进 {SMUDGE_STEP}</span>
              </div>
            </div>
          </section>

          {/* ========== 玩家数量 ========== */}
          <section className="section">
            <h2 className="section-title">玩家数量</h2>

            <div className="field field-inline">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={totalRandom}
                  onChange={e => setTotalRandom(e.target.checked)}
                />
                <span>完全随机（勾选后忽略玩家位置设置，随机生成所有参数）</span>
              </label>
            </div>

            <div className={`players-block ${totalRandom ? 'disabled' : ''}`}>
              <div className="grid">
                <div className="field">
                  <label htmlFor="totalPlayers">总玩家数（快捷）</label>
                  <input
                    id="totalPlayers"
                    type="number"
                    min={PLAYERS_MIN}
                    max={PLAYERS_MAX}
                    value={totalPlayers}
                    onChange={handlePlayersChange}
                    disabled={totalRandom}
                  />
                  <span className="field-hint">0=随机，范围 {PLAYERS_MIN}-{PLAYERS_MAX}</span>
                </div>
              </div>

              <div className="players-grid">
                {DIRECTIONS.map(dir => (
                  <div className="field player-field" key={dir}>
                    <label htmlFor={`player-${dir}`}>{DIRECTION_LABELS[dir]}</label>
                    <input
                      id={`player-${dir}`}
                      type="number"
                      min={0}
                      max={MAX_PLAYERS_PER_DIR}
                      value={players[dir]}
                      onChange={e => handlePlayerChange(dir, e)}
                      disabled={totalRandom}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ========== 其他选项区 ========== */}
          <section className="section">
            <h2 className="section-title">其他选项</h2>

            <div className="field field-inline">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={damageEnabled}
                  onChange={e => setDamageEnabled(e.target.checked)}
                />
                <span>损坏建筑</span>
              </label>
            </div>

            {damageEnabled && (
              <div className="damage-config">
                <div className="grid">
                  <div className="field">
                    <label htmlFor="damageMin">最低伤害 HP</label>
                    <input
                      id="damageMin"
                      type="number"
                      min={0}
                      max={256}
                      value={damageMin}
                      onChange={e => {
                        const n = Math.max(0, Math.min(256, Number.parseInt(e.target.value) || 0));
                        setDamageMin(n);
                        if (n > damageMax) setDamageMax(n);
                      }}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="damageMax">最高伤害 HP</label>
                    <input
                      id="damageMax"
                      type="number"
                      min={0}
                      max={256}
                      value={damageMax}
                      onChange={e => {
                        const n = Math.max(0, Math.min(256, Number.parseInt(e.target.value) || 0));
                        setDamageMax(n);
                        if (n < damageMin) setDamageMin(n);
                      }}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="destroyP">摧毁概率 %</label>
                    <input
                      id="destroyP"
                      type="number"
                      min={0}
                      max={100}
                      value={destroyP}
                      onChange={e => {
                        setDestroyP(Math.max(0, Math.min(100, Number.parseInt(e.target.value) || 0)));
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ========== 操作区 ========== */}
          <section className="section action-section">
            <button
              type="submit"
              className="btn-generate"
              disabled={status.kind === 'loading' || !playersValid}
            >
              {status.kind === 'loading' ? '生成中...' : '生成地图'}
            </button>

            {validationError && (
              <div className="status status-error">{validationError}</div>
            )}

            {status.kind === 'loading' && (
              <div className="status status-loading">
                <span className="spinner" />
                正在生成地图，请稍候...
              </div>
            )}
            {status.kind === 'success' && (
              <div className="status status-success">{status.message}</div>
            )}
            {status.kind === 'error' && !validationError && (
              <div className="status status-error">{status.message}</div>
            )}
          </section>
        </form>
      </main>

      <footer className="app-footer">
        <span>红色警戒 II 尤里的复仇 随机地图生成器 · React + Vite + TypeScript</span>
      </footer>
    </div>
  );
}
