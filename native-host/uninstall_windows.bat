@echo off
setlocal enabledelayedexpansion

echo ===============================================
echo Funscript Organizer Native Host Uninstaller
echo For Windows
echo ===============================================
echo.

:: Set paths
set "FIREFOX_DIR=%APPDATA%\Mozilla\NativeMessagingHosts"
set "CHROME_DIR=%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts"
set "EDGE_DIR=%LOCALAPPDATA%\Microsoft\Edge\User Data\NativeMessagingHosts"
set "JSON_FILE=funscript_rename_host.json"

:: Remove from Firefox
if exist "%FIREFOX_DIR%\%JSON_FILE%" (
    echo Removing from Firefox...
    del "%FIREFOX_DIR%\%JSON_FILE%"
    echo Removed from Firefox
) else (
    echo Not found in Firefox
)

:: Remove from Chrome
if exist "%CHROME_DIR%\%JSON_FILE%" (
    echo Removing from Chrome...
    del "%CHROME_DIR%\%JSON_FILE%"
    echo Removed from Chrome
) else (
    echo Not found in Chrome
)

:: Remove from Edge
if exist "%EDGE_DIR%\%JSON_FILE%" (
    echo Removing from Edge...
    del "%EDGE_DIR%\%JSON_FILE%"
    echo Removed from Edge
) else (
    echo Not found in Edge
)

echo.
echo ===============================================
echo Uninstallation Complete!
echo ===============================================
echo.
echo The native host has been removed from all browsers.
echo You can now safely delete the native-host folder if desired.
echo.
pause