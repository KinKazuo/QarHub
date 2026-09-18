@echo off
cd /d "%~dp0"
start "" https://dashboard.ngrok.com/get-started/your-authtoken
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0scripts\connect-ngrok.ps1"
