# 国际象棋开局背谱系统

这是一个前后端分离的国际象棋开局背谱系统，帮助用户通过智能分支匹配来练习和记忆国际象棋开局。支持多用户管理、权限控制和学习进度跟踪。

## ✨ 核心特性

- 🎯 **智能分支匹配**: 根据用户走棋自动匹配对应分支，无需手动选择
- 📁 **PGN棋谱解析**: 支持包含多个分支的复杂PGN文件
- 🎮 **交互式背谱**: 通过拖拽棋子进行开局练习，系统自动验证
- 🔄 **双视角支持**: 支持白方和黑方视角的背谱练习
- 📊 **进度跟踪**: 实时追踪学习进度和分支完成情况
- 🎉 **智能提示**: 走错时显示所有可能的正确走法
- ⚡ **现代UI**: 美观的用户界面和流畅的操作体验
- 🔐 **用户系统**: 支持用户注册、登录和权限管理
- 👥 **多用户支持**: 每个用户独立的学习进度和数据
- 🛡️ **权限控制**: 管理员可控制用户对PGN文件的访问权限
- 🗄️ **数据库存储**: 服务端SQLite数据库自动保存所有上传的棋谱
- 📱 **移动端优化**: 专为移动设备优化的界面，自动同步服务端数据
- 🌐 **跨设备同步**: 所有客户端共享最新棋谱数据，无需重复上传
- 💾 **本地备份**: 客户端本地存储备份，离线时仍可使用
- 🔧 **智能连接**: 自动检测服务端连接状态，优雅降级到本地模式

## 🚀 使用流程

### 初次使用
1. **启动服务**: 运行`start_backend.bat`启动后端服务
2. **访问系统**: 浏览器打开 `http://localhost:5000`
3. **登录系统**: 使用默认管理员账号登录
4. **修改密码**: 建议立即修改默认管理员密码

### 管理员操作
1. **用户管理**: 在管理员面板创建、编辑、删除用户账号
2. **上传棋谱**: 点击"📁 上传PGN文件"上传棋谱到服务端
3. **权限管理**: 为每个PGN文件授权可访问的用户
4. **进度监控**: 查看所有用户的学习进度和统计信息

### 普通用户操作
1. **登录系统**: 使用分配的账号密码登录
2. **学习棋谱**: 只能访问管理员授权的PGN文件
3. **背谱练习**: 点击"🎯 开始背谱"进入智能匹配模式
4. **查看进度**: 在进度页面查看个人学习统计

### 移动端使用
1. **网络访问**: 通过局域网IP访问（如：192.168.1.100:5000）
2. **登录账号**: 使用相同的用户账号登录
3. **同步数据**: 系统自动同步个人授权的棋谱数据
4. **专注学习**: 界面简洁，专注于背谱练习

## 🔐 用户系统

### 用户角色
- **管理员 (admin)**: 拥有所有权限，可以管理用户和PGN文件
- **普通用户 (user)**: 只能访问被授权的PGN文件

### 权限管理
- **PGN访问控制**: 管理员可为每个PGN文件单独设置用户访问权限
- **默认权限**: 新上传的PGN文件默认只有管理员可见
- **权限继承**: 管理员始终拥有对所有PGN文件的访问权限

### 数据隔离
- **个人进度**: 每个用户的学习进度完全独立
- **统计信息**: 系统为每个用户维护独立的学习统计
- **数据安全**: 用户只能访问被授权的内容

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
- **Session管理**: 基于Flask Session的会话管理
- **密码加密**: SHA256密码哈希存储

### 数据库结构
- **users**: 用户账号信息
- **user_sessions**: 用户会话管理
- **user_progress**: 用户学习进度
- **user_study_logs**: 学习日志记录
- **pgn_games**: PGN文件存储
- **pgn_permissions**: PGN访问权限控制

## 📦 安装和运行

### 环境要求
- **Python 3.7+**
- **现代浏览器**: Chrome、Firefox、Safari、Edge等
- **网络环境**: 支持HTTP服务（端口5000）

### 方法一：一键启动（推荐）

1. **克隆项目**
```bash
git clone https://github.com/your-username/Cursor_Chess_Opening_Memorization.git
cd Cursor_Chess_Opening_Memorization
```

2. **安装依赖**
```bash
cd backend
pip install -r requirements.txt
```

3. **启动服务**
```bash
# Windows用户（推荐）
start_backend.bat

# Linux/Mac用户
python app.py
```

