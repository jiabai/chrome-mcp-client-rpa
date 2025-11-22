/**
 * 页面链接信息提取工具
 * 
 * 功能说明：
 * - 连接到 Chrome DevTools MCP (Model Context Protocol) 服务器
 * - 提取当前页面中所有链接元素（<a>标签）的详细信息
 * - 获取链接的文本内容、URL、属性、位置和可见性等数据
 * - 将提取的链接信息保存为JSON格式文件，便于后续分析
 * 
 * 工作流程：
 * 1. 建立与Chrome浏览器（端口9222）的MCP连接
 * 2. 执行JavaScript代码获取页面中所有链接元素
 * 3. 提取每个链接的详细信息（文本、URL、属性、位置等）
 * 4. 过滤掉没有文本内容的链接
 * 5. 将结果保存为JSON文件到output目录
 * 
 * 提取的链接信息包括：
 * - text: 链接显示的文本内容
 * - href: 链接的目标URL
 * - title: 链接的title属性
 * - className: 链接的CSS类名
 * - id: 链接的ID属性
 * - isVisible: 链接是否在页面中可见
 * - rect: 链接元素的位置和尺寸信息（top、left、width、height）
 * 
 * 依赖要求：
 * - Chrome 浏览器实例运行在端口 9222 (http://127.0.0.1:9222)
 * - chrome-devtools-mcp npm 包
 * - @modelcontextprotocol/sdk npm 包
 * - Node.js 环境
 * 
 * 输出文件：
 * - 格式：JSON 文件
 * - 路径：./output/page-text-content.json
 * - 内容：链接总数、链接详细列表
 * 
 * 使用场景：
 * - 网站结构分析和导航地图生成
 * - SEO分析（链接数量和质量评估）
 * - 网页内容抓取和链接提取
 * - 自动化测试中的链接验证
 * - 网站可访问性分析
 * 
 * 错误处理：
 * - MCP连接失败时的错误捕获和报告
 * - JSON解析失败时保存原始内容
 * - 确保资源正确释放（关闭MCP连接）
 * 
 * 作者：Chrome MCP Client RPA Tool
 * 版本：1.0.0
 * 创建时间：2024
 */

import fs from 'fs';

// MCP服务器配置
const MCP_SERVER_CONFIG = {
  command: 'npx',
  args: ['-y', 'chrome-devtools-mcp@latest', '--browserUrl=http://127.0.0.1:9222'],
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
};

/**
 * 启动MCP连接
 */
async function startMcp() {
  console.log('正在启动MCP连接...');
  
  try {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
    
    const transport = new StdioClientTransport(MCP_SERVER_CONFIG);
    const client = new Client(
      {
        name: 'chrome-mcp-elements-test-client',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );
    
    await client.connect(transport);
    console.log('MCP连接成功建立');
    
    return { client, transport };
  } catch (error) {
    console.error('导入MCP SDK失败:', error);
    throw error;
  }
}

/**
 * 关闭MCP连接
 */
async function stopMcp(mcpInstance) {
  console.log('正在关闭MCP连接...');
  
  if (mcpInstance.client) {
    await mcpInstance.client.close();
  }
  
  if (mcpInstance.transport) {
    await mcpInstance.transport.close();
  }
  
  console.log('MCP连接已关闭');
}

/**
 * 获取页面所有元素信息
 */
async function getPageElements() {
  let mcpInstance = null;
  
  try {
    console.log('开始获取页面所有文字信息...');
    
    // 启动MCP连接
    console.log('正在连接到Chrome浏览器(端口9222)...');
    mcpInstance = await startMcp();
    const { client } = mcpInstance;
    
    console.log('MCP连接成功');
    
    // 获取页面所有链接元素的文字信息
    console.log('正在获取页面所有链接元素的文字信息...');
    try {
      const elementsResult = await client.callTool({ 
        name: 'evaluate_script', 
        arguments: {
          function: `() => {
            const linkElements = Array.from(document.querySelectorAll('a'));
            return {
              totalLinks: linkElements.length,
              links: linkElements.map(el => ({
                text: el.innerText?.trim(),
                href: el.href,
                title: el.title || '',
                className: el.className,
                id: el.id,
                isVisible: el.offsetWidth > 0 && el.offsetHeight > 0,
                rect: {
                  top: el.getBoundingClientRect().top,
                  left: el.getBoundingClientRect().left,
                  width: el.getBoundingClientRect().width,
                  height: el.getBoundingClientRect().height
                }
              })).filter(link => link.text && link.text.length > 0)
            };
          }`
        }
      });
      
      if (elementsResult && elementsResult.content && elementsResult.content.length > 0) {
        const content = elementsResult.content[0].text;
        
        // 尝试解析JSON结果
        try {
          const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[1]);
            console.log(`成功获取 ${result.totalLinks} 个链接元素，其中 ${result.links.length} 个包含文字内容`);
            
            // 保存文字信息到文件
            const outputPath = 'output/page-text-content.json';
            console.log(`正在保存文字信息到: ${outputPath}`);
            fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
            
            console.log('页面文字信息已保存到文件');
            console.log(`总计链接数量: ${result.totalLinks}`);
            console.log(`包含文字的链接数量: ${result.links.length}`);
            
            // 显示一些示例文字
            const sampleTexts = result.links.slice(0, 10).map(link => link.text);
            console.log(`前10个文字示例:`, sampleTexts);
          }
        } catch (e) {
          console.log('解析JSON失败，保存原始内容');
          const outputPath = 'output/page-text-content-raw.json';
          fs.writeFileSync(outputPath, content, 'utf8');
        }
      }
    } catch (error) {
      console.log('获取文字信息失败:', error.message);
    }
    
    console.log('获取页面文字信息完成');
    
  } catch (error) {
    console.error('测试过程中发生错误:', error.message);
    console.error(error.stack);
  } finally {
    // 确保关闭MCP连接
    if (mcpInstance) {
      try {
        await stopMcp(mcpInstance);
      } catch (error) {
        console.error('关闭MCP连接时发生错误:', error.message);
      }
    }
  }
}

// 运行测试
console.log('页面元素信息获取测试开始执行...');

// 直接运行测试，不检查导入状态
console.log('正在运行 getPageElements...');
getPageElements().then(() => {
  console.log('测试已完成，正在退出进程...');
  process.exit(0);
}).catch((error) => {
  console.error('测试执行出错:', error);
  process.exit(1);
});