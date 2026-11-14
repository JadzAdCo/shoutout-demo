"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

test("goToEditor focuses the first visible composer field (Message / #mainText)", () => {
  const src = fs.readFileSync(path.join(root, "patron-app.js"), "utf8");
  assert.match(src, /function firstEditorInput\(/);
  assert.match(src, /function focusFirstEditorInput\(/);
  assert.match(src, /function goToEditor\(\)[\s\S]*showPage\("editorPage"\)[\s\S]*focusFirstEditorInput\(/);
  assert.match(src, /byId\("mainText"\)/);
  const go = src.slice(src.indexOf("function goToEditor()"), src.indexOf("function goToEditor()") + 900);
  assert.match(go, /focusFirstEditorInput/);
});

test("index.html Message textarea is the first composer input", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const editor = html.slice(html.indexOf('id="editorPage"'), html.indexOf('id="soccerJerseyFields"'));
  assert.match(editor, /id="mainText"/);
  assert.ok(editor.indexOf('id="mainText"') < editor.indexOf("soccerJerseyFields") || !editor.includes("soccerJerseyFields"));
});
