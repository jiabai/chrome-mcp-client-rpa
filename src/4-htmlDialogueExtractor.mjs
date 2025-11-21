/**
 * HTML对话内容提取工具
 * 
 * 功能说明：
 * - 从HTML文件中提取问答对话内容（用户问题与AI回答）
 * - 使用LLM（大语言模型）智能识别和解析HTML中的对话结构
 * - 支持大型HTML文件的分批处理，避免超出模型输入限制
 * - 提取结果以结构化格式保存，便于后续处理和分析
 * 
 * 工作流程：
 * 1. 加载环境变量配置（API密钥、模型设置等）
 * 2. 创建OpenAI兼容的客户端连接
 * 3. 读取HTML文件（默认为output/page-captured.html）
 * 4. 使用LLM分析HTML内容，提取问答对话
 * 5. 保存提取结果到文件（默认为output/extracted-dialogue.txt）
 * 
 * 依赖要求：
 * - OpenAI兼容的API服务（默认使用SiliconFlow）
 * - 环境变量配置文件（.env）
 * - Node.js环境（ES模块支持）
 * - 已生成的HTML文件（通常由1-exportDeepSeekDom.mjs生成）
 * 
 * 配置参数（环境变量）：
 * - SILICONFLOW_API_KEY: API访问密钥（必需）
 * - LLM_BASE_URL: API服务地址（默认: https://api.siliconflow.cn/v1）
 * - MODEL_NAME: 使用的模型名称（默认: deepseek-ai/DeepSeek-V3.2-Exp）
 * - LLM_MAX_RETRIES: API请求最大重试次数（默认: 2）
 * - LLM_TIMEOUT: API请求超时时间（毫秒，默认: 30000）
 * - LLM_MAX_TOKENS: 最大输出令牌数（默认: 2000）
 * - HTML_MAX_CHARS: HTML内容处理最大字符数（默认: 200000）
 * 
 * 输出文件：
 * - 格式：文本文件
 * - 路径：./output/extracted-dialogue.txt
 * - 内容：提取的问答对话、元数据和处理统计信息
 * 
 * 使用场景：
 * - 从网页聊天记录中提取问答内容
 * - AI对话内容的结构化处理
 * - 聊天机器人交互记录分析
 * - 知识库构建和问答对提取
 * 
 * 作者：Chrome MCP Client RPA Tool
 * 版本：1.0.0
 * 创建时间：2024
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// 加载环境变量
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');
console.log(`正在加载环境变量文件: ${envPath}`);
const envResult = dotenv.config({ path: envPath });
if (envResult.error) {
  console.warn(`环境变量文件加载失败: ${envResult.error.message}`);
}

// 调试输出环境变量
console.log('Environment variables loaded');
console.log('- API Key:', process.env.SILICONFLOW_API_KEY ? 'Set' : 'Not set');
console.log('- Model:', process.env.MODEL_NAME);
console.log('- Base URL:', process.env.LLM_BASE_URL);

// OpenAI客户端配置
const OPENAI_CONFIG = {
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: process.env.LLM_BASE_URL || 'https://api.siliconflow.cn/v1',
  maxRetries: parseInt(process.env.LLM_MAX_RETRIES) || 2,
  timeout: parseInt(process.env.LLM_TIMEOUT) || 30000,
  model: process.env.MODEL_NAME || 'deepseek-ai/DeepSeek-V3.2-Exp',
  maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || 2000,
  htmlMaxChars: parseInt(process.env.HTML_MAX_CHARS) || 200000
};

/**
 * 创建OpenAI客户端
 */
async function createOpenAIClient() {
  try {
    const { OpenAI } = await import('openai');
    
    const client = new OpenAI({
      apiKey: OPENAI_CONFIG.apiKey,
      baseURL: OPENAI_CONFIG.baseURL,
      maxRetries: OPENAI_CONFIG.maxRetries,
      timeout: OPENAI_CONFIG.timeout
    });
    
    console.log('OpenAI客户端创建成功');
    console.log(`使用模型: ${OPENAI_CONFIG.model}`);
    console.log(`基础URL: ${OPENAI_CONFIG.baseURL}`);
    
    return client;
  } catch (error) {
    console.error('创建OpenAI客户端失败:', error.message);
    throw error;
  }
}

/**
 * 读取HTML文件
 */
