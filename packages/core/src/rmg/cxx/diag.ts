/**
 * DiagLog - the reference C++ project's per-stage diagnostic log
 * (MapGen.cpp DiagLog). The TS port writes the same lines so a
 * C++-exe run and a TS run can be diffed line by line to locate the
 * first divergence.
 *
 * The sink is installed by the caller (tests / CLI); by default lines
 * are buffered in memory.
 */

export type DiagSink = (line: string) => void;

let sink: DiagSink | null = null;
export const buffer: string[] = [];

export function setDiagSink(s: DiagSink | null): void {
    sink = s;
    if (s === null) buffer.length = 0;
}

export function diag(line: string): void {
    if (sink !== null) sink(line);
    else buffer.push(line);
}

/** sprintf-ish helpers matching the C++ format specifiers used by DiagLog. */
export const f3 = (v: number): string => {
    // MSVC %.3f on a double: round the exact binary value to 3 decimals.
    return v.toFixed(3);
};
export const f4 = (v: number): string => v.toFixed(4);
export const x8 = (v: number): string => (v >>> 0).toString(16).toUpperCase().padStart(8, '0');
export const x2 = (v: number): string => (v & 0xff).toString(16).toUpperCase().padStart(2, '0');
export const u = (v: number): string => (v >>> 0).toString(10);
