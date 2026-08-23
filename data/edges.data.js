// data/edges.data.js — CURATED package-level dependency edges.
//
// Row format:  sourcePackage@sourceVersion > targetPackage@targetVersion
//   • sourceVersion "*"  → edge applies to EVERY version of the source package
//   • targetVersion "*"  → resolve to the target package's latest version
//   • an explicit target pins the resolved Version node (lockfile semantics)
//
// These rows encode the assignment's required scenarios:
//   Scenario 2/3: webpack@* → package-x@3.1.4 → lodash@4.17.21 (deep chain)
//   Scenario 5:   package-a → lodash AND package-b → package-c → lodash
// plus realistic ecosystem edges where vulnerable versions are reachable only
// through SPECIFIC older versions (e.g. axios@0.21.1 → follow-redirects pinned).

export const EDGE_ROWS = [
  // next → react ecosystem + bundler chain (Scenario 3 backbone)
  "next@*>react@18.3.1",
  "next@*>react-dom@18.3.1",
  "next@*>webpack@5.91.0",
  "next@*>package-x@3.1.4",

  // webpack internals (Scenario 2 backbone: webpack reaches lodash two ways)
  "webpack@*>package-x@3.1.4",
  "webpack@*>terser@5.30.0",
  "webpack@*>acorn@8.11.3",
  "webpack@*>async@2.6.3",
  "webpack@*>minimist@1.2.5",

  // Demo chain packages (Scenarios 3 & 5)
  "package-x@3.1.4>lodash@4.17.21",
  "package-a@1.0.0>lodash@4.17.21",
  "package-b@1.2.0>package-c@2.0.1",
  "package-c@2.0.1>lodash@4.17.21",

  // react family
  "react@*>js-tokens@4.0.1",
  "react-dom@*>react@18.3.1",
  "react-dom@*>scheduler@0.24.0",

  // axios: ONLY the old release carries the vulnerable redirector
  "axios@0.21.1>follow-redirects@1.14.7",
  "axios@1.6.2>follow-redirects@1.15.6",

  // express: 4.18.2 pins vulnerable qs/fresh, 4.19.2 is patched
  "express@4.18.2>qs@6.5.2",
  "express@4.18.2>fresh@0.5.2",
  "express@4.18.2>body-parser@1.20.2",
  "express@4.19.2>qs@6.11.2",
  "express@4.19.2>fresh@0.5.3",
  "express@4.19.2>body-parser@1.20.3",

  // eslint: only v8 pulls the vulnerable glob-parent
  "eslint@8.57.0>glob-parent@5.1.1",
  "eslint@8.57.0>cross-spawn@7.0.3",
  "eslint@8.57.0>js-yaml@4.1.0",
  "eslint@9.0.0>cross-spawn@7.0.3",
  "eslint@9.0.0>js-yaml@4.1.0",

  // vite toolchain
  "vite@5.2.0>esbuild@0.20.2",
  "vite@5.4.0>esbuild@0.21.0",
  "vite@*>rollup@4.17.2",
  "vite@*>postcss@8.5.1",

  // test tooling
  "jest@29.7.0>yargs@17.7.2",
  "yargs@17.7.2>y18n@4.0.0",
  "yargs@17.7.3>y18n@5.0.8",

  // charts: recharts 2.12.2 pins vulnerable lodash, 2.12.7 does not
  "recharts@2.12.2>d3@7.9.0",
  "recharts@2.12.2>lodash@4.17.21",
  "recharts@2.12.7>d3@7.9.0",

  // styling
  "tailwindcss@3.4.3>postcss@8.4.38",
  "tailwindcss@4.0.6>postcss@8.5.1",

  // babel: older minor pins vulnerable semver, newer is patched
  "@babel/core@7.24.0>semver@6.3.0",
  "@babel/core@7.24.6>semver@7.6.0",

  // graphql servers / aws
  "@apollo/server@4.9.5>graphql@16.8.1",
  "@apollo/server@4.10.0>graphql@16.9.0",
  "@aws-sdk/client-s3@*>uuid@9.0.1",
];
