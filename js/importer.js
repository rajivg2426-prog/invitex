/* InviteX – guest list import from Excel (.xlsx) or CSV, with no external library.
 * .xlsx is a zip of XML files; we unzip with the browser's DecompressionStream.
 * Exposed as window.IXImport */
(function () {
  'use strict';

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = []; let cell = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  /* ---------- ZIP (central directory) ---------- */
  async function unzip(buf, wanted) {
    const dv = new DataView(buf); const u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('This file is not a valid .xlsx workbook.');
    const count = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
    const out = {}; const dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
      p += 46 + nl + el + cl;
      if (!wanted(name)) continue;
      const lnl = dv.getUint16(off + 26, true), lel = dv.getUint16(off + 28, true);
      const data = u8.subarray(off + 30 + lnl + lel, off + 30 + lnl + lel + csize);
      if (method === 0) out[name] = dec.decode(data);
      else if (method === 8) {
        if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot read .xlsx files. Please save the sheet as CSV and upload that.');
        const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        out[name] = await new Response(s).text();
      }
    }
    return out;
  }

  /* ---------- XLSX (first worksheet) ---------- */
  const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');
  const colIndex = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

  async function parseXLSX(buf) {
    const files = await unzip(buf, (n) => n === 'xl/sharedStrings.xml' || n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
    // first sheet in workbook order
    let sheetPath = 'xl/worksheets/sheet1.xml';
    const wb = files['xl/workbook.xml'], rels = files['xl/_rels/workbook.xml.rels'];
    const m = wb && wb.match(/<sheet\b[^>]*r:id="([^"]+)"/);
    if (m && rels) { const t = rels.match(new RegExp('<Relationship\\b[^>]*Id="' + m[1] + '"[^>]*Target="([^"]+)"')) || rels.match(new RegExp('<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="' + m[1] + '"')); if (t) sheetPath = 'xl/' + t[1].replace(/^\/?xl\//, ''); }
    const xml = files[sheetPath] || files[Object.keys(files).find((k) => k.includes('worksheets/'))];
    if (!xml) throw new Error('No worksheet found in this workbook.');
    const shared = [];
    (files['xl/sharedStrings.xml'] || '').replace(/<si>([\s\S]*?)<\/si>/g, (all, si) => { shared.push(unxml((si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(''))); return ''; });
    const rows = [];
    xml.replace(/<row\b[^>]*>([\s\S]*?)<\/row>/g, (all, r) => {
      const row = [];
      r.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (a, attrs, inner = '') => {
        const ref = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1];
        const type = (attrs.match(/\bt="(\w+)"/) || [])[1];
        let v = '';
        if (type === 'inlineStr') v = unxml((inner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/) || [])[1] || '');
        else { const raw = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1]; if (raw != null) v = type === 's' ? shared[+raw] || '' : unxml(raw); }
        if (type !== 's' && type !== 'inlineStr' && type !== 'str' && /^-?\d+(\.\d+)?(E\+?\d+)?$/i.test(v)) { const num = Number(v); if (Number.isFinite(num) && Number.isInteger(num)) v = String(BigInt(Math.round(num))); }
        row[ref ? colIndex(ref) : row.length] = v;
        return '';
      });
      rows.push(Array.from(row, (x) => x || ''));
      return '';
    });
    return rows;
  }

  async function readFile(file) {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.xls')) throw new Error('Old .xls files are not supported. In Excel choose File → Save As → Excel Workbook (.xlsx) or CSV, then upload again.');
    if (name.endsWith('.xlsx')) return parseXLSX(await file.arrayBuffer());
    return parseCSV(await file.text());
  }

  /* ---------- map columns to guest fields ---------- */
  const HEAD = {
    name: /name|नाम|ਨਾਮ|guest/i,
    phone: /phone|mobile|whats|number|contact|फ़ोन|फोन|मोबाइल|ਫ਼ੋਨ|ਮੋਬਾਈਲ/i,
    email: /e-?mail|ईमेल|ਈਮੇਲ/i,
    allowed: /max|people|persons|count|allowed|seats|members|लोग|ਲੋਕ/i,
  };
  function toGuests(rows) {
    rows = rows.filter((r) => r.some((c) => String(c).trim()));
    if (!rows.length) return [];
    let map = null;
    const head = rows[0].map((c) => String(c).trim());
    const found = {};
    head.forEach((h, i) => { for (const [k, re] of Object.entries(HEAD)) if (found[k] == null && re.test(h) && !(k === 'name' && HEAD.email.test(h))) { found[k] = i; break; } });
    if (found.name != null) { map = found; rows = rows.slice(1); }
    else map = { name: 0, phone: 1, email: rows[0].length > 3 ? 2 : null, allowed: rows[0].length > 3 ? 3 : 2 }; // no header: Name, Phone, (Email,) Max
    if (map.allowed != null && map.email != null && map.allowed === map.email) map.allowed = null;
    return rows.map((r) => {
      const get = (k) => (map[k] == null ? '' : String(r[map[k]] == null ? '' : r[map[k]]).trim());
      let phone = get('phone').replace(/\.0+$/, '');
      if (/^\d{12}$/.test(phone) && phone.startsWith('91')) phone = '+' + phone;
      return { name: get('name'), phone, email: get('email'), allowed: parseInt(get('allowed'), 10) || 0 };
    });
  }

  function templateCSV() {
    return '﻿' + ['Name,WhatsApp number,Email,Max people', 'Rakesh Kumar,+91 98765 43210,,4', 'Meena Sharma,9123456789,meena@example.com,2', 'Gurpreet Singh,+44 7700 900123,,1'].join('\r\n') + '\r\n';
  }

  window.IXImport = { readFile, parseCSV, parseXLSX, toGuests, templateCSV };
})();
