@echo off
chcp 65001 >nul
title 国际象棋背谱系统启动器

echo ========================================
echo    国际象棋背谱系统启动器
echo ========================================
echo.

:: 检查Python是否安装
echo [1/4] 检查Python环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误：未找到Python，请先安装Python 3.7或更高版本
    echo 下载地址：https://www.python.org/downloads/
    pause
    exit /b 1
)
echo ✅ Python环境检查通过

:: 检查后端目录
echo [2/4] 检查后端文件...
if not exist "backend\app.py" (
    echo ❌ 错误：未找到backend\app.py文件
    echo 请确保在项目根目录运行此脚本
    pause
    exit /b 1
)
echo ✅ 后端文件检查通过

:: 进入后端目录并安装依赖
echo [3/4] 安装后端依赖...
cd backend
if exist "requirements.txt" (
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ❌ 错误：依赖安装失败
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
) else (
    echo ⚠️  警告：未找到requirements.txt，尝试安装基础依赖...
    pip install flask flask-cors python-chess
)

echo [4/4] 启动服务...
echo.

:: 启动后端服务（在后台）
echo 🚀 启动后端服务...
start "国际象棋背谱系统后端" cmd /c "python app.py"

:: 等待后端启动
echo ⏳ 等待后端服务启动...
timeout /t 3 /nobreak >nul

:: 检查后端是否启动成功
echo 🔍 检查后端服务状态...
for /l %%i in (1,1,10) do (
    curl -s http://localhost:5000/api/health >nul 2>&1
    if not errorlevel 1 (
        echo ✅ 后端服务启动成功！
        goto :backend_ready
    )
    echo    尝试 %%i/10...
    timeout /t 1 /nobreak >nul
)

echo ❌ 后端服务启动失败，请检查控制台错误信息
pause
exit /b 1

:backend_ready
echo.
echo 🌐 启动前端页面...

:: 回到项目根目录
cd ..

:: 检查前端文件
if not exist "index.html" (
    echo ❌ 错误：未找到index.html文件
    pause
    exit /b 1
)

:: 启动前端页面
echo 📂 打开背谱系统主页面...
start "" "index.html"
timeout /t 1 /nobreak >nul

echo.
echo ========================================
echo ✅ 系统启动完成！
echo ========================================
echo.
echo 🎯 主要功能页面: http://localhost:5000
echo 📊 树状结构测试: tree_test.html
echo 🔧 后端API地址: http://localhost:5000/api
echo.
echo 💡 使用说明:
echo    1. 点击"加载对局"上传PGN文件
echo    2. 选择白方或黑方视角
echo    3. 点击"开始背谱"进行练习
echo    4. 使用"重置进度"清除背诵记录
echo.
echo ⚠️  注意：关闭此窗口将同时关闭后端服务
echo.
echo 按任意键退出...
pause >nul

:: 清理后台进程
echo 🛑 正在关闭后端服务...
taskkill /f /fi "WindowTitle eq 国际象棋背谱系统后端*" >nul 2>&1

echo 👋 系统已关闭，再见！ 