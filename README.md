# Regex Tester BD

Offline, bilingual (English / Bangla) live regular-expression tester. Type a pattern,
see matches highlighted in your text, inspect capture groups, and try replacements -
all in your browser, with zero network requests. Nothing leaves your device.

## What it does

- **Live testing** - pattern + test text update results as you type, using your
  browser's real JavaScript (ECMAScript) `RegExp` engine. No simulation, no fake engine.
- **Flag toggles** - `g` (global), `i` (ignore case), `m` (multiline), `s` (dotAll),
  `u` (Unicode), `y` (sticky), each with a plain-language label.
- **Match highlighting** - every match is highlighted in the test text.
- **Match list** - each match shows its text, start index, and capture groups
  (`$1`, `$2`, ...). Unset optional groups are shown as `(unset)`.
- **Invalid patterns** - the engine's real error message is shown, never a fake one.
- **Replace mode** - replacement string supporting `$1`, `$&`, `$$`, etc., with a live
  replaced-output preview and a copy button.
- **Pattern library** - 8 ready patterns (BD mobile number, email, URL, date
  DD/MM/YYYY, NID-style 10/17 digits, whitespace collapse, HTML tag,
  password-strength lookahead). One tap loads pattern + flags + sample text.
  These are common patterns, **not** validators for official formats.
- **Cheat sheet** - compact table of common tokens with one-line meanings.
- **Bilingual** - EN / Bangla toggle, persisted; Bengali digits in counts and indexes
  when Bangla is active.

## How to run

Open `index.html` in any modern browser. No build step, no server, no dependencies.

## Testing

```sh
node tests/run-node-tests.js   # unit tests (match extraction, groups, replace, errors, flags)
node tests/smoke.mjs desktop   # headless-Chrome smoke (desktop 1280px)
node tests/smoke.mjs mobile    # headless-Chrome smoke (390px mobile)
```

Results (2026-10-18): **35/35 unit + 16/16 desktop + 16/16 mobile**, 0 console/page
errors. Hand-verified: `(\d+)-(\d+)` on `12-34` gives groups `12`, `34`.

## Limitations (honest)

- **Catastrophic backtracking is real.** A pathological pattern such as
  `(a+)+$` on a long non-matching string can make the browser tab hang, because the
  engine runs on the main thread. The app caps output at 1,000 matches and caps
  pattern (2,000 chars) and test-text (100,000 chars) length, but it cannot make
  every possible pattern fast. If the page freezes, close the tab.
- Match display is capped at the first 1,000 matches.
- The pattern library offers common patterns, not official-format validators
  (e.g. the email pattern does not implement the full RFC; the NID pattern only
  checks digit count/shape).
- JavaScript regex syntax only - no PCRE-only features (e.g. recursion, possessive
  quantifiers are not supported by this engine; atomic groups need a newer engine).

## Status

Complete. Static site, ready for GitHub Pages.
