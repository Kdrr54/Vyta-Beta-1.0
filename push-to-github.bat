@echo off
echo ========================================================
echo    Envoi du code Vyta vers GitHub (Vyta-Beta-1.0)
echo ========================================================
echo.
git push -u origin choose_ai_ide_tool:main
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCES] Le code a ete envoye avec succes sur GitHub !
    echo Le serveur Mac de GitHub va maintenant compiler votre application iOS.
) else (
    echo [ATTENTION] Verifiez vos identifiants GitHub si demande.
)
pause
