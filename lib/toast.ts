// One toast for the whole app (docs/interaction/patterns.md P8–P10, DEC-004/005).
//
// A screen says what just happened by calling `toast()` after its write has
// finished. The toast belongs to the app, not the screen, so it survives the
// seller jumping to another tab or closing the sheet that made it (GAP-BER-6,
// GAP-HUN-4, AMB-17). One at a time: a newer one replaces the older, whose
// undo is no longer offered.
//
// - `undo`: shows Batal for 10 s. It writes back exactly what changed.
// - `error`: stays until closed, with Coba lagi when `retry` is given.

export type Toast = {
  id: number;
  text: string;
  undo?: () => Promise<unknown>;
  error?: boolean;
  retry?: () => Promise<unknown>;
};

export const UNDO_MS = 10_000;
const PLAIN_MS = 4_000;

let current: Toast | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<(t: Toast | null) => void>();

function emit() { listeners.forEach(f => f(current)); }

export function toast(t: Omit<Toast, "id">): void {
  clearTimeout(timer);
  current = { ...t, id: ++seq };
  if (!t.error) {
    const id = current.id;
    timer = setTimeout(() => { if (current?.id === id) { current = null; emit(); } }, t.undo ? UNDO_MS : PLAIN_MS);
  }
  emit();
}

/** A write that failed: say so where the seller is, with a way to try again. */
export function toastError(text: string, retry?: () => Promise<unknown>): void {
  toast({ text, error: true, retry });
}

export function dismissToast(id?: number): void {
  if (id !== undefined && current?.id !== id) return;
  clearTimeout(timer);
  current = null;
  emit();
}

export function subscribeToast(f: (t: Toast | null) => void): () => void {
  listeners.add(f);
  f(current);
  return () => { listeners.delete(f); };
}

/**
 * Run a write, then say so; on failure say that instead, with Coba lagi.
 * `fn` returns the undo for the write, or nothing when it can't be taken back.
 */
export async function withToast(text: string, fn: () => Promise<(() => Promise<unknown>) | void>, failed = "Gagal nyimpen. Cek koneksi lalu coba lagi."): Promise<boolean> {
  try {
    const undo = await fn();
    toast({ text, undo: undo || undefined });
    return true;
  } catch {
    toastError(failed, () => withToast(text, fn, failed));
    return false;
  }
}
