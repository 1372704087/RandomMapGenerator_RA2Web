import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { fetchMapPreviews, fetchCncmapsPreview, type MapPreviewData } from '../api';
import MapPreviewCanvas from '../components/MapPreviewCanvas';
import PreviewLightbox from '../components/PreviewLightbox';
import ImageLightbox from '../components/ImageLightbox';

// ============== 类型定义 ==============
type Direction = 'N' | 'S' | 'W' | 'E' | 'NE' | 'SE' | 'NW' | 'SW';

type Players = Record<Direction, number>;

type GenerateRequest = {
  width: number;
  height: number;
  theaterType: string;
  name: string;
  gamemode: string;
  /** 后端字段名是 playerLocations（见 server/src/types.ts GenerateOptions）；随机模式下省略 */
  playerLocations?: Record<string, number>;
  totalRandom: boolean;
  /** 后端接受 boolean，也接受具体的损坏参数（见 server/src/types.ts DamagedBuildingOptions） */
  damagedBuilding: boolean | { min: number; max: number; destroyP: number };
  smudge: number;
  /** VERA20k 适配：30 人 + 大图（width+height ≤ 1024） */
  vera20k: boolean;
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
/** VERA20k: [Map] Size 硬限 width+height ≤ 1024，最大正方形 512×512。 */
const VERA_MAX_SIDE = 512;
const VERA_MAX_SPAN = 1024;
const VERA_MAX_TOTAL_PLAYERS = 30;
const SMUDGE_MIN = 0;
const SMUDGE_MAX = 0.1;
const SMUDGE_STEP = 0.01;
const PLAYERS_MIN = 0;
const PLAYERS_MAX = 8;
const MAX_PLAYERS_PER_DIR = 8;
const MAX_TOTAL_PLAYERS = 8;
/** N/S/W/E 的 PlacePlayerLocation 写死了 4 个偏移，VERA 模式下按 4 校验。 */
const CARDINAL_DIRECTIONS: Direction[] = ['N', 'S', 'W', 'E'];
const MAX_CARDINAL_PLAYERS = 4;

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
export default function GeneratePage() {
  const [theaters, setTheaters] = useState<string[]>([]);
  const [theatersLoading, setTheatersLoading] = useState(true);
  const [theatersError, setTheatersError] = useState<string | null>(null);

  const [theaterType, setTheaterType] = useState('');
  const [width, setWidth] = useState(150);
  const [height, setHeight] = useState(150);
  const [mapName, setMapName] = useState('Random Map');
  const [gamemode, setGamemode] = useState('standard');
  const [totalPlayers, setTotalPlayers] = useState(0); // 0 = 使用下方方向计数（全 0 则随机）
  const [totalRandom, setTotalRandom] = useState(false);
  const [players, setPlayers] = useState<Players>(EMPTY_PLAYERS);
  const [vera20k, setVera20k] = useState(false);
  const [damageEnabled, setDamageEnabled] = useState(false);
  const [damageMin, setDamageMin] = useState(10);
  const [damageMax, setDamageMax] = useState(50);
  const [destroyP, setDestroyP] = useState(5);
  const [smudge, setSmudge] = useState(0);

  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [validationError, setValidationError] = useState<string | null>(null);
  /** 生成结果的雷达预览 */
  const [genPreview, setGenPreview] = useState<MapPreviewData | null>(null);
  /** 大图查看器（灯箱） */
  const [lightbox, setLightbox] = useState<{ preview: MapPreviewData; title: string } | null>(null);
  /** cncmaps 渲染预览 */
  const [cncmapsStatus, setCncmapsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [cncmapsError, setCncmapsError] = useState<string | null>(null);
  const [cncmapsPreviewUrl, setCncmapsPreviewUrl] = useState<string | null>(null);
  const [cncmapsLightbox, setCncmapsLightbox] = useState(false);
  const cncmapsUrlRef = useRef<string | null>(null);
  const cncmapsSeq = useRef(0);

  useEffect(() => () => {
    if (cncmapsUrlRef.current) URL.revokeObjectURL(cncmapsUrlRef.current);
  }, []);

  // 加载 theater 列表
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTheatersLoading(true);
      setTheatersError(null);
      try {
        const res = await fetch('/api/theaters');
        if (!res.ok) throw new Error(`获取地图类型失败: ${res.status}`);
        const data = await res.json() as { theaters: any[] };
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

  const widthMax = vera20k ? VERA_MAX_SIDE : WIDTH_MAX;
  const heightMax = vera20k ? VERA_MAX_SIDE : HEIGHT_MAX;
  const playersMax = vera20k ? VERA_MAX_TOTAL_PLAYERS : PLAYERS_MAX;
  const maxTotalPlayers = vera20k ? VERA_MAX_TOTAL_PLAYERS : MAX_TOTAL_PLAYERS;
  const perDirMax = (dir: Direction) =>
    vera20k && CARDINAL_DIRECTIONS.includes(dir)
      ? MAX_CARDINAL_PLAYERS
      : vera20k
        ? VERA_MAX_TOTAL_PLAYERS
        : MAX_PLAYERS_PER_DIR;

  const playersValid = totalRandom || (totalPlayers > 0
    ? totalPlayers <= playersMax
    : totalFromDirs <= maxTotalPlayers);

  function handlePlayerChange(dir: Direction, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === '') {
      setPlayers(prev => ({ ...prev, [dir]: 0 }));
      return;
    }
    let n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) n = 0;
    n = Math.max(0, Math.min(perDirMax(dir), n));
    setPlayers(prev => ({ ...prev, [dir]: n }));
  }

  function handlePlayersChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    let n = raw === '' ? 0 : Number.parseInt(raw, 10);
    if (Number.isNaN(n)) n = 0;
    const clamped = Math.max(PLAYERS_MIN, Math.min(playersMax, n));
    setTotalPlayers(clamped);
    if (clamped > 0) setPlayers(distributePlayers(clamped));
  }

  function handleWidthChange(e: ChangeEvent<HTMLInputElement>) {
    const n = safeParseInt(e.target.value, 0);
    setWidth(Math.max(0, Math.min(widthMax, n)));
  }

  function handleHeightChange(e: ChangeEvent<HTMLInputElement>) {
    const n = safeParseInt(e.target.value, 0);
    setHeight(Math.max(0, Math.min(heightMax, n)));
  }

  function handleVera20kToggle(checked: boolean) {
    setVera20k(checked);
    if (checked) {
      setTotalRandom(false);
      setWidth(500);
      setHeight(500);
      setTotalPlayers(VERA_MAX_TOTAL_PLAYERS);
      setPlayers(distributePlayers(VERA_MAX_TOTAL_PLAYERS));
    } else {
      if (width > WIDTH_MAX) setWidth(WIDTH_MAX);
      if (height > HEIGHT_MAX) setHeight(HEIGHT_MAX);
      if (totalPlayers > PLAYERS_MAX) {
        setTotalPlayers(PLAYERS_MAX);
        setPlayers(distributePlayers(PLAYERS_MAX));
      }
    }
  }

  function handleSmudgeChange(e: ChangeEvent<HTMLInputElement>) {
    const n = safeParseFloat(e.target.value, 0);
    setSmudge(Math.max(SMUDGE_MIN, Math.min(SMUDGE_MAX, n)));
  }

  function validate(): string | null {
    if (theaters.length === 0) return '没有可用的地图类型，请检查后端服务';
    if (!theaterType) return '请选择地图类型';
    if (!mapName.trim()) return '地图名称不能为空';
    if (vera20k) {
      if (totalRandom) return 'VERA20k 模式不支持完全随机';
      if (width === 0 || height === 0) return 'VERA20k 模式需要指定宽高（默认 500×500）';
      if (width < WIDTH_MIN || width > VERA_MAX_SIDE) {
        return `VERA20k 宽度需为 ${WIDTH_MIN}-${VERA_MAX_SIDE}`;
      }
      if (height < HEIGHT_MIN || height > VERA_MAX_SIDE) {
        return `VERA20k 高度需为 ${HEIGHT_MIN}-${VERA_MAX_SIDE}`;
      }
      if (width + height > VERA_MAX_SPAN) {
        return `VERA20k 限制宽+高 ≤ ${VERA_MAX_SPAN}（当前 ${width + height}）；1000×1000 会被 VERA20k 拒绝`;
      }
    } else {
      // width/height 允许 0 (随机) 或 90-200
      if (width !== 0 && (width < WIDTH_MIN || width > WIDTH_MAX)) {
        return `地图宽度需为 0(随机) 或 ${WIDTH_MIN}-${WIDTH_MAX}`;
      }
      if (height !== 0 && (height < HEIGHT_MIN || height > HEIGHT_MAX)) {
        return `地图高度需为 0(随机) 或 ${HEIGHT_MIN}-${HEIGHT_MAX}`;
      }
    }
    if (!totalRandom) {
      if (totalPlayers > 0) {
        if (totalPlayers > playersMax) {
          return `玩家总数 ${totalPlayers} 超过上限 ${playersMax}`;
        }
      } else {
        if (totalFromDirs > maxTotalPlayers) {
          return `玩家总数 ${totalFromDirs} 超过上限 ${maxTotalPlayers}`;
        }
        for (const d of DIRECTIONS) {
          const n = players[d] ?? 0;
          if (n < 0 || n > perDirMax(d)) {
            return `${DIRECTION_LABELS[d]} 玩家数需在 0-${perDirMax(d)} 之间`;
          }
        }
        if (vera20k && totalFromDirs === 0) {
          return 'VERA20k 模式请设置总玩家数或方向人数';
        }
      }
    }
    if (smudge < SMUDGE_MIN || smudge > SMUDGE_MAX) {
      return `污迹密度需在 ${SMUDGE_MIN}-${SMUDGE_MAX} 之间`;
    }
    return null;
  }

  /** Distribute N players evenly across 8 directions. */
  function distributePlayers(total: number): Players {
    const result: Players = { ...EMPTY_PLAYERS };
    if (total <= 0) return result;
    const dirs: Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    for (let i = 0; i < total; i++) {
      const d = dirs[i % 8];
      result[d] = (result[d] || 0) + 1;
    }
    return result;
  }

  function clearCncmapsPreview() {
    if (cncmapsUrlRef.current) {
      URL.revokeObjectURL(cncmapsUrlRef.current);
      cncmapsUrlRef.current = null;
    }
    setCncmapsPreviewUrl(null);
    setCncmapsLightbox(false);
  }

  async function startCncmapsPreview(mapText: string, name: string) {
    const seq = ++cncmapsSeq.current;
    clearCncmapsPreview();
    setCncmapsStatus('loading');
    setCncmapsError(null);
    try {
      const blob = await fetchCncmapsPreview(mapText, name, 1600);
      if (seq !== cncmapsSeq.current) return;
      const url = URL.createObjectURL(blob);
      cncmapsUrlRef.current = url;
      setCncmapsPreviewUrl(url);
      setCncmapsStatus('success');
    } catch (e) {
      if (seq !== cncmapsSeq.current) return;
      setCncmapsStatus('error');
      setCncmapsError(e instanceof Error ? e.message : String(e));
    }
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

    cncmapsSeq.current += 1;
    clearCncmapsPreview();
    setCncmapsStatus('idle');
    setCncmapsError(null);

    // 总人数 >0 时按「快捷」均分；为 0 且有方向计数时用方向计数；两者都空才随机。
    const isRandom = totalRandom || (totalPlayers === 0 && totalFromDirs === 0);
    const payload: GenerateRequest = {
      width,
      height,
      theaterType,
      name: mapName.trim(),
      gamemode,
      ...(isRandom
        ? {}
        : { playerLocations: totalPlayers > 0 ? distributePlayers(totalPlayers) : players }),
      damagedBuilding: damageEnabled ? { min: damageMin, max: damageMax, destroyP } : false,
      totalRandom: isRandom,
      smudge,
      vera20k
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
          if (text) {
            let detail = text;
            try {
              const parsed = JSON.parse(text) as { error?: unknown };
              if (typeof parsed.error === 'string' && parsed.error.trim()) detail = parsed.error;
            } catch { /* 非 JSON 错误体，原样展示 */ }
            msg = `${msg}: ${detail}`;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      // 先读文本（预览用），再转 Blob 下载
      const mapText = await res.text();
      const blob = new Blob([mapText], { type: 'application/octet-stream' });
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

      fetchMapPreviews([mapText])
        .then(([p]) => setGenPreview(p ?? null))
        .catch(() => setGenPreview(null));

      setStatus({ kind: 'success', message: `地图已生成: ${filename}` });
      void startCncmapsPreview(mapText, filename);
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : String(e)
      });
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      {/* ========== 基本参数区 ========== */}
      <section className="section">
        <h2 className="section-title">基本参数</h2>
        <div className="grid">
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={vera20k}
                onChange={e => handleVera20kToggle(e.target.checked)}
              />
              <span>VERA20k 适配（30 人 / 大图）</span>
            </label>
            <span className="field-hint">
              勾选后默认 500×500、30 人；单边 ≤ {VERA_MAX_SIDE}，且宽+高 ≤ {VERA_MAX_SPAN}
              （1000×1000 会被 VERA20k 拒绝，最大正方形 512×512）。
            </span>
          </div>

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
              min={vera20k ? WIDTH_MIN : 0}
              max={widthMax}
              value={width}
              onChange={handleWidthChange}
            />
            <span className="field-hint">
              {vera20k
                ? `${WIDTH_MIN}-${VERA_MAX_SIDE}，且宽+高 ≤ ${VERA_MAX_SPAN}`
                : `0=随机，范围 ${WIDTH_MIN}-${WIDTH_MAX}`}
            </span>
          </div>

          <div className="field">
            <label htmlFor="height">地图高度</label>
            <input
              id="height"
              type="number"
              min={vera20k ? HEIGHT_MIN : 0}
              max={heightMax}
              value={height}
              onChange={handleHeightChange}
            />
            <span className="field-hint">
              {vera20k
                ? `${HEIGHT_MIN}-${VERA_MAX_SIDE}，且宽+高 ≤ ${VERA_MAX_SPAN}`
                : `0=随机，范围 ${HEIGHT_MIN}-${HEIGHT_MAX}`}
            </span>
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
              disabled={vera20k}
              onChange={e => setTotalRandom(e.target.checked)}
            />
            <span>
              完全随机（勾选后忽略玩家位置设置，随机生成所有参数）
              {vera20k ? '（VERA20k 模式不可用）' : ''}
            </span>
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
                max={playersMax}
                value={totalPlayers}
                onChange={handlePlayersChange}
                disabled={totalRandom}
              />
              <span className="field-hint">
                0=使用下方方向计数（全 0 则随机），范围 {PLAYERS_MIN}-{playersMax}
              </span>
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
                  max={perDirMax(dir)}
                  value={players[dir]}
                  onChange={e => handlePlayerChange(dir, e)}
                  disabled={totalRandom}
                />
              </div>
            ))}
          </div>
          {vera20k && (
            <span className="field-hint">
              VERA20k：正向 N/S/W/E 每方向最多 {MAX_CARDINAL_PLAYERS} 个，总人数最多{' '}
              {VERA_MAX_TOTAL_PLAYERS}。总人数 &gt;0 时按快捷均分，设为 0 才使用下方方向计数。
              尺寸过小时出生点可能放不下，届时会提示减少人数或增大地图。
            </span>
          )}
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
        {status.kind === 'success' && genPreview && (
          <div className="preview-block">
            <span className="field-hint">雷达预览（minimap 配色，一格一像素，点击放大）</span>
            <MapPreviewCanvas
              preview={genPreview}
              maxWidth={560}
              className="preview-img"
              title="点击放大"
              onClick={() => setLightbox({ preview: genPreview, title: '生成结果预览' })}
            />
          </div>
        )}

        {status.kind === 'success' && (
          <div className="preview-block">
            <span className="field-hint">
              cncmaps 渲染预览（1600px；500×500 约 15–30 秒）
            </span>
            {cncmapsStatus === 'loading' && (
              <div className="status status-loading">
                <span className="spinner" />
                cncmaps 渲染中...
              </div>
            )}
            {cncmapsStatus === 'error' && (
              <div className="status status-error">cncmaps 预览失败：{cncmapsError}</div>
            )}
            {cncmapsStatus === 'success' && cncmapsPreviewUrl && (
              <img
                src={cncmapsPreviewUrl}
                alt="cncmaps 渲染预览"
                title="点击放大"
                onClick={() => setCncmapsLightbox(true)}
                style={{ maxWidth: '100%', height: 'auto', display: 'block', cursor: 'zoom-in' }}
              />
            )}
          </div>
        )}

        {lightbox && (
          <PreviewLightbox
            preview={lightbox.preview}
            title={lightbox.title}
            onClose={() => setLightbox(null)}
          />
        )}
        {cncmapsLightbox && cncmapsPreviewUrl && (
          <ImageLightbox
            src={cncmapsPreviewUrl}
            title="cncmaps 渲染预览"
            onClose={() => setCncmapsLightbox(false)}
          />
        )}
        {status.kind === 'error' && !validationError && (
          <div className="status status-error">{status.message}</div>
        )}
      </section>
    </form>
  );
}
