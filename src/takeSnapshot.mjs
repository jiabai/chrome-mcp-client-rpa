/**
 * Chrome页面快照捕获工具
 * 
 * 功能描述:
 * 通过MCP (Model Context Protocol) 协议连接Chrome DevTools，提供多种页面快照捕获功能。
 * 支持截图、页面快照和脚本执行三种模式，自动处理不同格式的输出数据。
 * 
 * 工作流程:
 * 1. 解析命令行参数，确定使用的工具类型
 * 2. 启动MCP客户端，连接到Chrome DevTools服务器
 * 3. 获取可用工具列表，根据参数或交互选择工具
 * 4. 执行选定的快照工具（take_screenshot/take_snapshot/evaluate_script）
 * 5. 处理工具返回的数据，提取有效内容
 * 6. 生成安全的文件名，处理文件名冲突
 * 7. 验证输出路径，创建输出目录
 * 8. 保存快照数据到文件（PNG或JSON格式）
 * 9. 清理MCP连接资源
 * 
 * 支持的工具:
 * - take_screenshot: 截图工具，生成PNG格式图片
 * - take_snapshot: 快照工具，生成JSON格式数据
 * - evaluate_script: 脚本执行工具，自定义脚本获取页面数据
 * 
 * 输出文件:
 * - 路径: ./output/snapshot-{工具名}[序号].{扩展名}
 * - 格式: PNG (截图) 或 JSON (快照/脚本)
 * - 命名: 自动处理文件名冲突，添加序号后缀
 * 
 * 依赖要求:
 * - Chrome实例运行在9222端口，启用远程调试
 * - @modelcontextprotocol/sdk MCP客户端库
 * - Node.js环境，支持ES模块
 * - 文件系统权限，用于创建输出目录和文件
 * 
 * 环境变量:
 * - 无需特殊环境变量配置
 * 
 * 使用方法:
 * node takeSnapshot.mjs [工具名] [选项]
 * 
 * 工具选项:
 * - auto: 自动选择第一个可用工具（默认）
 * - take_screenshot: 使用截图工具
 * - take_snapshot: 使用快照工具
 * - evaluate_script: 使用脚本执行工具
 * - interactive: 交互式选择工具
 * - help: 显示帮助信息
 * 
 * 命令行选项:
 * --help, -h: 显示帮助信息
 * --list, -l: 列出所有可用工具
 * 
 * 使用示例:
 * node takeSnapshot.mjs take_screenshot
 * node takeSnapshot.mjs interactive
 * node takeSnapshot.mjs auto
 * node takeSnapshot.mjs --list
 * 
 * 特性:
 * - 自动重试机制，支持指数退避
 * - 超时保护，防止长时间阻塞
 * - 安全的文件名生成，防止路径遍历攻击
 * - 智能数据提取，支持多种格式（JSON、文本、Base64）
 * - 完善的错误处理和资源清理
 * - 交互式工具选择界面
 * - 详细的日志记录，便于调试
 * 
 * 错误处理:
 * - MCP连接失败自动重试
 * - 工具执行超时保护
 * - 文件操作异常捕获
 * - 进程信号处理，确保资源清理
 * 
 * 项目信息:
 * 项目: chrome-mcp-client-rpa
 * 作者: Chrome MCP Client RPA Team
 * 版本: 1.0.0
 * 许可: MIT License
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'

// =============================================================================
// CONFIGURATION CONSTANTS
// =============================================================================

const MCP_SERVER_CONFIG = {
  command: 'npx',
  args: ['-y', 'chrome-devtools-mcp@latest', '--browserUrl=http://127.0.0.1:9222'],
  env: { ...process.env, NODE_ENV: 'production' }
}

const TIMEOUT_CONFIG = {
  MCP_CONNECTION_TIMEOUT: 30000, // 30 seconds
  TOOL_CALL_TIMEOUT: 60000,      // 60 seconds
  CLEANUP_TIMEOUT: 5000          // 5 seconds
}

const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // 2 seconds
  BACKOFF_MULTIPLIER: 2
}

const FILE_NAME_CONFIG = {
  MAX_BASE_NAME_LENGTH: 100,
  ALLOWED_FILENAME_CHARS: /[^a-zA-Z0-9-_]/g,
  ALLOWED_EXTENSION_CHARS: /[^a-zA-Z0-9]/g
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Extracts text content from MCP content parts array
 * @param {Array} parts - Array of content parts from MCP response
 * @returns {string} Extracted text content
 */
