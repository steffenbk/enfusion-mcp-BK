@echo off
title RoadForger tuning server
cd /d "C:/Users/Steffen/Documents/A_documents/Github/enfusion-mcp-BK"
set "ENFUSION_EXTRACTED_PATH=C:/Users/Steffen/Documents/My Games/ArmaReforgerWorkbench/extracted"
npm run tuning-server
echo.
echo Server stopped. Press a key to close.
pause > nul
