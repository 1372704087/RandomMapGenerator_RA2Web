import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { fetchMapPreviews, fetchCncmapsPreview, type MapPreviewData } from '../api';
import MapPreviewCanvas from '../components/MapPreviewCanvas';
import PreviewLightbox from '../components/PreviewLightbox';
import ImageLightbox from '../components/ImageLightbox';

// ============== 类型定义 ==============
type Direction = 'N' | 'S' | 'W' | 'E' | 'NE' | 'SE' | 'NW' | 'SW';

type Players = Record<Direction, number>;

type LightingMode = 'auto' | 'preset' | 'random' | 'custom';

type LightingEnvironment = 'temperate' | 'snow' | 'desert' | 'newurban' | 'islands';

/** `[Lighting]` 的通道值（0.2..1.6）。 */
type LightingValues = {
  Ambient: number;
  Red: number;
  Green: number;
  Blue: number;
  Level: number;
};

/** 服务端 `/api/lighting/presets` 返回的预设表。 */
type LightingPresetResponse = {
  timeOfDay: { value: number; label: string }[];
  /** 24 个整点（给 hour 时优先于 timeOfDay） */
  hours: { value: number; label: string }[];
  environments: {
    id: LightingEnvironment;
    label: string;
    presets: { timeOfDay: number; label: string; values: LightingValues }[];
    hourly: { hour: number; label: string; values: LightingValues }[];
  }[];
  modes: { value: LightingMode; label: string }[];
};

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
  /** 随机种子；留空则由服务端现摇一个并通过 X-Map-Seed 回显 */
  seed?: number;
  /** 环境光照；省略 = 跟随原版（auto） */
  lighting?: {
    mode: Exclude<LightingMode, 'auto'>;
    timeOfDay?: number;
    hour?: number;
    environment?: LightingEnvironment;
    jitter?: number;
    values?: Partial<LightingValues>;
  };
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
  SNOW: '雪地 SNOW',
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

/** 光照模式的兜底文案（拿不到 /api/lighting/presets 时也能用） */
const FALLBACK_LIGHTING_MODES: { value: LightingMode; label: string }[] = [
  { value: 'auto', label: '跟随原版（沙漠随机 / 其余不写光照）' },
  { value: 'preset', label: '固定预设（按时段+环境写死）' },
  { value: 'random', label: '预设 + 随机抖动（受种子约束）' },
  { value: 'custom', label: '自定义通道值' }
];

/** 24 个整点文案（与服务端 core/lighting.ts 的 HOUR_LABELS 一致） */
const FALLBACK_HOURS: { value: number; label: string }[] = [
  { value: 0, label: '00:00 深夜' }, { value: 1, label: '01:00 深夜' },
  { value: 2, label: '02:00 凌晨' }, { value: 3, label: '03:00 凌晨' },
  { value: 4, label: '04:00 黎明前' }, { value: 5, label: '05:00 黎明' },
  { value: 6, label: '06:00 日出' }, { value: 7, label: '07:00 清晨' },
  { value: 8, label: '08:00 清晨' }, { value: 9, label: '09:00 上午' },
  { value: 10, label: '10:00 上午' }, { value: 11, label: '11:00 上午' },
  { value: 12, label: '12:00 正午' }, { value: 13, label: '13:00 下午' },
  { value: 14, label: '14:00 下午' }, { value: 15, label: '15:00 下午' },
  { value: 16, label: '16:00 傍晚' }, { value: 17, label: '17:00 傍晚' },
  { value: 18, label: '18:00 黄昏' }, { value: 19, label: '19:00 入夜' },
  { value: 20, label: '20:00 入夜' }, { value: 21, label: '21:00 夜间' },
  { value: 22, label: '22:00 夜间' }, { value: 23, label: '23:00 深夜' }
];

/** 整点标签（拿不到预设表时的本地兜底）。 */
function getHourLabel(hour: number): string {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  return FALLBACK_HOURS[h]?.label ?? `${h}:00`;
}

/** 五个环境主题（与服务端 core/lighting.ts 一致） */
const LIGHTING_ENV_FALLBACK: { id: LightingEnvironment; label: string }[] = [
  { id: 'temperate', label: '温带' },
  { id: 'snow', label: '雪地' },
  { id: 'desert', label: '沙漠' },
  { id: 'newurban', label: '新城区' },
  { id: 'islands', label: '岛屿' }
];

