@echo off
chcp 65001 >nul
title IT Equipment Management System
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if %errorlevel% neq 0 (
    echo.
    echo ===================================================
    echo  Launcher stopped due to an error. Press any key...
    echo ===================================================
    pause >nul
)
