@echo off
cd /d "%~dp0"
echo. | start-platform.bat > logs\startup.log 2>&1
