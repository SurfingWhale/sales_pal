"use client";

// Filters you can stack: tap one and it joins a single blue bar with an × at
// its front; the others stay within reach, and tapping an active one sends it
// back to where it was (PRD-025).
//
// Motion is manual FLIP on the Web Animations API. First is read in the tap,
// Last after React commits, and the difference plays out from there, so a tap
// mid-flight starts from where things really are and nothing stays transformed.
// The verdict on motion libraries is in the PRD.
//
// Keep it flat: every pill is a sibling in one keyed array and the × is always
// the first one. A wrapper around the bar would remount the pills, and a
// remounted pill has no First. DOM order is reading order: never CSS `order`.

import { useLayoutEffect, useRef } from "react";
import Icon from "@/components/Icon";

export interface Pill<T extends string> {
  id: T;
  label: string;
  count?: number;
  disabled?: boolean;
}

interface Seen {
  x: number; y: number;
  shown: boolean;
  ink: string; radius: string; fill: string; line: string; clip: string;
}
interface Flight {
  seen: Map<string, Seen>;
  still: boolean;       // Reduce Motion: state and focus change, nothing moves
  tapped: string;
  focused: boolean;     // the tapped control had focus (a tap on iOS doesn't give it)
  lead: string;         // the pill the × rides on as it comes and goes
}

const CLEAR = "__clear";
const STILL = "(prefers-reduced-motion: reduce)";
const MOVE_MS = 220;    // native K9: 220 ms at most
const MORPH_MS = 180;
const SPRING = "cubic-bezier(.3, 1.28, .5, 1)";   // a spring's overshoot, without a runtime to solve one
// The × opens out of the pill's front edge, rounded all the way.
const BAR_OPEN = "inset(6px 0px 6px 0px round 16px 0px 0px 16px)";
const BAR_SHUT = "inset(6px 0px 6px 100% round 16px 0px 0px 16px)";
const VIEW_PAD = 16;

function toggled<T extends string>(value: T[], id: T): T[] {
  return value.includes(id) ? value.filter(x => x !== id) : [...value, id];
}

// The bar in the order they were picked, so a new one only ever joins its end;
// the rest in their usual order, so a pill goes home to the same place.
function inOrder<T extends string>(pills: Pill<T>[], value: T[]): Pill<T>[] {
  const picked = value.map(id => pills.find(p => p.id === id)).filter((p): p is Pill<T> => !!p);
  return [...picked, ...pills.filter(p => !value.includes(p.id))];
}

// x as on screen, so a scroll of the row is part of the move; y within the row,
// so a page that gets shorter under the filter isn't.
function look(row: HTMLElement): Map<string, Seen> {
  const seen = new Map<string, Seen>();
  const top = row.getBoundingClientRect().top;
  for (const child of Array.from(row.children)) {
    const box = child as HTMLElement;
    const own = getComputedStyle(box);
    const fill = getComputedStyle(box.firstElementChild as HTMLElement);
    const at = box.getBoundingClientRect();
    seen.set(box.dataset.key as string, {
      x: at.left, y: at.top - top, shown: own.visibility !== "hidden",
      ink: own.color, radius: fill.borderRadius, fill: fill.backgroundColor, line: fill.borderColor, clip: own.clipPath,
    });
  }
  return seen;
}

function byKey(row: HTMLElement, key: string): HTMLElement | undefined {
  return Array.from(row.children).find(c => (c as HTMLElement).dataset.key === key) as HTMLElement | undefined;
}

function takeOff(row: HTMLElement | null, tapped: string, lead: string): Flight | null {
  if (!row) return null;
  const still = window.matchMedia(STILL).matches;
  const focused = document.activeElement === byKey(row, tapped);
  return { seen: still ? new Map() : look(row), still, tapped, focused, lead };
}

// A pill sent to the bar can land out of view, and one going home can too.
function keepInView(row: HTMLElement, el: HTMLElement) {
  const view = row.getBoundingClientRect();
  const at = el.getBoundingClientRect();
  if (at.left < view.left + VIEW_PAD) row.scrollLeft -= view.left + VIEW_PAD - at.left;
  else if (at.right > view.right - VIEW_PAD) row.scrollLeft += at.right - view.right + VIEW_PAD;
}

function flyPill(box: HTMLElement, was: Seen, is: Seen, tapped: boolean) {
  const dx = was.x - is.x, dy = was.y - is.y;
  const lift = tapped ? { zIndex: 3 } : {};   // the tapped pill passes over the others
  if (dx || dy || was.ink !== is.ink) {
    box.animate([
      { transform: `translate(${dx}px, ${dy}px)`, color: was.ink, ...lift },
      { transform: "none", color: is.ink, ...lift },
    ], { duration: MOVE_MS, easing: SPRING });
  }
  const fill = box.firstElementChild as HTMLElement;
  if (was.fill !== is.fill || was.radius !== is.radius || was.line !== is.line) {
    fill.animate([
      { borderRadius: was.radius, backgroundColor: was.fill, borderColor: was.line },
      { borderRadius: is.radius, backgroundColor: is.fill, borderColor: is.line },
    ], { duration: MORPH_MS, easing: "ease-out" });
  }
  if (tapped) fill.animate([{ transform: "scale(.94)" }, { transform: "none" }], { duration: MOVE_MS, easing: SPRING });
}

