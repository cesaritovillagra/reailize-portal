/**
 * fix-encoding-double.js
 * Recupera contenido con DOBLE corrupción CP437 desde backup SQL.
 *
 * El contenido pasó dos veces por el ciclo:
 *   UTF-8 bytes → leídos como CP437 → re-codificados como UTF-8
 * Por eso fixEncoding debe aplicarse DOS veces.
 *
 * Tablas afectadas: ticket_guide, weekly_guide
 *
 * Uso: node fix-encoding-double.js
 * Ejecutar desde: /c/Dev/reailize-portal/backend
 */

const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'reailize_user',
  password: 'reailize_pass_2026',
  database: 'reailize_portal',
});

// CP437 → Unicode mapping para bytes 0x80–0xFF
const cp437 = [
  0x00C7,0x00FC,0x00E9,0x00E2,0x00E4,0x00E0,0x00E5,0x00E7,
  0x00EA,0x00EB,0x00E8,0x00EF,0x00EE,0x00EC,0x00C4,0x00C5,
  0x00C9,0x00E6,0x00C6,0x00F4,0x00F6,0x00F2,0x00FB,0x00F9,
  0x00FF,0x00D6,0x00DC,0x00A2,0x00A3,0x00A5,0x20A7,0x0192,
  0x00E1,0x00ED,0x00F3,0x00FA,0x00F1,0x00D1,0x00AA,0x00BA,
  0x00BF,0x2310,0x00AC,0x00BD,0x00BC,0x00A1,0x00AB,0x00BB,
  0x2591,0x2592,0x2593,0x2502,0x2524,0x2561,0x2562,0x2556,
  0x2555,0x2563,0x2551,0x2557,0x255D,0x255C,0x255B,0x2510,
  0x2514,0x2534,0x252C,0x251C,0x2500,0x253C,0x255E,0x255F,
  0x255A,0x2554,0x2569,0x2566,0x2560,0x2550,0x256C,0x2567,
  0x2568,0x2564,0x2565,0x2559,0x2558,0x2552,0x2553,0x256B,
  0x256A,0x2518,0x250C,0x2588,0x2584,0x258C,0x2590,0x2580,
  0x03B1,0x00DF,0x0393,0x03C0,0x03A3,0x03C3,0x00B5,0x03C4,
  0x03A6,0x0398,0x03A9,0x03B4,0x221E,0x03C6,0x03B5,0x2229,
  0x2261,0x00B1,0x2265,0x2264,0x2320,0x2321,0x00F7,0x2248,
  0x00B0,0x2219,0x00B7,0x221A,0x207F,0x00B2,0x25A0,0x00A0,
];

const unicodeToCp437 = new Map();
for (let i = 0; i < 128; i++) unicodeToCp437.set(i, i);
for (let i = 0; i < cp437.length; i++) unicodeToCp437.set(cp437[i], i + 0x80);

function fixEncoding(str) {
  const bytes = [];
  for (const char of str) {
    const cp = char.codePointAt(0);
    const byte = unicodeToCp437.get(cp);
    if (byte !== undefined) {
      bytes.push(byte);
    } else {
      const utf8 = Buffer.from(char, 'utf8');
      for (const b of utf8) bytes.push(b);
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

function fixEncodingDouble(str) {
  return fixEncoding(fixEncoding(str));
}

/**
 * Extrae el contenido de una tabla del archivo SQL de backup (formato COPY).
 * Retorna array de { id, content } para cada fila.
 */
function extractFromBackup(sqlText, tableName) {
  // Regex para encontrar el bloque COPY de la tabla
  const copyRegex = new RegExp(
    `COPY public\\.${tableName} \\([^)]+\\) FROM stdin;\\n([\\s\\S]*?)\\n\\\\.`,
    'm'
  );
  const match = sqlText.match(copyRegex);
  if (!match) {
    console.warn(`  ⚠ No se encontró COPY para ${tableName}`);
    return [];
  }

  const rows = [];
  const lines = match[1].split('\n').filter(l => l.length > 0);
  for (const line of lines) {
    // Columnas: id \t user_id \t project_id \t content \t updated_at
    const tabIdx = [];
    let pos = 0;
    for (let i = 0; i < 3; i++) {
      pos = line.indexOf('\t', pos) + 1;
      tabIdx.push(pos - 1);
    }
    // El content va desde tabIdx[2]+1 hasta el último \t
    const contentStart = tabIdx[2] + 1;
    const lastTab = line.lastIndexOf('\t');
    let rawContent = line.substring(contentStart, lastTab);

    // Decodificar escapes de PostgreSQL COPY format
    rawContent = rawContent
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');

    const id = line.substring(0, tabIdx[0]);
    rows.push({ id, content: rawContent });
  }
  return rows;
}

async function fixTable(sqlText, tableName) {
  console.log(`\n📋 Procesando ${tableName}...`);
  const rows = extractFromBackup(sqlText, tableName);
  if (rows.length === 0) return;

  for (const row of rows) {
    const fixed = fixEncodingDouble(row.content);

    // Preview: primeras 80 chars antes y después
    const before = row.content.substring(0, 80).replace(/\n/g, '↵');
    const after  = fixed.substring(0, 80).replace(/\n/g, '↵');
    console.log(`  Antes : ${before}`);
    console.log(`  Después: ${after}`);

    await pool.query(
      `UPDATE ${tableName} SET content = $1 WHERE id = $2`,
      [fixed, row.id]
    );
    console.log(`  ✓ Actualizado id=${row.id}`);
  }
}

async function main() {
  const backupPath = 'C:\\Users\\User\\OneDrive - B.Yond\\Documents\\Repositorio Claude\\Backups\\ReailizeDB\\reailize_2026-05-28_10-07.sql';

  console.log('📂 Leyendo backup...');
  // Leer como binario y decodificar como UTF-8, normalizando CRLF → LF
  const sqlText = fs.readFileSync(backupPath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  console.log(`   ${(sqlText.length / 1024).toFixed(0)} KB leídos`);

  try {
    await fixTable(sqlText, 'ticket_guide');
    await fixTable(sqlText, 'weekly_guide');
    console.log('\n✅ Listo. Verificá en el portal.');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
