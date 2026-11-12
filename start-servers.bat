@echo off
REM Start both Backend and Frontend servers for iElevate

echo ========================================
echo Starting iElevate Servers
echo ========================================
echo.

REM Start Backend in a new Terminal
echo Starting Backend Server (port 5000)...
start cmd /k "cd backend; npm start"

REM Wait 2 seconds for backend to start
timeout /t 2 /nobreak

REM Start Frontend in a new Terminal
echo Starting Frontend Server (port 5173)...
start cmd /k "cd frontend; npm run dev"

echo.
echo ========================================
echo Both servers should be starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173
echo ========================================
echo.
pause
