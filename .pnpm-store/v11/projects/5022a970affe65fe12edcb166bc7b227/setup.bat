@echo off
echo ========================================
echo 智能测试中台 - Vue3 重构版 安装脚本
echo ========================================

echo.
echo [1/2] 正在安装依赖...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [错误] 依赖安装失败！
    pause
    exit /b 1
)

echo.
echo [2/2] 安装完成！
echo.
echo ========================================
echo 安装成功！现在可以运行以下命令启动项目：
echo.
echo   npm run dev     - 开发模式
echo   npm run build   - 构建生产版本
echo.
echo 开发模式访问: http://localhost:3000
echo ========================================
echo.
pause
