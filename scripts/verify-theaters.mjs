const BASE = 'http://127.0.0.1:3000';
const CASES = [
  ['DESERT', 120, { NW: 2, SE: 2 }],
  ['NEWURBAN', 120, { NW: 1, SE: 1 }],
  ['SNOW', 100, { NW: 2, SE: 2 }],
  ['TEMPERATE', 100, { NW: 2, SE: 2 }],
  ['TEMPERATE_Islands', 120, { NW: 2, SE: 2 }],
];

for (const [theaterType, size, playerLocations] of CASES) {
  const body = JSON.stringify({ width: size, height: size, theaterType, playerLocations });
  const res = await fetch(`${BASE}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  if (!res.ok) {
    console.log(`${theaterType.padEnd(18)} HTTP ${res.status} ${await res.text()}`);
    continue;
  }
  const text = await res.text();
  const count = (sec) => (new RegExp(`\\[${sec}\\]`).test(text) ? (text.split(`[${sec}]`)[1].split(/\n\[/)[0].match(/=/g)?.length ?? 0) : 0);
  console.log(
    `${theaterType.padEnd(18)} HTTP 200 bytes=${text.length}  Structures=${count('Structures')} Terrain=${count('Terrain')} Overlay=${count('OverlayPack')} Units=${count('Units')} Waypoints=${count('Waypoints')}`,
  );
}
