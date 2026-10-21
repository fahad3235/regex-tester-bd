/* regex-tester-bd -- pure logic (no DOM). Uses the real JS RegExp engine.
   Pure ASCII. Works in browser (window.REGEX_LOGIC) and Node (module.exports). */
(function (global) {
  'use strict';

  var VALID_FLAGS = 'gimsuy';
  var MAX_MATCHES = 1000;
  var MAX_PATTERN = 2000;
  var MAX_TEXT = 100000;

  var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea',
                   '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];
  function toBnDigits(s) {
    return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[Number(d)]; });
  }
  function fmtNum(n, lang) {
    return lang === 'bn' ? toBnDigits(n) : String(n);
  }

  function validateFlags(flags) {
    flags = flags || '';
    var seen = {};
    for (var i = 0; i < flags.length; i++) {
      var f = flags.charAt(i);
      if (VALID_FLAGS.indexOf(f) === -1) return 'Invalid flag "' + f + '". Allowed: g, i, m, s, u, y.';
      if (seen[f]) return 'Duplicate flag "' + f + '".';
      seen[f] = true;
    }
    return '';
  }

  function buildRegex(pattern, flags) {
    try {
      return { ok: true, re: new RegExp(pattern, flags) };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  }

  function checkLimits(pattern, text) {
    if (pattern == null) return 'Pattern is required.';
    if (String(pattern).length > MAX_PATTERN) return 'Pattern is too long (max ' + MAX_PATTERN + ' characters).';
    if (String(text == null ? '' : text).length > MAX_TEXT) return 'Test text is too long (max ' + MAX_TEXT + ' characters).';
    return '';
  }

  /* Run the pattern against text. Returns { ok, matches, capped } or { ok:false, error }.
     matches: [{ text, index, groups: [g1, g2, ...] }]. Groups may be undefined
     when an optional group did not participate. */
  function runTest(pattern, flags, text) {
    pattern = pattern == null ? '' : String(pattern);
    flags = flags == null ? '' : String(flags);
    text = text == null ? '' : String(text);
    var lim = checkLimits(pattern, text);
    if (lim) return { ok: false, error: lim };
    var ferr = validateFlags(flags);
    if (ferr) return { ok: false, error: ferr };
    var built = buildRegex(pattern, flags);
    if (!built.ok) return { ok: false, error: built.error };
    var re = built.re;
    var matches = [];
    if (re.global || re.sticky) {
      re.lastIndex = 0;
      var m;
      while ((m = re.exec(text)) !== null) {
        matches.push({ text: m[0], index: m.index,
                       groups: Array.prototype.slice.call(m, 1) });
        if (matches.length >= MAX_MATCHES) break;
        if (m[0] === '') re.lastIndex++; /* avoid infinite loop on empty matches */
      }
    } else {
      var one = re.exec(text);
      if (one) matches.push({ text: one[0], index: one.index,
                              groups: Array.prototype.slice.call(one, 1) });
    }
    return { ok: true, matches: matches, capped: matches.length >= MAX_MATCHES };
  }

  /* Replace mode: String.replace with the real engine, so $1, $&, $$ etc. work. */
  function applyReplace(pattern, flags, text, replacement) {
    pattern = pattern == null ? '' : String(pattern);
    flags = flags == null ? '' : String(flags);
    text = text == null ? '' : String(text);
    replacement = replacement == null ? '' : String(replacement);
    var lim = checkLimits(pattern, text);
    if (lim) return { ok: false, error: lim };
    var ferr = validateFlags(flags);
    if (ferr) return { ok: false, error: ferr };
    var built = buildRegex(pattern, flags);
    if (!built.ok) return { ok: false, error: built.error };
    var out;
    try {
      out = text.replace(built.re, replacement);
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
    return { ok: true, output: out };
  }

  /* Pattern library: common patterns, NOT validators for official formats. */
  var LIBRARY = [
    { id: 'bd-mobile', name: 'BD mobile number', pattern: '01[3-9]\\d{8}', flags: 'g',
      sample: 'Call 01712345678 or 01987654321 for help.', replacement: '$&' },
    { id: 'email', name: 'Email address', pattern: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', flags: 'g',
      sample: 'Write to fahad@example.com or meem.test@mail.co.uk.', replacement: '$&' },
    { id: 'url', name: 'URL', pattern: 'https?://[^\\s]+', flags: 'g',
      sample: 'See https://example.com/page?q=1 and http://test.org.', replacement: '$&' },
    { id: 'date', name: 'Date DD/MM/YYYY', pattern: '\\b\\d{2}/\\d{2}/\\d{4}\\b', flags: 'g',
      sample: 'Exam on 17/10/2026, result on 01/12/2026.', replacement: '$&' },
    { id: 'nid', name: 'NID-style 10 / 17 digits', pattern: '\\b\\d{10}(\\d{7})?\\b', flags: 'g',
      sample: 'IDs: 1234567890 and 12345678901234567.', replacement: '$&' },
    { id: 'ws-collapse', name: 'Collapse whitespace', pattern: '\\s+', flags: 'g',
      sample: 'Too   much    space\tand\nnewlines.', replacement: ' ' },
    { id: 'html-tag', name: 'HTML tag', pattern: '<[^>]+>', flags: 'g',
      sample: '<p>Hello <b>world</b></p>', replacement: '$&' },
    { id: 'pwd-lookahead', name: 'Password-strength lookahead', pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$', flags: 'm',
      sample: 'weak\nStrong1!\nNoDigit!\nshort1!', replacement: '$&' }
  ];

  /* Cheat sheet: token -> one-line meaning. */
  var CHEAT = [
    { token: '.', en: 'Any character except a newline', bn: '\u09af\u09c7\u0995\u09cb\u09a8\u09cb \u0985\u0995\u09cd\u09b7\u09b0 (\u09a8\u09a4\u09c1\u09a8 \u09b2\u09be\u0987\u09a8 \u099b\u09be\u09dc\u09be)' },
    { token: '\\d', en: 'A digit (0-9)', bn: '\u098f\u0995\u099f\u09bf \u0985\u0999\u09cd\u0995 (0-9)' },
    { token: '\\D', en: 'A non-digit', bn: '\u0985\u0999\u09cd\u0995 \u09a8\u09df \u098f\u09ae\u09a8 \u0985\u0995\u09cd\u09b7\u09b0' },
    { token: '\\w', en: 'A word character [A-Za-z0-9_]', bn: '\u09b6\u09ac\u09cd\u09a6 \u0985\u0995\u09cd\u09b7\u09b0 [A-Za-z0-9_]' },
    { token: '\\W', en: 'A non-word character', bn: '\u09b6\u09ac\u09cd\u09a6 \u09a8\u09df \u098f\u09ae\u09a8 \u0985\u0995\u09cd\u09b7\u09b0' },
    { token: '\\s', en: 'Whitespace (space, tab, newline)', bn: '\u09ab\u09be\u0981\u0995\u09be \u099c\u09be\u09df\u0997\u09be (\u09b8\u09cd\u09aa\u09c7\u09b8, \u099f\u09cd\u09af\u09be\u09ac, \u09a8\u09a4\u09c1\u09a8 \u09b2\u09be\u0987\u09a8)' },
    { token: '\\S', en: 'Non-whitespace', bn: '\u09ab\u09be\u0981\u0995\u09be \u099c\u09be\u09df\u0997\u09be \u09a8\u09df' },
    { token: '*', en: '0 or more of the previous', bn: '\u0986\u0997\u09c7\u09b0\u099f\u09bf 0 \u09ac\u09be \u09a4\u09be\u09b0 \u09ac\u09c7\u09b6\u09bf' },
    { token: '+', en: '1 or more of the previous', bn: '\u0986\u0997\u09c7\u09b0\u099f\u09bf 1 \u09ac\u09be \u09a4\u09be\u09b0 \u09ac\u09c7\u09b6\u09bf' },
    { token: '?', en: '0 or 1 of the previous', bn: '\u0986\u0997\u09c7\u09b0\u099f\u09bf 0 \u09ac\u09be 1\u099f\u09bf' },
    { token: '{n,m}', en: 'Between n and m of the previous', bn: '\u0986\u0997\u09c7\u09b0\u099f\u09bf n \u09a5\u09c7\u0995\u09c7 m \u09aa\u09b0\u09cd\u09af\u09a8\u09cd\u09a4' },
    { token: '^', en: 'Start of text (or line, with m)', bn: '\u09b2\u09c7\u0996\u09be\u09b0 \u09b6\u09c1\u09b0\u09c1 (m \u09a6\u09bf\u09df\u09c7 \u09b2\u09be\u0987\u09a8\u09c7\u09b0 \u09b6\u09c1\u09b0\u09c1)' },
    { token: '$', en: 'End of text (or line, with m)', bn: '\u09b2\u09c7\u0996\u09be\u09b0 \u09b6\u09c7\u09b7 (m \u09a6\u09bf\u09df\u09c7 \u09b2\u09be\u0987\u09a8\u09c7\u09b0 \u09b6\u09c7\u09b7)' },
    { token: '(...)', en: 'Capture group', bn: '\u0995\u09cd\u09af\u09be\u09aa\u099a\u09be\u09b0 \u0997\u09cd\u09b0\u09c1\u09aa' },
    { token: '(?:...)', en: 'Non-capturing group', bn: '\u0995\u09cd\u09af\u09be\u09aa\u099a\u09be\u09b0 \u099b\u09be\u09dc\u09be \u0997\u09cd\u09b0\u09c1\u09aa' },
    { token: '(?=...)', en: 'Positive lookahead', bn: '\u09aa\u099c\u09bf\u099f\u09bf\u09ad \u09b2\u09c1\u0995\u0986\u09b9\u09c7\u09a1' },
    { token: '(?!...)', en: 'Negative lookahead', bn: '\u09a8\u09c7\u0997\u09c7\u099f\u09bf\u09ad \u09b2\u09c1\u0995\u0986\u09b9\u09c7\u09a1' },
    { token: '(?<=...)', en: 'Positive lookbehind', bn: '\u09aa\u099c\u09bf\u099f\u09bf\u09ad \u09b2\u09c1\u0995\u09ac\u09bf\u09b9\u09be\u0987\u09a8\u09cd\u09a1' },
    { token: '(?<!...)', en: 'Negative lookbehind', bn: '\u09a8\u09c7\u0997\u09c7\u099f\u09bf\u09ad \u09b2\u09c1\u0995\u09ac\u09bf\u09b9\u09be\u0987\u09a8\u09cd\u09a1' },
    { token: '|', en: 'Alternation (or)', bn: '\u09ac\u09be (\u0985\u09a5\u09b6\u09a8)' },
    { token: '[...]', en: 'Character set (any one of)', bn: '\u0995\u09cd\u09af\u09be\u09b0\u09be\u0995\u099f\u09be\u09b0 \u09b8\u09c7\u099f (\u09af\u09c7\u0995\u09cb\u09a8\u09cb \u098f\u0995\u099f\u09bf)' },
    { token: '[^...]', en: 'Negated character set', bn: '\u09a8\u09c7\u0997\u09c7\u099f\u09bf\u09ad \u0995\u09cd\u09af\u09be\u09b0\u09be\u0995\u099f\u09be\u09b0 \u09b8\u09c7\u099f' },
    { token: '\\b', en: 'Word boundary', bn: '\u09b6\u09ac\u09cd\u09a6\u09c7\u09b0 \u09b8\u09c0\u09ae\u09be\u09a8\u09be' },
    { token: '\\', en: 'Escape the next character', bn: '\u09aa\u09b0\u09c7\u09b0 \u0985\u0995\u09cd\u09b7\u09b0\u099f\u09bf\u0995\u09c7 \u098f\u09b8\u0995\u09c7\u09aa \u0995\u09b0\u09c7' }
  ];

  /* UI strings. */
  var I18N = {
    en: {
      tagline: 'Test regular expressions live, in your browser. Nothing leaves this device.',
      pattern: 'Pattern',
      patternHint: 'Type a pattern, e.g. \\d+',
      flags: 'Flags',
      flag_g: 'g - Global: find all matches, not just the first',
      flag_i: 'i - Ignore case: A matches a',
      flag_m: 'm - Multiline: ^ and $ match line starts/ends',
      flag_s: 's - DotAll: . also matches newlines',
      flag_u: 'u - Unicode: full Unicode mode',
      flag_y: 'y - Sticky: match only from the last position (advanced)',
      testText: 'Test text',
      testTextHint: 'Type or paste text to test against.',
      highlighted: 'Highlighted matches',
      matchCount: 'Matches',
      noMatches: 'No matches.',
      matchList: 'Match list',
      matchText: 'Match',
      matchIndex: 'Index',
      matchGroups: 'Groups',
      noGroups: '(no groups)',
      groupUnset: '(unset)',
      capped: 'Showing the first 1,000 matches.',
      replaceMode: 'Replace mode',
      replacement: 'Replacement (supports $1, $&, $$)',
      replacementHint: 'e.g. [$1] or $&!',
      replaced: 'Replaced output',
      copyBtn: 'Copy output',
      copied: 'Copied!',
      library: 'Pattern library',
      libraryNote: 'Common patterns - not validators for official formats. Tap one to load it.',
      cheat: 'Cheat sheet',
      token: 'Token',
      meaning: 'Meaning',
      errorPrefix: 'Invalid pattern: ',
      clearBtn: 'Clear all',
      langBtn: '\u09ac\u09be\u0982\u09b2\u09be',
      emptyPattern: 'Enter a pattern to start.',
      emptyText: 'Enter test text above.'
    },
    bn: {
      tagline: '\u09a8\u09bf\u099c\u09c7\u09b0 \u09ac\u09cd\u09b0\u09be\u0989\u099c\u09be\u09b0\u09c7 \u09b0\u09c7\u0997\u09c1\u09b2\u09be\u09b0 \u098f\u0995\u09cd\u09b8\u09aa\u09cd\u09b0\u09c7\u09b6\u09a8 \u09b2\u09be\u0987\u09ad \u09aa\u09b0\u09c0\u0995\u09cd\u09b7\u09be \u0995\u09b0\u09c1\u09a8\u0964 \u0995\u09bf\u099b\u09c1\u0987 \u098f\u0987 \u09a1\u09bf\u09ad\u09be\u0987\u09b8 \u099b\u09be\u09dc\u09c7 \u09af\u09be\u09df \u09a8\u09be\u0964',
      pattern: '\u09aa\u09cd\u09af\u09be\u099f\u09be\u09b0\u09cd\u09a8',
      patternHint: '\u098f\u0995\u099f\u09bf \u09aa\u09cd\u09af\u09be\u099f\u09be\u09b0\u09cd\u09a8 \u09b2\u09bf\u0996\u09c1\u09a8, \u09af\u09c7\u09ae\u09a8 \\d+',
      flags: '\u09ab\u09cd\u09b2\u09cd\u09af\u09be\u0997',
      flag_g: 'g - \u0997\u09cd\u09b2\u09cb\u09ac\u09be\u09b2: \u09b6\u09c1\u09a7\u09c1 \u09aa\u09cd\u09b0\u09a5\u09ae\u099f\u09bf \u09a8\u09df, \u09b8\u09ac \u09ae\u09bf\u09b2 \u0996\u09c1\u0981\u099c\u09c1\u09a8',
      flag_i: 'i - \u0995\u09c7\u09b8 \u0989\u09aa\u09c7\u0995\u09cd\u09b7\u09be \u0995\u09b0\u09c1\u09a8: A \u098f\u09ac\u0982 a \u098f\u0995',
      flag_m: 'm - \u09ae\u09be\u09b2\u09cd\u099f\u09bf\u09b2\u09be\u0987\u09a8: ^ \u0993 $ \u09aa\u09cd\u09b0\u09a4\u09bf \u09b2\u09be\u0987\u09a8\u09c7\u09b0 \u09b6\u09c1\u09b0\u09c1/\u09b6\u09c7\u09b7',
      flag_s: 's - \u09a1\u099f\u0985\u09b2: . \u09a8\u09a4\u09c1\u09a8 \u09b2\u09be\u0987\u09a8\u09c7\u0993 \u09ae\u09bf\u09b2\u09c7',
      flag_u: 'u - \u0987\u0989\u09a8\u09bf\u0995\u09cb\u09a1: \u09aa\u09c2\u09b0\u09cd\u09a3 \u0987\u0989\u09a8\u09bf\u0995\u09cb\u09a1 \u09ae\u09cb\u09a1',
      flag_y: 'y - \u09b8\u09cd\u099f\u09bf\u0995\u09bf: \u09b6\u09c1\u09a7\u09c1 \u09b6\u09c7\u09b7 \u0985\u09ac\u09b8\u09cd\u09a5\u09be\u09a8 \u09a5\u09c7\u0995\u09c7 \u09ae\u09bf\u09b2\u09be\u09a8 (\u0985\u09cd\u09af\u09be\u09a1\u09ad\u09be\u09a8\u09cd\u09b8\u09a1)',
      testText: '\u09aa\u09b0\u09c0\u0995\u09cd\u09b7\u09be\u09b0 \u09b2\u09c7\u0996\u09be',
      testTextHint: '\u09aa\u09b0\u09c0\u0995\u09cd\u09b7\u09be\u09b0 \u099c\u09a8\u09cd\u09af \u09b2\u09c7\u0996\u09be \u09b2\u09bf\u0996\u09c1\u09a8 \u09ac\u09be \u09aa\u09c7\u09b8\u09cd\u099f \u0995\u09b0\u09c1\u09a8\u0964',
      highlighted: '\u09b9\u09be\u0987\u09b2\u09be\u0987\u099f \u0995\u09b0\u09be \u09ae\u09bf\u09b2',
      matchCount: '\u09ae\u09bf\u09b2',
      noMatches: '\u0995\u09cb\u09a8\u09cb \u09ae\u09bf\u09b2 \u09a8\u09c7\u0987\u0964',
      matchList: '\u09ae\u09bf\u09b2\u09c7\u09b0 \u09a4\u09be\u09b2\u09bf\u0995\u09be',
      matchText: '\u09ae\u09bf\u09b2',
      matchIndex: '\u0985\u09ac\u09b8\u09cd\u09a5\u09be\u09a8',
      matchGroups: '\u0997\u09cd\u09b0\u09c1\u09aa',
      noGroups: '(\u0995\u09cb\u09a8\u09cb \u0997\u09cd\u09b0\u09c1\u09aa \u09a8\u09c7\u0987)',
      groupUnset: '(\u09b8\u09c7\u099f \u09b9\u09df\u09a8\u09bf)',
      capped: '\u09aa\u09cd\u09b0\u09a5\u09ae 1,000\u099f\u09bf \u09ae\u09bf\u09b2 \u09a6\u09c7\u0996\u09be\u09a8\u09cb \u09b9\u099a\u09cd\u099b\u09c7\u0964',
      replaceMode: '\u09aa\u09cd\u09b0\u09a4\u09bf\u09b8\u09cd\u09a5\u09be\u09aa\u09a8 \u09ae\u09cb\u09a1',
      replacement: '\u09aa\u09cd\u09b0\u09a4\u09bf\u09b8\u09cd\u09a5\u09be\u09aa\u09a8 ($1, $&, $$ \u099a\u09b2\u09c7)',
      replacementHint: '\u09af\u09c7\u09ae\u09a8 [$1] \u09ac\u09be $&!',
      replaced: '\u09aa\u09cd\u09b0\u09a4\u09bf\u09b8\u09cd\u09a5\u09be\u09aa\u09bf\u09a4 \u0986\u0989\u099f\u09aa\u09c1\u099f',
      copyBtn: '\u0986\u0989\u099f\u09aa\u09c1\u099f \u0995\u09aa\u09bf \u0995\u09b0\u09c1\u09a8',
      copied: '\u0995\u09aa\u09bf \u09b9\u09df\u09c7\u099b\u09c7!',
      library: '\u09aa\u09cd\u09af\u09be\u099f\u09be\u09b0\u09cd\u09a8 \u09b2\u09be\u0987\u09ac\u09cd\u09b0\u09c7\u09b0\u09bf',
      libraryNote: '\u09b8\u09be\u09a7\u09be\u09b0\u09a3 \u09aa\u09cd\u09af\u09be\u099f\u09be\u09b0\u09cd\u09a8 - \u098f\u0997\u09c1\u09b2\u09cb \u0986\u09a8\u09c1\u09b7\u09cd\u09a0\u09be\u09a8\u09bf\u0995 \u09ab\u09b0\u09cd\u09ae\u09cd\u09af\u09be\u099f\u09c7\u09b0 \u09af\u09be\u099a\u09be\u0987\u0995\u09be\u09b0\u09c0 \u09a8\u09df\u0964 \u09a8\u09be\u09aa \u0995\u09b0\u09b2\u09c7 \u09b2\u09cb\u09a1 \u09b9\u09ac\u09c7\u0964',
      cheat: '\u099a\u09bf\u099f \u09b6\u09bf\u099f',
      token: '\u099f\u09cb\u0995\u09c7\u09a8',
      meaning: '\u0985\u09b0\u09cd\u09a5',
      errorPrefix: '\u09ad\u09c1\u09b2 \u09aa\u09cd\u09af\u09be\u099f\u09be\u09b0\u09cd\u09a8: ',
      clearBtn: '\u09b8\u09ac \u09ae\u09c1\u099b\u09c1\u09a8',
      langBtn: 'English',
      emptyPattern: '\u09b6\u09c1\u09b0\u09c1 \u0995\u09b0\u09a4\u09c7 \u098f\u0995\u099f\u09bf \u09aa\u09cd\u09af\u09be\u099f\u09be\u09b0\u09cd\u09a8 \u09a6\u09bf\u09a8\u0964',
      emptyText: '\u0989\u09aa\u09b0\u09c7 \u09aa\u09b0\u09c0\u0995\u09cd\u09b7\u09be\u09b0 \u09b2\u09c7\u0996\u09be \u09a6\u09bf\u09a8\u0964'
    }
  };

  var api = {
    MAX_MATCHES: MAX_MATCHES, MAX_PATTERN: MAX_PATTERN, MAX_TEXT: MAX_TEXT,
    validateFlags: validateFlags, buildRegex: buildRegex,
    runTest: runTest, applyReplace: applyReplace,
    LIBRARY: LIBRARY, CHEAT: CHEAT, I18N: I18N,
    toBnDigits: toBnDigits, fmtNum: fmtNum
  };
  global.REGEX_LOGIC = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
