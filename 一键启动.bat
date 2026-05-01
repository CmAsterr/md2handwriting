@echo off
start "" http://localhost:8001/
start "md2handwriting local exporter" cmd /k "node local-export-server.js"
python -m http.server 8001
