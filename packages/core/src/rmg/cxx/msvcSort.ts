/**
 * Faithful transliteration of MSVC STL std::sort (microsoft/stl `<algorithm>`
 * _Sort_unchecked + __msvc_heap_algorithms.hpp). The reference C++ project's
 * tie order after std::sort depends on MSVC's introsort, not on a stable
 * sort, so alignment requires the exact algorithm.
 *
 * cmp(a, b) mirrors the C++ strict-weak predicate `_Pred(a, b)` ("a < b").
 */

const ISORT_MAX = 32; // _ISORT_MAX

function insertionSort<T>(a: T[], first: number, last: number, cmp: (x: T, y: T) => boolean): void {
    // _Insertion_sort_unchecked
    if (first === last) return;
    for (let mid = first + 1; mid !== last; ++mid) {
        const val = a[mid]!;
        if (cmp(val, a[first]!)) {
            // found new earliest element: move [first, mid) up one, drop at first
            // (_Move_backward_unchecked(_First, _Mid, ++_Hole))
            for (let i = mid; i > first; --i) a[i] = a[i - 1]!;
            a[first] = val;
        } else {
            // look for insertion point after first
            // for (_Prev = _Hole; _Pred(_Val, *--_Prev); _Hole = _Prev) *_Hole = move(*_Prev);
            let hole = mid;
            let prev = mid;
            for (;;) {
                --prev;
                if (!cmp(val, a[prev]!)) break;
                a[hole] = a[prev]!;
                hole = prev;
            }
            a[hole] = val;
        }
    }
}

function med3<T>(a: T[], f: number, m: number, l: number, cmp: (x: T, y: T) => boolean): void {
    // _Med3_unchecked - sort median of three elements to the middle
    if (cmp(a[m]!, a[f]!)) {
        const t = a[m]!; a[m] = a[f]!; a[f] = t;
    }
    if (cmp(a[l]!, a[m]!)) {
        const t = a[l]!; a[l] = a[m]!; a[m] = t;
        if (cmp(a[m]!, a[f]!)) {
            const t2 = a[m]!; a[m] = a[f]!; a[f] = t2;
        }
    }
}

function guessMedian<T>(a: T[], first: number, last: number, cmp: (x: T, y: T) => boolean): number {
    // _Guess_median_unchecked(First, Mid, Prev_iter(Last)) - returns Mid's index
    const mid = first + ((last - first) >> 1);
    const count = last - 1 - first;
    if (40 < count) {
        // Tukey's ninther
        const step = (count + 1) >> 3;
        const twoStep = step << 1;
        med3(a, first, first + step, first + twoStep, cmp);
        med3(a, mid - step, mid, mid + step, cmp);
        med3(a, last - 1 - twoStep, last - 1 - step, last - 1, cmp);
        med3(a, first + step, mid, last - 1 - step, cmp);
    } else {
        med3(a, first, mid, last - 1, cmp);
    }
    return mid;
}

function partitionByPivot<T>(
    a: T[], first: number, pfirstIn: number, last: number,
    cmp: (x: T, y: T) => boolean,
): { first: number; second: number } {
    // _Partition_by_pivot_unchecked - returns the equal-to-pivot range
    const swap = (i: number, j: number): void => {
        const t = a[i]!; a[i] = a[j]!; a[j] = t;
    };
    let pfirst = pfirstIn;
    let plast = pfirstIn + 1;

    while (first < pfirst && !cmp(a[pfirst - 1]!, a[pfirst]!) && !cmp(a[pfirst]!, a[pfirst - 1]!)) {
        --pfirst;
    }
    while (plast < last && !cmp(a[plast]!, a[pfirst]!) && !cmp(a[pfirst]!, a[plast]!)) {
        ++plast;
    }

    let gfirst = plast;
    let glast = pfirst;

    for (;;) {
        for (; gfirst < last; ++gfirst) {
            if (cmp(a[pfirst]!, a[gfirst]!)) {
                continue;
            } else if (cmp(a[gfirst]!, a[pfirst]!)) {
                break;
            } else if (plast !== gfirst) {
                swap(plast, gfirst);
                ++plast;
            } else {
                ++plast;
            }
        }

        for (; first < glast; --glast) {
            const glastPrev = glast - 1;
            if (cmp(a[glastPrev]!, a[pfirst]!)) {
                continue;
            } else if (cmp(a[pfirst]!, a[glastPrev]!)) {
                break;
            } else {
                --pfirst;
                if (pfirst !== glastPrev) swap(pfirst, glastPrev);
            }
        }

        if (glast === first && gfirst === last) {
            return { first: pfirst, second: plast };
        }

        if (glast === first) {
            // no room at bottom, rotate pivot upward
            if (plast !== gfirst) swap(pfirst, plast);
            ++plast;
            swap(pfirst, gfirst);
            ++pfirst;
            ++gfirst;
        } else if (gfirst === last) {
            // no room at top, rotate pivot downward
            --glast;
            --pfirst;
            if (glast !== pfirst) swap(glast, pfirst);
            swap(pfirst, --plast);
        } else {
            swap(gfirst, --glast);
            ++gfirst;
        }
    }
}

