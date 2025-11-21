/**
 * DeepSeek新对话开启器
 * 
 * 功能：
 * - 自动连接到Chrome DevTools Protocol (CDP) 端口9222
 * - 导航到DeepSeek聊天页面 (https://chat.deepseek.com)
 * - 自动定位并点击"开启新对话"按钮
 * - 验证新对话是否成功开启
 * 
 * 用法：
 * 1. 确保Chrome浏览器已启动并开启远程调试端口9222
 *    可使用脚本目录下的 Start-Chrome-9222.ps1 启动Chrome
 * 2. 运行此脚本: node deepseek-newchat-opener.js
 * 
 * 环境变量配置：
 * - CHROME_MCP_URL: Chrome调试地址，默认为 'http://127.0.0.1:9222'
 * - NEWCHAT_AX_NAME: 要点击的按钮名称，默认为 '开启新对话'
 * - NEWCHAT_AX_ROLE: 按钮的ARIA角色，默认为 'button'
 * - CDP_TIMEOUT_MS: CDP命令超时时间(毫秒)，默认为10000
 * - NEWCHAT_MAX_TOTAL_MS: 整体操作最大耗时(毫秒)，默认为20000
 * - NEWCHAT_AX_TIMEOUT_MS: 可访问性树查询超时(毫秒)，默认为6000
 * - NEWCHAT_FRAME_TIMEOUT_MS: 帧操作超时(毫秒)，默认为6000
 * 
 * 工作原理：
 * 1. 通过Chrome DevTools Protocol连接到浏览器
 * 2. 检查是否已有DeepSeek页面打开，没有则自动导航到目标页面
 * 3. 等待页面加载完成
 * 4. 使用多种方法尝试定位并点击"开启新对话"按钮：
 *    - 通过可访问性查询树 (AXQuery)
 *    - 通过可访问性完整树 (AX)
 *    - 通过DOM查询
 *    - 通过帧内DOM查询
 * 5. 验证新对话是否成功开启（检查输入框是否存在且可编辑）
 * 6. 输出操作结果
 */

import WebSocket from 'ws'

const BASE = process.env.CHROME_MCP_URL || 'http://127.0.0.1:9222'
const TARGET_URL = 'https://chat.deepseek.com'
const AX_NAME = process.env.NEWCHAT_AX_NAME || '开启新对话'
const AX_ROLE = process.env.NEWCHAT_AX_ROLE || 'button'
const CDP_TIMEOUT_MS = parseInt(process.env.CDP_TIMEOUT_MS || '10000', 10)
const MAX_TOTAL_MS = parseInt(process.env.NEWCHAT_MAX_TOTAL_MS || '20000', 10)
const AX_TIMEOUT_MS = parseInt(process.env.NEWCHAT_AX_TIMEOUT_MS || '6000', 10)
const FRAME_TIMEOUT_MS = parseInt(process.env.NEWCHAT_FRAME_TIMEOUT_MS || '6000', 10)

async function j(path) {
  try {
    const r = await fetch(`${BASE}${path}`)
    if (!r.ok) {
      throw new Error(`HTTP error! status: ${r.status}`)
    }
    const text = await r.text()
    try {
      return JSON.parse(text)
    } catch (parseError) {
      console.error(`Failed to parse JSON response from ${BASE}${path}:`, text.substring(0, 200))
      throw new Error(`Invalid JSON response: ${parseError.message}`)
    }
  } catch (error) {
    console.error(`Error fetching ${BASE}${path}:`, error.message)
    throw error
  }
}

async function ensureTarget() {
  try {
    console.log(`Checking for existing DeepSeek tabs at ${BASE}/json/list`)
    const list = await j('/json/list')
    let t = list.find(x => x && x.type === 'page' && typeof x.url === 'string' && x.url.includes('chat.deepseek.com'))
    if (t) {
      console.log(`Found existing DeepSeek tab: ${t.title}`)
      return t
    }
    
    console.log(`No existing DeepSeek tab found, creating new one at ${TARGET_URL}`)
    const response = await fetch(`${BASE}/json/new?${encodeURIComponent(TARGET_URL)}`)
    if (!response.ok) {
      throw new Error(`Failed to create new tab: ${response.status}`)
    }
    const text = await response.text()
    try {
      const newTab = JSON.parse(text)
      console.log(`Created new DeepSeek tab: ${newTab.title || 'Untitled'}`)
      return newTab
    } catch (parseError) {
      console.error(`Failed to parse JSON response when creating new tab:`, text.substring(0, 200))
      throw new Error(`Invalid JSON response: ${parseError.message}`)
    }
  } catch (error) {
    console.error(`Error in ensureTarget: ${error.message}`)
    console.error(`Please ensure Chrome is running with remote debugging enabled on port 9222`)
    console.error(`You can start Chrome with: chrome --remote-debugging-port=9222`)
    throw error
  }
}

