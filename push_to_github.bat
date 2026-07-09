@echo off
echo ===================================================
echo   Pushing AI Form Builder to GitHub
echo ===================================================
echo.

:: 1. Check if git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Git is not installed or not in your PATH.
    echo Please install Git from https://git-scm.com/ and try again.
    pause
    exit /b 1
)

:: 2. Initialize Git repo if it isn't (already initialized, but defensive)
if not exist .git (
    echo Initializing Git repository...
    git init
)

:: 3. Add remote
echo Configuring remote github repository...
git remote remove origin >nul 2>nul
git remote add origin https://github.com/kiraan12/AI-Form-Builder.git

:: 4. Stage all changes
echo Staging files...
git add .

:: 5. Create commit
echo Creating initial commit...
git commit -m "Initial commit: AI-Powered Form Builder & Document Autofill"

:: 6. Rename branch to main
echo Renaming current branch to main...
git branch -M main

:: 7. Push to GitHub
echo Pushing to GitHub (origin/main)...
echo.
echo NOTE: A GitHub authentication window may open if you are not signed in.
echo.
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Push failed. Make sure:
    echo 1. The repository https://github.com/kiraan12/AI-Form-Builder.git exists and is empty.
    echo 2. You have write permissions to this repository.
    echo 3. You are authenticated with Git/GitHub.
    echo.
) else (
    echo.
    echo SUCCESS: Project pushed to GitHub successfully!
    echo.
)

pause
