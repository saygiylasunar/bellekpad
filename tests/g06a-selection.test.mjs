import test from "node:test";
import assert from "node:assert/strict";
import {
  assertDocument, graphemes, blockLength, normalizePoint, pointFromRun,
  runFromPoint, comparePoints, normalizeSelection, moveCaret,
  selectedFragments, selectedText, rebaseSelection
} from "../src/editor/g06a-selection.mjs";

const document = () => ({
  blocks: [
    { id: "a", runs: [
      { text: "Mer", marks: ["bold"] },
      { text: "haba", marks: [] },
      { text: " 👩‍💻", marks: ["italic"] }
    ] },
    { id: "empty", runs: [] },
    { id: "c", runs: [{ text: "Dünya", marks: ["code"] }] }
  ]
});
const p = (blockId, offset) => ({ blockId, offset });
const sel = (anchor, focus) => ({ anchor, focus });

test("Unicode graphemes remain indivisible: combining, ZWJ and flags", () => {
  assert.deepEqual(graphemes("a\u0301👩‍💻🇹🇷"), ["a\u0301", "👩‍💻", "🇹🇷"]);
  assert.equal(blockLength(document().blocks[0]), 9);
});

test("reject duplicate block identities, missing blocks and malformed runs", () => {
  assert.throws(() => assertDocument({ blocks: [] }), /at least one/);
  assert.throws(() => assertDocument({ blocks: [{ id: "x", runs: [] }, { id: "x", runs: [] }] }), /unique/);
  assert.throws(() => assertDocument({ blocks: [{ id: "x", runs: [{}] }] }), /text/);
});

test("normalize out-of-bounds offset without changing its block identity", () => {
  assert.deepEqual(normalizePoint(document(), p("a", 999)), p("a", 9));
  assert.deepEqual(normalizePoint(document(), p("a", -4)), p("a", 0));
  assert.throws(() => normalizePoint(document(), p("missing", 2)), /Unknown block/);
  assert.throws(() => normalizePoint(document(), p("a", 1.5)), /integer/);
});

test("DOM adapter positions survive a formatting boundary", () => {
  const doc = document();
  assert.deepEqual(pointFromRun(doc, "a", 1, 0), p("a", 3));
  assert.deepEqual(pointFromRun(doc, "a", 2, 2), p("a", 9));
  assert.deepEqual(runFromPoint(doc, p("a", 3), "forward"),
    { blockId: "a", runIndex: 1, runOffset: 0 });
  assert.deepEqual(runFromPoint(doc, p("a", 3), "backward"),
    { blockId: "a", runIndex: 0, runOffset: 3 });
  assert.deepEqual(runFromPoint(doc, p("empty", 0)),
    { blockId: "empty", runIndex: 0, runOffset: 0 });
});

test("reject invalid run indexes and run offsets", () => {
  assert.throws(() => pointFromRun(document(), "a", 99, 0), /Unknown run/);
  assert.throws(() => pointFromRun(document(), "a", 0, 4), /out of bounds/);
  assert.throws(() => runFromPoint(document(), p("a", 0), "sideways"), /bias/);
});

test("selection order uses document order, not lexicographic block IDs", () => {
  const doc = document();
  assert.equal(comparePoints(doc, p("a", 9), p("empty", 0)), -1);
  assert.equal(comparePoints(doc, p("c", 0), p("a", 9)), 1);
  assert.equal(comparePoints(doc, p("a", 2), p("a", 2)), 0);
});

test("backward selection retains anchor/focus while normalizing boundaries", () => {
  const doc = document();
  const range = normalizeSelection(doc, sel(p("c", 3), p("a", 2)));
  assert.equal(range.direction, "backward");
  assert.deepEqual(range.start, p("a", 2));
  assert.deepEqual(range.end, p("c", 3));
  assert.deepEqual(range.anchor, p("c", 3));
  assert.equal(range.collapsed, false);
});

test("collapsed selection has no fragments or text", () => {
  const s = sel(p("a", 3), p("a", 3));
  assert.equal(normalizeSelection(document(), s).collapsed, true);
  assert.deepEqual(selectedFragments(document(), s), []);
  assert.equal(selectedText(document(), s), "");
});

