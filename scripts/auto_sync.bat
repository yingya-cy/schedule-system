@echo off
cd /d "C:\Users\MR\Desktop\sc sys"
echo [%date% %time%] Auto sync started >> scripts\auto_sync.log

REM Step 1: Fetch new WeChat articles
python scripts\sync_kb.py >> scripts\auto_sync.log 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] sync_kb failed >> scripts\auto_sync.log
    exit /b 1
)

REM Step 2: Rebuild knowledge base from all sources
python scripts\rebuild_kb.py >> scripts\auto_sync.log 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] rebuild_kb failed >> scripts\auto_sync.log
    exit /b 1
)

REM Step 3: Rebuild embeddings cache (delete old, Flask will rebuild on next request)
del /f embeddings_cache.json 2>nul

echo [%date% %time%] Auto sync completed >> scripts\auto_sync.log