function cdp(ws) {
  let id = 0
  const map = new Map()
  ws.on('message', m => {
    try {
      const d = JSON.parse(m.toString())
      if (d && typeof d.id === 'number' && map.has(d.id)) {
        const { resolve, reject, tid } = map.get(d.id)
        map.delete(d.id)
        if (tid) clearTimeout(tid)
        if (d.error) reject(new Error(typeof d.error.message === 'string' ? d.error.message : 'cdp error'))
        else resolve(d)
      }
    } catch (e) {
      console.error('Error parsing CDP message:', e.message)
      console.error('Raw message:', m.toString())
    }
  })
  ws.on('error', err => {
    console.error('WebSocket error in CDP:', err.message)
    for (const [key, v] of map.entries()) {
      if (v.tid) clearTimeout(v.tid)
      v.reject(new Error('ws error'))
      map.delete(key)
    }
  })
  ws.on('close', () => {
    console.log('WebSocket connection closed')
    for (const [key, v] of map.entries()) {
      if (v.tid) clearTimeout(v.tid)
      v.reject(new Error('ws closed'))
      map.delete(key)
    }
  })
  return async (method, params, options) => {
    id += 1
    try {
      const message = JSON.stringify({ id, method, params })
      ws.send(message)
    } catch (error) {
      return Promise.reject(new Error(`Failed to send CDP message: ${error.message}`))
    }
    return await new Promise((resolve, reject) => {
      const to = options && typeof options.timeout === 'number' ? options.timeout : CDP_TIMEOUT_MS
      const tid = setTimeout(() => {
        if (map.has(id)) {
          map.delete(id)
          reject(new Error(`cdp timeout for ${method}`))
        }
      }, to)
      map.set(id, { resolve, reject, tid, method })
    })
  }
}

async function pickNode(call, backendIds) {
  let best = null
  for (const bid of backendIds) {
    const bm = await call('DOM.getBoxModel', { backendNodeId: bid })
    const q = bm?.model?.content || bm?.model?.border || bm?.model?.margin
    if (!q || q.length < 8) continue
    const xs = [q[0], q[2], q[4], q[6]]
    const ys = [q[1], q[3], q[5], q[7]]
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const width = Math.max(0, maxX - minX)
    const height = Math.max(0, maxY - minY)
    if (width < 1 || height < 1) continue
    const area = width * height
    const cx = (q[0] + q[2] + q[4] + q[6]) / 4
    const cy = (q[1] + q[3] + q[5] + q[7]) / 4
    if (!best || area > best.area) best = { bid, cx, cy, area }
  }
  if (!best) return null
  return { bid: best.bid, cx: Math.round(best.cx), cy: Math.round(best.cy) }
}

async function clickByAX(call) {
  const ax = await call('Accessibility.getFullAXTree', {}, { timeout: AX_TIMEOUT_MS })
  const nodes = ax?.nodes || []
  const cands = []
  for (const n of nodes) {
    const role = n?.role?.value || ''
    const name = n?.name?.value || ''
    const bid = n?.backendDOMNodeId
    const nid = n?.nodeId
    if (!(bid || nid)) continue
    if (name && name.includes(AX_NAME) && role === AX_ROLE) cands.push({ bid, nid })
  }
  const bids = cands.map(x => x.bid).filter(Boolean)
  const picked = bids.length ? await pickNode(call, bids) : null
  if (!picked) return { ok: false }
  try {
    const rn = await call('DOM.resolveNode', { backendNodeId: picked.bid })
    const oid = rn?.object?.objectId
    if (oid) {
      const txt = await call('Runtime.callFunctionOn', { objectId: oid, functionDeclaration: 'function(){ return (this.innerText||this.textContent||"") }', returnByValue: true })
      const val = txt?.result?.result?.value || ''
      if (val.includes(AX_NAME)) {
        await call('Runtime.callFunctionOn', { objectId: oid, functionDeclaration: 'function(){ this.scrollIntoView({block:"center",inline:"center"}); this.click() }', awaitPromise: true })
        return { ok: true, backendNodeId: picked.bid, x: picked.cx, y: picked.cy, via: 'callFunctionOn' }
      }
    }
  } catch {}
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: picked.cx, y: picked.cy, button: 'left', clickCount: 1 })
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: picked.cx, y: picked.cy, button: 'left', clickCount: 1 })
  return { ok: true, backendNodeId: picked.bid, x: picked.cx, y: picked.cy, via: 'dispatchMouseEvent' }
}

