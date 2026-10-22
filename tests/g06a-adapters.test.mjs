import test from "node:test";
import assert from "node:assert/strict";
import { pointFromRunUtf16, pointToRunUtf16, graphemeToUtf16,
  utf16ToGrapheme, createCompositionGuard } from "../src/editor/g06a-utf16.mjs";
import { proposeHorizontalSelection, moveToBoundary } from "../src/editor/g06a-navigation.mjs";

const p = (blockId, offset) => ({ blockId, offset });
const s = (anchor, focus) => ({ anchor, focus });
const doc = () => ({ blocks: [
  { id: "first", runs: [{ text: "Hi ", marks: ["bold"] },
    { text: "👩‍💻🇹🇷", marks: ["italic"] },
    { text: "a\u0301!", marks: ["code"] }] },
  { id: "blank", runs: [] },
  { id: "last", runs: [{ text: "Dünya" }] }
] });

test("UTF-16 boundaries are exact for combining, ZWJ emoji and flags", () => {
  const text = "A👩‍💻e\u0301🇹🇷Z";
  assert.equal(text.length, 13);
  assert.deepEqual([0, 1, 6, 8, 12, 13].map((i) =>
    utf16ToGrapheme(text, i)), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) =>
    graphemeToUtf16(text, i)), [0, 1, 6, 8, 12, 13]);
});

test("half a surrogate or ZWJ cluster snaps to affinity, never splits", () => {
  const text = "A👩‍💻B";
  for (const offset of [2, 3, 4, 5]) {
    assert.equal(utf16ToGrapheme(text, offset, "backward"), 1);
    assert.equal(utf16ToGrapheme(text, offset, "forward"), 2);
  }
  assert.equal(utf16ToGrapheme(text, 1, "forward"), 1);
  assert.equal(utf16ToGrapheme(text, 6, "backward"), 2);
});

test("UTF-16 conversion rejects negative, fractional and out of range offsets", () => {
  assert.throws(() => graphemeToUtf16("a", 2), RangeError);
  assert.throws(() => graphemeToUtf16("a", -1), RangeError);
  assert.throws(() => utf16ToGrapheme("abc", 1.1), RangeError);
  assert.throws(() => utf16ToGrapheme("a", 2), RangeError);
  assert.throws(() => utf16ToGrapheme("a", 0, "middle"), /Bias/);
  assert.equal(graphemeToUtf16("", 0), 0);
  assert.equal(utf16ToGrapheme("", 0), 0);
});

test("mixed formatting maps DOM UTF-16 into stable semantic block position", () => {
  const model = doc();
  // Run 1 starts at grapheme offset 3. Offset 3 is inside first ZWJ.
  assert.deepEqual(pointFromRunUtf16(model, "first", 1, 3, "backward"), p("first", 3));
  assert.deepEqual(pointFromRunUtf16(model, "first", 1, 3, "forward"), p("first", 4));
  assert.deepEqual(pointFromRunUtf16(model, "first", 1, 5), p("first", 4));
  assert.deepEqual(pointFromRunUtf16(model, "first", 1, 9), p("first", 5));
  assert.deepEqual(pointFromRunUtf16(model, "first", 2, 2), p("first", 6));
});

test("format boundary affinity chooses previous run end or next run start", () => {
  const model = doc();
  assert.deepEqual(pointToRunUtf16(model, p("first", 5), "backward"),
    { blockId: "first", runIndex: 1, offset: 9 });
  assert.deepEqual(pointToRunUtf16(model, p("first", 5), "forward"),
    { blockId: "first", runIndex: 2, offset: 0 });
  assert.deepEqual(pointToRunUtf16(model, p("first", 4), "forward"),
    { blockId: "first", runIndex: 1, offset: 5 });
  assert.deepEqual(pointToRunUtf16(model, p("blank", 0)),
    { blockId: "blank", runIndex: 0, offset: 0 });
});

