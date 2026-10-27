@echo off
setlocal
cd /d "%~dp0"
set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js LTS e tente novamente.
  pause
  exit /b 1
)
if not exist node_modules\vite\bin\vite.js (
  call npm.cmd install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo AEON AQUA: iniciando servidor e abrindo o Edge.
node scripts\preview-browser.mjs
if errorlevel 1 pause
