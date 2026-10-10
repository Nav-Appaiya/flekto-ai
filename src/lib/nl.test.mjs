import assert from "node:assert/strict";
import { TYPES, isBsn, isIban, isPostcode, isKvk, isBtw } from "./nl.js";

assert.ok(isBsn("111222333") && !isBsn("123456789") && !isBsn("000000000"));
assert.ok(isIban("NL91 ABNA 0417 1643 00") && !isIban("NL92ABNA0417164300"));
assert.ok(isPostcode("1012 ab") && !isPostcode("0123AB") && !isPostcode("1012SS"));
assert.ok(isKvk("69599084") && !isKvk("0123456"));
assert.ok(isBtw("NL123456782B01") && isBtw("NL000099998B57") && !isBtw("NL123456789B01"));

for (const t of TYPES) {
  assert.ok(t.isValid(t.example), `${t.key} example`);
  for (let i = 0; i < 200; i++) {
    const v = t.generate();
    assert.ok(t.isValid(v), `${t.key} generated ${v}`);
  }
}
console.log("ok");
