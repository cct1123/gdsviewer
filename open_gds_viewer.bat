@echo off
setlocal
if not "%~1"=="" (
  echo Open index.html, then select or drop a .gds file in the browser.
  echo Root cell and hierarchy depth are available in View options.
  exit /b 1
)
start "" "%~dp0index.html"
exit /b %errorlevel%
