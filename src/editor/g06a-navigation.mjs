/**
 * G0.6A — keyboard intent resolver, independent of DOM and native key events.
 * This does NOT listen to keydown or preventDefault: the renderer decides
 * whether and when to apply a proposed semantic selection.
 *
 * No ArrowUp/Down or visual-line Home/End here: those need layout geometry.
 * No Ctrl/Alt/Meta+arrows here: native word/navigation intent must be handled
 * explicitly by later editor commands, not silently reduced to one grapheme.
 */
import { moveCaret, normalizeSelection } from "./g06a-selection.mjs";

export function proposeHorizontalSelection(doc, selection, event, guard) {
  if (!event || !guard || typeof guard.canNavigate !== "function" ||
      !guard.canNavigate(event)) return null;
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return null;
  return moveCaret(doc, selection, event.key === "ArrowLeft" ? "backward" : "forward", {
    extend: !!event.shiftKey
  });
}

/** Logical block/document endpoints (not physical visual line endpoints). */
export function moveToBoundary(doc, selection, edge, { scope = "block", extend = false } = {}) {
  if (!doc || !Array.isArray(doc.blocks) || !doc.blocks.length) {
    throw new TypeError("Document requires at least one block");
  }
  if (edge !== "start" && edge !== "end") throw new TypeError("Invalid boundary edge");
  if (scope !== "block" && scope !== "document") throw new TypeError("Invalid boundary scope");

  const current = normalizeSelection(doc, selection);
  const focus = current.focus;
  const targetBlock = scope === "document" ? doc.blocks[edge === "start" ? 0 : doc.blocks.length - 1]
    : doc.blocks.find((block) => block.id === focus.blockId);

  // The kernel defines lengths from individual text runs, not UTF-16 offsets.
  // Import lazily to keep the coordinate logic in the selection kernel.
  return boundarySelection(doc, current, targetBlock, edge, extend);
}

import { blockLength } from "./g06a-selection.mjs";
function boundarySelection(doc, current, block, edge, extend) {
  const point = { blockId: block.id, offset: edge === "start" ? 0 : blockLength(block) };
  return { anchor: extend ? current.anchor : point, focus: point };
}
