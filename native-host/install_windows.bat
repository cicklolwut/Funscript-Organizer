@echo off
setlocal enabledelayedexpansion

echo ===============================================
echo Funscript Organizer Native Host Installer
echo For Windows
echo ===============================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.6+ from https://python.org
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

echo Python found: 
python --version
echo.

:: Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

:: Set paths
set "NATIVE_HOST_DIR=%APPDATA%\Mozilla\NativeMessagingHosts"
set "JSON_FILE=funscript_rename_host.json"
set "PYTHON_SCRIPT=%SCRIPT_DIR%\funscript_rename_host_v2.py"

:: Create native messaging directory if it doesn't exist
if not exist "%NATIVE_HOST_DIR%" (
    echo Creating native messaging directory...
    mkdir "%NATIVE_HOST_DIR%"
)

:: Get Python executable path
for /f "tokens=*" %%i in ('where python') do set "PYTHON_PATH=%%i"

:: Convert paths to use forward slashes for JSON
set "PYTHON_PATH_JSON=%PYTHON_PATH:\=/%"
set "PYTHON_SCRIPT_JSON=%PYTHON_SCRIPT:\=/%"

:: Create the JSON manifest file
echo Creating native host manifest...
(
echo {
echo   "name": "funscript_rename_host",
echo   "description": "Native messaging host for Funscript Download Tracker",
echo   "path": "%PYTHON_PATH_JSON%",
echo   "type": "stdio",
echo   "allowed_extensions": ["funscript-tracker@example.com"],
echo   "args": ["%PYTHON_SCRIPT_JSON%"]
echo }
) > "%NATIVE_HOST_DIR%\%JSON_FILE%"

echo.
echo Native host manifest created at:
echo %NATIVE_HOST_DIR%\%JSON_FILE%
echo.

:: Test if the Python script exists
if not exist "%PYTHON_SCRIPT%" (
    echo WARNING: Python script not found at expected location
    echo Expected: %PYTHON_SCRIPT%
    echo Please ensure the native-host folder is complete
    pause
    exit /b 1
)

:: Test Python script
echo Testing Python script...
python "%PYTHON_SCRIPT%" --version >nul 2>&1
if errorlevel 1 (
    echo Testing basic Python execution...
    echo {"action": "ping"} | python "%PYTHON_SCRIPT%" >nul 2>&1
    if errorlevel 1 (
        echo WARNING: Could not test Python script
        echo The script may still work with the extension
    ) else (
        echo Python script is working!
    )
) else (
    echo Python script is working!
)

echo.
echo ===============================================
echo Installation Complete!
echo ===============================================
echo.
echo Next steps:
echo 1. Restart Firefox if it's currently running
echo 2. Install the extension from the packages folder
echo 3. Check Settings -^> Native Host Status in the extension
echo.
echo If you encounter issues:
echo - Make sure Python 3.6+ is installed
echo - Check that the extension ID matches in manifest.json
echo - Review the browser console for error messages
echo.
pause