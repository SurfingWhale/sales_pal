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

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(e => e.offsetParent !== null || e === document.activeElement);
}

export default function ModalA11y() {
  useEffect(() => {
    const openers: (HTMLElement | null)[] = [];
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
    document.addEventListener("keydown", onKey);
    return () => { observer.disconnect(); document.removeEventListener("keydown", onKey); };
  }, []);
  return null;
}
