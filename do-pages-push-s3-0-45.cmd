@echo off
cd /d "C:\Users\Don\Documents\Codex\2026-06-22\so\work\v29-08\.publish-s3-0-45-nfl-shout-maximize"
copy /Y "C:\Users\Don\Documents\Codex\2026-06-22\so\work\v29-08\display.css" display.css >nul
copy /Y "C:\Users\Don\Documents\Codex\2026-06-22\so\work\v29-08\display-app.js" display-app.js >nul
copy /Y "C:\Users\Don\Documents\Codex\2026-06-22\so\work\v29-08\display.html" display.html >nul
copy /Y "C:\Users\Don\Documents\Codex\2026-06-22\so\work\v29-08\display2.html" display2.html >nul
git add -- display.css display-app.js display.html display2.html
git commit -F commit-msg.txt
if errorlevel 1 exit /b 1
git -c credential.helper= -c credential.helper=manager push origin main
if errorlevel 1 exit /b 1
git log -1 --oneline
