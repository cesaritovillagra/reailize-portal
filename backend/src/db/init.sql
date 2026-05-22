-- ============================================================
-- REAILIZE PORTAL — Database Schema
-- ============================================================

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  lastname    VARCHAR(100) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  username    VARCHAR(80)  UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(20)  NOT NULL DEFAULT 'user', -- 'admin' | 'user'
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- PROJECTS (per user)
CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  archived    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- TICKETS (JIRA tasks)
CREATE TABLE IF NOT EXISTS tickets (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id          INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id             VARCHAR(20)  UNIQUE NOT NULL,  -- YYYY-MM-DD-####
  jira_id             VARCHAR(50),
  date_created        DATE         NOT NULL,
  date_closed         DATE,
  category            VARCHAR(100),
  environment         VARCHAR(100),
  status              VARCHAR(30)  NOT NULL DEFAULT 'Open', -- Open | In Progress | Closed
  description         TEXT,
  current_situation   TEXT,
  impact              TEXT,
  value_added         TEXT,
  next_steps          TEXT,
  governance          TEXT,
  strategic_relevance TEXT,
  key_technical_insight TEXT,
  led_by              VARCHAR(100),
  tier1_involvement   BOOLEAN NOT NULL DEFAULT FALSE,
  problem_type        VARCHAR(50),  -- application | infrastructure | observability | configuration | etc.
  network_functions   TEXT[],       -- array: ['CHF','PCF','SMF',...]
  raw_input           TEXT,         -- original text pasted by user
  deleted             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- GLOBAL TASK ID COUNTER
CREATE TABLE IF NOT EXISTS task_id_counter (
  id       SERIAL PRIMARY KEY,
  last_seq INTEGER NOT NULL DEFAULT 0
);
INSERT INTO task_id_counter (last_seq) VALUES (0);

-- QBR CONFIGURATIONS (per user + project)
CREATE TABLE IF NOT EXISTS qbr_configs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content     TEXT    NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

-- QBR REPORTS (generated)
CREATE TABLE IF NOT EXISTS qbr_reports (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date_from   DATE    NOT NULL,
  date_to     DATE    NOT NULL,
  content     TEXT    NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DEFAULT ADMIN USER (password: Admin2026!)
INSERT INTO users (name, lastname, email, username, password, role)
VALUES ('César', 'Villagra', 'cesar.villagra@yahoo.com.ar', 'cesar',
  '$2b$10$rQZ8K1vX2mN9pL3oH5tYuOq7wE4jF6gI0kM2nR8sT1aV5bC3dE7fG',
  'admin')
ON CONFLICT DO NOTHING;
