@echo off
setlocal
cd /d "%~dp0.."
echo [%date% %time%] Starting daily build automation...
call npm.cmd run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed at %time%
    exit /b %ERRORLEVEL%
)
echo [%date% %time%] Daily build and sitemap generation complete.
echo Your updated sitemap is ready at: %cd%\public\sitemap.xml
endlocal
pause
