# 依赖包管理指南 (Dependencies Management Guide)

这是国际象棋开局记忆系统的依赖包管理指南。

## 📋 依赖文件说明

### 1. 核心依赖 (Core Dependencies)
- **requirements.txt** - 项目运行所需的最小依赖包
- 包含：Flask、Flask-CORS、python-chess、requests等

### 2. 开发环境依赖 (Development Dependencies)
- **requirements-dev.txt** - 开发环境所需的完整依赖包
- 包含：测试框架、代码质量工具、调试工具等

### 3. 生产环境依赖 (Production Dependencies)
- **requirements-prod.txt** - 生产环境所需的部署依赖包
- 包含：gunicorn、gevent等生产环境服务器

## 🚀 安装指南

### 基础安装 (Basic Installation)
```bash
# 进入后端目录
cd backend

# 安装核心依赖
pip install -r requirements.txt

# 运行应用
python app.py
```

### 开发环境安装 (Development Installation)
```bash
# 进入后端目录
cd backend

# 安装开发依赖（包含核心依赖）
pip install -r requirements-dev.txt

# 运行开发服务器
python app.py

# 或者使用Flask开发服务器
export FLASK_APP=app.py
export FLASK_ENV=development
flask run
```

### 生产环境安装 (Production Installation)
```bash
# 进入后端目录
cd backend

# 安装生产依赖（包含核心依赖）
pip install -r requirements-prod.txt

# 使用gunicorn启动生产服务器
gunicorn --bind 0.0.0.0:24377 --workers 4 --worker-class gevent app:app
```

## 🔧 虚拟环境管理

### 创建虚拟环境
```bash
# 创建虚拟环境
python -m venv chess_env

# 激活虚拟环境 (Windows)
chess_env\Scripts\activate

# 激活虚拟环境 (macOS/Linux)
source chess_env/bin/activate
```

### 管理依赖
```bash
# 生成当前环境的依赖列表
pip freeze > requirements-current.txt

# 升级所有依赖包
pip install --upgrade -r requirements.txt

# 检查过期的依赖包
pip list --outdated
```

## 📊 开发工具使用

### 代码格式化
```bash
# 使用black格式化代码
black app.py

# 使用isort排序导入
isort app.py
```

### 代码检查
```bash
# 使用flake8检查代码风格
flake8 app.py

# 使用mypy进行类型检查
mypy app.py
```

### 运行测试
```bash
# 运行所有测试
pytest

# 运行测试并生成覆盖率报告
pytest --cov=app

# 运行指定测试文件
pytest test/test_progress_calculation.py
```

## 🐛 故障排除

### 常见问题
1. **依赖安装失败**
   - 确保Python版本 >= 3.8
   - 升级pip：`pip install --upgrade pip`
   - 使用清华源：`pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt`

2. **导入错误**
   - 检查虚拟环境是否激活
   - 确认依赖包已正确安装

3. **性能问题**
   - 生产环境使用gunicorn
   - 根据服务器配置调整worker数量

### 更新依赖
```bash
# 更新特定包
pip install --upgrade Flask

# 更新所有包（谨慎使用）
pip install --upgrade -r requirements.txt
```

## 📈 性能优化

### 生产环境配置
```bash
# 推荐的生产环境启动命令
gunicorn --bind 0.0.0.0:24377 \
         --workers 4 \
         --worker-class gevent \
         --worker-connections 1000 \
         --max-requests 1000 \
         --max-requests-jitter 50 \
         --timeout 30 \
         --keepalive 2 \
         app:app
```

### 内存监控
```bash
# 使用memory-profiler监控内存使用
python -m memory_profiler app.py

# 使用psutil监控系统资源
python -c "import psutil; print(f'内存使用: {psutil.virtual_memory().percent}%')"
```

## 📋 依赖包说明

### 核心依赖
- **Flask**: Web框架
- **Flask-CORS**: 跨域请求支持
- **python-chess**: 国际象棋逻辑处理
- **requests**: HTTP客户端（用于测试）

### 开发依赖
- **pytest**: 测试框架
- **black**: 代码格式化工具
- **flake8**: 代码风格检查
- **mypy**: 类型检查工具

### 生产依赖
- **gunicorn**: WSGI HTTP服务器
- **gevent**: 异步网络库
- **psutil**: 系统监控

## 🔒 安全建议

1. **定期更新依赖包**
   ```bash
   pip install --upgrade -r requirements.txt
   ```

2. **使用虚拟环境隔离依赖**
   ```bash
   python -m venv chess_env
   ```

3. **生产环境使用固定版本**
   - 避免使用 `>=` 等不确定版本号
   - 定期测试依赖包更新

4. **监控安全漏洞**
   ```bash
   pip install safety
   safety check
   ```

## 📞 技术支持

如果在依赖管理过程中遇到问题，请：
1. 检查Python版本是否兼容
2. 确认虚拟环境设置正确
3. 查看错误日志获取详细信息
4. 参考官方文档或社区支持 