function readHtmlFile(filePath) {
  try {
    const absolutePath = path.resolve(filePath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    console.log(`成功读取文件: ${absolutePath}`);
    console.log(`文件大小: ${content.length} 字符`);
    return content;
  } catch (error) {
    console.error('读取HTML文件失败:', error.message);
    throw error;
  }
}

/**
 * 提取问答对话信息
 */
async function extractQADialogue(htmlContent, client) {
  // 如果HTML内容超过限制，分批处理
  if (htmlContent.length > OPENAI_CONFIG.htmlMaxChars) {
    console.log(`HTML内容较大 (${htmlContent.length} 字符)，将分批处理...`);
    return await extractQADialogueInBatches(htmlContent, client);
  }
  
  const prompt = `请从以下HTML文件中提取问答对话信息，并打印出来。请识别出用户的问题和AI的回答，以清晰的格式展示对话内容。

HTML内容：
${htmlContent}

请按以下格式输出：
用户: [用户的问题]
AI: [AI的回答]

请提取所有完整的问答对话对。`;

  try {
    console.log('正在发送请求到LLM...');
    console.log(`使用超时设置: ${OPENAI_CONFIG.timeout}ms`);
    
    // 添加请求超时处理
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`请求超时 (${OPENAI_CONFIG.timeout}ms)`)), OPENAI_CONFIG.timeout);
    });
    
    // 创建API请求
    const apiRequest = client.chat.completions.create({
      model: OPENAI_CONFIG.model,
      messages: [
        {
          role: 'system',
          content: '你是一个专业的HTML内容分析助手，擅长从HTML文件中提取对话信息。请准确识别用户问题和AI回答，并以清晰的格式展示。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: OPENAI_CONFIG.maxTokens,
      temperature: 0.3
    });
    
    // 使用Promise.race来处理超时
    const response = await Promise.race([apiRequest, timeoutPromise]);

    if (!response || !Array.isArray(response.choices) || response.choices.length === 0 || !response.choices[0]?.message?.content) {
      throw new Error('LLM响应不包含有效的choices或内容');
    }
    const result = response.choices[0].message.content;
    const tokenUsage = response.usage?.total_tokens || 'N/A';
    
    console.log('\n=== 提取的问答对话信息 ===');
    console.log(result);
    console.log('========================\n');
    console.log(`Token使用情况: ${tokenUsage}`);
    
    return {
      content: result,
      tokenUsage: tokenUsage,
      model: OPENAI_CONFIG.model
    };
  } catch (error) {
    if (error.message.includes('超时')) {
      console.error(`请求超时: ${error.message}`);
      console.error('建议: 尝试增加LLM_TIMEOUT环境变量值或减少HTML_MAX_CHARS值');
    } else {
      console.error('LLM处理失败:', error.message);
    }
    throw error;
  }
}

/**
 * 分批处理大型HTML文件
 */
async function extractQADialogueInBatches(htmlContent, client) {
  const batchSize = OPENAI_CONFIG.htmlMaxChars;
  const batches = [];
  
  // 将HTML内容分成多个批次
  for (let i = 0; i < htmlContent.length; i += batchSize) {
    const batch = htmlContent.slice(i, i + batchSize);
    batches.push({
      content: batch,
      index: i,
      isLast: i + batchSize >= htmlContent.length
    });
  }
  
  console.log(`将分为 ${batches.length} 个批次进行处理，每批约 ${batchSize} 字符`);
  
  const results = [];
  let totalTokenUsage = 0;
  
  // 处理每个批次
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`\n处理批次 ${i + 1}/${batches.length} (${batch.content.length} 字符)...`);
    
    const prompt = `请从以下HTML片段中提取问答对话信息。这是第 ${i + 1}/${batches.length} 个片段。

HTML片段：
${batch.content}

请按以下格式输出：
用户: [用户的问题]
AI: [AI的回答]

只提取此片段中的完整问答对话对。${batch.isLast ? '' : '不需要包含之前片段的内容。'}`;

    try {
      console.log(`正在发送批次 ${i + 1} 请求到LLM...`);
      
      // 添加请求超时处理
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`批次 ${i + 1} 请求超时 (${OPENAI_CONFIG.timeout}ms)`)), OPENAI_CONFIG.timeout);
      });
      
      // 创建API请求
      const apiRequest = client.chat.completions.create({
        model: OPENAI_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的HTML内容分析助手，擅长从HTML片段中提取对话信息。请准确识别用户问题和AI回答，并以清晰的格式展示。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: OPENAI_CONFIG.maxTokens,
        temperature: 0.3
      });
      
      // 使用Promise.race来处理超时
      const response = await Promise.race([apiRequest, timeoutPromise]);

      if (!response || !Array.isArray(response.choices) || response.choices.length === 0 || !response.choices[0]?.message?.content) {
        throw new Error(`批次 ${i + 1} LLM响应不包含有效的choices或内容`);
      }
      
      const result = response.choices[0].message.content;
      const tokenUsage = response.usage?.total_tokens || 'N/A';
      totalTokenUsage += parseInt(tokenUsage);
      
      console.log(`批次 ${i + 1} 处理完成，Token使用: ${tokenUsage}`);
      
      results.push({
        batchIndex: i + 1,
        content: result,
        tokenUsage: tokenUsage
      });
      
      // 在批次之间添加短暂延迟，避免API限制
      if (i < batches.length - 1) {
        console.log('等待1秒后处理下一批次...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`批次 ${i + 1} 处理失败:`, error.message);
      // 继续处理下一批次，而不是完全失败
      results.push({
        batchIndex: i + 1,
        content: `错误: 批次 ${i + 1} 处理失败 - ${error.message}`,
        tokenUsage: 0
      });
    }
  }
  
  // 合并所有批次的结果
  const mergedContent = results.map(r => r.content).join('\n\n');
  
  console.log('\n=== 所有批次处理完成 ===');
  console.log(`总Token使用情况: ${totalTokenUsage}`);
  console.log('========================\n');
  
  return {
    content: mergedContent,
    tokenUsage: totalTokenUsage,
    model: OPENAI_CONFIG.model,
    batchCount: batches.length
  };
}