async function clickByDOM(call) {
  const expr = `(() => { const t = ${JSON.stringify(AX_NAME)}; const spans = Array.from(document.querySelectorAll('span')); let s = spans.find(x => ((x.textContent||'').trim())===t) || spans.find(x => ((x.textContent||'').trim()).includes(t)); if (!s) { const all = Array.from(document.querySelectorAll('*')); s = all.find(x => ((x.textContent||'').trim()).includes(t)) || null; } let el = s ? (s.closest('button,[role="button"],a[role="button"],div[role="button"]')||s) : null; if (!el) return { ok:false }; try { el.scrollIntoView({block:'center',inline:'center'}) } catch {} const r = el.getBoundingClientRect(); if (r.width<=0 || r.height<=0) return { ok:false }; const cx = r.left + r.width/2; const cy = r.top + r.height/2; try { el.click() } catch {} return { ok:true, x: Math.round(cx), y: Math.round(cy), via: 'runtime' } })()`
  const r = await call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  const v = r?.result?.result?.value
  if (!v || !v.ok) return { ok:false }
  return v
}

async function clickByFrames(call) {
  const ft = await call('Page.getFrameTree', {})
  const frames = []
  const stack = [ft?.frameTree].filter(Boolean)
  while (stack.length) {
    const n = stack.pop()
    if (n?.frame?.id) frames.push(n.frame.id)
    const ch = n?.childFrames || []
    for (const c of ch) stack.push(c)
  }
  for (const fid of frames) {
    try {
      const iw = await call('Page.createIsolatedWorld', { frameId: fid, worldName: 'newchat', grantUniveralAccess: true }, { timeout: FRAME_TIMEOUT_MS })
      const expr = `(() => { const t = ${JSON.stringify(AX_NAME)}; const spans = Array.from(document.querySelectorAll('span')); let s = spans.find(x => ((x.textContent||'').trim())===t) || spans.find(x => ((x.textContent||'').trim()).includes(t)); if (!s) { const all = Array.from(document.querySelectorAll('*')); s = all.find(x => ((x.textContent||'').trim()).includes(t)) || null; } let el = s ? (s.closest('button,[role="button"],a[role="button"],div[role="button"]')||s) : null; if (!el) return { ok:false }; try { el.scrollIntoView({block:'center',inline:'center'}) } catch {} const r = el.getBoundingClientRect(); if (r.width<=0 || r.height<=0) return { ok:false }; const cx = r.left + r.width/2; const cy = r.top + r.height/2; try { el.click() } catch {} return { ok:true, x: Math.round(cx), y: Math.round(cy), via: 'frame' } })()`
      const rv = await call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, contextId: iw?.executionContextId })
      const v = rv?.result?.result?.value
      if (v && v.ok) return v
    } catch {}
  }
  return { ok:false }
}

async function clickByAXQuery(call) {
  const doc = await call('DOM.getDocument', { depth: 0 })
  const nid = doc?.root?.nodeId
  if (!nid) return { ok:false }
  try {
    const q = await call('Accessibility.queryAXTree', { nodeId: nid, accessibleName: AX_NAME }, { timeout: AX_TIMEOUT_MS })
    const arr = q?.nodes || []
    const filtered = arr.filter(n => (n?.role?.value || '') === AX_ROLE)
    const bids = filtered.map(n => n.backendDOMNodeId || null).filter(Boolean)
    if (bids.length === 0) return { ok:false }
    const picked = await pickNode(call, bids)
    if (!picked) return { ok:false }
    try {
      const rn = await call('DOM.resolveNode', { backendNodeId: picked.bid })
      const oid = rn?.object?.objectId
      if (oid) {
        await call('Runtime.callFunctionOn', { objectId: oid, functionDeclaration: 'function(){ this.scrollIntoView({block:"center",inline:"center"}); this.click() }', awaitPromise: true })
        return { ok:true, backendNodeId: picked.bid, x: picked.cx, y: picked.cy, via: 'axQuery' }
      }
    } catch {}
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: picked.cx, y: picked.cy, button: 'left', clickCount: 1 })
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: picked.cx, y: picked.cy, button: 'left', clickCount: 1 })
    return { ok:true, backendNodeId: picked.bid, x: picked.cx, y: picked.cy, via: 'axQueryDispatch' }
  } catch {
    return { ok:false }
  }
}

