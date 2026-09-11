@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing QarHub dependencies...
  call npm.cmd install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm.cmd run dev -- --open
pause
