# ChromeDriver 启动脚本说明

本目录包含用于启动 ChromeDriver 服务和 Chrome 浏览器的脚本文件。

## 脚本列表

### 1. Start-ChromeDriver.ps1
- **类型**: PowerShell 脚本
- **功能**: 启动 ChromeDriver 服务
- **使用方法**:
  ```powershell
  .\Start-ChromeDriver.ps1
  ```

### 2. Start-Chrome-9222.ps1
- **类型**: PowerShell 脚本
- **功能**: 启动 Chrome 浏览器并开启远程调试端口 9222
- **使用方法**:
  ```powershell
  .\Start-Chrome-9222.ps1
  ```

## 默认配置

### ChromeDriver 配置
- **端口**: 9515
- **允许的来源**: *
- **URL基础路径**: /
- **ChromeDriver路径**: `..\chromedriver\win64-142.0.7444.175\chromedriver-win64\chromedriver.exe`

### Chrome 远程调试配置（Start-Chrome-9222.ps1）
- **端口**: 9222
- **地址**: 192.168.31.112
- **用户数据目录**: `D:\ChromeDebugProfile`



## 使用示例

### 基础启动
```powershell
# PowerShell
.\Start-ChromeDriver.ps1
```

### 检查端口占用
脚本会自动检查端口是否被占用，如果被占用会给出警告提示。

## 故障排除

1. **ChromeDriver 未找到**
   - 确认 ChromeDriver 已正确安装
   - 检查路径是否正确
   - 使用以下命令安装 ChromeDriver：
     ```bash
     npx @puppeteer/browsers install chromedriver@latest
     ```

2. **端口被占用**
   - 尝试使用其他端口
   - 检查是否有其他 ChromeDriver 实例在运行

3. **权限问题**
   - 确保脚本有执行权限
   - PowerShell 脚本可能需要执行策略调整：`Set-ExecutionPolicy RemoteSigned`

4. **ChromeDriver 版本不匹配**
   - 检查 Chrome 浏览器版本
   - 下载对应版本的 ChromeDriver
   - 更新脚本中的 ChromeDriver 路径

## ChromeDriver 安装与更新

### 安装 ChromeDriver
使用 @puppeteer/browsers 工具安装指定版本的 ChromeDriver：

```bash
# 安装最新版本
npx @puppeteer/browsers install chromedriver@latest

# 安装指定版本
npx @puppeteer/browsers install chromedriver@142.0.7444.175

# 安装 Canary 版本
npx @puppeteer/browsers install chromedriver@canary
```

### 更新 ChromeDriver
当 Chrome 浏览器更新后，可能需要更新 ChromeDriver：

1. 检查当前 Chrome 浏览器版本
2. 安装对应版本的 ChromeDriver
3. 更新脚本中的路径配置
4. 重启 ChromeDriver 服务

### 代理设置（如需要）
如果下载需要代理，可以设置环境变量：

```powershell
$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"
npx @puppeteer/browsers install chromedriver@latest
```

## 使用场景

### ChromeDriver 模式
启动 ChromeDriver 服务后，可以使用项目中的脚本来操作 DeepSeek：

```bash
npm run clear-history -- --remote http://127.0.0.1:9515 --url https://chat.deepseek.com/
```

### Chrome 远程调试模式
使用 Start-Chrome-9222.ps1 启动 Chrome 后，可以通过远程调试端口直接控制浏览器：

```bash
# 使用远程调试端口
node your-script.js --remote-debugging-port=9222
```

## 注意事项

- **Start-Chrome-9222.ps1**: 会启动一个新的 Chrome 实例，请确保关闭现有的 Chrome 进程
- **端口冲突**: 如果端口被占用，请修改脚本中的端口号
- **路径配置**: 请根据实际环境调整 Chrome 和 ChromeDriver 的路径
- **版本兼容性**: 确保 ChromeDriver 版本与 Chrome 浏览器版本兼容
- **路径更新**: 当重新安装 ChromeDriver 后，记得更新所有脚本中的路径配置