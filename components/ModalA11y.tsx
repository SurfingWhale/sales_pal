"use client";

import { useEffect } from "react";

// Every dialog in SalesPal is a `.modal-overlay` whose own click closes it,
// wrapping one box. Rather than rewrite fourteen of them, this watches for
// them once and gives each what a dialog needs (docs/prd/PRD-004):
// - the box is announced as a modal dialog, named by its first line
// - focus moves inside when it opens and goes back to the opener when it closes
// - Tab stays inside it, Escape closes it (by clicking the overlay, the same
//   path as clicking outside)
// - the page behind does not scroll along
// - a × that stays at the top while the box scrolls, unless it has its own
//   Tutup / Kembali
// - the phone's back (swipe on iOS, the back button on Android) closes the
//   top dialog instead of leaving the app: each dialog is a history entry

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const OWN_CLOSE = /^(tutup|kembali)/i;

function addCloseButton(overlay: HTMLElement, box: HTMLElement) {
  if (overlay.classList.contains("print-overlay") || overlay.classList.contains("sp-leadpage")) return;
  const own = Array.from(box.querySelectorAll("button")).some(b => OWN_CLOSE.test((b.getAttribute("aria-label") || b.textContent || "").trim()));
  if (own) return;
  // A zero-height sticky rail as the first child: the × floats over the
  // box's top-right corner and stays there while the box scrolls.
  const rail = document.createElement("div");
  rail.className = "modal-x-rail";
  const x = document.createElement("button");
  x.type = "button";
  x.className = "modal-x";
  x.setAttribute("aria-label", "Tutup");
  x.textContent = "×";
  x.addEventListener("click", e => { e.stopPropagation(); overlay.click(); });
  rail.appendChild(x);
  box.insertBefore(rail, box.firstChild);
}

function focusables(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(e => e.offsetParent !== null || e === document.activeElement);
}

export default function ModalA11y() {
  useEffect(() => {
    const openers: (HTMLElement | null)[] = [];
    // Back closes a dialog: one history entry per open dialog. Next.js keeps
    // its own fields in history.state, so they're copied along.
    let entries = 0;
    // Going back lands later, and Safari merges back() calls made together into
    // one step. So: at most one traversal in flight (`inFlight`), entries still
    // to drop wait in `owed`, and a dialog opened meanwhile waits in `deferred`
    // to push its entry until the traversal is through.
    let inFlight = false;
    let owed = 0;
    let deferred = 0;
    // A step back another part of the app took (Hunting leaving a person's
    // page, announced with "sp:back"): its popstate is not someone pressing
    // Back on a dialog opened meanwhile, which waits for it like for our own.
    let external = 0;
    const busy = () => inFlight || external > 0;
    const pushNow = () => window.history.pushState({ ...(window.history.state || {}), spModal: entries }, "");
    const push = () => { entries++; if (busy()) deferred++; else pushNow(); };
    const drop = (n: number) => { if (busy()) { owed += n; return; } inFlight = true; window.history.go(-n); };
    const settle = () => {
      if (owed) { const n = owed; owed = 0; drop(n); return; }
      for (; deferred > 0; deferred--) pushNow();
    };
    // If its popstate never comes, don't wait on it for ever.
    const onExternal = () => { external++; setTimeout(() => { if (external > 0) { external--; if (!busy()) settle(); } }, 3000); };
    const topmost = () => {
      const all = document.querySelectorAll<HTMLElement>(".modal-overlay");
      return all.length ? all[all.length - 1] : null;
    };

    function prepare(overlay: HTMLElement) {
      if (overlay.dataset.dialog) return;
      overlay.dataset.dialog = "1";
      overlay.style.overscrollBehavior = "contain";
      const box = overlay.firstElementChild as HTMLElement | null;
      if (!box) return;
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      addCloseButton(overlay, box);
      push();
      const title = (box.textContent || "").trim().split("\n")[0].slice(0, 60);
      if (!box.hasAttribute("aria-label") && title) box.setAttribute("aria-label", title);
      openers.push(document.activeElement as HTMLElement | null);
      if (!box.contains(document.activeElement)) {
        const first = box.querySelector<HTMLElement>("[autofocus]") || focusables(box).find(e => e.tagName !== "BUTTON") || focusables(box)[0];
        first?.focus({ preventScroll: true });
      }
    }

    const observer = new MutationObserver(() => {
      document.querySelectorAll<HTMLElement>(".modal-overlay").forEach(prepare);
      const open = document.querySelectorAll(".modal-overlay").length;
      while (openers.length > open) {
        const el = openers.pop();
        if (el && document.contains(el)) el.focus({ preventScroll: true });
      }
      // Closed by its own button: drop the entry it pushed, quietly.
      let gone = 0;
      while (entries > open) {
        entries--;
        // Its entry never went in (still waiting on a back): nothing to undo.
        if (deferred > 0) { deferred--; continue; }
        gone++;
      }
      if (gone) drop(gone);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll<HTMLElement>(".modal-overlay").forEach(prepare);

    function onKey(e: KeyboardEvent) {
      const overlay = topmost();
      if (!overlay) return;
      if (e.key === "Escape") {
        e.preventDefault();
        overlay.click();
        return;
      }
      if (e.key !== "Tab") return;
      const box = overlay.firstElementChild as HTMLElement | null;
      if (!box) return;
      const items = focusables(box);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !box.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !box.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
    function onPop() {
      if (external > 0) {
        external--;
        if (!busy()) settle();
        return;
      }
      if (inFlight) {
        inFlight = false;
        if (!busy()) settle();
        return;
      }
      const overlay = topmost();
      if (!overlay || entries === 0) return;
      entries--;
      overlay.click();
      // Some dialogs won't close from outside (mid-save); keep their entry.
      setTimeout(() => { if (document.contains(overlay)) push(); }, 50);
    }

    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    window.addEventListener("sp:back", onExternal);
    return () => { observer.disconnect(); document.removeEventListener("keydown", onKey); window.removeEventListener("popstate", onPop); window.removeEventListener("sp:back", onExternal); };
  }, []);
  return null;
}
