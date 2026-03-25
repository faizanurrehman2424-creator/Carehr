import sys
import asyncio
import uvicorn

# --- FORCE WINDOWS TO USE THE CORRECT EVENT LOOP FOR PLAYWRIGHT ---
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
# ----------------------------------------------------------------

if __name__ == "__main__":
    # Removed 'reload=True' to prevent Windows subprocess error
    uvicorn.run("main:app", host="127.0.0.1", port=8000)