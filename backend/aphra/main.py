from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from apra import verify_ahpra_registration
import uvicorn

app = FastAPI(
    title="AHPRA Verification API",
    description="API to verify AHPRA registration numbers in the background",
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "AHPRA Verification API is running"}

@app.get("/api/verify/{ahpra_number}")
async def verify_practitioner(ahpra_number: str):
    """
    Verify an AHPRA registration number.
    Returns practitioner details or error.
    """
    print(f"🚀 API Request to verify: {ahpra_number}")
    try:
        result = await verify_ahpra_registration(ahpra_number)
        
        if result.get("error"):
            # If there's an error, we can still return 200 with the error field,
            # or raise an exception based on preference.
            # Returning 200 with error details is often easier for clients to parse.
            return result
            
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
