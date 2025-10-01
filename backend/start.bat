@echo off
echo 🚀 Starting Secure Video Chat Application...

echo 📦 Starting Backend Server...
start "Backend Server" cmd /k "npm start"

timeout /t 3 /nobreak >nul

echo 🎨 Starting Frontend Application...
start "Frontend Application" cmd /k "cd ../frontend && npm start"

echo.
echo ✅ Application started successfully!
echo 🌐 Frontend: http://localhost:3000
echo 🔧 Backend:  http://localhost:4001
echo.
echo Press any key to exit...
pause >nul