/**
 * 保存提取结果到文件
 */
function saveExtractedDialogue(extractionResult, htmlFilePath, htmlContent) {
  try {
    const resultFilePath = path.join(process.cwd(), 'output', 'extracted-dialogue.txt');
    const batchInfo = extractionResult.batchCount ? `\n批次数: ${extractionResult.batchCount}` : '';
    const resultContent = `LLM Q&A Dialogue Extraction Results
Generated at: ${new Date().toISOString()}
Model: ${extractionResult.model}
HTML File: ${htmlFilePath}
HTML Size: ${htmlContent.length} characters
Token Usage: ${extractionResult.tokenUsage}${batchInfo}

${extractionResult.content}`;
    try { fs.mkdirSync(path.dirname(resultFilePath), { recursive: true }); } catch {}
    fs.writeFileSync(resultFilePath, resultContent, 'utf8');
    console.log(`\n✅ 提取结果已保存到: ${resultFilePath}`);
    return resultFilePath;
  } catch (error) {
    console.error('保存文件失败:', error.message);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(60));
  console.log('LLM CLIENT - Q&A DIALOGUE EXTRACTION');
  console.log('='.repeat(60));
  
  try {
    // 检查配置
    console.log('\n1. Environment Check:');
    console.log('   - API Key:', process.env.SILICONFLOW_API_KEY ? 'Set' : 'Not set');
    console.log('   - Model:', process.env.MODEL_NAME);
    console.log('   - Base URL:', process.env.LLM_BASE_URL);
    
    if (!OPENAI_CONFIG.apiKey) {
      throw new Error('未找到API密钥，请检查.env文件中的SILICONFLOW_API_KEY配置');
    }
    
    console.log('\n2. Creating OpenAI client...');
    // 创建OpenAI客户端
    const client = await createOpenAIClient();
    
    
    console.log('\n3. Reading HTML file...');
    // 读取HTML文件
    const htmlFilePath = path.join(process.cwd(), 'output', 'page-captured.html');
    console.log(`   - File path: ${htmlFilePath}`);
    if (!fs.existsSync(htmlFilePath)) {
      throw new Error(`未找到HTML文件: ${htmlFilePath}`);
    }
    const htmlContent = readHtmlFile(htmlFilePath);
    
    console.log('\n4. Extracting Q&A dialogue...');
    // 提取问答对话
    const extractedDialogue = await extractQADialogue(htmlContent, client);
    
    console.log('\n5. Saving results...');
    // 保存结果到文件
    const savedFilePath = saveExtractedDialogue(extractedDialogue, htmlFilePath, htmlContent);
    
    console.log('\n' + '='.repeat(60));
    console.log('PROCESS COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log(`✅ Results saved to: ${savedFilePath}`);
    
    // 显式退出程序，确保返回正确的退出代码
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// 运行主函数
// 更健壮的方式来检测模块是否被直接运行
const argv1 = process.argv[1] || '';
const isMainModule = argv1
  ? (import.meta.url === `file://${argv1}` ||
     import.meta.url === `file:///${argv1.replace(/\\/g, '/')}` ||
     argv1 === fileURLToPath(import.meta.url))
  : false;

console.log('Debug info:');
console.log('- import.meta.url:', import.meta.url);
console.log('- process.argv[1]:', process.argv[1]);
console.log('- isMainModule:', isMainModule);

if (isMainModule) {
  console.log('正在执行主函数...');
  main().catch((error) => {
    console.error('程序执行失败:', error);
    process.exit(1);
  });
} else {
  console.log('模块被导入，不执行主函数');
}

export { createOpenAIClient, readHtmlFile, extractQADialogue, saveExtractedDialogue };