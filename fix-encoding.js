/**
 * fix-encoding.js
 * Fixes CP437-corrupted UTF-8 text stored in the DB.
 * The content was stored as: original_utf8_bytes decoded as CP437 → re-encoded as UTF-8.
 * This script reverses that: corrupted_utf8 → encode as CP437 → decode as UTF-8.
 *
 * Run from: /c/Dev/reailize-portal
 * Usage: node fix-encoding.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'reailize_user',
  password: 'reailize_pass_2026',
  database: 'reailize_portal',
});

// CP437 → Unicode mapping for bytes 0x80–0xFF
const cp437 = [
  0x00C7,0x00FC,0x00E9,0x00E2,0x00E4,0x00E0,0x00E5,0x00E7, // 0x80
  0x00EA,0x00EB,0x00E8,0x00EF,0x00EE,0x00EC,0x00C4,0x00C5, // 0x88
  0x00C9,0x00E6,0x00C6,0x00F4,0x00F6,0x00F2,0x00FB,0x00F9, // 0x90
  0x00FF,0x00D6,0x00DC,0x00A2,0x00A3,0x00A5,0x20A7,0x0192, // 0x98
  0x00E1,0x00ED,0x00F3,0x00FA,0x00F1,0x00D1,0x00AA,0x00BA, // 0xA0
  0x00BF,0x2310,0x00AC,0x00BD,0x00BC,0x00A1,0x00AB,0x00BB, // 0xA8
  0x2591,0x2592,0x2593,0x2502,0x2524,0x2561,0x2562,0x2556, // 0xB0
  0x2555,0x2563,0x2551,0x2557,0x255D,0x255C,0x255B,0x2510, // 0xB8
  0x2514,0x2534,0x252C,0x251C,0x2500,0x253C,0x255E,0x255F, // 0xC0
  0x255A,0x2554,0x2569,0x2566,0x2560,0x2550,0x256C,0x2567, // 0xC8
  0x2568,0x2564,0x2565,0x2559,0x2558,0x2552,0x2553,0x256B, // 0xD0
  0x256A,0x2518,0x250C,0x2588,0x2584,0x258C,0x2590,0x2580, // 0xD8
  0x03B1,0x00DF,0x0393,0x03C0,0x03A3,0x03C3,0x00B5,0x03C4, // 0xE0
  0x03A6,0x0398,0x03A9,0x03B4,0x221E,0x03C6,0x03B5,0x2229, // 0xE8
  0x2261,0x00B1,0x2265,0x2264,0x2320,0x2321,0x00F7,0x2248, // 0xF0
  0x00B0,0x2219,0x00B7,0x221A,0x207F,0x00B2,0x25A0,0x00A0, // 0xF8
];

// Build reverse map: Unicode codepoint → CP437 byte
const unicodeToCp437 = new Map();
for (let i = 0; i < 128; i++) unicodeToCp437.set(i, i);
for (let i = 0; i < cp437.length; i++) unicodeToCp437.set(cp437[i], i + 0x80);

function fixEncoding(str) {
  // 1. Convert each Unicode char back to CP437 byte
  const bytes = [];
  for (const char of str) {
    const cp = char.codePointAt(0);
    const byte = unicodeToCp437.get(cp);
    if (byte !== undefined) {
      bytes.push(byte);
    } else {
      // Character not in CP437 — keep as-is (encode as UTF-8 bytes)
      const utf8 = Buffer.from(char, 'utf8');
      for (const b of utf8) bytes.push(b);
    }
  }
  // 2. Decode those bytes as UTF-8
  try {
    return Buffer.from(bytes).toString('utf8');
  } catch {
    return str; // fallback: return original
  }
}

async function fixTable(tableName) {
  const res = await pool.query(`SELECT id, content FROM ${tableName}`);
  let fixed = 0;
  for (const row of res.rows) {
    const corrected = fixEncoding(row.content);
    if (corrected !== row.content) {
      await pool.query(`UPDATE ${tableName} SET content = $1 WHERE id = $2`, [corrected, row.id]);
      fixed++;
      console.log(`  ✓ Fixed row id=${row.id}`);
    }
  }
  console.log(`  → ${fixed}/${res.rows.length} rows updated in ${tableName}`);
}

async function main() {
  console.log('🔧 Fixing encoding in qbr_configs, ticket_guide, weekly_guide...\n');
  try {
    await fixTable('qbr_configs');
    await fixTable('ticket_guide');
    await fixTable('weekly_guide');
    console.log('\n✅ Done.');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
