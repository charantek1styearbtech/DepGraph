// ─────────────────────────────────────────────────────────────────────────────
// DepGraph · CognoDB schema (openCypher)
//
// Executed idempotently by `npm run seed` (each statement individually, and
// failures are tolerated when a CognoDB instance does not support a feature).
//
// Node labels
//   (:Project)        a software project (GitHub repository)
//   (:Package)        a reusable dependency/module (e.g. lodash)
//   (:Version)        ONE specific release of a package (e.g. lodash@4.17.21)
//   (:Vulnerability)  a demo-labelled security issue (CVE-DEMO-*)
//   (:Repository)     a Git repository
//   (:Organization)   an org/user owning repositories
//   (:License)        an OSS license (MIT, Apache-2.0, ...)
//   (:Developer)      a contributor
//   (:Technology)     a language/runtime/stack tag
//
// Relationships
//   Project  -[:DIRECT_DEPENDS_ON {addedBy}]->   Package
//   Package  -[:HAS_VERSION]->                   Version
//   Version  -[:DEPENDS_ON {range}]->            Package      ← transitive edges
//   Version  -[:AFFECTED_BY]->                   Vulnerability
//   Package  -[:USES_LICENSE]->                  License
//   Project  -[:HAS_REPOSITORY]->                Repository
//   Repository -[:MAINTAINED_BY]->               Organization
//   Developer -[:CONTRIBUTES_TO {commits}]->      Repository
//   Package  -[:USES_TECHNOLOGY]->                Technology
//
// The core traversal chain:
//   Project → DIRECT_DEPENDS_ON → Package → HAS_VERSION → Version
//           → DEPENDS_ON* → Package → HAS_VERSION → Version → AFFECTED_BY → Vulnerability
// ─────────────────────────────────────────────────────────────────────────────

// ── Uniqueness constraints ───────────────────────────────────────────────────
CREATE CONSTRAINT project_id IF NOT EXISTS
FOR (p:Project) REQUIRE p.id IS UNIQUE;

CREATE CONSTRAINT package_id IF NOT EXISTS
FOR (k:Package) REQUIRE k.id IS UNIQUE;

CREATE CONSTRAINT version_id IF NOT EXISTS
FOR (v:Version) REQUIRE v.id IS UNIQUE;

CREATE CONSTRAINT vulnerability_id IF NOT EXISTS
FOR (v:Vulnerability) REQUIRE v.id IS UNIQUE;

CREATE CONSTRAINT repository_id IF NOT EXISTS
FOR (r:Repository) REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT organization_id IF NOT EXISTS
FOR (o:Organization) REQUIRE o.id IS UNIQUE;

CREATE CONSTRAINT license_id IF NOT EXISTS
FOR (l:License) REQUIRE l.id IS UNIQUE;

CREATE CONSTRAINT developer_id IF NOT EXISTS
FOR (d:Developer) REQUIRE d.id IS UNIQUE;

CREATE CONSTRAINT technology_id IF NOT EXISTS
FOR (t:Technology) REQUIRE t.id IS UNIQUE;

// ── Lookup indexes for hot filters/sorts ─────────────────────────────────────
CREATE INDEX package_name IF NOT EXISTS
FOR (k:Package) ON (k.name);

CREATE INDEX project_name IF NOT EXISTS
FOR (p:Project) ON (p.name);

CREATE INDEX version_number IF NOT EXISTS
FOR (v:Version) ON (v.number);

CREATE INDEX vulnerability_severity IF NOT EXISTS
FOR (v:Vulnerability) ON (v.severity);

CREATE INDEX vulnerability_package IF NOT EXISTS
FOR (v:Vulnerability) ON (v.packageId);

// ── Fulltext index backing global search (best effort) ───────────────────────
CREATE FULLTEXT INDEX entity_search IF NOT EXISTS
FOR (n:Project|Package|Vulnerability) ON EACH [n.name, n.id];
