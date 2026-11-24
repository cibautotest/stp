@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem ===========================================================================
rem   智能测试中台 (Smart Testing Platform) - 一键启动 / 停止 脚本
rem
rem   用法:
rem     start-platform.bat          启动全部服务
rem     start-platform.bat stop     停止全部服务
rem
rem   前提: MySQL(3306) 与 Kafka(9092) 需自行启动（如 Docker 容器）
rem   流程: 环境检查 -> 数据库检查(幂等初始化) -> Eureka -> Platform
rem         -> Gateway -> Execute Service -> Frontend
rem ===========================================================================

rem ------------------------------ 配置区 ------------------------------
set MYSQL_HOST=127.0.0.1
set MYSQL_PORT=3306
set MYSQL_USER=root
set MYSQL_PASS=cib@1234
set DB_NAME=uitest

rem JDK 11（enforcer 强制要求 [11,12)，安装于 D 盘，勿改用其他版本）
set JAVA_HOME=D:\jdk-11

rem Maven JVM 堆限制（低内存机器防 malloc 失败，应用堆在各启动命令行单独指定）
set MAVEN_OPTS=-Xmx256m

rem JWT 密钥（本地开发用，生产环境请修改）
set JWT_SECRET=stpLocalDevJwtSecret0123456789abcd
rem 报告上传令牌：必须与 execute-service/.env 中的 REPORT_UPLOAD_TOKEN 保持一致
set REPORT_UPLOAD_TOKEN=123456789abcdefghijklmn123456789

set EXECUTE_PORT=3001
set FRONTEND_PORT=3000

rem MySQL 客户端路径（找不到时自动跳过数据库初始化）
set MYSQL_EXE=C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe
rem -------------------------------------------------------------------

if /i "%1"=="stop" goto STOP_ALL

echo.
echo ==========================================================================
echo                智能测试中台 - 一键启动
echo ==========================================================================
echo.

rem ------------------------------ 0. 环境检查 ------------------------------
echo [0/7] 检查运行环境...
where mvn >nul 2>&1
if errorlevel 1 (echo   [错误] 未找到 Maven，请先安装并加入 PATH & pause & exit /b 1)
where node >nul 2>&1
if errorlevel 1 (echo   [错误] 未找到 Node.js，请先安装并加入 PATH & pause & exit /b 1)
where npm >nul 2>&1
if errorlevel 1 (echo   [错误] 未找到 npm，请先安装并加入 PATH & pause & exit /b 1)
echo   [OK] Maven / Node.js / npm 就绪

echo   - MySQL %MYSQL_HOST%:%MYSQL_PORT% ...
call :CHECK_PORT %MYSQL_PORT%
if errorlevel 1 (echo   [警告] MySQL 端口未就绪，请先启动 MySQL 再运行本脚本) else (echo   [OK] MySQL 已就绪)

echo   - Kafka 9092 ...
call :CHECK_PORT 9092
if errorlevel 1 (echo   [警告] Kafka 未就绪，接口报文采集功能不可用（不影响主流程）) else (echo   [OK] Kafka 已就绪)

rem ------------------------------ 1. 数据库检查 ------------------------------
echo.
echo [1/7] 检查数据库（仅首次需要初始化，已初始化则跳过）...
if not exist "%MYSQL_EXE%" (
    echo   [跳过] 未找到 MySQL 客户端，跳过数据库检查
    goto SKIP_DB
)

rem 认证测试（带重试，应对 Docker 端口转发偶发不稳定）
set DB_RETRY=0
:DB_CONNECT_RETRY
"%MYSQL_EXE%" -h %MYSQL_HOST% -P %MYSQL_PORT% -u %MYSQL_USER% -p%MYSQL_PASS% -e "SELECT 1;" >nul 2>&1
if not errorlevel 1 goto DB_CONNECT_OK
set /a DB_RETRY+=1
if %DB_RETRY% GEQ 4 (
    echo   [警告] 无法连接 MySQL（已重试 4 次），请确认服务已启动且账号密码正确（当前: %MYSQL_USER%）
    goto SKIP_DB
)
echo   连接失败，3 秒后重试（第 %DB_RETRY%/4 次）...
ping -n 4 127.0.0.1 >nul
goto DB_CONNECT_RETRY

