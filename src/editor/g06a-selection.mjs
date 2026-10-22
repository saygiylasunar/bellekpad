/**
 * BellekPad G0.6A — pure logical selection/caret kernel.
 *
 * The document is an adapter shape: { blocks: [{ id, runs: [{ text, ...metadata }] }] }.
 * No DOM ranges, editor dependency, persistence or Electron APIs belong here.
 * Offsets count Unicode grapheme clusters (NOT UTF-16 code units).
 *
 * This is intentionally isolated until the G0.5 model/handoff is available remotely.
 */
const segmenter = new Intl.Segmenter("und", { granularity: "grapheme" });

export function graphemes(text) {
  if (typeof text !== "string") throw new TypeError("Run text must be a string");
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

export function assertDocument(doc) {
  if (!doc || !Array.isArray(doc.blocks) || doc.blocks.length === 0) {
    throw new TypeError("Document requires at least one block");
  }
  const ids = new Set();
  for (const block of doc.blocks) {
    if (!block || typeof block.id !== "string" || !block.id || ids.has(block.id)) {
      throw new TypeError("Block IDs must be unique nonempty strings");
    }
    ids.add(block.id);
    if (!Array.isArray(block.runs)) throw new TypeError("Block requires a runs array");
    for (const run of block.runs) {
      if (!run || typeof run.text !== "string") throw new TypeError("Run requires text");
    }
  }
  return doc;
}

/**
 * Validate that formatting run boundaries do not bisect a Unicode grapheme.
 * Do this at the editor adapter boundary (e.g. after import), rather than on
 * every keystroke. A styled grapheme cannot be assigned two logical offsets.
 */
export function assertGraphemeAlignedRuns(doc) {
  assertDocument(doc);
  for (const block of doc.blocks) {
    const joined = block.runs.map((run) => run.text).join("");
    const stops = new Set([0, joined.length]);
    for (const part of segmenter.segment(joined)) stops.add(part.index);
    let offset = 0;
    for (const run of block.runs) {
      offset += run.text.length;
      if (!stops.has(offset)) {
        throw new TypeError("A formatting run boundary splits a Unicode grapheme in block " + block.id);
      }
    }
  }
  return doc;
}

export function blockLength(block) {
  if (!block || !Array.isArray(block.runs)) throw new TypeError("Invalid block");
  return block.runs.reduce((sum, run) => sum + graphemes(run.text).length, 0);
}

function blockIndex(doc, blockId) {
  const index = doc.blocks.findIndex((block) => block.id === blockId);
  if (index === -1) throw new RangeError("Unknown block ID: " + blockId);
  return index;
}

export function normalizePoint(doc, point) {
  assertDocument(doc);
  if (!point || typeof point.blockId !== "string" || !Number.isSafeInteger(point.offset)) {
    throw new TypeError("Point requires blockId and integer grapheme offset");
  }
  const block = doc.blocks[blockIndex(doc, point.blockId)];
  return { blockId: block.id, offset: Math.max(0, Math.min(point.offset, blockLength(block))) };
}

export function comparePoints(doc, a, b) {
  const left = normalizePoint(doc, a);
  const right = normalizePoint(doc, b);
  const delta = blockIndex(doc, left.blockId) - blockIndex(doc, right.blockId);
  return Math.sign(delta || left.offset - right.offset);
}

export function normalizeSelection(doc, selection) {
  if (!selection || !selection.anchor || !selection.focus) {
    throw new TypeError("Selection requires anchor and focus");
  }
  const anchor = normalizePoint(doc, selection.anchor);
  const focus = normalizePoint(doc, selection.focus);
  const backwards = comparePoints(doc, anchor, focus) > 0;
  return {
    anchor,
    focus,
    start: backwards ? focus : anchor,
    end: backwards ? anchor : focus,
    direction: backwards ? "backward" : "forward",
    collapsed: comparePoints(doc, anchor, focus) === 0
  };
}

/** Map a DOM adapter's run-relative *grapheme* offset onto a stable block point. */
export function pointFromRun(doc, blockId, runIndex, runOffset) {
  assertDocument(doc);
  const block = doc.blocks[blockIndex(doc, blockId)];
  if (!Number.isSafeInteger(runIndex) || !Number.isSafeInteger(runOffset)) {
    throw new TypeError("Run coordinates must be integers");
  }
  if (!block.runs.length && runIndex === 0 && runOffset === 0) {
    return { blockId, offset: 0 };
  }
  if (runIndex < 0 || runIndex >= block.runs.length) throw new RangeError("Unknown run index");
  const length = graphemes(block.runs[runIndex].text).length;
  if (runOffset < 0 || runOffset > length) throw new RangeError("Run offset out of bounds");
  return {
    blockId,
    offset: block.runs.slice(0, runIndex).reduce((sum, run) => sum + graphemes(run.text).length, 0) + runOffset
  };
}

/** At a formatting boundary, bias selects the preceding or following run. */
export function runFromPoint(doc, point, bias = "forward") {
  if (!["forward", "backward"].includes(bias)) throw new TypeError("Invalid boundary bias");
  const safe = normalizePoint(doc, point);
  const block = doc.blocks[blockIndex(doc, safe.blockId)];
  if (!block.runs.length) return { blockId: safe.blockId, runIndex: 0, runOffset: 0 };
  let cursor = 0;
  for (let i = 0; i < block.runs.length; i++) {
    const size = graphemes(block.runs[i].text).length;
    const end = cursor + size;
    if (safe.offset < end || (safe.offset === end && (bias === "backward" || i === block.runs.length - 1))) {
      return { blockId: safe.blockId, runIndex: i, runOffset: safe.offset - cursor };
    }
    cursor = end;
  }
  // Defensive fallback; the final run always owns the end position.
  return { blockId: safe.blockId, runIndex: block.runs.length - 1,
    runOffset: graphemes(block.runs.at(-1).text).length };
}

function stepPoint(doc, point, direction) {
  const safe = normalizePoint(doc, point);
  const index = blockIndex(doc, safe.blockId);
  const len = blockLength(doc.blocks[index]);
  if (direction === "backward") {
    if (safe.offset > 0) return { ...safe, offset: safe.offset - 1 };
    return index > 0
      ? { blockId: doc.blocks[index - 1].id, offset: blockLength(doc.blocks[index - 1]) }
      : safe;
  }
  if (safe.offset < len) return { ...safe, offset: safe.offset + 1 };
  return index < doc.blocks.length - 1
    ? { blockId: doc.blocks[index + 1].id, offset: 0 }
    : safe;
}

/**
 * Move one grapheme or one block boundary.
 * When a selection is active, a non-extending arrow collapses to its edge.
 * Extending movement retains anchor and moves only focus.
 */
export function moveCaret(doc, selection, direction, { extend = false } = {}) {
  if (!["forward", "backward"].includes(direction)) throw new TypeError("Invalid direction");
  const safe = normalizeSelection(doc, selection);
  if (!extend && !safe.collapsed) {
    const edge = direction === "forward" ? safe.end : safe.start;
    return { anchor: edge, focus: edge };
  }
  const focus = stepPoint(doc, safe.focus, direction);
  return { anchor: extend ? safe.anchor : focus, focus };
}

/** Return styled fragments without altering the original runs or their metadata. */
export function selectedFragments(doc, selection) {
  const safe = normalizeSelection(doc, selection);
  if (safe.collapsed) return [];
  const first = blockIndex(doc, safe.start.blockId);
  const last = blockIndex(doc, safe.end.blockId);
  const fragments = [];
  for (let index = first; index <= last; index++) {
    const block = doc.blocks[index];
    const from = index === first ? safe.start.offset : 0;
    const to = index === last ? safe.end.offset : blockLength(block);
    let position = 0;
    const runs = [];
    for (const run of block.runs) {
      const units = graphemes(run.text);
      const left = Math.max(0, from - position);
      const right = Math.min(units.length, to - position);
      if (right > left) {
        // A fragment must not share mutable marks/attributes with stored data.
        // Editor runs are serialized data objects (structured clone-safe).
        const copy = structuredClone(run);
        copy.text = units.slice(left, right).join("");
        runs.push(copy);
      }
      position += units.length;
    }
    fragments.push({ blockId: block.id, runs });
  }
  return fragments;
}

export function selectedText(doc, selection) {
  return selectedFragments(doc, selection)
    .map((fragment) => fragment.runs.map((run) => run.text).join(""))
    .join("\n");
}

/**
 * Keep positions stable across reformatting and clamp after deletions.
 * Removed block IDs fall back to the nearest surviving block ordinal.
 * No mutation or replacement of the editor's canonical block model occurs.
 */
export function rebaseSelection(before, after, selection) {
  const safe = normalizeSelection(before, selection);
  assertDocument(after);
  const mapPoint = (point) => {
    const exists = after.blocks.some((block) => block.id === point.blockId);
    const fallbackIndex = Math.min(blockIndex(before, point.blockId), after.blocks.length - 1);
    const blockId = exists ? point.blockId : after.blocks[fallbackIndex].id;
    return normalizePoint(after, { blockId, offset: point.offset });
  };
  return { anchor: mapPoint(safe.anchor), focus: mapPoint(safe.focus) };
}
