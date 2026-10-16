@echo off
set ROOT=C:\Users\Don\Documents\Codex\2026-06-22\so\work\v29-08
set STAGE=%ROOT%\.publish-s3-0-48-patron-shoutout-history
set GIT="C:\Program Files\Git\cmd\git.exe"
if exist "%STAGE%" rmdir /s /q "%STAGE%"
%GIT% clone --depth 1 https://github.com/JadzAdCo/shoutout-demo.git "%STAGE%"
if errorlevel 1 exit /b 1
copy /Y "%ROOT%\patron-portal-app.js" "%STAGE%\patron-portal-app.js" >nul
copy /Y "%ROOT%\patron-portal.html" "%STAGE%\patron-portal.html" >nul
copy /Y "%ROOT%\patron-app.js" "%STAGE%\patron-app.js" >nul
copy /Y "%ROOT%\index.html" "%STAGE%\index.html" >nul
copy /Y "%ROOT%\commit-msg-s3-0-48.txt" "%STAGE%\commit-msg.txt" >nul
cd /d "%STAGE%"
%GIT% add -- patron-portal-app.js patron-portal.html patron-app.js index.html
%GIT% commit -F commit-msg.txt
if errorlevel 1 exit /b 1
%GIT% -c credential.helper= -c credential.helper=manager push origin main
if errorlevel 1 exit /b 1
%GIT% log -1 --oneline
