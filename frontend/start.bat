@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo Starting Monitoring System - Face Registration Portal...
echo Directory: %CD%
echo Web UI:    http://127.0.0.1:5173
echo ========================================================

if not exist "node_modules\" (
    echo Installing frontend dependencies (this only happens on first run)...
    call npm.cmd install
    if errorlevel 1 (
        echo.
        echo npm install failed. Make sure Node.js is installed.
        pause
        exit /b 1
    )
)

call npm.cmd run dev
if errorlevel 1 (
    echo.
    echo Failed to start the frontend server.
    pause
    exit /b 1
)
