@echo off
start "" http://localhost:8000/
start "md2handwriting local exporter" cmd /k "node local-export-server.js"
python -m http.server 8000
