/**
 * BellekPad G0.6A: offset translation at the renderer boundary.
 *
 * DOM Text node offsets use UTF-16 code units. The semantic editor kernel
 * uses Unicode grapheme clusters. This file is a pure adapter: it never
 * accesses the live DOM, contenteditable, storage or Electron.
 *
 * Invariant: formatting runs must not split a single grapheme cluster.
 * A canonical G0.5 adapter must preserve/normalize this invariant.
 */
import { assertDocument, graphemes, pointFromRun, runFromPoint } from "./g06a-selection.mjs";

function assertBias(bias) {
  if (bias !== "backward" && bias !== "forward") {
    throw new TypeError("Bias must be backward or forward");
  }
}

function boundaries(text) {
  const result = [0];
  let length = 0;
  for (const part of graphemes(text)) {
    length += part.length;
    result.push(length);
  }
  return result;
}

function requireOffset(value, max, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new RangeError(label + " must be an integer in [0, " + max + "]");
  }
}

/** Convert a semantic grapheme index to an exact DOM UTF-16 offset. */
export function graphemeToUtf16(text, offset) {
  const stops = boundaries(text);
  requireOffset(offset, stops.length - 1, "Grapheme offset");
  return stops[offset];
}

/**
 * Snap a DOM UTF-16 offset to a valid grapheme boundary.
 * If a browser points *inside* an emoji/combining cluster, affinity decides
 * which side of the cluster receives the caret.
 */
export function utf16ToGrapheme(text, offset, bias = "backward") {
  assertBias(bias);
  const stops = boundaries(text);
  requireOffset(offset, text.length, "UTF-16 offset");
  for (let i = 0; i < stops.length; i++) {
    if (stops[i] === offset) return i;
    if (stops[i] > offset) return bias === "forward" ? i : i - 1;
  }
  return stops.length - 1;
}

function findRun(doc, blockId, runIndex) {
  assertDocument(doc);
  const block = doc.blocks.find((entry) => entry.id === blockId);
  if (!block) throw new RangeError("Unknown block ID: " + blockId);
  if (!Number.isSafeInteger(runIndex) || runIndex < 0 || runIndex >= block.runs.length) {
    if (block.runs.length === 0 && runIndex === 0) return "";
    throw new RangeError("Unknown run index");
  }
  return block.runs[runIndex].text;
}

/** Translate a DOM text node position (inside one run) into a block point. */
export function pointFromRunUtf16(doc, blockId, runIndex, offset, bias = "backward") {
  const text = findRun(doc, blockId, runIndex);
  return pointFromRun(doc, blockId, runIndex, utf16ToGrapheme(text, offset, bias));
}

/** Translate a block point into a run position usable by a DOM adapter. */
export function pointToRunUtf16(doc, point, bias = "forward") {
  const location = runFromPoint(doc, point, bias);
  const text = findRun(doc, location.blockId, location.runIndex);
  return {
    blockId: location.blockId,
    runIndex: location.runIndex,
    offset: graphemeToUtf16(text, location.runOffset)
  };
}

/**
 * The renderer may supply this guard's onStart/onEnd to composition event
 * listeners. Navigation never intercepts an active IME composition.
 */
export function createCompositionGuard() {
  let active = false;
  return Object.freeze({
    onStart() { active = true; },
    onEnd() { active = false; },
    get active() { return active; },
    canNavigate(event) {
      return !active && !!event && !event.defaultPrevented &&
        !event.isComposing && event.key !== "Process" && event.keyCode !== 229;
    }
  });
}