:DB_CONNECT_OK
"%MYSQL_EXE%" -h %MYSQL_HOST% -P %MYSQL_PORT% -u %MYSQL_USER% -p%MYSQL_PASS% -e "CREATE DATABASE IF NOT EXISTS %DB_NAME% DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;" 2>nul

set TABLE_COUNT=0
for /f "usebackq tokens=*" %%i in (`"%MYSQL_EXE%" -h %MYSQL_HOST% -P %MYSQL_PORT% -u %MYSQL_USER% -p%MYSQL_PASS% -N -B -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='%DB_NAME%';" 2^>nul`) do set TABLE_COUNT=%%i

if not "%TABLE_COUNT%"=="0" (
    echo   [OK] 数据库 %DB_NAME% 已初始化（%TABLE_COUNT% 张表），跳过
    goto SKIP_DB
)

echo   首次运行，正在初始化数据库表结构...
rem 用 node 合并 init.sql + 迁移脚本并去除 UTF-8 BOM（否则 MySQL 报语法错误）
set MERGED_SQL=%TEMP%\stp_init_all.sql
node -e "const fs=require('fs'),p=require('path');const d='backend/platform-service/src/main/resources/sql';let s='USE %DB_NAME%;\n';s+=fs.readFileSync(p.join(d,'init.sql'),'utf8').replace(/^\uFEFF/,'');fs.readdirSync(d).filter(f=>/^V.*\.sql$/.test(f)).sort().forEach(f=>{s+='\n'+fs.readFileSync(p.join(d,f),'utf8').replace(/^\uFEFF/,'');});fs.writeFileSync(process.env.TEMP+'/stp_init_all.sql',s,'utf8');"
if errorlevel 1 (echo   [错误] 生成初始化 SQL 失败 & pause & exit /b 1)

"%MYSQL_EXE%" -h %MYSQL_HOST% -P %MYSQL_PORT% -u %MYSQL_USER% -p%MYSQL_PASS% -e "source %MERGED_SQL:\=/%"
set TABLE_COUNT=0
for /f "usebackq tokens=*" %%i in (`"%MYSQL_EXE%" -h %MYSQL_HOST% -P %MYSQL_PORT% -u %MYSQL_USER% -p%MYSQL_PASS% -N -B -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='%DB_NAME%';" 2^>nul`) do set TABLE_COUNT=%%i
echo   [OK] 数据库初始化完成（%TABLE_COUNT% 张表，默认账号 sysadmin / admin123）

:SKIP_DB

rem ------------------------------ 2. Eureka ------------------------------
echo.
echo [2/7] 启动 Eureka 注册中心 :8761 ...
start "Eureka :8761" cmd /k "cd /d "%~dp0backend" && mvn -pl eureka-server spring-boot:run -DskipTests "-Dspring-boot.run.jvmArguments=-Xmx384m""
call :WAIT_PORT 8761 120
if errorlevel 1 (echo   [错误] Eureka 启动超时，请查看 Eureka 窗口日志 & pause & exit /b 1)

rem ------------------------------ 3. Platform Service ------------------------------
echo.
echo [3/7] 启动 Platform Service :8081 ...
set SPRING_DATASOURCE_USERNAME=%MYSQL_USER%
set SPRING_DATASOURCE_PASSWORD=%MYSQL_PASS%
start "Platform :8081" cmd /k "cd /d "%~dp0backend" && mvn -pl platform-service spring-boot:run -DskipTests "-Dspring-boot.run.jvmArguments=-Xmx768m""
call :WAIT_PORT 8081 240
if errorlevel 1 (echo   [错误] Platform Service 启动超时，请查看其窗口日志 & pause & exit /b 1)

rem ------------------------------ 4. Gateway ------------------------------
echo.
echo [4/7] 启动 Gateway 网关 :8080 ...
start "Gateway :8080" cmd /k "cd /d "%~dp0backend" && mvn -pl gateway-service spring-boot:run -DskipTests "-Dspring-boot.run.jvmArguments=-Xmx384m""
call :WAIT_PORT 8080 120
if errorlevel 1 (echo   [错误] Gateway 启动超时，请查看其窗口日志 & pause & exit /b 1)

