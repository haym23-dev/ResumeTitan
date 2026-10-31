/* ==========================================================================
   editor.js — bootstraps the builder shell.

   Responsibilities for Part 1: tab switching, the resizable split, and wiring
   state -> live preview. Section editing lands in later parts.
   ========================================================================== */

import { loadResume, subscribe } from "./state.js";
import { createPreview } from "./preview.js";
import { mountSectionView } from "./section-view.js";

const SPLIT_MIN = 30;
const SPLIT_MAX = 70;
const SPLIT_STEP = 2;

/** Show one tab panel and sync aria state across the strip. */
function initTabs() {
  const tabs = Array.from(document.querySelectorAll('#builder-tabs [role="tab"]'));

  function select(name) {
    for (const tab of tabs) {
      const active = tab.dataset.tab === name;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute("aria-controls"));
      if (panel) panel.hidden = !active;
    }
  }

  for (const tab of tabs) {
    tab.addEventListener("click", () => select(tab.dataset.tab));
  }

  // Roving arrow-key navigation between tabs.
  document.getElementById("builder-tabs").addEventListener("keydown", (event) => {
    const i = tabs.indexOf(document.activeElement);
    if (i === -1) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = tabs[(i + 1) % tabs.length];
      next.focus();
      select(next.dataset.tab);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prev = tabs[(i - 1 + tabs.length) % tabs.length];
      prev.focus();
      select(prev.dataset.tab);
    }
  });

  select("content");
}

/** Drag (or arrow-key) the divider between the editor and preview. */
function initSplit() {
  const split = document.getElementById("split");
  const handle = document.getElementById("split-handle");
  if (!split || !handle) return;

  const clamp = (pct) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, pct));
  let dragging = false;

  function apply(pct) {
    const value = clamp(pct);
    split.style.setProperty("--split", `${value}%`);
    handle.setAttribute("aria-valuenow", String(Math.round(value)));
  }

  function pctFromPointer(clientX) {
    const rect = split.getBoundingClientRect();
    if (!rect.width) return 55;
    return ((clientX - rect.left) / rect.width) * 100;
  }

  handle.addEventListener("pointerdown", (event) => {
    dragging = true;
    handle.dataset.dragging = "true";
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  handle.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    apply(pctFromPointer(event.clientX));
  });

  function end() {
    dragging = false;
    handle.dataset.dragging = "false";
  }
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);

  handle.addEventListener("keydown", (event) => {
    const current = Number(handle.getAttribute("aria-valuenow")) || 55;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      apply(current - SPLIT_STEP);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      apply(current + SPLIT_STEP);
    }
  });
}

async function boot() {
  initTabs();
  initSplit();

  const preview = createPreview(document.getElementById("preview-iframe"));
  subscribe((resume) => {
    if (resume) preview.render(resume);
  });

  mountSectionView(document.getElementById("editor-pane"));

  try {
    await loadResume();
  } catch (error) {
    console.error("[editor] failed to load resume", error);
  }
}

boot();