// The × moves like a pill while it stays, and rides on the lead pill as it
// opens or closes, so the bar grows out of that pill and shrinks back into it.
function flyClear(box: HTMLElement, was: Seen, is: Seen, leadWas?: Seen, leadIs?: Seen) {
  if (!was.shown && !is.shown) return;
  const dx = was.x - is.x, dy = was.y - is.y;
  const rideX = leadWas && leadIs ? leadWas.x - leadIs.x : 0;
  const rideY = leadWas && leadIs ? leadWas.y - leadIs.y : 0;
  const fromX = was.shown ? dx : rideX, fromY = was.shown ? dy : rideY;
  const toX = is.shown ? 0 : dx - rideX, toY = is.shown ? 0 : dy - rideY;
  const fromClip = !was.shown ? BAR_SHUT : was.clip === "none" ? BAR_OPEN : was.clip;
  const toClip = is.shown ? BAR_OPEN : BAR_SHUT;
  if (fromX === toX && fromY === toY && fromClip === toClip) return;
  box.animate([
    { transform: `translate(${fromX}px, ${fromY}px)`, clipPath: fromClip, visibility: "visible" },
    { transform: `translate(${toX}px, ${toY}px)`, clipPath: toClip, visibility: "visible" },
  ], { duration: MOVE_MS, easing: SPRING });
}

function land(row: HTMLElement, f: Flight) {
  // Off with whatever was still moving: First already has where it had got to.
  row.getAnimations({ subtree: true }).forEach(a => a.cancel());

  // Scrolling goes here, between First and Last, so it plays out as part of the same move.
  const pill = byKey(row, f.tapped);
  const cleared = f.tapped === CLEAR;
  if (cleared || pill?.getAttribute("aria-pressed") === "true") row.scrollLeft = 0;
  if (pill && !cleared) keepInView(row, pill);

  // React moved a pill by taking it out and putting it back, which drops focus;
  // the × has just gone, so focus goes to the first pill rather than to the page.
  if (cleared) (row.querySelector("button[aria-pressed]:not(:disabled)") as HTMLElement | null)?.focus({ preventScroll: true });
  else if (f.focused && document.activeElement !== pill) pill?.focus({ preventScroll: true });

  if (f.still) return;
  const now = look(row);
  for (const child of Array.from(row.children)) {
    const box = child as HTMLElement;
    const key = box.dataset.key as string;
    const was = f.seen.get(key), is = now.get(key);
    if (!was || !is) continue;
    if (key === CLEAR) flyClear(box, was, is, f.seen.get(f.lead), now.get(f.lead));
    else flyPill(box, was, is, key === f.tapped);
  }
}

// What a filter changed settles in rather than pops.
export function settleIn(el: HTMLElement | null) {
  if (!el || window.matchMedia(STILL).matches) return;
  el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: MORPH_MS, easing: "ease-out" });
}

export default function FilterPills<T extends string>({ label, pills, value, onChange, status, clearLabel = "Hapus semua filter" }: {
  label: string;           // what the group of filters is, for screen readers
  pills: Pill<T>[];
  value: T[];              // in the order they were picked; none = no filter
  onChange: (next: T[]) => void;
  status: string;          // the result, said aloud when it changes
  clearLabel?: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const flight = useRef<Flight | null>(null);

  useLayoutEffect(() => {
    if (flight.current && rowRef.current) land(rowRef.current, flight.current);
    flight.current = null;
  }, [value]);

  const ordered = inOrder(pills, value);
  const barEnd = ordered.filter(p => value.includes(p.id)).length - 1;

  return (
    <div className="sp-fp">
      <div ref={rowRef} role="group" aria-label={label} className="sp-fp-row">
        <button type="button" className="sp-fp-x" data-key={CLEAR} data-on={value.length > 0} aria-label={clearLabel}
          onClick={() => { flight.current = takeOff(rowRef.current, CLEAR, value[0]); onChange([]); }}>
          <span className="sp-fp-fill" aria-hidden="true" />
          <Icon name="close" size={16} stroke={2} style={{ position: "relative" }} />
        </button>
        {ordered.map((p, i) => {
          const on = value.includes(p.id);
          return (
            <button key={p.id} type="button" className="sp-fp-chip" data-key={p.id} data-end={i === barEnd || undefined}
              aria-pressed={on} disabled={p.disabled && !on}
              onClick={() => { flight.current = takeOff(rowRef.current, p.id, value[0] ?? p.id); onChange(toggled(value, p.id)); }}>
              <span className="sp-fp-fill" aria-hidden="true" />
              <span className="sp-fp-text">{p.label}{p.count === undefined ? null : <> <span className="tabnum">{p.count}</span></>}</span>
            </button>
          );
        })}
      </div>
      <div role="status" aria-live="polite" className="sp-fp-status tabnum">{status}</div>
    </div>
  );
}