test("DOM ↔ semantic roundtrip for every grapheme point and both affinities", () => {
  const model = doc();
  for (let i = 0; i <= 7; i++) {
    for (const bias of ["forward", "backward"]) {
      const run = pointToRunUtf16(model, p("first", i), bias);
      assert.deepEqual(pointFromRunUtf16(model, run.blockId, run.runIndex, run.offset, bias),
        p("first", i));
    }
  }
});

test("malformed DOM run addresses cannot silently target neighboring content", () => {
  const model = doc();
  assert.throws(() => pointFromRunUtf16(model, "first", 10, 0), /run index/);
  assert.throws(() => pointFromRunUtf16(model, "missing", 0, 0), /block/);
  assert.throws(() => pointFromRunUtf16(model, "blank", 0, 1), /UTF-16 offset/);
});

test("composition guard blocks native navigation during IME processing", () => {
  const guard = createCompositionGuard();
  const normal = { key: "ArrowLeft" };
  assert.equal(guard.canNavigate(normal), true);
  guard.onStart();
  assert.equal(guard.active, true);
  assert.equal(guard.canNavigate(normal), false);
  guard.onEnd();
  assert.equal(guard.active, false);
  assert.equal(guard.canNavigate({ key: "Process" }), false);
  assert.equal(guard.canNavigate({ key: "ArrowLeft", isComposing: true }), false);
  assert.equal(guard.canNavigate({ key: "ArrowLeft", keyCode: 229 }), false);
  assert.equal(guard.canNavigate({ key: "ArrowLeft", defaultPrevented: true }), false);
});

test("horizontal keyboard intent respects platform modifiers and composition", () => {
  const guard = createCompositionGuard();
  const model = doc();
  const selection = s(p("first", 4), p("first", 4));
  assert.deepEqual(proposeHorizontalSelection(model, selection,
    { key: "ArrowRight" }, guard), s(p("first", 5), p("first", 5)));
  assert.equal(proposeHorizontalSelection(model, selection,
    { key: "ArrowRight", ctrlKey: true }, guard), null);
  assert.equal(proposeHorizontalSelection(model, selection,
    { key: "ArrowRight", metaKey: true }, guard), null);
  assert.equal(proposeHorizontalSelection(model, selection,
    { key: "ArrowRight", altKey: true }, guard), null);
  assert.equal(proposeHorizontalSelection(model, selection,
    { key: "ArrowUp" }, guard), null);
  guard.onStart();
  assert.equal(proposeHorizontalSelection(model, selection,
    { key: "ArrowLeft" }, guard), null);
});

test("shift-left extends range without moving the original anchor", () => {
  const guard = createCompositionGuard();
  const model = doc();
  assert.deepEqual(proposeHorizontalSelection(model, s(p("first", 4), p("first", 4)),
    { key: "ArrowLeft", shiftKey: true }, guard), s(p("first", 4), p("first", 3)));
});

test("logical block start/end and document start/end are semantic positions", () => {
  const model = doc();
  const caret = s(p("first", 3), p("first", 3));
  assert.deepEqual(moveToBoundary(model, caret, "end"),
    s(p("first", 7), p("first", 7)));
  assert.deepEqual(moveToBoundary(model, caret, "start"),
    s(p("first", 0), p("first", 0)));
  assert.deepEqual(moveToBoundary(model, caret, "end", { scope: "document" }),
    s(p("last", 5), p("last", 5)));
  assert.deepEqual(moveToBoundary(model, caret, "start", { scope: "document", extend: true }),
    s(p("first", 3), p("first", 0)));
  assert.deepEqual(moveToBoundary(model, s(p("blank", 0), p("blank", 0)), "end"),
    s(p("blank", 0), p("blank", 0)));
  assert.throws(() => moveToBoundary(model, caret, "middle"), /edge/);
  assert.throws(() => moveToBoundary(model, caret, "start", { scope: "visual-line" }), /scope/);
});
