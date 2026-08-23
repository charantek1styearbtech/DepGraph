// data/vulnerabilities.data.js — deterministic demo advisories.
//
// Row format (pipe-delimited):
//   packageId|versionNumber|SEVERITY|cvss|fixedIn|null|title|description
//
// Row order assigns IDs sequentially: CVE-DEMO-2026-001 … CVE-DEMO-2026-036.
// Severity mix: 6 critical, 12 high, 12 medium, 6 low.
//
// ⚠ These are clearly-labelled DEMO advisories for fictional scenarios.
// They intentionally use the CVE-DEMO-* prefix and must never be presented
// as real vulnerability information.

export const VULNERABILITY_ROWS = [
  // ── Critical ────────────────────────────────────────────────────────────────
  "lodash|4.17.21|CRITICAL|9.8|4.17.23|Prototype pollution in _.defaultsDeep|Demo advisory: crafted merge payloads rewrite Object.prototype, enabling RCE patterns.",
  "jsonwebtoken|8.5.1|CRITICAL|9.8|9.0.0|Signature verification bypass|Demo advisory: tokens signed with unexpected algorithms may validate as legitimate.",
  "ws|7.4.5|CRITICAL|9.1|7.4.6|DoS via crafted HTTP handshake|Demo advisory: unbounded header processing lets one request exhaust server memory.",
  "elliptic|6.5.3|CRITICAL|9.1|6.5.7|ECDSA private key leakage|Demo advisory: timing side channel recovers signing keys during batch verification.",
  "ejs|3.1.5|CRITICAL|9.8|3.1.7|RCE via template injection|Demo advisory: unsanitized template locals compile into arbitrary code execution.",
  "minimist|1.2.5|CRITICAL|9.8|1.2.6|Prototype pollution via constructor payloads|Demo advisory: __proto__ argv keys poison Object.prototype defaults.",
  // ── High ────────────────────────────────────────────────────────────────────
  "axios|0.21.1|HIGH|8.2|0.21.4|SSRF via absolute redirect URL|Demo advisory: servers following redirects can be steered toward internal endpoints.",
  "qs|6.5.2|HIGH|7.5|6.9.7|Parser DoS via nested brackets|Demo advisory: deeply nested query parameters stall the event loop.",
  "semver|5.7.1|HIGH|7.5|5.7.2|ReDoS in range parsing|Demo advisory: adversarial ranges trigger catastrophic backtracking.",
  "node-fetch|2.6.6|HIGH|7.5|2.6.7|Secure header forwarding on redirect|Demo advisory: Authorization header leaks to third-party origins.",
  "tar|6.1.8|HIGH|7.0|6.1.9|Arbitrary file overwrite on extract|Demo advisory: symlink entries escape the extraction directory.",
  "follow-redirects|1.14.7|HIGH|7.4|1.14.8|Sensitive header exposure on redirect|Demo advisory: auth headers forwarded across cross-origin redirects.",
  "moment|2.29.1|HIGH|7.5|2.29.2|Path traversal in locale loading|Demo advisory: crafted locale identifiers read arbitrary bundle paths.",
  "got|11.8.2|HIGH|7.4|11.8.5|Authorization leak on cross-origin redirect|Demo advisory: credentials replayed to redirect targets.",
  "underscore|1.12.0|HIGH|7.2|1.12.1|Code execution via template variable injection|Demo advisory: template settings injection compiles attacker JavaScript.",
  "hosted-git-info|2.8.8|HIGH|7.5|2.8.9|Command injection via crafted repo URL|Demo advisory: shell metacharacters in shortcuts reach exec calls.",
  "glob-parent|5.1.1|HIGH|7.5|5.1.2|ReDoS in parent directory resolution|Demo advisory: hostile glob inputs backtrack exponentially.",
  "ansi-regex|5.0.0|HIGH|7.5|5.0.1|ReDoS via crafted ANSI escape sequences|Demo advisory: hostile escape sequences hang terminal matching.",
  // ── Medium ──────────────────────────────────────────────────────────────────
  "y18n|4.0.0|MEDIUM|5.6|4.0.1|Prototype pollution in translation cache|Demo advisory: polluted keys alter fallback lookups.",
  "trim-newlines|3.0.0|MEDIUM|5.3|3.0.1|ReDoS on trailing whitespace input|Demo advisory: crafted strings stall trimming regexes.",
  "semver|6.3.0|MEDIUM|5.3|6.3.1|ReDoS variant in prerelease parsing|Demo advisory: second backtracking vector in comparator parsing.",
  "ini|1.3.5|MEDIUM|5.3|1.3.6|Prototype pollution via INI section keys|Demo advisory: dunder keys in config files poison defaults.",
  "diff|3.5.0|MEDIUM|5.3|3.5.1|ReDoS in line diff computation|Demo advisory: pathological hunks freeze patch calculation.",
  "serialize-javascript|3.1.0|MEDIUM|5.6|3.1.1|XSS via unsafe serialization of functions|Demo advisory: function payloads deserialize into markup execution.",
  "node-notifier|8.0.0|MEDIUM|5.3|8.0.1|Command injection through notifier arguments|Demo advisory: notification titles reach the shell unquoted.",
  "browserslist|4.14.0|MEDIUM|5.3|4.16.5|ReDoS in region query parsing|Demo advisory: hostile queries stall config parsing.",
  "ssri|6.0.1|MEDIUM|5.3|6.0.2|ReDoS in integrity attribute parsing|Demo advisory: crafted SRI strings backtrack the matcher.",
  "async|2.6.3|MEDIUM|5.3|2.6.4|Prototype pollution in merge helpers|Demo advisory: polluted merge utilities mutate base objects.",
  "markdown-it|10.0.0|MEDIUM|5.4|12.3.2|XSS via crafted link title attributes|Demo advisory: escaping gap allows script injection through titles.",
  "prismjs|1.23.0|MEDIUM|5.4|1.24.0|XSS via crafted markup in code samples|Demo advisory: language hooks interpolate unescaped content.",
  // ── Low ─────────────────────────────────────────────────────────────────────
  "json-schema|0.2.3|LOW|3.7|0.4.0|Prototype pollution proof-of-concept|Demo advisory: research advisory merged from ecosystem scans.",
  "mime|1.4.1|LOW|3.3|1.4.2|ReDoS in extension lookup|Demo advisory: crafted paths slow content-type resolution.",
  "jquery|3.4.0|LOW|3.5|3.5.1|XSS in DOM manipulation helper|Demo advisory: untrusted HTML fragments bypass sanitizer expectations.",
  "marked|1.1.0|LOW|3.9|1.1.1|ReDoS in block tokenizer|Demo advisory: nested emphasis patterns hang parsing.",
  "hoek|4.2.0|LOW|3.3|4.2.1|ReDoS in email validation helper|Demo advisory: crafted addresses stall RFC checks.",
  "fresh|0.5.2|LOW|3.3|0.5.3|Header parsing DoS|Demo advisory: malformed cache headers stall freshness checks.",
];
