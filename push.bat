@echo off
echo Checking Git status...
git status

echo.
echo Adding changes...
git add .

echo.
echo Committing changes...
git commit -m "%1"

echo.
echo Pushing to remote...
git push

echo.
echo Done!
pause 