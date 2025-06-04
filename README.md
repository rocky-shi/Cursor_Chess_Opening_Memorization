# 国际象棋开局背谱系统

这是一个前后端分离的国际象棋开局背谱系统，帮助用户通过智能分支匹配来练习和记忆国际象棋开局。

## ✨ 核心特性

- 🎯 **智能分支匹配**: 根据用户走棋自动匹配对应分支，无需手动选择
- 📁 **PGN棋谱解析**: 支持包含多个分支的复杂PGN文件
- 🎮 **交互式背谱**: 通过拖拽棋子进行开局练习，系统自动验证
- 🔄 **双视角支持**: 支持白方和黑方视角的背谱练习
- 📊 **进度跟踪**: 实时追踪学习进度和分支完成情况
- 🎉 **智能提示**: 走错时显示所有可能的正确走法
- ⚡ **现代UI**: 美观的用户界面和流畅的操作体验

## 🚀 使用流程

1. **加载棋谱**: 点击"加载对局"选择PGN文件
2. **开始背谱**: 点击"开始背谱"进入智能匹配模式
3. **走棋练习**: 拖拽棋子走棋，系统自动匹配对应分支
4. **完成分支**: 背完一个分支后自动提示并回到初始位置
5. **继续练习**: 继续背诵其他分支直到全部完成

## 🛠 技术架构

### 前端技术栈
- **HTML5 + CSS3 + JavaScript**: 现代Web技术
- **jQuery 3.6.0**: DOM操作和事件处理
- **Chess.js 0.10.3**: 国际象棋逻辑引擎
- **Chessboard.js 1.0.0**: 交互式棋盘组件

### 后端技术栈
- **Python 3.7+**: 主要编程语言
- **Flask 2.3.3**: 轻量级Web框架
- **python-chess 1.999**: 专业棋谱解析库
- **Flask-CORS 4.0.0**: 跨域请求支持

## 📦 安装和运行

### 方法一：自动启动（推荐）

1. **克隆项目**
```bash
git clone <project-url>
cd Cursor_Chess_Opening_Memorization
```

2. **一键启动后端**
```bash
# Windows用户
start_backend.bat

# Linux/Mac用户
cd backend
python app.py
```

3. **打开前端**
直接在浏览器中打开 `index.html` 文件

### 方法二：手动安装

1. **安装Python依赖**
```bash
cd backend
pip install -r requirements.txt
```

2. **启动后端服务**
```bash
python app.py
```
后端服务将在 `http://localhost:5000` 启动

3. **启动前端**
```bash
# 使用Python内置服务器（可选）
python -m http.server 8000
```
然后访问 `http://localhost:8000`

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
- 带有变体的复杂棋谱
- 多个分支路径
- 标准的国际象棋记谱法
- 自动解析分支结构

## 🎯 智能功能详解

### 自动分支匹配
- 系统根据用户的实际走棋自动判断属于哪个分支
- 无需预先选择分支，更加自然流畅
- 支持从任意分支开始练习

### 错误提示系统
- 走错时显示当前位置所有可能的正确走法
- 智能提示帮助用户理解开局变化

### 进度管理
- 自动记录已完成的分支
- 实时显示整体完成进度
- 分支完成时自动提示并重置位置

## 🌐 API 接口

### 健康检查
```
GET /api/health
响应: {"status": "healthy", "message": "后端服务正常运行"}
```

### 解析PGN文件
```
POST /api/parse-pgn
Content-Type: multipart/form-data
参数: file (PGN文件)
响应: {
  "success": true,
  "branches": [...],
  "tree": {...},
  "total_branches": 数量
}
```

### 测试树状结构
```
GET /api/test-tree
响应: 使用默认测试文件的解析结果
```

## 📁 项目结构

```
├── backend/                 # Python后端服务
│   ├── app.py              # Flask应用主文件
│   └── requirements.txt    # Python依赖清单
├── js/                     # 前端JavaScript模块
│   ├── api.js             # API通信模块
│   ├── chess.js           # 棋盘逻辑和PGN解析
│   ├── app.js             # 主应用控制器
│   └── tree.js            # 树状结构显示
├── css/                    # 样式文件
│   └── tree.css           # 树状结构样式
├── img/                    # 棋子图片资源
├── index.html             # 主应用页面
├── tree_test.html         # 树状结构测试页面
├── white_black_2025.pgn.txt # 示例PGN文件
├── start_backend.bat      # Windows快速启动脚本
└── README.md              # 项目说明文档
```

## 🎮 使用技巧

1. **选择合适的视角**: 根据要练习的开局选择白方或黑方视角
2. **错误学习**: 走错时仔细查看提示的正确走法
3. **重复练习**: 可以多次重置位置来加强记忆
4. **分支完成**: 关注分支完成提示，确保每个变化都掌握

## 🔧 开发和调试

### 树状结构测试
访问 `tree_test.html` 页面来：
- 测试PGN文件的解析效果
- 查看棋谱的树状结构
- 上传自定义PGN文件进行测试

### 自定义配置
- 修改 `backend/app.py` 中的端口设置
- 调整前端样式以适应不同屏幕尺寸
- 添加新的棋子主题图片

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进这个项目！

### 提交代码前请确保：
- 代码通过基本测试
- 遵循现有的代码风格
- 添加必要的注释
- 更新相关文档

## 📄 许可证

MIT License - 详见 LICENSE 文件 