/** `[Lighting]` 里可手填的五个核心通道。 */
const LIGHTING_CHANNEL_KEYS: (keyof LightingValues)[] = [
  'Ambient', 'Red', 'Green', 'Blue', 'Level'
];

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
  /** 随机种子（字符串保存，空 = 交给服务端摇）；同种子 ⇒ 逐字节相同的地图 */
  const [seedInput, setSeedInput] = useState('');
  /** 最近一次生成实际用的种子（服务端用 X-Map-Seed 回显，便于复现） */
  const [lastSeed, setLastSeed] = useState<number | null>(null);

  /** 环境光照：模式、时段、环境主题、自定义通道、抖动幅度 */
  const [lightingMode, setLightingMode] = useState<LightingMode>('auto');
  /** 整点小时 0..23（0 深夜 / 6 日出 / 12 正午 / 18 黄昏），中间整点按曲线插值 */
  const [lightingHour, setLightingHour] = useState(12);
  /** 空字符串 = 跟随当前地图类型 */
  const [lightingEnv, setLightingEnv] = useState<'' | LightingEnvironment>('');
  const [lightingJitter, setLightingJitter] = useState(0.08);
  /** 自定义通道，字符串保存，空 = 用预设值 */
  const [lightingCustom, setLightingCustom] = useState<Record<keyof LightingValues, string>>({
    Ambient: '', Red: '', Green: '', Blue: '', Level: ''
  });
  /** 最近一次生成实际写入的 [Lighting] 值（服务端 X-Map-Lighting 回显） */
  const [lastLighting, setLastLighting] = useState<LightingValues | null>(null);
  /** 预设表（服务端 /api/lighting/presets），用于色卡预览 */
  const [presetTable, setPresetTable] = useState<LightingPresetResponse | null>(null);

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

  // 加载光照预设表（一次即可，用于色卡预览与下拉选项）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/lighting/presets');
        if (!res.ok) throw new Error(`获取光照预设失败: ${res.status}`);
        const data = (await res.json()) as LightingPresetResponse;
        if (!cancelled) setPresetTable(data);
      } catch {
        // 拿不到预设表不阻塞生成，只是没有色卡预览
      }
    })();
    return () => { cancelled = true; };
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

  /** theater 目录名 → 环境主题（与服务端 theaterToLightingEnvironment 保持一致）。 */
  function theaterEnvironment(theater: string): LightingEnvironment {
    const upper = (theater || '').toUpperCase();
    if (upper.startsWith('DESERT')) return 'desert';
    if (upper.startsWith('SNOW')) return 'snow';
    if (upper.startsWith('NEWURBAN')) return 'newurban';
    if (upper.includes('ISLAND')) return 'islands';
    return 'temperate';
  }

  /** 空选 = 跟随地图类型。 */
  const effectiveLightingEnv: LightingEnvironment =
    lightingEnv || theaterEnvironment(theaterType);

  /** 当前面板将要写出的光照值（自定义模式叠加通道覆盖；按整点取色） */
  const lightingPreviewValues = useMemo<LightingValues>(() => {
    const fallback: LightingValues = { Ambient: 1, Red: 1, Green: 1, Blue: 1, Level: 0.03 };
    const env = presetTable?.environments.find(e => e.id === effectiveLightingEnv);
    const base =
      env?.hourly.find(h => h.hour === lightingHour)?.values ??
      env?.presets.find(p => p.timeOfDay === 1)?.values ??
      fallback;
    const result: LightingValues = { ...base };
    if (lightingMode === 'custom') {
      for (const key of LIGHTING_CHANNEL_KEYS) {
        const raw = lightingCustom[key].trim();
        if (raw === '') continue;
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0.2 && n <= 1.6) result[key] = n;
      }
    }
    return result;
  }, [presetTable, effectiveLightingEnv, lightingHour, lightingMode, lightingCustom]);

  /** 把光照值折成一个示意色块（环境光 × 通道增益），让人一眼看出偏暖还是偏蓝 */
  const swatchOf = (v: LightingValues): string => {
    const to255 = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));
    const scale = Math.min(1, Math.max(0.15, v.Ambient));
    return `rgb(${to255(0.95 * scale * v.Red)}, ${to255(0.95 * scale * v.Green)}, ${to255(
      0.95 * scale * v.Blue,
    )})`;
  };

  const lightingSwatch = useMemo(
    () => swatchOf(lightingPreviewValues),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lightingPreviewValues],
  );

  /** 当前环境主题的 24 整点日照曲线（供色带预览/点选） */
  const hourlyCurve = useMemo(() => {
    const env = presetTable?.environments.find(e => e.id === effectiveLightingEnv);
    return env?.hourly ?? [];
  }, [presetTable, effectiveLightingEnv]);

  function validate(): string | null {
    if (theaters.length === 0) return '没有可用的地图类型，请检查后端服务';
    if (!theaterType) return '请选择地图类型';
    if (!mapName.trim()) return '地图名称不能为空';
    if (seedInput.trim()) {
      const n = Number(seedInput.trim());
      if (!Number.isInteger(n) || n < 0 || n > 0x7fffffff) {
        return '随机种子需为 0-2147483647 的整数（留空则随机）';
      }
    }
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
    // 环境光照：自定义通道值必须是 0.2-1.6 的数字；抖动幅度 0-0.5
    if (lightingMode === 'custom') {
      for (const key of LIGHTING_CHANNEL_KEYS) {
        const raw = lightingCustom[key].trim();
        if (raw === '') continue;
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0.2 || n > 1.6) {
          return `光照 ${key} 需在 0.2-1.6 之间（留空则用预设值）`;
        }
      }
    }
    if (lightingMode === 'random' && (lightingJitter < 0 || lightingJitter > 0.5)) {
      return '光照抖动幅度需在 0-0.5 之间';
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

  async function startCncmapsPreview(
    target: string | { mapKey: string },
    name: string,
  ) {
    const seq = ++cncmapsSeq.current;
    clearCncmapsPreview();
    setCncmapsStatus('loading');
    setCncmapsError(null);
    try {
      const blob = await fetchCncmapsPreview(target, name, 1600);
      if (seq !== cncmapsSeq.current) return;
      const url = URL.createObjectURL(blob);
      cncmapsUrlRef.current = url;
      setCncmapsPreviewUrl(url);
      setCncmapsStatus('success');
    } catch (e) {
      if (seq !== cncmapsSeq.current) return;
      setCncmapsStatus('error');
      const status = (e as Error & { status?: number }).status;
      setCncmapsError(
        status === 413
          ? '地图太大，已跳过实景渲染（上方雷达预览仍可用）'
          : e instanceof Error
            ? e.message
            : String(e),
      );
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

    // 环境光照：auto 对应「省略 lighting」，保持服务端原版行为
    let lightingPayload: GenerateRequest['lighting'];
    if (lightingMode !== 'auto') {
      const customValues: Partial<LightingValues> = {};
      if (lightingMode === 'custom') {
        for (const key of LIGHTING_CHANNEL_KEYS) {
          const raw = lightingCustom[key].trim();
          if (raw === '') continue;
          const n = Number(raw);
          if (Number.isFinite(n)) customValues[key] = n;
        }
      }
      lightingPayload = {
        mode: lightingMode,
        hour: lightingHour,
        environment: effectiveLightingEnv,
        ...(lightingMode === 'random' ? { jitter: lightingJitter } : {}),
        ...(lightingMode === 'custom' && Object.keys(customValues).length > 0
          ? { values: customValues }
          : {})
      };
    }
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
      vera20k,
      ...(seedInput.trim() ? { seed: Number(seedInput.trim()) } : {}),
      ...(lightingPayload ? { lighting: lightingPayload } : {})
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
      // 服务端回显本次实际使用的种子：留空生成时也拿它复现同一张图
      const seedHeader = res.headers.get('X-Map-Seed');
      if (seedHeader) setLastSeed(Number(seedHeader));
      const lightingHeader = res.headers.get('X-Map-Lighting');
      if (lightingHeader) {
        try {
          setLastLighting(JSON.parse(lightingHeader) as LightingValues);
        } catch { /* 头解析失败就不显示 */ }
      } else {
        setLastLighting(null);
      }
      // 后端把地图原文留在内存里并回了 X-Map-Key：预览凭 key 取，不必重传整张图
      const mapKey = res.headers.get('X-Map-Key');
      void startCncmapsPreview(mapKey ? { mapKey } : mapText, filename);
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
            <label htmlFor="seed">随机种子</label>
            <input
              id="seed"
              type="number"
              min={0}
              max={0x7fffffff}
              step={1}
              value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
              placeholder="留空 = 随机"
            />
            <span className="field-hint">
              同种子 ⇒ 逐字节相同的地图；留空由服务端摇一个并回显
              {lastSeed !== null ? `（上一张 seed=${lastSeed}）` : ''}
            </span>
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

      {/* ========== 环境光照 ========== */}
      <section className="section">
        <h2 className="section-title">环境光照</h2>

        <div className="grid">
          <div className="field">
            <label htmlFor="lightingMode">光照模式</label>
            <select
              id="lightingMode"
              value={lightingMode}
              onChange={e => setLightingMode(e.target.value as LightingMode)}
            >
              {(presetTable?.modes ?? FALLBACK_LIGHTING_MODES).map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <span className="field-hint">
              {lightingMode === 'auto'
                ? '原版行为：沙漠每张随机抖动，其余地图不写 [Lighting]（用游戏默认天色）'
                : '按时段 + 环境主题写入 [Lighting]，所有地图类型都生效；同 seed 结果一致'}
            </span>
          </div>

          <div className="field">
            <label htmlFor="lightingEnv">环境主题</label>
            <select
              id="lightingEnv"
              value={lightingEnv}
              disabled={lightingMode === 'auto'}
              onChange={e => setLightingEnv(e.target.value as '' | LightingEnvironment)}
            >
              <option value="">
                跟随地图类型（{THEATER_LABELS[theaterType] ?? theaterType ?? '未选择'}）
              </option>
              {(presetTable?.environments ?? LIGHTING_ENV_FALLBACK).map(env => (
                <option key={env.id} value={env.id}>{env.label}</option>
              ))}
            </select>
            <span className="field-hint">
              沙漠走偏黄底色（由原版 settings.ini 中值派生），其余走游戏的冷/暖色调表
            </span>
          </div>

          <div className="field">
            <label htmlFor="lightingHour">时刻（0-23 点）</label>
            <select
              id="lightingHour"
              value={lightingHour}
              disabled={lightingMode === 'auto'}
              onChange={e => setLightingHour(Number(e.target.value))}
            >
              {(presetTable?.hours ?? FALLBACK_HOURS).map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <span className="field-hint">
              00:00 / 06:00 / 12:00 / 18:00 是游戏原生四组光照值，其余整点由它们插值而来
            </span>
          </div>

          {lightingMode === 'random' && (
            <div className="field">
              <label htmlFor="lightingJitter">抖动幅度</label>
              <input
                id="lightingJitter"
                type="number"
                min={0}
                max={0.5}
                step={0.01}
                value={lightingJitter}
                onChange={e => setLightingJitter(safeParseFloat(e.target.value, 0.08))}
              />
              <span className="field-hint">
                每个通道 ±{Math.round(lightingJitter * 100)}%，用种子约束，换 seed 才换天色
              </span>
            </div>
          )}
        </div>

        {lightingMode === 'custom' && (
          <div className="grid">
            {LIGHTING_CHANNEL_KEYS.map(key => (
              <div className="field" key={key}>
                <label htmlFor={`lighting-${key}`}>{key}</label>
                <input
                  id={`lighting-${key}`}
                  type="number"
                  min={0.2}
                  max={1.6}
                  step={0.01}
                  value={lightingCustom[key]}
                  placeholder={String(lightingPreviewValues[key])}
                  onChange={e =>
                    setLightingCustom(prev => ({ ...prev, [key]: e.target.value }))
                  }
                />
                <span className="field-hint">留空 = 用预设 {lightingPreviewValues[key]}</span>
              </div>
            ))}
          </div>
        )}

        {hourlyCurve.length > 0 && (
          <div className="field">
            <span className="field-hint">一天 24 小时的天色曲线（点色块直接选时刻）</span>
            <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
              {hourlyCurve.map(h => (
                <button
                  key={h.hour}
                  type="button"
                  title={`${h.label}  A ${h.values.Ambient} R ${h.values.Red} G ${h.values.Green} B ${h.values.Blue}`}
                  onClick={() => setLightingHour(h.hour)}
                  disabled={lightingMode === 'auto'}
                  style={{
                    flex: '1 1 0',
                    height: 34,
                    padding: 0,
                    cursor: lightingMode === 'auto' ? 'default' : 'pointer',
                    borderRadius: 3,
                    border:
                      h.hour === lightingHour
                        ? '2px solid #ffffff'
                        : '1px solid rgba(0,0,0,.25)',
                    background: swatchOf(h.values),
                    opacity: lightingMode === 'auto' ? 0.5 : 1,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 2,
                marginTop: 2,
                fontSize: 10,
                opacity: 0.7,
              }}
            >
              {hourlyCurve.map(h => (
                <span key={h.hour} style={{ flex: '1 1 0', textAlign: 'center' }}>
                  {h.hour % 3 === 0 ? h.hour : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="field field-inline" style={{ gap: 12, alignItems: 'center' }}>
          <span className="field-hint">色卡预览</span>
          <div
            style={{
              width: 96,
              height: 28,
              borderRadius: 6,
              border: '1px solid rgba(0,0,0,.25)',
              background: lightingMode === 'auto' ? '#8a8a8a' : lightingSwatch,
            }}
            title={lightingSwatch}
          />
          <span className="field-hint">
            {lightingMode === 'auto'
              ? '跟随原版（不写死光照）'
              : `${getHourLabel(lightingHour)} · A ${lightingPreviewValues.Ambient} · R ${
                  lightingPreviewValues.Red
                } · G ${lightingPreviewValues.Green} · B ${lightingPreviewValues.Blue} · L ${
                  lightingPreviewValues.Level
                }`}
          </span>
        </div>

        {lastLighting && (
          <span className="field-hint">
            上一张实际写入：A {lastLighting.Ambient} · R {lastLighting.Red} · G {lastLighting.Green} · B{' '}
            {lastLighting.Blue} · L {lastLighting.Level}
          </span>
        )}
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
