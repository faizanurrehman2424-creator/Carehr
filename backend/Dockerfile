# Use a base image that already has Playwright & Python installed
# This saves us from installing Chrome manually for the AHPRA check
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# 1. Install Tesseract OCR (The missing piece!)
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

# 2. Set up the working directory
WORKDIR /app

# 3. Copy requirements and install Python libraries
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copy the rest of the application code
COPY . .

# 5. Run the application
# We use the same command as before, but inside Docker
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "--timeout", "300", "main:app"]