async function verifyNewChat(call) {
  const expr = `(() => {
    const qs = ['textarea','[contenteditable="true"]','[role="textbox"]','input[type="text"]','.ProseMirror']
    let el = null
    for (const q of qs){ const e = document.querySelector(q); if (e) { el = e; break } }
    if (!el) return { ok:false }
    const tag = (el.tagName||'').toLowerCase()
    const editable = tag==='textarea' || (tag==='input' && el.type==='text') || !!el.isContentEditable
    const val = (el.value!==undefined ? el.value : (el.textContent||'')).trim()
    const ph = el.getAttribute('placeholder') || ''
    const phMatch = /输入|消息|message|chat|send/i.test(ph)
    if (editable && val.length===0 && phMatch) return { ok:true, via:'verify' }
    return { ok:false }
  })()`
  const r = await call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  return r?.result?.result?.value || { ok:false }
}

async function main() {
  try {
    console.log('Starting DeepSeek new chat opener...')
    const t = await ensureTarget()
    console.log(`Connecting to WebSocket: ${t.webSocketDebuggerUrl}`)
    
    const ws = new WebSocket(t.webSocketDebuggerUrl)
    ws.on('error', (error) => {
      console.error('WebSocket error:', error.message)
      process.exit(1)
    })
    
    await new Promise(res => ws.once('open', res))
    console.log('WebSocket connected successfully')
    
    const call = cdp(ws)
    console.log('Enabling CDP domains...')
    await call('Runtime.enable', {})
    await call('DOM.enable', {})
    await call('Accessibility.enable', {})
    await call('Page.enable', {})
    await call('Page.bringToFront', {})

    // try {
    //   const loc = await call('Runtime.evaluate', { expression: 'location.hostname', returnByValue: true })
    //   const host = loc?.result?.result?.value || ''
    //   if (typeof host !== 'string' || !host.includes('chat.deepseek.com')) {
    //     console.log(`Navigating to ${TARGET_URL}...`)
    //     await call('Page.navigate', { url: TARGET_URL })
    //   }
    // } catch (e) {
    //   console.log('Error checking hostname, navigating to target URL:', e.message)
    //   await call('Page.navigate', { url: TARGET_URL })
    // }
    
    // console.log('Waiting for page to load...')
    // let contextId = null
    // try {
    //   const ft = await call('Page.getFrameTree', {})
    //   const fid = ft?.frameTree?.frame?.id
    //   if (fid) {
    //     const iw = await call('Page.createIsolatedWorld', { frameId: fid, worldName: 'main', grantUniveralAccess: true })
    //     contextId = iw?.executionContextId || null
    //   }
    // } catch {}
    // for (let i=0;i<20;i++){ 
    //   const st = await call('Runtime.evaluate',{ expression:'document.readyState', returnByValue:true, ...(contextId?{ contextId }:{}) }); 
    //   if (st?.result?.result?.value==='complete') {
    //     console.log('Page loaded successfully')
    //     break
    //   } else {
    //     console.log(`Page readyState: ${st?.result?.result?.value}`)
    //   }
    //   await new Promise(r=>setTimeout(r,250))
    // }

    let r = { ok:false }
    const start = Date.now()
    console.log('Attempting to click "开启新对话" button...')
    
    for (let attempt=0; attempt<5 && !r.ok; attempt++) {
      console.log(`Attempt ${attempt + 1}/5`)
      r = await clickByAXQuery(call)
      if (!r.ok) r = await clickByAX(call)
      if (!r.ok) r = await clickByDOM(call)
      if (!r.ok) r = await clickByFrames(call)
      if (!r.ok) await new Promise(rs => setTimeout(rs, 500))
      if (Date.now() - start > MAX_TOTAL_MS) {
        console.log('Timeout reached')
        break
      }
    }
    
    if (!r.ok) {
      console.log('Verifying if new chat is already open...')
      const v = await verifyNewChat(call)
      if (v && v.ok) r = v
    }
    
    if (!r.ok && r.x!==undefined && r.y!==undefined) {
      console.log('Using fallback click method...')
      await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 })
      await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 })
      r = { ok: true, x: r.x, y: r.y, via: 'fallback' }
    }
    
    console.log('Result:', r)
    ws.close()
    setTimeout(() => { process.exit(0) }, 100)
  } catch (error) {
    console.error('Error in main function:', error.message)
    console.error('Please ensure Chrome is running with remote debugging enabled on port 9222')
    console.error('You can start Chrome with: chrome --remote-debugging-port=9222')
    process.exit(1)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
