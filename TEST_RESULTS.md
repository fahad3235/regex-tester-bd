# TEST_RESULTS.md - regex-tester-bd

Date: 2026-10-18. All tests run for real; nothing invented.

## Unit tests - 35/35 passed

`node tests/run-node-tests.js`

- Match extraction: basic, global (3 matches), groups `(\d+)-(\d+)` on `12-34` -> groups `12`, `34`, optional unset group `undefined`, sticky anchor.
- Flags: `i` case-insensitive, `m` `^` per line, `s` dot-newline, `u` `\p{Letter}`, invalid flag, duplicate flag.
- Errors: invalid regex surfaces the real engine message (`Invalid regular expression...`), pattern/text length caps.
- Zero-length safety: `a*` on `bbb` terminates with 4 empty matches; match cap at 1,000 (`x?` on 2,000 chars -> capped).
- Replace: `$1`/`$2`, `$&`, `$$` literal, `g` replace-all, invalid-regex failure.
- Library: 8/8 patterns compile and match their samples; lookahead matches exactly `Strong1!`; NID matches `1234567890` and `12345678901234567`.
- Cheat sheet >= 18 entries with EN + BN; Bengali digits `123` -> `\u09e7\u09e8\u09e9`; I18N key parity EN/BN.

Repairs: 1 test-side fix only. The `u`-flag test first assumed `\p{Letter}`
without `u` is a compile error; in modern JS it is an identity escape for literal
`p`. The test was corrected to assert the true behavior (literal `p{Letter}` match).
0 app-logic bugs.

## Browser smoke - 16/16 desktop + 16/16 mobile passed, 0 console/page errors

`node tests/smoke.mjs desktop` / `node tests/smoke.mjs mobile` (headless Chromium,
raw CDP, `file://` URLs).

Covered: title, default pattern + highlighted matches, match count, groups `12`/`34`
in the match list, invalid-pattern error visible, replace output `[12-34]`/`[56-78]`,
library BD-mobile load + 2 matches, cheat sheet rows, BN toggle both ways,
no horizontal overflow (incl. 390px), 0 console/page errors.

## Hand verification

Pattern `(\d+)-(\d+)` on `12-34` gives groups `12`, `34` (unit + smoke).
Library lookahead sample: only `Strong1!` matches out of `weak / Strong1! / NoDigit! / short1!`.

## Hygiene

- Pure-ASCII sources verified: `grep -nP '[^\x00-\x7F]'` = 0 matches across
  `index.html`, `js/`, `css/` (Bengali as `\uXXXX` escapes).
- Zero network requests (static files only, no fetch/XHR in app code).
