import type { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { logger } from '../../utils/logger.js';

/**
 * GET /local-file-text?path=<absolute-path>
 * 供浏览器插件读取执行机本地文件内容（插件沙箱无法直接读盘）。
 * 支持：文本类（txt/csv/json/log/md/html/xml/yaml）、docx、xlsx（zip 解包提取文本）。
 * 返回: { exists, size, fileName, text, truncated }
 */

const TEXT_EXTS = new Set(['.txt', '.csv', '.json', '.log', '.md', '.html', '.htm', '.xml', '.yaml', '.yml', '.tsv', '.ini']);
const MAX_TEXT = 20000;

// ── 极简 ZIP 读取（无依赖，适配 docx/xlsx） ──
interface ZipEntry { name: string; method: number; compressedSize: number; localOffset: number }

function readZipEntries(buf: Buffer): ZipEntry[] {
  // 从尾部找 EOCD (0x06054b50)
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count && pos + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const method = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    const name = buf.subarray(pos + 46, pos + 46 + nameLen).toString('utf8');
    entries.push({ name, method, compressedSize, localOffset });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function inflateEntry(buf: Buffer, entry: ZipEntry): Buffer {
  const lh = entry.localOffset;
  if (buf.readUInt32LE(lh) !== 0x04034b50) throw new Error('bad local header');
  const nameLen = buf.readUInt16LE(lh + 26);
  const extraLen = buf.readUInt16LE(lh + 28);
  const dataStart = lh + 30 + nameLen + extraLen;
  const data = buf.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return zlib.inflateRawSync(data);
  throw new Error(`unsupported zip method ${entry.method}`);
}

function xmlToText(xml: string): string {
  return xml
    .replace(/<w:tab[^>]*\/?>(?![\s\S]*?<\/w:tab>)/g, '\t')
    .replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (m) => m.replace(/<[^>]+>/g, '') + '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}

function extractDocx(buf: Buffer): string {
  const entries = readZipEntries(buf);
  const doc = entries.find(e => e.name === 'word/document.xml');
  if (!doc) throw new Error('docx 中未找到 word/document.xml');
  return xmlToText(inflateEntry(buf, doc).toString('utf8'));
}

function extractXlsx(buf: Buffer): string {
  const entries = readZipEntries(buf);
  const shared = entries.find(e => e.name === 'xl/sharedStrings.xml');
  const sharedStrings: string[] = [];
  if (shared) {
    const xml = inflateEntry(buf, shared).toString('utf8');
    for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      sharedStrings.push(m[1].replace(/<[^>]+>/g, ''));
    }
  }
  const sheets = entries.filter(e => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name));
  const out: string[] = [];
  for (const sheet of sheets) {
    const xml = inflateEntry(buf, sheet).toString('utf8');
    for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const cell of row[1].matchAll(/<c[^>]*?(?:\s+t="(\w+)")?[^>]*>([\s\S]*?)<\/c>/g)) {
        const vMatch = cell[2].match(/<v>([\s\S]*?)<\/v>/);
        if (!vMatch) continue;
        const v = vMatch[1];
        cells.push(cell[1] === 's' ? (sharedStrings[Number(v)] ?? v) : v);
      }
      if (cells.length) out.push(cells.join('\t'));
    }
  }
  return out.join('\n') || xmlToText(sheets.map(s => inflateEntry(buf, s).toString('utf8')).join(''));
}

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const buf = await fs.readFile(filePath);
  if (ext === '.docx') return extractDocx(buf);
  if (ext === '.xlsx' || ext === '.xlsm') return extractXlsx(buf);
  if (TEXT_EXTS.has(ext) || buf.subarray(0, 4).toString('latin1') !== 'PK\x03\x04') {
    return buf.toString('utf8');
  }
  throw new Error(`不支持的文件类型: ${ext}（支持文本类/docx/xlsx）`);
}

export async function localFileRoutes(server: FastifyInstance): Promise<void> {
  server.get('/local-file-text', async (request, reply) => {
    const q = request.query as { path?: string };
    const p = (q.path || '').trim();
    if (!p || !path.isAbsolute(p)) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'path 必须为绝对路径' });
    }
    try {
      const stat = await fs.stat(p);
      if (!stat.isFile()) throw new Error('not a file');
      const full = await extractText(p);
      const truncated = full.length > MAX_TEXT;
      logger.info({ path: p, size: stat.size }, 'local-file-text served');
      return reply.send({
        exists: true,
        size: stat.size,
        fileName: path.basename(p),
        text: truncated ? full.slice(0, MAX_TEXT) : full,
        truncated,
      });
    } catch (err) {
      const msg = (err as Error).message || String(err);
      logger.warn({ path: p, err: msg }, 'local-file-text failed');
      return reply.code(404).send({ exists: false, error: 'READ_FAILED', message: msg });
    }
  });
}
