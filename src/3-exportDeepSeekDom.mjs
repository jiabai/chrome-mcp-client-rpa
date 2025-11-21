/**
 * DeepSeek DOM 导出工具
 * 
 * 功能说明：
 * - 连接到 Chrome DevTools MCP (Model Context Protocol) 服务器
 * - 获取当前浏览器页面的完整 DOM 结构
 * - 智能提取和处理 HTML 内容，支持多种格式（纯 HTML、Markdown 代码块、JSON 等）
 * - 将提取的 HTML 内容保存到本地文件
 * 
 * 依赖要求：
 * - Chrome 浏览器实例运行在端口 9222 (http://127.0.0.1:9222)
 * - chrome-devtools-mcp npm 包
 * - @modelcontextprotocol/sdk npm 包
 * 
 * 使用场景：
 * - 网页内容抓取和分析
 * - 浏览器页面 DOM 结构备份
 * - 与 DeepSeek 等 AI 工具集成的内容提取
 * - 自动化测试和页面内容监控
 * 
 * 输出文件：
 * - 格式：HTML 文件
 * - 路径：./output/page-captured.html
 * - 编码：UTF-8
 * 
 * 作者：Chrome MCP Client RPA Tool
 * 版本：1.0.0
 * 创建时间：2024
 */

import fs from 'fs'
import path from 'path'

const MCP_SERVER_CONFIG = {
  command: 'npx',
  args: ['-y', 'chrome-devtools-mcp@latest', '--browserUrl=http://127.0.0.1:9222'],
  env: { ...process.env, NODE_ENV: 'production' }
}

async function startMcp() {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
  const transport = new StdioClientTransport(MCP_SERVER_CONFIG)
  const client = new Client({ name: 'chrome-mcp-dom-export-client', version: '1.0.0' }, { capabilities: {} })
  await client.connect(transport)
  return { client, transport }
}

async function stopMcp(mcpInstance) {
  if (mcpInstance?.client) await mcpInstance.client.close()
  if (mcpInstance?.transport) await mcpInstance.transport.close()
}

function getTextFromContentParts(parts) {
  if (!Array.isArray(parts)) return ''
  const out = []
  for (const p of parts) {
    if (typeof p?.text === 'string') out.push(p.text)
    else if (typeof p === 'string') out.push(p)
    else if (p && typeof p === 'object') {
      if (p.type === 'json' && p.json) out.push(JSON.stringify(p.json))
      else out.push(JSON.stringify(p))
    }
  }
  return out.join('\n')
}

function extractHtml(raw) {
  if (!raw || typeof raw !== 'string') return ''
  let html = raw
  const mHtml = raw.match(/```html\r?\n([\s\S]*?)\r?\n```/i)
  if (mHtml) html = mHtml[1]
  else {
    const mJson = raw.match(/```json\r?\n([\s\S]*?)\r?\n```/i)
    if (mJson) {
      try {
        const data = JSON.parse(mJson[1])
        const candidates = [data, data?.result, data?.html, data?.content]
        for (const c of candidates) {
          if (typeof c === 'string' && c.trim().length) { html = c; break }
          if (c && typeof c === 'object') {
            if (typeof c.html === 'string' && c.html.trim().length) { html = c.html; break }
            if (typeof c.value === 'string' && c.value.trim().length) { html = c.value; break }
          }
        }
      } catch {}
    } else {
      try {
        const data2 = JSON.parse(raw)
        const candidates2 = [data2, data2?.result, data2?.html, data2?.content]
        for (const c of candidates2) {
          if (typeof c === 'string' && c.trim().length) { html = c; break }
          if (c && typeof c === 'object') {
            if (typeof c.html === 'string' && c.html.trim().length) { html = c.html; break }
            if (typeof c.value === 'string' && c.value.trim().length) { html = c.value; break }
          }
        }
      } catch {}
      const i = raw.indexOf('<html')
      const j = raw.lastIndexOf('</html>')
      if (i !== -1 && j !== -1 && j > i) html = raw.slice(i, j + 7)
    }
  }
  return html
}

async function exportDeepSeekDom() {
  let mcp = null
  try {
    mcp = await startMcp()
    const { client } = mcp

    let tools
    try {
      tools = await client.listTools()
    } catch {}
    const names = new Set((tools?.tools || []).map(t => t?.name))
    // 屏蔽导航到 https://chat.deepseek.com 的代码，因为浏览器已经在目标页面准备就绪
    // if (names.has('navigate_page')) {
    //   try {
    //     await client.callTool({ name: 'navigate_page', arguments: { url: 'https://chat.deepseek.com', timeout: 15000 } })
    //   } catch (e) {
    //     console.log(e?.message || 'navigate_page failed')
    //   }
    // }

    const result = await client.callTool({ name: 'evaluate_script', arguments: { function: `() => document.documentElement.outerHTML` } })
    const raw = getTextFromContentParts(result?.content)
    const html = extractHtml(raw)

    const outPath = path.join(process.cwd(), 'output', 'page-captured.html')
    try { fs.mkdirSync(path.dirname(outPath), { recursive: true }) } catch {}
    fs.writeFileSync(outPath, html || raw, 'utf8')
    console.log(`captured: ${outPath}`)
  } catch (e) {
    console.error(e?.message || String(e))
  } finally {
    if (mcp) await stopMcp(mcp)
    process.exit(0)
  }
}

exportDeepSeekDom()