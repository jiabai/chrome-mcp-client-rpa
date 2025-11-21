# Chrome MCP Client RPA

A powerful Chrome automation tool that leverages the Model Context Protocol (MCP) for browser automation, dialogue extraction, and web scraping capabilities. This RPA (Robotic Process Automation) client enables seamless interaction with web applications, particularly optimized for LLM platforms like DeepSeek.

## 🚀 Features

- **Browser Automation**: Automated Chrome browser control using Selenium WebDriver
- **Dialogue Extraction**: Extract conversations and chat histories from web platforms
- **MCP Integration**: Model Context Protocol support for enhanced AI interactions
- **Web Scraping**: Comprehensive content extraction and analysis
- **LLM Integration**: Built-in support for SiliconFlow and OpenAI APIs
- **Snapshot Capture**: Take automated screenshots and page captures
- **Link Analysis**: Extract and analyze all links from web pages

## 📋 Prerequisites

- Node.js (version 16.0.0 or higher)
- Chrome browser installed
- Windows operating system (PowerShell support)

## 🔧 Installation

1. Clone the repository:
```bash
git clone https://github.com/username/chrome-mcp-client-rpa.git
cd chrome-mcp-client-rpa
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit the `.env` file with your API keys and configuration:
```env
# SiliconFlow API Configuration
SILICONFLOW_API_KEY=your_siliconflow_api_key_here

# LLM Configuration
MODEL_NAME=deepseek-ai/DeepSeek-V3.2-Exp
LLM_BASE_URL=https://api.siliconflow.cn/v1
LLM_MAX_RETRIES=2
LLM_TIMEOUT=30000

# Agent Configuration
AGENT_MAX_STEPS=10
TARGET_URL=https://chat.deepseek.com

# Execution Configuration
MAX_EXECUTION_TIME=120000
```

## 🎯 Usage

### Start Chrome with Remote Debugging

Use the provided PowerShell script to start Chrome with debugging enabled:
```powershell
.\scripts\Start-Chrome-9222.ps1
```

### Available Scripts

- **Extract DOM Content**: `npm start`
- **Extract Dialogue**: `npm run extract-dialogue`
- **Count Links**: `npm run count-links`
- **Extract History**: `npm run extract-history`
- **Test LLM Connection**: `npm run ping-llm`

### Direct Script Execution

You can also run individual scripts directly:
```bash
node src/1-newchat-opener.js
node src/2-chat-injector.js
node src/3-exportDeepSeekDom.mjs
node src/4-htmlDialogueExtractor.mjs
node src/5-totalLinks.mjs
node src/6-historyRecordExtractor.mjs
```

## 📁 Project Structure

```
chrome-mcp-client-rpa/
├── src/                          # Source code
│   ├── 1-newchat-opener.js      # New chat opener
│   ├── 2-chat-injector.js       # Chat message injector
│   ├── 3-exportDeepSeekDom.mjs  # DOM content extractor
│   ├── 4-htmlDialogueExtractor.mjs # Dialogue extraction
│   ├── 5-totalLinks.mjs         # Link counter
│   ├── 6-historyRecordExtractor.mjs # History extractor
│   ├── llmPing.mjs              # LLM connection test
│   └── takeSnapshot.mjs         # Page snapshot utility
├── scripts/                      # Utility scripts
│   └── Start-Chrome-9222.ps1   # Chrome launcher
├── docs/                         # Documentation
├── output/                       # Generated outputs
├── config.json                   # Configuration file
├── tools.json                    # MCP tools definition
└── tsup.config.ts               # Build configuration
```

## 🔧 Configuration

### MCP Configuration
The `config.json` file contains MCP client configuration:
```json
{
  "mcpServers": {
    "chrome": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-chrome"],
      "env": {
        "CHROME_DEBUG_PORT": "9222"
      }
    }
  }
}
```

### Tools Definition
The `tools.json` file defines available MCP tools for browser automation and content extraction.

## 🛠️ Development

### Build Configuration
The project uses `tsup` for building TypeScript configurations:
```bash
npm run build
```

### Environment Setup
Ensure your development environment includes:
- Node.js 16+ with ES modules support
- Chrome browser with remote debugging enabled
- PowerShell execution policy allowing script execution

## 🔒 Security

- Store API keys securely in environment variables
- Never commit sensitive configuration files
- Use the provided `.gitignore` to exclude sensitive data
- Regularly update dependencies for security patches

## 📊 Output Files

The tool generates various output files in the `output/` directory:
- `extracted-dialogue.txt`: Extracted conversation text
- `extracted-dialogue-history.txt`: Complete dialogue history
- `page-captured.html`: Captured HTML content
- `page-text-content.json`: Structured page content
- `snapshot-take_snapshot.json`: Page snapshot data

## 🐛 Troubleshooting

### Common Issues

1. **Chrome Connection Failed**: Ensure Chrome is running with remote debugging on port 9222
2. **API Key Issues**: Verify your SiliconFlow API key is correctly set in `.env`
3. **PowerShell Execution Policy**: Run `Set-ExecutionPolicy RemoteSigned` if scripts fail
4. **Port Conflicts**: Ensure port 9222 is available for Chrome debugging

### Debug Mode
Enable debug logging by setting:
```env
NODE_ENV=development
LOG_LEVEL=debug
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Model Context Protocol (MCP) for browser automation
- Selenium WebDriver for browser control
- SiliconFlow for LLM API services
- DeepSeek for AI platform integration

## 📞 Support

For issues and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting guide in `docs/troubleshooting.md`
- Review the tool reference in `docs/tool-reference.md`

---

**Note**: This tool is designed for legitimate automation and data extraction purposes. Please respect website terms of service and applicable laws when using this software.