/**
 * DeepSeek对话历史记录提取工具
 * 
 * 功能说明：
 * - 从DeepSeek页面链接数据中提取对话历史记录
 * - 使用LLM（大语言模型）智能识别和解析对话标题与URL
 * - 支持大型JSON文件的分批处理，避免API限制
 * - 将提取的对话历史保存为结构化文本文件，便于后续分析
 * 
 * 工作流程：
 * 1. 加载环境变量配置（API密钥、模型参数等）
 * 2. 创建OpenAI兼容的LLM客户端
 * 3. 读取之前提取的页面链接JSON文件
 * 4. 使用LLM分析JSON数据，识别DeepSeek对话历史记录
 * 5. 根据数据大小选择单次处理或分批处理模式
 * 6. 将提取结果保存到output目录
 * 
 * 提取内容：
 * - 对话标题：DeepSeek左侧栏对话控制区中的对话标题
 * - 对话URL：每个对话对应的DeepSeek页面URL
 * - 格式：标题和URL成对显示，便于阅读和使用
 * 
 * 依赖要求：
 * - OpenAI兼容的API服务（如SiliconFlow）
 * - 环境变量配置文件（.env）
 * - Node.js环境
 * - 已提取的页面链接JSON文件（output/page-text-content.json）
 * 
 * 环境变量配置：
 * - SILICONFLOW_API_KEY: API访问密钥（必需）
 * - MODEL_NAME: 使用的模型名称（默认: deepseek-ai/DeepSeek-V3.2-Exp）
 * - LLM_BASE_URL: API基础URL（默认: https://api.siliconflow.cn/v1）
 * - LLM_MAX_RETRIES: 最大重试次数（默认: 2）
 * - LLM_TIMEOUT: 请求超时时间（毫秒，默认: 30000）
 * - LLM_MAX_TOKENS: 最大返回token数（默认: 2000）
 * - JSON_MAX_CHARS: 单次处理JSON最大字符数（默认: 200000）
 * 
 * 输出文件：
 * - 格式：文本文件
 * - 路径：./output/extracted-dialogue-history.txt
 * - 内容：提取的对话历史、处理统计信息、元数据
 * 
 * 使用场景：
 * - DeepSeek对话历史备份和归档
 * - 对话内容分析和统计
 * - 自动化对话管理和整理
 * - 研究和学习资料收集
 * - 对话记录迁移和转换
 * 
 * 分批处理机制：
 * - 自动检测JSON数据大小，超过阈值时启用分批处理
 * - 每个批次独立处理，避免API限制
 * - 批次间添加延迟，防止API频率限制
 * - 自动合并所有批次结果
 * 
 * 错误处理：
 * - 环境变量加载失败的容错处理
 * - API请求超时和重试机制
 * - JSON解析错误的捕获和处理
 * - 批处理中单个批次失败时的继续处理策略
 * - 详细的错误日志和解决建议
 * 
 * 性能优化：
 * - 智能批次大小计算
 * - 内存使用优化
 * - 并发控制
 * - Token使用统计和优化
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
  jsonMaxChars: parseInt(process.env.JSON_MAX_CHARS) || 200000
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
 * 读取JSON文件
 */
function readJsonFile(filePath) {
  try {
    const absolutePath = path.resolve(filePath);
    const content = fs.readFileSync(absolutePath, 'utf8');
    console.log(`成功读取文件: ${absolutePath}`);
    console.log(`文件大小: ${content.length} 字符`);
    
    // 解析JSON内容
    const jsonData = JSON.parse(content);
    console.log(`JSON解析成功，包含 ${jsonData.totalLinks} 个链接`);
    
    return jsonData;
  } catch (error) {
    console.error('读取JSON文件失败:', error.message);
    throw error;
  }
}

/**
 * 提取对话历史标题和URL
 */