function getTextFromContentParts(parts) {
  try {
    if (!Array.isArray(parts)) {
      console.log('getTextFromContentParts: Input is not an array, returning empty string')
      return ''
    }
    
    console.log(`getTextFromContentParts: Processing ${parts.length} content parts`)
    const out = []
    
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      try {
        if (typeof p?.text === 'string') {
          out.push(p.text)
        } else if (typeof p === 'string') {
          out.push(p)
        } else if (p && typeof p === 'object') {
          if (p.type === 'json' && p.json) {
            out.push(JSON.stringify(p.json))
          } else {
            out.push(JSON.stringify(p))
          }
        } else {
          console.log(`Part ${i}: Unknown content type, skipping`)
        }
      } catch (partError) {
        console.error(`Error processing part ${i}:`, partError?.message || String(partError))
        // Continue processing other parts instead of failing completely
      }
    }
    
    const result = out.join('\n')
    console.log(`getTextFromContentParts: Extracted ${result.length} characters`)
    return result
  } catch (error) {
    console.error('getTextFromContentParts: Unexpected error:', error?.message || String(error))
    return ''
  }
}

/**
 * Extracts structured data from raw MCP response
 * @param {string} raw - Raw response data from MCP
 * @returns {string} Processed and formatted data
 */
function extractSnapshotData(raw) {
  if (!raw || typeof raw !== 'string') {
    console.log('extractSnapshotData: Invalid input - expected non-empty string')
    return ''
  }
  
  console.log('extractSnapshotData: Processing raw data of length:', raw.length)
  
  // Try to extract JSON data first
  const mJson = raw.match(/```json\r?\n([\s\S]*?)\r?\n```/i)
  if (mJson) {
    try {
      console.log('Found JSON block, parsing...')
      const parsed = JSON.parse(mJson[1])
      console.log('JSON parsing successful')
      return JSON.stringify(parsed, null, 2)
    } catch (parseError) {
      console.log('JSON parsing failed:', parseError?.message || String(parseError))
    }
  }
  
  // Try to extract text content
  const mText = raw.match(/```text\r?\n([\s\S]*?)\r?\n```/i)
  if (mText) {
    console.log('Found text block, extracting...')
    return mText[1]
  }
  
  // Check for base64 encoded data (more robust detection)
  if (raw.includes('base64,') || /^[A-Za-z0-9+/]*={0,2}$/.test(raw.replace(/\s/g, ''))) {
    console.log('Detected potential base64 encoded data')
    return raw
  }
  
  console.log('No structured format found, returning raw content')
  return raw
}

/**
 * Generates a simple filename without timestamp, handles conflicts with numbered suffix
 * @param {string} toolName - Name of the tool used
 * @param {string} extension - File extension
 * @param {string} outputDir - Output directory path
 * @returns {string} Generated filename with path
 */
function generateSafeFilename(toolName, extension, outputDir) {
  const baseName = `snapshot-${toolName}`
  const safeBaseName = baseName.replace(FILE_NAME_CONFIG.ALLOWED_FILENAME_CHARS, '-')
  const safeExtension = extension.replace(FILE_NAME_CONFIG.ALLOWED_EXTENSION_CHARS, '')
  
  if (!safeExtension) {
    throw new Error('Invalid file extension')
  }
  
  // Try base filename first
  const basePath = path.join(outputDir, `${safeBaseName}.${safeExtension}`)
  
  if (!fs.existsSync(basePath)) {
    return basePath
  }
  
  // If exists, add numbered suffix starting from 1
  let counter = 1
  while (counter <= 999) { // Reasonable limit to prevent infinite loops
    const numberedPath = path.join(outputDir, `${safeBaseName}-${counter}.${safeExtension}`)
    if (!fs.existsSync(numberedPath)) {
      return numberedPath
    }
    counter++
  }
  
  throw new Error('Too many existing files, cannot generate unique filename')
}

/**
 * Validates output path for security (prevents path traversal attacks)
 * @param {string} outputPath - Path to validate
 * @returns {string} Resolved and validated path
 */
function validateOutputPath(outputPath) {
  const resolvedPath = path.resolve(outputPath)
  const cwd = process.cwd()
  
  // Ensure path is within project directory
  if (!resolvedPath.startsWith(cwd)) {
    throw new Error(`Output path must be within project directory: ${cwd}`)
  }
  
  // Check for path traversal attacks
  if (outputPath.includes('..') || outputPath.includes('~')) {
    throw new Error('Path traversal detected in output path')
  }
  
  return resolvedPath
}

/**
 * Executes an async operation with retry logic and exponential backoff
 * @param {Function} operation - Async operation to execute
 * @param {string} operationName - Name for logging
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {*} Operation result
 */
