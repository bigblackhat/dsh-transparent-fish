#!/usr/bin/env node
/**
 * 把 src/ 下的 CSS 与 SVG 内联进客户端模块模板，产出 client/client.js。
 *
 * 之所以要内联：DSH 客户端只加载 bundle 导出的那一个 JS 模块，
 * 没有静态资源管道路径可用，样式表必须随模块一起带走。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = dirname(fileURLToPath(import.meta.url))
const checkOnly = process.argv.includes('--check')

const css = readFileSync(resolve(root, 'src/glass.css'), 'utf8')
const svg = readFileSync(resolve(root, 'src/filter.svg'), 'utf8')
const template = readFileSync(resolve(root, 'src/client.tpl.js'), 'utf8')

/** 模板字符串里需要转义的只有反引号、反斜杠与 ${ */
function escapeForTemplate(source) {
  return source.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

const output = template
  .replace('/*__CSS__*/', escapeForTemplate(css))
  .replace('/*__SVG__*/', escapeForTemplate(svg))

const target = resolve(root, 'client/client.js')
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, output)

try {
  execFileSync(process.execPath, ['--check', target], { stdio: 'pipe' })
} catch (error) {
  console.error('client/client.js 语法检查失败：')
  console.error(String(error.stderr || error.message))
  process.exit(1)
}

const kib = (Buffer.byteLength(output) / 1024).toFixed(1)
console.log(`client/client.js 已生成（${kib} KiB）`)
if (!checkOnly) {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  console.log(`  bundle: ${pkg.name}@${pkg.version}`)
}