rem ------------------------------ 5. Execute Service ------------------------------
echo.
echo [5/7] 启动 Execute Service :%EXECUTE_PORT% ...
if not exist "%~dp0execute-service\node_modules" (
    echo   首次运行，安装执行引擎依赖...
    cd /d "%~dp0execute-service"
    call npm install --no-audit --no-fund
    cd /d "%~dp0"
)
if not exist "%~dp0execute-service\dist\index.js" (
    echo   构建执行引擎...
    cd /d "%~dp0execute-service"
    call npm run build
    cd /d "%~dp0"
)
start "Execute Service :%EXECUTE_PORT%" cmd /k "cd /d "%~dp0execute-service" && set PORT=%EXECUTE_PORT% && node dist/index.js"
call :WAIT_PORT %EXECUTE_PORT% 60
if errorlevel 1 (echo   [警告] Execute Service 启动超时，请查看其窗口日志)

rem ------------------------------ 6. Frontend ------------------------------
echo.
echo [6/7] 启动前端 :%FRONTEND_PORT% ...
if not exist "%~dp0frontend\node_modules" (
    echo   首次运行，安装前端依赖...
    cd /d "%~dp0frontend"
    call npm install --no-audit --no-fund
    cd /d "%~dp0"
)
start "Frontend :%FRONTEND_PORT%" cmd /k "cd /d "%~dp0frontend" && npm run dev"
call :WAIT_PORT %FRONTEND_PORT% 60
if errorlevel 1 (echo   [警告] 前端启动超时，请查看其窗口日志)

rem ------------------------------ 7. 完成 ------------------------------
echo.
echo [7/7] 服务自检...
ping -n 4 127.0.0.1 >nul
call :CHECK_PORT %EXECUTE_PORT%
if errorlevel 1 (echo   - Execute Service : 未就绪) else (echo   - Execute Service : OK)
call :CHECK_PORT %FRONTEND_PORT%
if errorlevel 1 (echo   - Frontend       : 未就绪) else (echo   - Frontend       : OK)

echo.
echo ==========================================================================
echo                     全部服务启动完成
echo ==========================================================================
echo.
echo   前端访问     : http://localhost:%FRONTEND_PORT%
echo   登录账号     : sysadmin / admin123
echo   网关         : http://localhost:8080
echo   接口文档     : http://localhost:8081/doc.html
echo   注册中心     : http://localhost:8761
echo   执行引擎     : http://localhost:%EXECUTE_PORT%
echo.
echo   提示: 各服务运行在独立窗口中，关闭窗口即停止对应服务
echo         停止全部服务请运行: start-platform.bat stop
echo.

start "" http://localhost:%FRONTEND_PORT%
echo 按任意键退出本窗口（不会影响已启动的服务）...
pause >nul
exit /b 0

rem ====================== 子程序：等待端口就绪 ======================
:WAIT_PORT
set WPORT=%~1
set WLIMIT=%~2
set /a WELAPSED=0
:WAIT_LOOP
netstat -ano | findstr "LISTENING" | findstr ":%WPORT% " >nul 2>&1
if not errorlevel 1 (
    echo   [OK] 端口 %WPORT% 已就绪
    exit /b 0
)
ping -n 4 127.0.0.1 >nul
set /a WELAPSED+=3
if %WELAPSED% GEQ %WLIMIT% (
    echo   [超时] 端口 %WPORT% 在 %WLIMIT% 秒内未就绪
    exit /b 1
)
goto WAIT_LOOP

rem ====================== 子程序：检测端口（不等待） ======================
:CHECK_PORT
set CPORT=%~1
netstat -ano | findstr "LISTENING" | findstr ":%CPORT% " >nul 2>&1
if errorlevel 1 (exit /b 1) else (exit /b 0)

rem ====================== 停止全部服务 ======================
:STOP_ALL
echo.
echo ==========================================================================
echo                     正在停止全部服务
echo ==========================================================================
echo.
for %%p in (3000 %EXECUTE_PORT% 8080 8081 8761) do (
    echo   停止端口 %%p ...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":%%p "') do (
        taskkill /PID %%a /T /F >nul 2>&1
    )
)
ping -n 4 127.0.0.1 >nul
echo.
echo   已停止。剩余监听情况：
for %%p in (8761 8081 8080 %EXECUTE_PORT% 3000) do (
    netstat -ano | findstr "LISTENING" | findstr ":%%p " >nul 2>&1
    if errorlevel 1 (echo     端口 %%p : 已关闭) else (echo     端口 %%p : 仍在监听)
)
echo.
echo 按任意键退出...
pause >nul
exit /b 0
