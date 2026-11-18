/**
 * 透明肥鱼 · 宿主端
 *
 * 这个插件只做一件"重活"：把用户自己选的壁纸文件管起来。
 * 壁纸是本地文件，浏览器拿不到磁盘路径，所以由本进程负责：
 *   · 接收浏览器交来的字节流，落到 $DSH_HOME/transparent-fish/wallpapers/
 *   · 按内容 sha256 去重，同一份文件不会堆成两份
 *   · 用 /file 路由回放（支持 Range，视频才能拖动进度条）
 *
 * 安全边界：写操作只接受回环地址（Host 是 127.0.0.1 / localhost / ::1），
 * 与鲸鱼挂件同一套判断方式 —— 否则局域网里任何拿到 Web 会话的人都能往你磁盘写文件。
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'

const ROUTE_PREFIX = '/dsh-transparent-fish'
const MAX_BODY = 512 * 1024 * 1024 // 512 MiB，够放 4K 视频
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp'])
const VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv'])

/** 数据根：$DSH_HOME/transparent-fish */
function dataDir() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'transparent-fish')
}

const dirs = {
  root: () => dataDir(),
  wallpapers: () => path.join(dataDir(), 'wallpapers'),
  libraryFile: () => path.join(dataDir(), 'library.json'),
  settingsFile: () => path.join(dataDir(), 'settings.json'),
}

function ensureDirs() {
  fs.mkdirSync(dirs.wallpapers(), { recursive: true })
}

/** 读 JSON；文件缺失或损坏一律退化成兜底值，绝不抛 */
function readJson(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const value = JSON.parse(raw)
    return value && typeof value === 'object' ? value : fallback
  } catch (_error) {
    return fallback
  }
}

/** 原子写：先写 .tmp 再 rename，断电不会留下半截 JSON */
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2))
  fs.renameSync(tmp, file)
}

function readLibrary() {
  const lib = readJson(dirs.libraryFile(), { items: [] })
  return Array.isArray(lib.items) ? lib : { items: [] }
}

function writeLibrary(lib) {
  writeJson(dirs.libraryFile(), lib)
}

function readSettings() {
  const s = readJson(dirs.settingsFile(), {})
  return {
    currentId: typeof s.currentId === 'string' ? s.currentId : null,
  }
}

function writeSettings(next) {
  writeJson(dirs.settingsFile(), { ...readSettings(), ...next })
}

/* ------------------------------------------------------------------ 工具 */

function isLoopback(hostHeader) {
  try {
    const url = new URL(`http://${String(hostHeader || '')}`)
    const h = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (h === 'localhost' || h.endsWith('.localhost') || h === '::1') return true
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
    if (!m) return false
    return Number(m[1]) === 127 && [m[2], m[3], m[4]].every((x) => Number(x) <= 255)
  } catch (_error) {
    return false
  }
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function send(res, code, body, headers) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)
  res.writeHead(code, {
    'cache-control': 'no-store',
    ...(typeof body === 'string' || Buffer.isBuffer(body) ? {} : { 'content-type': 'application/json; charset=utf-8' }),
    ...headers,
  })
  res.end(payload)
}

function readBodyBuffer(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > maxBytes) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  ogv: 'video/ogg',
}

function extOf(name) {
  const ext = path.extname(String(name || '')).replace('.', '').toLowerCase()
  return ext === 'jpeg' ? 'jpg' : ext
}

function kindOf(ext) {
  if (IMAGE_EXT.has(ext)) return 'image'
  if (VIDEO_EXT.has(ext)) return 'video'
  return null
}

function publicItem(item) {
  return {
    id: item.id,
    name: item.name,
    kind: item.kind,
    ext: item.ext,
    bytes: item.bytes,
    addedAt: item.addedAt,
    url: `${ROUTE_PREFIX}/file?id=${encodeURIComponent(item.id)}`,
  }
}

/* ------------------------------------------------------------------ 路由 */

function listState() {
  const lib = readLibrary()
  const settings = readSettings()
  const items = lib.items.map(publicItem)
  const current = items.find((i) => i.id === settings.currentId) || null
  return { current, items }
}

function serveFile(req, res) {
  const id = new URL(req.url || '/', 'http://localhost').searchParams.get('id')
  const item = readLibrary().items.find((i) => i.id === id)
  if (!item) return send(res, 404, 'not found', { 'content-type': 'text/plain; charset=utf-8' })

  const file = path.join(dirs.wallpapers(), item.file)
  let stat
  try {
    stat = fs.statSync(file)
  } catch (_error) {
    return send(res, 404, 'missing file', { 'content-type': 'text/plain; charset=utf-8' })
  }

  const type = MIME[item.ext] || 'application/octet-stream'
  const range = req.headers.range
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim())
    if (m) {
      let start = m[1] === '' ? NaN : Number(m[1])
      let end = m[2] === '' ? NaN : Number(m[2])
      if (Number.isNaN(start)) {
        start = stat.size - end
        end = stat.size - 1
      } else if (Number.isNaN(end)) {
        end = stat.size - 1
      }
      if (start < 0) start = 0
      if (end >= stat.size) end = stat.size - 1
      if (start > end) {
        return send(res, 416, '', { 'content-range': `bytes */${stat.size}` })
      }
      res.writeHead(206, {
        'content-type': type,
        'content-length': end - start + 1,
        'content-range': `bytes ${start}-${end}/${stat.size}`,
        'accept-ranges': 'bytes',
        'cache-control': 'public, max-age=31536000, immutable',
      })
      return fs.createReadStream(file, { start, end }).pipe(res)
    }
  }

  res.writeHead(200, {
    'content-type': type,
    'content-length': stat.size,
    'accept-ranges': 'bytes',
    'cache-control': 'public, max-age=31536000, immutable',
  })
  fs.createReadStream(file).pipe(res)
}