async function extractDialogueHistory(jsonData, client) {
  // 将JSON数据转换为字符串
  const jsonString = JSON.stringify(jsonData, null, 2);
  
  // 如果JSON内容过大，分批处理
  if (jsonString.length > OPENAI_CONFIG.jsonMaxChars) {
    console.log(`JSON内容较大 (${jsonString.length} 字符)，将分批处理...`);
    return await extractDialogueHistoryInBatches(jsonData, client);
  }
  
  const prompt = `从中提取deepseek页面左边栏对话控制区中的问答对话历史的标题，和标题对应的deepseek url，并打印。

JSON数据：
${jsonString}

请按以下格式输出：
标题: [对话标题]
URL: [对应的deepseek URL]

请只提取属于deepseek页面左边栏对话控制区的对话历史，忽略其他不相关的链接。`;

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
          content: '你是一个专业的JSON数据分析师，擅长从JSON数据中提取deepseek页面对话历史信息。请准确识别对话标题和对应的URL，并以清晰的格式展示。'
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
    
    console.log('\n=== 提取的对话历史信息 ===');
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
      console.error('建议: 尝试增加LLM_TIMEOUT环境变量值或减少JSON_MAX_CHARS值');
    } else {
      console.error('LLM处理失败:', error.message);
    }
    throw error;
  }
}

/**
 * 分批处理大型JSON文件
 */
async function extractDialogueHistoryInBatches(jsonData, client) {
  // 由于JSON结构复杂，我们只处理links数组
  const links = jsonData.links || [];
  const batchSize = Math.floor(OPENAI_CONFIG.jsonMaxChars / 200); // 估算每个链接的平均大小
  const batches = [];
  
  // 将links分成多个批次
  for (let i = 0; i < links.length; i += batchSize) {
    const batch = links.slice(i, i + batchSize);
    batches.push({
      links: batch,
      index: i,
      isLast: i + batchSize >= links.length
    });
  }
  
  console.log(`将分为 ${batches.length} 个批次进行处理，每批约 ${batchSize} 个链接`);
  
  const results = [];
  let totalTokenUsage = 0;
  
  // 处理每个批次
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchJson = { totalLinks: batch.links.length, links: batch.links };
    const batchString = JSON.stringify(batchJson, null, 2);
    
    console.log(`\n处理批次 ${i + 1}/${batches.length} (${batchString.length} 字符)...`);
    
    const prompt = `从中提取deepseek页面左边栏对话控制区中的问答对话历史的标题，和标题对应的deepseek url。这是第 ${i + 1}/${batches.length} 个片段。

JSON数据片段：
${batchString}

请按以下格式输出：
标题: [对话标题]
URL: [对应的deepseek URL]

只提取此片段中属于deepseek页面左边栏对话控制区的对话历史，忽略其他不相关的链接。${batch.isLast ? '' : '不需要包含之前片段的内容。'}`;

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
            content: '你是一个专业的JSON数据分析师，擅长从JSON数据中提取deepseek页面对话历史信息。请准确识别对话标题和对应的URL，并以清晰的格式展示。'
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
function saveExtractedHistory(extractionResult, jsonFilePath, jsonData) {
  try {
    const resultFilePath = path.join(process.cwd(), 'output', 'extracted-dialogue-history.txt');
    const batchInfo = extractionResult.batchCount ? `\n批次数: ${extractionResult.batchCount}` : '';
    const resultContent = `LLM Dialogue History Extraction Results
Generated at: ${new Date().toISOString()}
Model: ${extractionResult.model}
JSON File: ${jsonFilePath}
JSON Size: ${JSON.stringify(jsonData).length} characters
Total Links: ${jsonData.totalLinks}
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
  console.log('LLM CLIENT - DIALOGUE HISTORY EXTRACTION');
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
    
    console.log('\n3. Reading JSON file...');
    // 读取JSON文件
    const jsonFilePath = path.join(process.cwd(), 'output', 'page-text-content.json');
    console.log(`   - File path: ${jsonFilePath}`);
    if (!fs.existsSync(jsonFilePath)) {
      throw new Error(`未找到JSON文件: ${jsonFilePath}`);
    }
    const jsonData = readJsonFile(jsonFilePath);
    
    console.log('\n4. Extracting dialogue history...');
    // 提取对话历史
    const extractedHistory = await extractDialogueHistory(jsonData, client);
    
    console.log('\n5. Saving results...');
    // 保存结果到文件
    const savedFilePath = saveExtractedHistory(extractedHistory, jsonFilePath, jsonData);
    
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

export { createOpenAIClient, readJsonFile, extractDialogueHistory, saveExtractedHistory };