4. **访问应用**
- **本地访问**: `http://localhost:5000`
- **局域网访问**: `http://你的电脑IP:5000`（如：`http://192.168.1.100:5000`）

5. **默认账号**
- **管理员**: `admin / admin123`
- **重要**: 首次登录后请立即修改默认密码

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

### 用户认证API

#### 用户登录
```http
POST /api/auth/login
Content-Type: application/json
参数: {"username": "用户名", "password": "密码"}
响应: {
  "success": true,
  "message": "登录成功",
  "user": {"id": 1, "username": "admin", "role": "admin"}
}
```

#### 用户注册
```http
POST /api/auth/register
Content-Type: application/json
参数: {"username": "用户名", "password": "密码", "email": "邮箱"}
响应: {"success": true, "message": "注册成功", "user_id": 1}
```

#### 用户登出
```http
POST /api/auth/logout
响应: {"success": true, "message": "登出成功"}
```

#### 获取当前用户信息
```http
GET /api/auth/me
响应: {"success": true, "user": {...}}
```

### PGN文件API（需要登录）

#### 解析并保存PGN文件
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

#### 获取最新棋谱（权限控制）
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

#### 获取棋谱历史列表（权限控制）
```http
GET /api/pgn-list?limit=10
响应: {
  "success": true,
  "data": [...],
  "count": 数量
}
```

#### 获取特定PGN（权限控制）
```http
GET /api/pgn/{pgn_id}
响应: {棋谱数据和元信息}
```

### 学习进度API（需要登录）

#### 获取我的学习进度
```http
GET /api/progress/my
响应: {"success": true, "progress": [...]}
```

#### 更新学习进度
```http
POST /api/progress/update
Content-Type: application/json
参数: {
  "pgn_game_id": 1,
  "branch_id": "branch_1",
  "is_completed": true,
  "correct_count": 5,
  "total_attempts": 5
}
```

#### 获取学习统计
```http
GET /api/progress/stats
响应: {"success": true, "stats": {...}}
```

### 管理员API（需要管理员权限）

#### 获取用户列表
```http
GET /api/admin/users
响应: {"success": true, "users": [...]}
```

#### 创建用户
```http
POST /api/admin/users
Content-Type: application/json
参数: {"username": "用户名", "password": "密码", "role": "user"}
```

#### 获取PGN权限设置
```http
GET /api/admin/pgn/{pgn_id}/permissions
响应: {
  "success": true,
  "pgn_id": 1,
  "filename": "example.pgn",
  "authorized_users": [...],
  "all_users": [...]
}
```

#### 授予PGN访问权限
```http
POST /api/admin/pgn/{pgn_id}/permissions
Content-Type: application/json
参数: {"user_id": 2}
响应: {"success": true, "message": "权限授予成功"}
```

#### 撤销PGN访问权限
```http
DELETE /api/admin/pgn/{pgn_id}/permissions/{user_id}
响应: {"success": true, "message": "权限撤销成功"}
```

## 📁 项目结构

```
├── backend/                 # Python后端服务
│   ├── app.py              # Flask应用主文件
│   ├── requirements.txt    # Python依赖清单
│   ├── chess_pgn.db        # SQLite数据库（自动生成）
│   └── test/               # 测试脚本
│       └── test_connection.py
├── js/                     # 前端JavaScript模块
│   ├── api.js             # API通信和数据同步
│   ├── chess.js           # 棋盘逻辑和游戏控制
│   ├── app.js             # 主应用控制器
│   └── tree.js            # 树状结构显示
├── css/                    # 样式文件
│   └── tree.css           # 树状结构样式
├── img/                    # 棋子图片资源
├── index.html             # 主应用页面（需要登录）
├── login.html             # 用户登录页面
├── admin.html             # 管理员面板
├── progress.html          # 学习进度页面
├── tree_test.html         # 树状结构测试页面
├── start_backend.bat      # Windows快速启动脚本
├── .gitignore             # Git忽略文件配置
├── README.md              # 项目说明文档
└── README_用户系统.md      # 用户系统详细说明
```

### 主要页面说明
- **login.html**: 用户登录和注册页面，系统入口
- **index.html**: 主学习页面，支持PGN上传和背谱练习
- **admin.html**: 管理员面板，用户管理和PGN权限控制
- **progress.html**: 个人学习进度查看和统计分析

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