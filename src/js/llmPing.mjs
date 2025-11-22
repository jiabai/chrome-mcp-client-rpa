import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// 加载环境变量
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.join(__dirname, '..', '.env')
console.log(`正在加载环境变量文件: ${envPath}`)
const envResult = dotenv.config({ path: envPath })
if (envResult.error) {
  console.warn(`环境变量文件加载失败: ${envResult.error.message}`)
}

// 调试输出环境变量
console.log('Environment variables loaded')
console.log('- API Key:', process.env.SILICONFLOW_API_KEY ? 'Set' : 'Not set')
console.log('- Model:', process.env.MODEL_NAME)
console.log('- Base URL:', process.env.LLM_BASE_URL)

// OpenAI客户端配置
const OPENAI_CONFIG = {
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: process.env.LLM_BASE_URL || 'https://api.siliconflow.cn/v1',
  maxRetries: parseInt(process.env.LLM_MAX_RETRIES) || 2,
  timeout: parseInt(process.env.LLM_TIMEOUT) || 30000,
  model: process.env.MODEL_NAME || 'deepseek-ai/DeepSeek-V3.2-Exp',
  maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || 2000,
  htmlMaxChars: parseInt(process.env.HTML_MAX_CHARS) || 200000
}

/**
 * 创建OpenAI客户端
 */
async function createOpenAIClient() {
  try {
    const { OpenAI } = await import('openai')
    
    const client = new OpenAI({
      apiKey: OPENAI_CONFIG.apiKey,
      baseURL: OPENAI_CONFIG.baseURL,
      maxRetries: OPENAI_CONFIG.maxRetries,
      timeout: OPENAI_CONFIG.timeout
    })
    
    console.log('OpenAI客户端创建成功')
    console.log(`使用模型: ${OPENAI_CONFIG.model}`)
    console.log(`基础URL: ${OPENAI_CONFIG.baseURL}`)
    
    return client
  } catch (error) {
    console.error('创建OpenAI客户端失败:', error.message)
    throw error
  }
}

async function pingLLM(client, model) {
  try {
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        { role: 'user', content: '你好' }
      ],
      max_tokens: 50,
      temperature: 0
    });
    if (!response || !Array.isArray(response.choices) || response.choices.length === 0 || !response.choices[0]?.message?.content) {
      throw new Error('LLM响应不包含有效的choices或内容');
    }
    return response.choices[0].message.content;
  } catch (error) {
    console.error('LLM连通性测试失败:', error.message);
    throw error;
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('LLM PING')
  console.log('='.repeat(60))
  try {
    const client = await createOpenAIClient()
    const model = process.env.MODEL_NAME || 'deepseek-ai/DeepSeek-V3.2-Exp'
    console.log('\nPinging LLM...')
    const pong = await pingLLM(client, model)
    console.log('\n=== LLM Ping Result ===')
    console.log(pong)
    console.log('========================\n')
    console.log('PING COMPLETED')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ ERROR:', error.message)
    console.error('Stack:', error.stack)
    process.exit(1)
  }
}

const argv1 = process.argv[1] || ''
const isMainModule = argv1
  ? (import.meta.url === `file://${argv1}` ||
     import.meta.url === `file:///${argv1.replace(/\\/g, '/')}` ||
     argv1 === fileURLToPath(import.meta.url))
  : false

if (isMainModule) {
  main().catch((error) => {
    console.error('程序执行失败:', error)
    process.exit(1)
  })
}