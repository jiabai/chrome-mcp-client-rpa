/**
 * 深度说明：DeepSeek Chat 自动注入与提交脚本
 *
 * 目标
 * - 通过 Chrome DevTools Protocol (CDP) 在 DeepSeek Chat 页面中自动定位输入框、填充文本并触发发送
 * - 同时支持两种接入方式：
 *   1) 通过 selenium-webdriver 连接到已开启远程调试的 Chrome
 *   2) 无法创建 WebDriver 时，直接使用 CDP WebSocket 进行操作（回退方案）
 *
 * 关键依赖
 * - `selenium-webdriver`: 构建浏览器驱动（仅在已开启 `--remote-debugging-port` 情况下使用）
 * - `ws`: 与目标页面的 CDP WebSocket 通信
 *
 * 运行环境与变量
 * - `CHROME_MCP_URL`: 指定远程调试端点基础地址，默认 `http://127.0.0.1:9222`
 * - 需本机或远程 Chrome 以 `--remote-debugging-port=9222` 启动，或由 MCP 服务代理到对应端口
 *
 * 核心常量
 * - `TARGET_URL`: 目标站点（DeepSeek Chat）主页地址
 * - `TEXT`: 要注入到聊天输入框并尝试发送的文本内容
 *
 * 核心函数
 * - `injection(text)`: 生成一段自执行脚本字符串。
 *   - 多策略查找输入控件（textarea、contenteditable、role=textbox、ProseMirror、Lexical 等）
 *   - 对原生 `<textarea>`/`<input type="text">` 通过原型 `value` 的 setter 注入以触发正确的事件链
 *   - 对可编辑区域（contenteditable）设置 `textContent` 并分发 `InputEvent`/`input`/`change`
 *   - 优先查找并点击“发送/Submit”按钮；若未命中则向活动元素发送 Enter 键
 *   - 返回注入结果，包含选择器、标签名、是否 contenteditable 等调试信息
 *
 * - `j(path)`: 基于 `BASE` 进行 HTTP 请求并解析 JSON，用于访问 CDP 的 `json/list`、`json/new` 等端点
 * - `findDeepseekTarget()`: 从 `/json/list` 中检索 DeepSeek 页签信息
 * - `cdp(ws)`: 根据传入的 WebSocket 构造一个 CDP 调用器（带递增 `id`、结果映射与 30s 超时）
 * - `main()`: 首选通过 `selenium-webdriver` 连接既有调试端口并导航至目标页面；
 *   - 成功获取页签后，建立 CDP WebSocket，开启 `Runtime`，前置页面并执行注入表达式
 *   - 若无法创建 WebDriver 或找不到目标页签，则回退到 `runCdpDirect()`
 * - `runCdpDirect()`: 直接通过 CDP 端点创建或获取 DeepSeek 目标，并以同样方式注入和提交
 *
 * 典型流程
 * 1) 尝试构建 Selenium 驱动（绑定 `debuggerAddress`）
 * 2) 导航到 `TARGET_URL`，从 `/json/list` 查找目标；若无则再次导航或走回退
 * 3) 连接 `webSocketDebuggerUrl`，启用 `Runtime`、`Page.bringToFront`
 * 4) 执行由 `injection(TEXT)` 生成的表达式，自动填充+提交
 * 5) 将结果输出到控制台并关闭连接
 *
 * 使用说明
 * - 预置条件：Chrome 已开启远程调试或 MCP 提供调试端口代理；可访问 `BASE` 的 `/json/list`
 * - 运行：在项目根目录执行 `node special/deepseek-chat-injector.js`
 * - 行为：若存在 DeepSeek 标签页则直接注入，否则创建新标签页后注入；打印 CDP 执行返回值
 *
 * 兼容与稳定性
 * - 站点前端演进可能导致选择器失效；如遇注入失败需更新 `sels`/`btnSels`
 * - 事件触发采用尽量贴近真实输入的序列，但不同框架（Slate/ProseMirror/Lexical）仍可能要求特定事件
 * - 超时与回退：CDP 调用默认 30s 超时；WebDriver失败时自动回退到直接 CDP 模式
 *
 * 安全注意
 * - 启用远程调试端口存在安全风险，请在受信网络环境中使用
 * - 脚本仅对已打开的 DeepSeek Chat 页签进行操作，不触达其他站点数据
 */
import { Builder } from 'selenium-webdriver'
import WebSocket from 'ws'

const BASE = process.env.CHROME_MCP_URL || 'http://127.0.0.1:9222'
const TARGET_URL = 'https://chat.deepseek.com'
const TEXT = '请搜索NemoVideo这家公司的信息'

