@echo off
setlocal
cd /d "%~dp0"

if exist ".venv\Scripts\gdsviewer.exe" (
  ".venv\Scripts\gdsviewer.exe" %*
  exit /b %errorlevel%
)

set "UV_EXE=uv"
where uv >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.local\bin\uv.exe" (
    set "UV_EXE=%USERPROFILE%\.local\bin\uv.exe"
  ) else (
    echo uv is required. Install it from https://docs.astral.sh/uv/
    exit /b 1
  )
)

"%UV_EXE%" run gdsviewer %*
endlocal
