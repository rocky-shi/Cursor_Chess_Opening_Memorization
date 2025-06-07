# 国际象棋开局背谱系统

这是一个前后端分离的国际象棋开局背谱系统，帮助用户通过智能分支匹配来练习和记忆国际象棋开局。支持跨设备同步，桌面端上传棋谱，移动端自动获取最新数据。

## ✨ 核心特性

- 🎯 **智能分支匹配**: 根据用户走棋自动匹配对应分支，无需手动选择
- 📁 **PGN棋谱解析**: 支持包含多个分支的复杂PGN文件
- 🎮 **交互式背谱**: 通过拖拽棋子进行开局练习，系统自动验证
- 🔄 **双视角支持**: 支持白方和黑方视角的背谱练习
- 📊 **进度跟踪**: 实时追踪学习进度和分支完成情况
- 🎉 **智能提示**: 走错时显示所有可能的正确走法
- ⚡ **现代UI**: 美观的用户界面和流畅的操作体验
- 🗄️ **数据库存储**: 服务端SQLite数据库自动保存所有上传的棋谱
- 📱 **移动端优化**: 专为移动设备优化的界面，自动同步服务端数据
- 🌐 **跨设备同步**: 所有客户端共享最新棋谱数据，无需重复上传
- 💾 **本地备份**: 客户端本地存储备份，离线时仍可使用
- 🔧 **智能连接**: 自动检测服务端连接状态，优雅降级到本地模式

## 🚀 使用流程

### 桌面端（管理者）
1. **启动服务**: 运行`start_backend.bat`启动后端服务
2. **加载棋谱**: 点击"📁 加载对局"上传PGN文件到服务端
3. **开始背谱**: 点击"🎯 开始背谱"进入智能匹配模式
4. **走棋练习**: 拖拽棋子走棋，系统自动匹配对应分支

### 移动端（学习者）
1. **打开应用**: 通过局域网IP访问（如：192.168.1.100:5000）
2. **自动同步**: 系统自动加载服务端最新棋谱数据
3. **专注背谱**: 界面简洁，专注于背谱练习
4. **离线使用**: 即使断网也能继续使用已加载的棋谱

## 🛠 技术架构

### 前端技术栈
- **HTML5 + CSS3 + JavaScript**: 现代Web技术
- **jQuery 3.6.0**: DOM操作和事件处理
- **Chess.js 0.10.3**: 国际象棋逻辑引擎
- **Chessboard.js 1.0.0**: 交互式棋盘组件
- **localStorage**: 客户端数据缓存
- **响应式设计**: 支持桌面端和移动端

### 后端技术栈
- **Python 3.7+**: 主要编程语言
- **Flask 2.3.3**: 轻量级Web框架
- **python-chess 1.999**: 专业棋谱解析库
- **Flask-CORS 4.0.0**: 跨域请求支持
- **SQLite3**: 轻量级数据库存储
- **多线程安全**: 支持并发访问

## 📦 安装和运行

### 方法一：一键启动（推荐）

1. **克隆项目**
```bash
git clone https://github.com/your-username/Cursor_Chess_Opening_Memorization.git
cd Cursor_Chess_Opening_Memorization
```

2. **启动后端服务**
```bash
# Windows用户（推荐）
start_backend.bat

# Linux/Mac用户
cd backend
pip install -r requirements.txt
python app.py
```

3. **访问应用**
- **桌面端**: `http://localhost:5000`
- **移动端**: `http://你的电脑IP:5000`（如：`http://192.168.1.100:5000`）

### 方法二：Docker部署（未来支持）

```bash
docker-compose up -d
```

## 🌐 网络配置

### 局域网访问设置

1. **获取电脑IP地址**
```bash
# Windows
ipconfig

# Linux/Mac
ifconfig
```

2. **配置防火墙**
确保5000端口对局域网开放

3. **移动端访问**
在移动设备浏览器中输入：`http://电脑IP:5000`

## 📋 PGN文件格式

系统支持标准PGN格式，包括复杂的分支结构：

```pgn
[Event "开局练习"]
[Site "?"]
[Date "2025.01.01"]
[Round "?"]
[White "练习者"]
[Black "系统"]
[Result "*"]

1. e4 e5 2. Nf3 (2. f4 d5 3. fxe5 Qh4+ 4. Ke2 Qxe4+) 2... Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 *
```

**支持的特性**：
- ✅ 带有变体的复杂棋谱
- ✅ 多个分支路径
- ✅ 标准的国际象棋记谱法
- ✅ 自动解析分支结构
- ✅ 中文注释和文件名
- ✅ 多种编码格式（UTF-8、GBK等）

