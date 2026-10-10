/**
 * R250Random - exact replication of the game's global Randomizer
 * (dst_ @ 0xABE890). Source: G:/MapGenerator MapGen.cpp R250 section.
 *
 *   Seed  = sub_65C6D0 (4-round constant mixing per buffer slot)
 *   Next  = Randomizer::Random 0x65C780 (dual-pointer XOR feedback)
 *   Range = Randomizer::RandomRanged 0x65C7E0 (bitmask rejection)
 *   Float = sub_598030 (float scaling + upper rejection)
 *   Unit  = Randomizer::Random_w 0x598000 (Next * kUnitScale)
 *   Gauss = sub_5980C0 (Marsaglia polar, second value cached)
 */

const K_SEED_T1 = [0xbaa96887, 0x1e17d32c, 0x03bcdc3c, 0x0f33d1b2];
const K_SEED_T2 = [0x48aad7e4, 0x4b0f3b58, 0xe874f0c3, 0x6955c5a6, 0x55a7ca46];

import { K_UNIT_SCALE } from './mathTables';

export class R250Random {
    private buffer: Uint32Array;
    private index1 = 0;
    private index2 = 103;
    private gaussHave = false;
    private gaussSaved = 0;
    private draws = 0;

    constructor() {
        this.buffer = new Uint32Array(250);
    }

    /** Total next() calls since seed - debugging aid, no game counterpart. */
    drawCount(): number {
        return this.draws;
    }

    /** sub_65C6D0. Also resets the Gauss state (sub_598960 does it right after). */
    seed(seed: number): void {
        const buffer = this.buffer;
        for (let slot = 0; slot < 250; ++slot) {
            let v3 = seed >>> 0;
            let v4 = slot >>> 0;
            for (let n = 0; n < 4; ++n) {
                const prev = v4;
                const v7 = (v4 ^ K_SEED_T1[n]) >>> 0;
                const hi = (v7 >> 16) >>> 0; // sar -> arithmetic; >>> 0 reinterprets
                const lo = v7 & 0xffff;
                const hihi = Math.imul(hi, hi) >>> 0;
                const hilo = Math.imul(hi, lo) >>> 0;
                const lolo = Math.imul(lo, lo) >>> 0;
                const t = (lolo + ~hihi) >>> 0;
                const rot = (((t | 0) >> 16) | (t << 16)) >>> 0;
                const v8 = (v3 ^ ((hilo + (K_SEED_T2[n + 1] ^ rot)) >>> 0)) >>> 0;
                v4 = v8;
                v3 = prev;
            }
            buffer[slot] = v4;
        }
        this.index1 = 0;
        this.index2 = 103;
        this.gaussHave = false;
        this.gaussSaved = 0;
    }

    /** Randomizer::Random 0x65C780. */
    next(): number {
        ++this.draws;
        const i1 = this.index1;
        this.buffer[i1] = (this.buffer[i1] ^ this.buffer[this.index2]) >>> 0;
        const result = this.buffer[i1];

        let a = i1 + 1;
        let b = this.index2 + 1;
        this.index1 = a;
        this.index2 = b;
        if (a >= 250) this.index1 = 0;
        if (b >= 250) this.index2 = 0;

        return result;
    }

    /** Randomizer::RandomRanged 0x65C7E0 - bitmask rejection sampling. */
    randomRanged(min: number, max: number): number {
        if (min === max) return min;
        let nMin = min;
        let nMax = max;
        if (min > max) {
            nMin = max;
            nMax = min;
        }
        const nRange = nMax - nMin;

        let n31 = 31;
        if (nRange >= 0) {
            do {
                if (n31 <= 0) break;
                --n31;
            } while (((1 << n31) & nRange) === 0);
        }

        const mask = ~(-1 << (n31 + 1));
        let r = nRange + 1;
        while (r > nRange) r = (mask & this.next()) | 0;

        return nMin + r;
    }

    /** sub_598030 - float scaling + upper rejection. */
    randomFloatRange(lo: number, hi: number): number {
        const range = (hi >>> 0) - (lo >>> 0) + 1;
        const base = lo >>> 0;
        for (;;) {
            const r = this.next();
            const x = (r * range) * K_UNIT_SCALE + base;
            const v = Math.trunc(x);
            if ((v >>> 0) <= (hi >>> 0)) return v;
        }
    }

    /** Randomizer::Random_w 0x598000 - uniform double in [0,1]. */
    unit(): number {
        return this.next() * K_UNIT_SCALE;
    }

    /** 25% chance boolean (sub_599650 @ 0x59a4cc). */
    chance25(): boolean {
        return this.next() * K_UNIT_SCALE < 0.25;
    }

    /** sub_5980C0 - Marsaglia polar gaussian with a cached second value. */
    gaussian(): number {
        if (this.gaussHave) {
            this.gaussHave = false;
            return this.gaussSaved;
        }
        let a = this.unit();
        let b = this.unit();
        let u = a + a - 1.0;
        let v = b + b - 1.0;
        let s = v * v + u * u;
        while (s >= 1.0 || s === 0.0) {
            a = this.unit();
            b = this.unit();
            u = a + a - 1.0;
            v = b + b - 1.0;
            s = v * v + u * u;
        }
        const lns = Math.log(s); // asm: fldln2 + fyl2x (see README: log parity risk)
        const factor = Math.sqrt((-lns - lns) / s);
        this.gaussHave = true;
        this.gaussSaved = factor * v;
        return factor * u;
    }
}
