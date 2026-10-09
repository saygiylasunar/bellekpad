// Fast, dependency-free smoke checks for static BellekPad assets.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const unique = new Set(ids);
assert.equal(ids.length, unique.size, "HTML ids must be unique");

for (const match of js.matchAll(/byId\("([^"]+)"\)/g)) {
  assert.ok(unique.has(match[1]), "Missing HTML element: " + match[1]);
}
for (const match of html.matchAll(/aria-labelledby="([^"]+)"/g)) {
  for (const id of match[1].split(/\s+/)) {
    assert.ok(unique.has(id), "Broken accessible label: " + id);
  }
}
assert.match(html, /src="\.\/app\.js"/);
assert.match(html, /href="\.\/styles\.css"/);
assert.match(js, /schemaVersion:\s*1/);
assert.ok(css.length > 100, "Stylesheet is empty");
assert.ok(!/\.innerHTML\s*=/.test(js), "Avoid HTML injection for user text");
console.log("BellekPad static contract: PASS");