## 🎯 智能功能详解

### 数据同步机制
- **优先级**: 服务端数据 > 本地缓存
- **自动同步**: 移动端自动获取服务端最新棋谱
- **离线备份**: 断网时使用本地缓存数据
- **智能通知**: 加载数据时显示来源和时间

### 移动端适配
- **按钮优化**: 隐藏"加载对局"和"清除棋谱"按钮
- **布局调整**: 响应式设计适配不同屏幕尺寸
- **网络检测**: 显示连接状态和数据来源
- **触控优化**: 针对触屏设备的交互优化

### 错误提示系统
- **智能诊断**: 连接失败时提供详细原因分析
- **降级策略**: 服务端不可用时自动使用本地模式
- **用户友好**: 清晰的错误信息和解决建议

## 🌐 API 接口

### 健康检查
```http
GET /api/health
响应: {"status": "healthy", "message": "后端服务正常运行"}
```

### 解析并保存PGN文件
```http
POST /api/parse-pgn
Content-Type: multipart/form-data
参数: file (PGN文件)
响应: {
  "success": true,
  "branches": [...],
  "tree": {...},
  "total_branches": 数量,
  "game_id": 数据库ID
}
```

### 获取最新棋谱
```http
GET /api/latest-pgn
响应: {
  "branches": [...],
  "tree": {...},
  "metadata": {
    "id": 1,
    "filename": "example.pgn",
    "upload_time": "2025-01-01 12:00:00",
    "total_branches": 5
  }
}
```

### 获取棋谱历史列表
```http
GET /api/pgn-list?limit=10
响应: {
  "success": true,
  "data": [...],
  "count": 数量
}
```

## 📁 项目结构

```
├── backend/                 # Python后端服务
│   ├── app.py              # Flask应用主文件
│   ├── requirements.txt    # Python依赖清单
│   └── chess_pgn.db        # SQLite数据库（自动生成）
├── js/                     # 前端JavaScript模块
│   ├── api.js             # API通信和数据同步
│   ├── chess.js           # 棋盘逻辑和游戏控制
│   ├── app.js             # 主应用控制器
│   └── tree.js            # 树状结构显示
├── css/                    # 样式文件
│   └── tree.css           # 树状结构样式
├── img/                    # 棋子图片资源
├── index.html             # 主应用页面
├── tree_test.html         # 树状结构测试页面
├── start_backend.bat      # Windows快速启动脚本
├── .gitignore             # Git忽略文件配置
└── README.md              # 项目说明文档
```

## 📱 移动端使用指南

### 连接设置
1. 确保手机和电脑在同一WiFi网络下
2. 在电脑上运行`start_backend.bat`
3. 获取电脑IP地址（通常是192.168.x.x格式）
4. 在手机浏览器访问：`http://电脑IP:5000`

### 功能说明
- **自动同步**: 打开页面自动加载最新棋谱
- **简化界面**: 只显示背谱相关功能
- **连接状态**: 右侧面板显示服务端连接状态
- **离线模式**: 网络断开时使用本地缓存

## 🔧 开发和调试

### 后端开发
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### 前端调试
- 打开浏览器开发者工具查看控制台日志
- 移动端访问时查看详细的连接和同步信息
- 使用`tree_test.html`测试PGN解析效果

### 数据库管理
```bash
# 查看数据库内容
sqlite3 backend/chess_pgn.db
.tables
SELECT * FROM pgn_games;
```

## 🚀 部署和配置

### 生产环境部署
1. 修改Flask为生产模式
2. 配置反向代理（Nginx）
3. 设置HTTPS证书
4. 配置域名和端口

### 网络安全
- 默认只允许局域网访问
- 生产环境建议配置认证
- 定期备份数据库文件

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进这个项目！

### 开发流程
1. Fork项目
2. 创建功能分支
3. 提交代码变更
4. 创建Pull Request

### 提交代码前请确保：
- ✅ 代码通过基本测试
- ✅ 遵循现有的代码风格
- ✅ 添加必要的注释
- ✅ 更新相关文档
- ✅ 测试移动端兼容性

## 📄 许可证

MIT License - 详见 LICENSE 文件

## 🙏 致谢

- Chess.js - 国际象棋逻辑引擎
- Chessboard.js - 交互式棋盘组件
- python-chess - Python棋谱解析库
- Flask - 轻量级Web框架 