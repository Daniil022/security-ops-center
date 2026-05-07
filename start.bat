@echo off
echo ======================================
echo  VR HOUSE - Запуск сервера камер
echo ======================================
echo.

cd server

echo [1/2] Устанавливаю зависимости...
pip install -r requirements.txt

echo.
echo [2/2] Запускаю сервер...
python camera_server.py

pause