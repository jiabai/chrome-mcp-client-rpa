# Chrome MCP Client RPA

A comprehensive Chrome automation toolkit for RPA (Robotic Process Automation) that enables browser automation, dialogue extraction, web scraping, and chat history management for DeepSeek and other LLM platforms.

## 🚀 Features

- **Remote Chrome Automation**: Control Chrome browser via ChromeDriver or Chrome DevTools Protocol
- **DeepSeek Integration**: Specialized tools for DeepSeek chat platform automation
- **Dialogue Extraction**: Extract and process chat conversations from web interfaces
- **History Management**: Batch delete chat history entries
- **Web Scraping**: Extract DOM content, links, and structured data
- **Screenshot Capture**: Automated screenshot functionality for verification
- **Multi-Modal Support**: Works with various LLM platforms and chat interfaces

## 📋 Prerequisites

- Node.js ≥ 16.0.0
- Chrome browser installed

## 🔧 Installation

```bash
# Clone the repository
git clone https://github.com/username/chrome-mcp-client-rpa.git
cd chrome-mcp-client-rpa

# Install dependencies
npm install

# Install TypeScript execution environment
npm i -D typescript ts-node @types/node
```

## 🎯 Available Scripts

### 1. New Chat Opener
Opens a new chat session on DeepSeek platform.
```bash
npm start
# or
ts-node --esm src/1-newchat-opener.ts
```

### 2. Chat Injector
Injects custom scripts into chat interfaces.
```bash
ts-node --esm src/2-chat-injector.ts
```

### 3. DOM Exporter
Exports the complete DOM structure from DeepSeek pages.
```bash
npm run extract-dom
# or
ts-node --esm src/3-exportDeepSeekDom.ts
```

### 4. Dialogue Extractor
Extracts chat dialogues and conversations from web interfaces.
```bash
npm run extract-dialogue
# or
ts-node --esm src/4-htmlDialogueExtractor.ts
```

### 5. Link Counter
Counts and extracts all links from web pages.
```bash
npm run count-links
# or
ts-node --esm src/5-totalLinks.ts
```

### 6. History Record Extractor
Extracts chat history records from DeepSeek.
```bash
npm run extract-history
# or
ts-node --esm src/6-historyRecordExtractor.ts
```

### 7. Clear Chat History
**Batch deletes chat history entries from DeepSeek sidebar.**
```bash
npm run clear-history -- --base http://127.0.0.1:9222 --url https://chat.deepseek.com/ --timeout 20000
```

### LLM Ping
Tests connectivity with LLM services.
```bash
npm run ping-llm
# or
ts-node --esm src/llmPing.ts
```

### Screenshot Capture
Captures screenshots of web pages.
```bash
ts-node --esm src/takeSnapshot.ts
```

## 📝 Command Line Arguments

### Clear History Script Arguments:
- `--base`: Chrome DevTools WebSocket URL (default: `http://127.0.0.1:9222`)
- `--url`: DeepSeek entry URL (default: `https://chat.deepseek.com/`)
- `--timeout`: Explicit wait timeout in milliseconds (default: `20000`)

## 🏗️ Architecture

### Chrome DevTools Protocol Mode
- Direct communication with Chrome via WebSocket
- No external dependencies required
- Faster and more lightweight
- Uses Chrome's built-in debugging capabilities

## 🔍 Technical Implementation

### Explicit Waiting Strategies
- `until.elementLocated`: Wait for element presence
- `until.elementIsVisible`: Wait for element visibility
- `until.elementIsEnabled`: Wait for element interactivity

### Element Selection Strategy
- **Sidebar Container**: `aside`, `[data-testid*="sidebar"]`, `[class*="sidebar" i]`
- **History Items**: `aside a[href*="/chat/"]`, `//aside//a[contains(@href, "/chat/")]`
- **Item Menus**: `button[aria-label*="More"]`, `button[aria-label*="Menu"]`
- **Delete Actions**: `//div[@role="menu"]//*[contains(text(), "Delete")]`
- **Confirmation Dialogs**: `//div[@role="dialog"]//button[contains(., "Delete"|"OK")]`

### Error Handling
- Comprehensive try-catch blocks for robust operation
- Graceful degradation when elements are not found
- Detailed logging for debugging and verification

## 📊 Test Cases

1. **Single Item Deletion**: 1 chat history → 0 items after execution
2. **Multiple Items**: Batch delete multiple history entries
3. **Not Logged In**: Handle login page gracefully with error logging
4. **Collapsed Sidebar**: Auto-expand and continue deletion
5. **Different UI Variants**: Handle various button configurations
6. **Confirmation Dialogs**: Properly handle delete confirmations
7. **Network Delays**: High timeout (30000ms) for slow connections
8. **Headless Mode**: Full functionality in headless environment
9. **Connection Failures**: Graceful handling of remote connection errors
10. **Screenshot Verification**: Before/after screenshots for validation

## 🛡️ Safety & Validation

- **Scoped Deletion**: Only targets `/chat/` links in sidebar
- **Post-Deletion Verification**: Re-count items to confirm deletion
- **Comprehensive Logging**: All operations logged for traceability
- **Screenshot Evidence**: Before/after screenshots for verification
- **No Data Modification**: Read-only operations except for intended deletions

## 📁 Output Structure

```
logs/
├── deepseek-clear-history_YYYY-MM-DD_HH-mm-ss.log
├── export-dom_YYYY-MM-DD_HH-mm-ss.log
└── ...

output/
├── history-before_YYYY-MM-DD_HH-mm-ss.png
├── history-after_YYYY-MM-DD_HH-mm-ss.png
├── dom-export_YYYY-MM-DD_HH-mm-ss.json
└── ...
```

## 🚀 Getting Started

1. **Start Chrome with remote debugging**:
```bash
# Windows
start chrome.exe --remote-debugging-port=9222

# macOS
open -a "Google Chrome" --args --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222
```

2. **Login to DeepSeek** and navigate to the chat interface

3. **Run the script**:
```bash
ts-node --esm src/7-clear-history.ts --base http://127.0.0.1:9222 --url https://chat.deepseek.com/
```

## 🔧 Troubleshooting

### Common Issues

**Element Not Found**:
- Increase `--timeout` parameter
- Ensure you're logged into DeepSeek
- Check if the page has fully loaded

**Connection Failed**:
- Verify Chrome is running with remote debugging enabled on port 9222
- Check firewall settings
- Ensure Chrome browser is responsive

**Screenshot Save Failed**:
- Ensure `output/` directory has write permissions
- Check available disk space

**Script Timeout**:
- Increase timeout value for slow network connections
- Check Chrome browser responsiveness

### Debug Mode
Enable verbose logging by checking the log files in the `logs/` directory.

## 📈 Performance Optimization

- Adjust `--timeout` based on network conditions
- Close unnecessary browser tabs to free up resources
- Use Chrome DevTools Protocol for efficient browser automation

## 🔒 Security Considerations

- Scripts only interact with specified domains
- No sensitive data is stored or transmitted
- All operations are logged for audit trails
- Browser automation is limited to user-visible actions

## 📚 Additional Resources

- [Selenium WebDriver Documentation](https://www.selenium.dev/documentation/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [DeepSeek Platform](https://chat.deepseek.com/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

ISC License - See LICENSE file for details

## 📝 Type Checking

```bash
npm run typecheck
```

## 🔧 Code Quality

For linting and code style checking, please specify your preferred lint command and I'll integrate it into the scripts.