test("selection spanning styles splits runs and retains marks", () => {
  const doc = document();
  const fragments = selectedFragments(doc, sel(p("a", 2), p("a", 5)));
  assert.deepEqual(fragments, [
    { blockId: "a", runs: [
      { text: "r", marks: ["bold"] }, { text: "ha", marks: [] }
    ] }
  ]);
  assert.equal(selectedText(doc, sel(p("a", 2), p("a", 5))), "rha");
});

test("cross-block selection includes paragraph delimiters and empty blocks", () => {
  const doc = document();
  assert.equal(selectedText(doc, sel(p("a", 8), p("c", 2))), "👩‍💻\n\nDü");
  assert.equal(selectedText(doc, sel(p("c", 2), p("a", 8))), "👩‍💻\n\nDü");
  assert.equal(selectedText(doc, sel(p("a", 9), p("empty", 0))), "\n");
});

test("arrow without shift collapses an existing range to the relevant edge", () => {
  const doc = document();
  const range = sel(p("c", 2), p("a", 2));
  assert.deepEqual(moveCaret(doc, range, "backward"), sel(p("a", 2), p("a", 2)));
  assert.deepEqual(moveCaret(doc, range, "forward"), sel(p("c", 2), p("c", 2)));
});

test("shift-arrow preserves anchor, extends focus and supports reversal", () => {
  const doc = document();
  const s = sel(p("a", 3), p("a", 3));
  assert.deepEqual(moveCaret(doc, s, "backward", { extend: true }),
    sel(p("a", 3), p("a", 2)));
  const backwards = sel(p("a", 3), p("a", 2));
  assert.deepEqual(moveCaret(doc, backwards, "forward", { extend: true }),
    sel(p("a", 3), p("a", 3)));
});

test("arrow crosses style boundaries in grapheme units", () => {
  const doc = document();
  assert.deepEqual(moveCaret(doc, sel(p("a", 7), p("a", 7)), "forward"),
    sel(p("a", 8), p("a", 8)));
  assert.deepEqual(moveCaret(doc, sel(p("a", 8), p("a", 8)), "forward"),
    sel(p("a", 9), p("a", 9)));
});

test("arrow walks through empty paragraphs and clamps at document edges", () => {
  const doc = document();
  assert.deepEqual(moveCaret(doc, sel(p("a", 9), p("a", 9)), "forward"),
    sel(p("empty", 0), p("empty", 0)));
  assert.deepEqual(moveCaret(doc, sel(p("empty", 0), p("empty", 0)), "forward"),
    sel(p("c", 0), p("c", 0)));
  assert.deepEqual(moveCaret(doc, sel(p("c", 0), p("c", 0)), "backward"),
    sel(p("empty", 0), p("empty", 0)));
  assert.deepEqual(moveCaret(doc, sel(p("a", 0), p("a", 0)), "backward"),
    sel(p("a", 0), p("a", 0)));
});

test("caret rebases onto re-styled runs without changing document position", () => {
  const before = document();
  const after = document();
  after.blocks[0].runs = [{ text: "Merhaba 👩‍💻", marks: ["underline"] }];
  assert.deepEqual(rebaseSelection(before, after, sel(p("a", 8), p("a", 4))),
    sel(p("a", 8), p("a", 4)));
});

test("rebasing after deletions clamps both endpoints to available blocks", () => {
  const before = document();
  const after = { blocks: [{ id: "a", runs: [{ text: "Me" }] }] };
  assert.deepEqual(rebaseSelection(before, after, sel(p("c", 5), p("a", 8))),
    sel(p("a", 2), p("a", 2)));
});

test("reading a mixed-format selection cannot mutate original run marks", () => {
  const doc = document();
  const original = structuredClone(doc);
  const output = selectedFragments(doc, sel(p("a", 0), p("a", 9)));
  output[0].runs[0].marks.push("mutated");
  assert.deepEqual(doc, original);
});

test("invalid directions and malformed selection fail explicitly", () => {
  assert.throws(() => moveCaret(document(), sel(p("a", 0), p("a", 0)), "north"), /direction/);
  assert.throws(() => normalizeSelection(document(), { anchor: p("a", 0) }), /anchor and focus/);
});