function injection(text) {
  const s = JSON.stringify(text)
  return `(() => {
    const sels = ["textarea","[contenteditable=\\\"true\\\"]","[role=\\\"textbox\\\"]","input[type=\\\"text\\\"]",".ProseMirror","div[aria-label]","div[placeholder]","[data-slate-editor]","[data-testid*=\\\"editor\\\"]","[data-lexical-editor]"]
    let el = null
    let used = null
    for (const q of sels){ const e = document.querySelector(q); if (e) { el = e; used = q; break } }
    if (!el) return { ok:false, msg:'no input' }
    const tag = (el.tagName||'').toLowerCase()
    el.focus()
    if (tag==='textarea' || (tag==='input' && el.type==='text')) {
      const proto = tag==='textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      const desc = Object.getOwnPropertyDescriptor(proto,'value')
      if (desc && desc.set) desc.set.call(el, ${s}); else el.value = ${s}
      try { el.dispatchEvent(new InputEvent('input',{bubbles:true,data:${s},inputType:'insertText'})) } catch {}
      el.dispatchEvent(new Event('input',{bubbles:true}))
      el.dispatchEvent(new Event('change',{bubbles:true}))
    } else if (el.isContentEditable) {
      const r = document.createRange(); r.selectNodeContents(el); r.deleteContents(); el.textContent = ${s}
      try { el.dispatchEvent(new InputEvent('input',{bubbles:true,data:${s},inputType:'insertText'})) } catch {}
      el.dispatchEvent(new Event('input',{bubbles:true}))
    } else {
      el.textContent = ${s}
      el.dispatchEvent(new Event('input',{bubbles:true}))
    }
    el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}))
    el.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',bubbles:true}))
    const container = el.closest('form') || el.parentElement || document
    const btnSels = [
      'button[type=\\\"submit\\\"]',
      'button[aria-label*=\\\"发送\\\"]',
      'button[aria-label*=\\\"Send\\\"]',
      '[role=\\\"button\\\"][aria-label*=\\\"发送\\\"]',
      '[role=\\\"button\\\"][aria-label*=\\\"Send\\\"]',
      '[data-testid*=\\\"send\\\"]',
      '[aria-label*=\\\"提交\\\"]',
      '[aria-label*=\\\"Submit\\\"]'
    ]
    let btn = null
    for (const qs of btnSels){ btn = container.querySelector(qs) || document.querySelector(qs); if (btn) break }
    if (btn) {
      const evInit = { bubbles:true, cancelable:true }
      btn.dispatchEvent(new MouseEvent('pointerdown', evInit))
      btn.dispatchEvent(new MouseEvent('mousedown', evInit))
      btn.dispatchEvent(new MouseEvent('click', evInit))
      btn.dispatchEvent(new MouseEvent('mouseup', evInit))
    } else {
      const active = document.activeElement || el
      active.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}))
      active.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',bubbles:true}))
    }
    return { ok:true, selector: used, tag: el.tagName, contenteditable: !!el.isContentEditable }
  })()`
}

async function j(path) {
  const r = await fetch(`${BASE}${path}`)
  return await r.json()
}

async function findDeepseekTarget() {
  const list = await j('/json/list')
  return list.find(x => typeof x.url === 'string' && x.url.includes('chat.deepseek.com'))
}

function cdp(ws) {
  let id = 0
  const map = new Map()
  ws.on('message', m => {
    try {
      const d = JSON.parse(m.toString())
      if (d && typeof d.id === 'number' && map.has(d.id)) {
        const { resolve } = map.get(d.id)
        map.delete(d.id)
        resolve(d)
      }
    } catch {}
  })
  return async (method, params) => {
    id += 1
    ws.send(JSON.stringify({ id, method, params }))
    return await new Promise((resolve, reject) => {
      map.set(id, { resolve, reject })
      setTimeout(() => {
        if (map.has(id)) {
          map.delete(id)
          reject(new Error('cdp timeout'))
        }
      }, 30000)
    })
  }
}

async function main() {
  const caps = { browserName: 'chrome', 'goog:chromeOptions': { debuggerAddress: '127.0.0.1:9222' } }
  let driver
  try {
    driver = await new Builder().withCapabilities(caps).build()
  } catch (e) {
    await runCdpDirect()
    return
  }
  try {
    await driver.get(TARGET_URL)
    let t = await findDeepseekTarget()
    if (!t) {
      await driver.get(TARGET_URL)
      t = await findDeepseekTarget()
    }
    if (!t) {
      await runCdpDirect()
      return
    }
    const ws = new WebSocket(t.webSocketDebuggerUrl)
    await new Promise(res => ws.once('open', res))
    const call = cdp(ws)
    await call('Runtime.enable', {})
    await call('Page.bringToFront', {})
    const expr = injection(TEXT)
    const r = await call('Runtime.evaluate', { expression: expr, awaitPromise: true })
    console.log(r?.result ?? r)
    ws.close()
  } finally {
  }
}

async function runCdpDirect() {
  let list = await j('/json/list')
  let t = list.find(x => typeof x.url === 'string' && x.url.includes('chat.deepseek.com'))
  if (!t) {
    const r = await fetch(`${BASE}/json/new?${encodeURIComponent(TARGET_URL)}`)
    t = await r.json()
  }
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise(res => ws.once('open', res))
  const call = cdp(ws)
  await call('Runtime.enable', {})
  await call('Page.bringToFront', {})
  const expr = injection(TEXT)
  const r = await call('Runtime.evaluate', { expression: expr, awaitPromise: true })
  console.log(r?.result ?? r)
  ws.close()
}

main().catch(e => { console.error(e); process.exit(1) })
