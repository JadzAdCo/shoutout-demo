@echo off
set ROOT=C:\Users\Don\Documents\Codex\2026-06-22\so\work\v29-08
set STAGE=%ROOT%\.publish-s3-0-47-nfl-jersey-shout-fit
set GIT="C:\Program Files\Git\cmd\git.exe"
if exist "%STAGE%" rmdir /s /q "%STAGE%"
%GIT% clone --depth 1 https://github.com/JadzAdCo/shoutout-demo.git "%STAGE%"
if errorlevel 1 exit /b 1
copy /Y "%ROOT%\display.css" "%STAGE%\display.css" >nul
copy /Y "%ROOT%\display-app.js" "%STAGE%\display-app.js" >nul
copy /Y "%ROOT%\display.html" "%STAGE%\display.html" >nul
copy /Y "%ROOT%\display2.html" "%STAGE%\display2.html" >nul
copy /Y "%ROOT%\commit-msg-s3-0-47.txt" "%STAGE%\commit-msg.txt" >nul
cd /d "%STAGE%"
%GIT% add -- display.css display-app.js display.html display2.html
%GIT% commit -F commit-msg.txt
if errorlevel 1 exit /b 1
%GIT% -c credential.helper= -c credential.helper=manager push origin main
if errorlevel 1 exit /b 1
%GIT% log -1 --oneline
