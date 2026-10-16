@echo off
cd /d "C:\Users\Don\Documents\Codex\2026-06-22\so\work\v29-08\.publish-s3-0-44-nfl-functions-redeploy"
git commit -F commit-msg.txt
if errorlevel 1 exit /b 1
git -c credential.helper= -c credential.helper=manager push origin main
if errorlevel 1 exit /b 1
git log -1 --oneline