async function importFile(req, res) {
  const url = new URL(req.url || '/', 'http://localhost')
  const name = String(url.searchParams.get('name') || 'wallpaper').slice(0, 200)
  const ext = extOf(name)
  const kind = kindOf(ext)
  if (!kind) return send(res, 415, { ok: false, error: 'unsupported-type' })

  let bytes
  try {
    bytes = await readBodyBuffer(req, MAX_BODY)
  } catch (error) {
    return send(res, 413, { ok: false, error: 'too-large' })
  }
  if (bytes.length === 0) return send(res, 400, { ok: false, error: 'empty' })

  const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16)
  const lib = readLibrary()
  const existing = lib.items.find((i) => i.id === hash)
  if (existing) {
    /* 同一份文件：直接复用，不重复落盘 */
    return send(res, 200, { ok: true, reused: true, item: publicItem(existing), state: listState() })
  }

  ensureDirs()
  const file = `${hash}.${ext}`
  const target = path.join(dirs.wallpapers(), file)
  const tmp = `${target}.${process.pid}.tmp`
  await fsp.writeFile(tmp, bytes)
  await fsp.rename(tmp, target)

  const item = {
    id: hash,
    file,
    name: name.replace(/[\\/]/g, '_').slice(0, 200),
    kind,
    ext,
    bytes: bytes.length,
    addedAt: Date.now(),
  }
  lib.items.unshift(item)
  writeLibrary(lib)
  if (!readSettings().currentId) writeSettings({ currentId: item.id })

  return send(res, 200, { ok: true, item: publicItem(item), state: listState() })
}

function selectWallpaper(req, res) {
  const id = new URL(req.url || '/', 'http://localhost').searchParams.get('id')
  const item = readLibrary().items.find((i) => i.id === id)
  if (!item) return send(res, 404, { ok: false, error: 'not-found' })
  writeSettings({ currentId: id })
  return send(res, 200, { ok: true, state: listState() })
}

function removeWallpaper(req, res) {
  const id = new URL(req.url || '/', 'http://localhost').searchParams.get('id')
  const lib = readLibrary()
  const item = lib.items.find((i) => i.id === id)
  if (!item) return send(res, 404, { ok: false, error: 'not-found' })

  lib.items = lib.items.filter((i) => i.id !== id)
  writeLibrary(lib)
  try {
    fs.unlinkSync(path.join(dirs.wallpapers(), item.file))
  } catch (_error) {
    /* 文件已经不在了，库记录删掉就行 */
  }
  if (readSettings().currentId === id) {
    writeSettings({ currentId: lib.items[0] ? lib.items[0].id : null })
  }
  return send(res, 200, { ok: true, state: listState() })
}

/* ------------------------------------------------------------------ 插件 */

export default {
  name: 'dsh-transparent-fish',
  apply(ctx) {
    ensureDirs()

    ctx.inject(['webServer'], (scope) => {
      const routes = [
        {
          kind: 'exact',
          path: `${ROUTE_PREFIX}/state`,
          handler: (req, res) => send(res, 200, { ok: true, ...listState() }),
        },
        { kind: 'exact', path: `${ROUTE_PREFIX}/file`, handler: serveFile },
        {
          kind: 'exact',
          path: `${ROUTE_PREFIX}/import`,
          handler: async (req, res) => {
            if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' })
            if (!isLoopback(req.headers.host)) return send(res, 403, { ok: false, error: 'forbidden' })
            try {
              await importFile(req, res)
            } catch (error) {
              send(res, 500, { ok: false, error: String((error && error.message) || error) })
            }
          },
        },
        {
          kind: 'exact',
          path: `${ROUTE_PREFIX}/select`,
          handler: async (req, res) => {
            if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' })
            if (!isLoopback(req.headers.host)) return send(res, 403, { ok: false, error: 'forbidden' })
            await readBodyBuffer(req, 8192).catch(() => Buffer.alloc(0))
            selectWallpaper(req, res)
          },
        },
        {
          kind: 'exact',
          path: `${ROUTE_PREFIX}/remove`,
          handler: async (req, res) => {
            if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' })
            if (!isLoopback(req.headers.host)) return send(res, 403, { ok: false, error: 'forbidden' })
            await readBodyBuffer(req, 8192).catch(() => Buffer.alloc(0))
            removeWallpaper(req, res)
          },
        },
      ]
      for (const route of routes) {
        try {
          scope.webServer.register(route)
        } catch (error) {
          console.warn('[transparent-fish] 路由注册失败 %s：%s', route.path, String(error))
        }
      }
    })
  },
}

/* WRITE_METHODS 目前只在将来扩展时用得到，显式导出让打包器别抱怨 */
export const __writeMethods = WRITE_METHODS