/** _Push_heap_by_index over the absolute window [base, base+bottom). */
function pushHeapByIndex<T>(
    a: T[], base: number, holeIn: number, top: number, val: T, cmp: (x: T, y: T) => boolean,
): void {
    let hole = holeIn;
    for (let idx = (hole - 1) >> 1; top < hole && cmp(a[base + idx]!, val); idx = (hole - 1) >> 1) {
        a[base + hole] = a[base + idx]!;
        hole = idx;
    }
    a[base + hole] = val;
}

/** _Pop_heap_hole_by_index over the absolute window [base, base+bottom). */
function popHeapHoleByIndex<T>(
    a: T[], base: number, holeIn: number, bottom: number, val: T, cmp: (x: T, y: T) => boolean,
): void {
    const top = holeIn;
    let hole = holeIn;
    let idx = hole;
    const maxSequenceNonLeaf = (bottom - 1) >> 1;
    while (idx < maxSequenceNonLeaf) {
        idx = 2 * idx + 2;
        if (cmp(a[base + idx]!, a[base + idx - 1]!)) {
            --idx;
        }
        a[base + hole] = a[base + idx]!;
        hole = idx;
    }
    if (idx === maxSequenceNonLeaf && bottom % 2 === 0) {
        a[base + hole] = a[base + bottom - 1]!;
        hole = bottom - 1;
    }
    pushHeapByIndex(a, base, hole, top, val, cmp);
}

/**
 * std::sort(first, last, pred) on `a[first..last)`. Mutates `a` in place,
 * producing MSVC's exact element order including ties.
 */
export function msvcSort<T>(a: T[], cmp: (x: T, y: T) => boolean, first = 0, last = a.length): void {
    let f = first;
    let l = last;
    let ideal = l - f;
    for (;;) {
        if (l - f <= ISORT_MAX) {
            insertionSort(a, f, l, cmp);
            return;
        }
        if (ideal <= 0) {
            // heap sort fallback: _Make_heap_unchecked + _Sort_heap_unchecked
            const n = l - f;
            for (let hole = n >> 1; hole > 0;) {
                --hole;
                const val = a[f + hole]!;
                popHeapHoleByIndex(a, f, hole, n, val, cmp);
            }
            // _Sort_heap_unchecked: for (; _Last - _First >= 2; --_Last) _Pop_heap_unchecked(...)
            for (; l - f >= 2; --l) {
                const target = l - 1;        // _Pop_heap_unchecked's --_Last
                const val = a[target]!;
                a[target] = a[f]!;           // *_Dest = move(*_First)
                popHeapHoleByIndex(a, f, 0, target - f, val, cmp);
            }
            return;
        }

        const mid = partitionByPivot(a, f, guessMedian(a, f, l, cmp), l, cmp);

        ideal = (ideal >> 1) + (ideal >> 2); // allow 1.5 log2(N) divisions

        if (mid.first - f < l - mid.second) {
            msvcSort(a, cmp, f, mid.first);
            f = mid.second;
        } else {
            msvcSort(a, cmp, mid.second, l);
            l = mid.first;
        }
    }
}
