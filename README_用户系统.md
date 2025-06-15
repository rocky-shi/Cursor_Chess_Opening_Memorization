# 国际象棋开局记忆系统 - 用户系统说明

## 系统概述

本系统已升级为多用户版本，支持用户账号管理、权限控制和个人学习进度跟踪。

## 新增功能

### 1. 用户认证系统
- **用户注册**: 支持用户自主注册账号
- **用户登录**: 安全的密码验证登录
- **会话管理**: 基于Flask Session的会话管理
- **密码加密**: 使用SHA256对密码进行加密存储

### 2. 权限管理系统
- **普通用户**: 可以使用所有学习功能，查看个人进度
- **管理员用户**: 除普通用户功能外，还可以管理用户账号
- **默认管理员**: 系统自带默认管理员账号 `admin / admin123`

### 3. 学习进度跟踪
- **个人进度**: 记录每个用户在各个分支的练习情况
- **掌握度计算**: 基于正确率和练习次数计算掌握度
- **学习统计**: 提供详细的学习数据分析
- **进度可视化**: 直观的进度条和统计图表

## 页面说明

### 登录页面 (`/login.html`)
- 支持登录和注册功能切换
- 显示默认管理员账号信息
- 自动跳转功能（已登录用户自动跳转到主页）

### 主页面 (`/`)
- 需要登录才能访问
- 显示用户导航栏
- 管理员可见管理员面板链接
- 集成进度跟踪功能

### 管理员面板 (`/admin.html`)
- 仅管理员可访问
- 用户统计信息
- 用户管理功能：新增、编辑、删除用户
- 权限管理：设置用户角色和状态

### 学习进度页面 (`/progress.html`)
- 个人学习统计概览
- 详细的分支学习进度
- 最近学习活动记录
- 可视化进度显示

## 数据库结构

### 用户表 (`users`)
```sql
- id: 用户ID
- username: 用户名（唯一）
- password_hash: 密码哈希
- email: 邮箱
- role: 角色（user/admin）
- is_active: 是否激活
- created_at: 创建时间
- last_login: 最后登录时间
- login_count: 登录次数
```

### 用户进度表 (`user_progress`)
```sql
- id: 进度记录ID
- user_id: 用户ID
- pgn_game_id: PGN游戏ID
- branch_id: 分支ID
- is_completed: 是否完成
- correct_count: 正确次数
- total_attempts: 总尝试次数
- mastery_level: 掌握度（0-100%）
- last_attempt_at: 最后练习时间
- notes: 备注
```

### 学习日志表 (`user_study_logs`)
```sql
- id: 日志ID
- user_id: 用户ID
- pgn_game_id: PGN游戏ID
- branch_id: 分支ID
- action: 操作类型
- result: 结果（correct/incorrect）
- duration_seconds: 练习时长
- created_at: 创建时间
```

## API接口

### 用户认证API
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `POST /api/auth/register` - 用户注册
- `GET /api/auth/me` - 获取当前用户信息

### 管理员API（需要管理员权限）
- `GET /api/admin/users` - 获取用户列表
- `POST /api/admin/users` - 创建新用户
- `PUT /api/admin/users/<id>` - 更新用户信息
- `DELETE /api/admin/users/<id>` - 删除用户

### 学习进度API（需要登录）
- `GET /api/progress/my` - 获取我的学习进度
- `POST /api/progress/update` - 更新学习进度
- `GET /api/progress/stats` - 获取学习统计

### PGN文件API（需要登录）
- `POST /api/parse-pgn` - 解析PGN文件
- `GET /api/latest-pgn` - 获取最新PGN数据
- `GET /api/pgn-list` - 获取PGN历史列表

## 使用指南

### 首次使用
1. 启动后端服务：`python backend/app.py`
2. 访问 `http://localhost:5000`
3. 系统会自动跳转到登录页面
4. 使用默认管理员账号登录：`admin / admin123`
5. 或者注册新用户账号

### 用户学习流程
1. 登录系统后，在主页面上传PGN文件
2. 开始背谱练习
3. 系统自动记录学习进度
4. 在进度页面查看学习统计

### 管理员操作
1. 使用管理员账号登录
2. 访问管理员面板
3. 管理用户账号：创建、编辑、删除用户
4. 查看系统统计信息

## 安全特性

- 密码加密存储（SHA256）
- 会话管理防止未授权访问
- 权限控制确保功能安全
- SQL注入防护
- 跨域请求保护

## 开发说明

### 环境要求
- Python 3.7+
- Flask 2.0+
- SQLite 3
- 现代浏览器（支持ES6+）

### 依赖包
```bash
pip install flask flask-cors python-chess
```

### 配置说明
- 数据库文件：`chess_pgn.db`（自动创建）
- 会话密钥：可通过环境变量 `SECRET_KEY` 设置
- 默认端口：5000

## 升级说明

本次升级保持了原有的PGN解析和背谱功能，同时新增了用户系统。原有功能完全兼容，但现在需要登录才能使用。

升级后的改进：
- 🔐 安全的用户认证系统
- 👥 多用户支持，数据隔离
- 📊 详细的学习进度跟踪
- 🎯 个性化学习体验
- ⚙️ 强大的管理功能

## 故障排除

### 常见问题
1. **无法登录**: 检查用户名密码是否正确
2. **403权限错误**: 确认用户有相应权限
3. **数据库错误**: 检查数据库文件权限
4. **会话过期**: 重新登录即可

### 重置管理员密码
如果忘记管理员密码，可以删除数据库文件 `chess_pgn.db`，系统会重新创建并生成默认管理员账号。

---

**注意**: 首次使用时，请及时修改默认管理员密码以确保系统安全！ 