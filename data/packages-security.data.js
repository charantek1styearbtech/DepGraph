// data/packages-security.data.js — SECURITY-SENSITIVE packages.
//
// Same row format as packages.data.js. Every version referenced by an entry
// in vulnerabilities.data.js MUST appear here with the exact same number.
//
// Modelling detail that makes Version-as-node shine: these packages carry
// BOTH affected releases (e.g. lodash 4.17.21) and patched/latest releases
// (e.g. lodash 4.17.23), so traversal can tell projects apart based on which
// version they actually resolve.

export const VULNERABLE_CAPABLE_PACKAGE_ROWS = [
  "lodash|mit|javascript,nodejs|4.17.15,4.17.21,4.17.23",
  "jsonwebtoken|mit|security,nodejs|8.5.1,9.0.0",
  "ws|mit|websockets,nodejs|7.4.5,8.17.1",
  "elliptic|mit|security,nodejs|6.5.3,6.5.7",
  "ejs|apache-2.0|nodejs,ui-components|3.1.5,3.1.10",
  "minimist|mit|cli,nodejs|1.2.5,1.2.8",
  "axios|mit|rest,nodejs|0.21.1,0.27.2,1.6.2",
  "qs|bsd-3-clause|nodejs,rest|6.5.2,6.11.2",
  "semver|isc|nodejs,build-tools|5.7.1,6.3.0,7.6.0",
  "node-fetch|mit|rest,nodejs|2.6.6,3.3.2",
  "tar|isc|cli,nodejs|6.1.8,7.0.1",
  "follow-redirects|mit|rest,nodejs|1.14.7,1.15.6",
  "moment|mit|javascript,ui-components|2.29.1,2.30.1",
  "got|mit|rest,nodejs|11.8.2,13.0.0",
  "underscore|mit|javascript,nodejs|1.12.0,1.13.6",
  "hosted-git-info|isc|build-tools,nodejs|2.8.8,4.1.0",
  "glob-parent|isc|build-tools,nodejs|5.1.1,6.0.2",
  "ansi-regex|mit|cli,nodejs|5.0.0,6.0.1",
  "y18n|mit|cli,nodejs|4.0.0,5.0.8",
  "trim-newlines|mit|cli,nodejs|3.0.0,4.1.1",
  "ini|isc|nodejs,cli|1.3.5,4.1.1",
  "diff|bsd-3-clause|nodejs,cli|3.5.0,5.1.0",
  "serialize-javascript|bsd-3-clause|nodejs,build-tools|3.1.0,6.0.1",
  "node-notifier|mit|nodejs,ui-components|8.0.0,10.0.1",
  "browserslist|mit|build-tools,javascript|4.14.0,4.23.0",
  "ssri|isc|security,build-tools|6.0.1,10.0.5",
  "async|mit|nodejs,javascript|2.6.3,3.2.5",
  "markdown-it|mit|javascript,ui-components|10.0.0,14.1.0",
  "prismjs|mit|ui-components,javascript|1.23.0,1.29.0",
  "json-schema|isc|security,nodejs|0.2.3,0.4.0",
  "mime|mit|nodejs,rest|1.4.1,3.0.0",
  "jquery|mit|javascript,ui-components|3.4.0,3.7.1",
  "marked|mit|javascript,ui-components|1.1.0,12.0.2",
  "hoek|bsd-3-clause|nodejs,security|4.2.0,6.1.3",
  "fresh|mit|nodejs,rest|0.5.2,0.5.3",
];
