@echo off
REM Sales Buddy - DISASTER RECOVERY launcher
REM Skips all prereq checks. Use when start.bat is broken but Python is fine.
cd /d "%~dp0..\"
powershell -ExecutionPolicy Bypass -File "%~dp0start-bare.ps1"