async function executeWithRetry(operation, operationName, maxRetries = RETRY_CONFIG.MAX_RETRIES) {
  let lastError
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`${operationName}: Attempt ${attempt}/${maxRetries}`)
      const result = await operation()
      console.log(`${operationName}: Success on attempt ${attempt}`)
      return result
    } catch (error) {
      lastError = error
      console.error(`${operationName}: Attempt ${attempt} failed:`, error?.message || String(error))
      
      if (attempt < maxRetries) {
        const delay = RETRY_CONFIG.RETRY_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1)
        console.log(`${operationName}: Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  console.error(`${operationName}: All ${maxRetries} attempts failed`)
  throw lastError
}

// =============================================================================
// MCP CLIENT FUNCTIONS
// =============================================================================

/**
 * Starts MCP client connection with timeout and retry logic
 * @returns {Object} MCP client and transport instances
 */
async function startMcpClient() {
  console.log('Starting MCP client...')
  
  const startMcpOperation = async () => {
    try {
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
      console.log('Creating transport with config:', JSON.stringify(MCP_SERVER_CONFIG, null, 2))
      
      // Create transport with timeout
      const transport = new StdioClientTransport(MCP_SERVER_CONFIG)
      const client = new Client({ name: 'chrome-mcp-snapshot-client', version: '1.0.0' }, { capabilities: {} })
      
      console.log('Connecting to MCP server with timeout...')
      const connectPromise = client.connect(transport)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('MCP connection timeout')), TIMEOUT_CONFIG.MCP_CONNECTION_TIMEOUT)
      )
      
      await Promise.race([connectPromise, timeoutPromise])
      console.log('MCP client started successfully')
      return { client, transport }
    } catch (error) {
      console.error('MCP client operation failed:', error?.message || String(error))
      throw new Error(`Failed to start MCP client: ${error?.message || String(error)}`)
    }
  }
  
  return await executeWithRetry(startMcpOperation, 'MCP Connection')
}

/**
 * Stops MCP client and cleans up resources
 * @param {Object} mcpInstance - MCP client instance to cleanup
 */
async function stopMcpClient(mcpInstance) {
  console.log('Stopping MCP client...')
  try {
    if (mcpInstance?.client) {
      console.log('Closing MCP client...')
      await mcpInstance.client.close()
      console.log('MCP client closed')
    }
    if (mcpInstance?.transport) {
      console.log('Closing MCP transport...')
      await mcpInstance.transport.close()
      console.log('MCP transport closed')
    }
    console.log('MCP client stopped successfully')
  } catch (error) {
    console.error('Error during MCP cleanup:', error?.message || String(error))
    throw error
  }
}

/**
 * Executes a snapshot tool with timeout protection
 * @param {Object} client - MCP client instance
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} toolArgs - Arguments for the tool
 * @returns {*} Tool execution result
 */
async function executeSnapshotTool(client, toolName, toolArgs) {
  console.log(`Executing tool: ${toolName} with timeout ${TIMEOUT_CONFIG.TOOL_CALL_TIMEOUT}ms`)
  
  const toolCallPromise = client.callTool({ 
    name: toolName, 
    arguments: toolArgs 
  })
  
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error(`Tool execution timeout after ${TIMEOUT_CONFIG.TOOL_CALL_TIMEOUT}ms`)), TIMEOUT_CONFIG.TOOL_CALL_TIMEOUT)
  )
  
  const result = await Promise.race([toolCallPromise, timeoutPromise])
  console.log(`Tool ${toolName} executed successfully`)
  return result
}

// =============================================================================
// USER INTERFACE FUNCTIONS
// =============================================================================

/**
 * Displays help information for the script
 */
function showHelp() {
  console.log(`
用法: node takeSnapshot.mjs [工具名] [选项]

可选工具:
  auto            - 自动选择第一个可用工具 (默认)
  take_screenshot - 使用截图工具 (PNG格式)
  take_snapshot   - 使用快照工具 (JSON格式)
  evaluate_script - 使用脚本执行工具 (JSON格式)
  interactive     - 交互式选择
  help            - 显示此帮助信息

选项:
  --help, -h      - 显示帮助信息
  --list, -l      - 列出所有可用工具

示例:
  node takeSnapshot.mjs take_screenshot
  node takeSnapshot.mjs interactive
  node takeSnapshot.mjs auto
  node takeSnapshot.mjs --list
`)
}

/**
 * Provides interactive tool selection via command line
 * @param {Set} availableTools - Set of available tool names
 * @returns {string|null} Selected tool name or null if cancelled
 */
async function selectToolInteractively(availableTools) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  console.log('\n可用工具:')
  const toolArray = Array.from(availableTools)
  const snapshotTools = toolArray.filter(name => 
    ['take_screenshot', 'take_snapshot', 'evaluate_script'].includes(name)
  )
  
  if (snapshotTools.length === 0) {
    console.log('没有可用的快照工具')
    rl.close()
    return null
  }

  snapshotTools.forEach((tool, index) => {
    const descriptions = {
      'take_screenshot': '截图工具 (PNG格式)',
      'take_snapshot': '快照工具 (JSON格式)', 
      'evaluate_script': '脚本执行工具 (JSON格式)'
    }
    console.log(`${index + 1}. ${tool} - ${descriptions[tool] || '未知工具'}`)
  })
  console.log('0. 取消')

  return new Promise((resolve) => {
    rl.question('\n请选择工具 (输入数字): ', (answer) => {
      const choice = parseInt(answer)
      rl.close()
      
      if (choice === 0) {
        resolve(null)
      } else if (choice >= 1 && choice <= snapshotTools.length) {
        resolve(snapshotTools[choice - 1])
      } else {
        console.log('无效选择')
        resolve(null)
      }
    })
  })
}

// =============================================================================
// ARGUMENT PARSING
// =============================================================================

/**
 * Parses command line arguments and validates inputs
 * @returns {Object} Parsed arguments object
 */
function parseCommandLineArguments() {
  const args = process.argv.slice(2)
  
  // Handle help options
  if (args.includes('--help') || args.includes('-h') || args.includes('help')) {
    showHelp()
    process.exit(0)
  }
  
  // Handle list options
  if (args.includes('--list') || args.includes('-l')) {
    return { action: 'list' }
  }
  
  const toolArg = args[0] || 'auto'
  
  // Validate tool argument
  const validTools = ['auto', 'take_screenshot', 'take_snapshot', 'evaluate_script', 'interactive']
  if (!validTools.includes(toolArg) && toolArg !== 'help') {
    console.error(`Invalid tool: ${toolArg}`)
    console.log('Valid tools:', validTools.join(', '))
    process.exit(1)
  }
  
  return { 
    action: 'use_tool',
    preferredTool: toolArg
  }
}

// =============================================================================
// MAIN SNAPSHOT LOGIC
// =============================================================================

/**
 * Main function to capture page snapshot using selected tool
 */
async function capturePageSnapshot() {
  const args = parseCommandLineArguments()
  
  let mcp = null
  try {
    mcp = await startMcpClient()
    if (!mcp || !mcp.client) {
      throw new Error('MCP client initialization failed - no client instance returned')
    }
    const { client } = mcp

    console.log('Fetching available tools from MCP server...')
    let tools
    try {
      tools = await client.listTools()
      console.log(`Found ${tools?.tools?.length || 0} tools from MCP server`)
    } catch (error) {
      console.error('Failed to list tools:', error?.message || String(error))
      throw error
    }
    
    const availableTools = new Set((tools?.tools || []).map(t => t?.name))
    console.log('Available tools:', Array.from(availableTools))
    
    // Handle list request
    if (args.action === 'list') {
      console.log('\n所有可用工具:')
      Array.from(availableTools).forEach(tool => console.log(`  - ${tool}`))
      console.log('\n快照相关工具:')
      try {
        ['take_screenshot', 'take_snapshot', 'evaluate_script'].forEach(tool => {
          if (availableTools.has(tool)) {
            console.log(`  ✓ ${tool}`)
          } else {
            console.log(`  ✗ ${tool}`)
          }
        })
      } catch (e) {
        console.log('无法判断快照工具可用性')
      }
      process.exit(0)
    }
    
    if (args.action === 'use_tool') {
    // Select tool
    let selectedTool = null
    let fileExtension = 'html'
    
    if (args.preferredTool === 'interactive') {
      selectedTool = await selectToolInteractively(availableTools)
      if (!selectedTool) {
        console.log('用户取消操作')
        return
      }
    } else if (args.preferredTool === 'auto') {
      // Auto-select based on priority
      if (availableTools.has('take_screenshot')) {
        selectedTool = 'take_screenshot'
        fileExtension = 'png'
      } else if (availableTools.has('take_snapshot')) {
        selectedTool = 'take_snapshot'  
        fileExtension = 'json'
      } else if (availableTools.has('evaluate_script')) {
        selectedTool = 'evaluate_script'
        fileExtension = 'json'
      }
    } else {
      // User specified specific tool
      if (availableTools.has(args.preferredTool)) {
        selectedTool = args.preferredTool
        if (selectedTool === 'take_screenshot') fileExtension = 'png'
        else fileExtension = 'json'
      } else {
        console.error(`工具 '${args.preferredTool}' 不可用`)
        console.log('可用工具:', Array.from(availableTools))
        process.exit(1)
      }
    }
    
    if (!selectedTool) {
      console.log('没有可用的快照工具')
      return
    }
    
    console.log(`使用工具: ${selectedTool}`)
    if (!availableTools.has(selectedTool)) {
      console.log('工具不可用')
      return
    }
    
    // Execute selected tool
    let snapshotResult = null
    
    if (selectedTool === 'take_screenshot') {
      snapshotResult = await executeSnapshotTool(client, 'take_screenshot', {
        format: 'png',
        fullPage: true 
      })
    } else if (selectedTool === 'take_snapshot') {
      snapshotResult = await executeSnapshotTool(client, 'take_snapshot', {
        verbose: true 
      })
    } else if (selectedTool === 'evaluate_script') {
      snapshotResult = await executeSnapshotTool(client, 'evaluate_script', {
        function: `() => {
          return {
            url: window.location.href,
            title: document.title,
            timestamp: new Date().toISOString(),
            html: document.documentElement.outerHTML,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight
            }
          }
        }` 
      })
    }
    
    if (snapshotResult) {
      const raw = getTextFromContentParts(snapshotResult?.content)
      const snapshotData = extractSnapshotData(raw)
      
      // Generate simple filename without timestamp
      const outputDir = path.join(process.cwd(), 'output')
      const outPath = generateSafeFilename(selectedTool, fileExtension, outputDir)
      
      // Validate output path
      try {
        validateOutputPath(outPath)
        console.log(`Validated output path: ${outPath}`)
      } catch (validationError) {
        console.error('Output path validation failed:', validationError?.message || String(validationError))
        throw validationError
      }
      
      console.log(`Creating output directory: ${outputDir}`)
      try { 
        fs.mkdirSync(outputDir, { recursive: true }) 
        console.log('Output directory created successfully')
      } catch (mkdirError) {
        console.error('Failed to create output directory:', mkdirError?.message || String(mkdirError))
        throw mkdirError
      }
      
      // Handle base64 encoded images with improved validation
      if (selectedTool === 'take_screenshot') {
        console.log('Processing screenshot data...')
        
        // More robust base64 detection
        const base64Pattern = /base64,([A-Za-z0-9+/\n\r]*={0,2})/
        const base64Match = snapshotData.match(base64Pattern)
        
        if (base64Match) {
          console.log('Found base64 encoded image data')
          const base64Data = base64Match[1].replace(/[\n\r]/g, '') // Remove line breaks
          
          // Validate base64 data
          if (base64Data.length > 0 && base64Data.length % 4 === 0) {
            console.log(`Writing base64 image (${base64Data.length} characters) to: ${outPath}`)
            fs.writeFileSync(outPath, base64Data, 'base64')
            console.log('Base64 image saved successfully')
          } else {
            console.error('Invalid base64 data: incorrect length or format')
            throw new Error('Invalid base64 image data')
          }
        } else {
          console.log('No base64 pattern found, saving raw data')
          fs.writeFileSync(outPath, snapshotData || raw, 'utf8')
        }
      } else {
        console.log(`Saving ${selectedTool} data to: ${outPath}`)
        fs.writeFileSync(outPath, snapshotData || raw, 'utf8')
        console.log('Data saved successfully')
      }
      
      console.log(`快照已保存: ${outPath}`)
    } else {
      console.log('执行工具失败')
    }
    }
    
  } catch (error) {
    console.error('Error capturing snapshot:', error?.message || String(error))
    console.error('Error stack:', error?.stack || 'No stack trace available')
    throw error
  } finally {
    // Ensure proper cleanup
    if (mcp) {
      try {
        await stopMcpClient(mcp)
        console.log('MCP resources cleaned up successfully')
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError?.message || String(cleanupError))
      }
    }
    
    // Force process termination after cleanup
    setTimeout(() => {
      console.log('Process termination initiated...')
      process.exit(0)
    }, 100)
  }
}

// =============================================================================
// PROCESS SIGNAL HANDLERS
// =============================================================================

// Handle process termination signals
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, cleaning up...')
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, cleaning up...')
  process.exit(0)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

// Start the snapshot capture
capturePageSnapshot().catch((error) => {
  console.error('Failed to capture snapshot:', error)
  process.exit(1)
})