#!/usr/bin/env bash
# Exit on error
set -o errexit

# 1. Install Tesseract OCR (The Linux Tool)
apt-get update && apt-get install -y tesseract-ocr tesseract-ocr-eng

# 2. Install Python Dependencies
pip install -r requirements.txt

# 3. Install Playwright Browsers (If needed for your other tools)
playwright install chromium
