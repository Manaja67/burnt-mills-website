-- Schéma actuel, distinct du modèle normalisé cible dans ARCHITECTURE.md.
-- Instance monoentreprise. Les liens entre records sont validés par l'API.
PRAGMA foreign_keys=ON;
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL, -- sel:hash scrypt, jamais de mot de passe en clair
  role TEXT NOT NULL CHECK(role IN ('admin','director','accountant','project_manager','foreman','employee','subcontractor','client')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  client_id TEXT REFERENCES records(id),
  employee_id TEXT REFERENCES records(id),
  budget_access INTEGER NOT NULL DEFAULT 0 CHECK(budget_access IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX user_employee ON users(employee_id) WHERE employee_id IS NOT NULL;
CREATE TABLE user_projects (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES records(id),
  PRIMARY KEY(user_id,project_id)
);
CREATE TABLE sessions (
  token TEXT PRIMARY KEY, -- SHA-256 du jeton aléatoire du cookie
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE TABLE records (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON validé : champs spécifiques au type métier
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX records_kind ON records(kind);
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES records(id),
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes BLOB NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'internal' CHECK(audience IN ('internal','team','client'))
);
CREATE TABLE settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE audit (
  id INTEGER PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  at TEXT NOT NULL
);
