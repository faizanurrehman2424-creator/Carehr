import os
import logging
from openai import AzureOpenAI

logger = logging.getLogger(__name__)

# --- CONFIG ---
AZURE_KEY = os.environ.get("AZURE_OPENAI_API_KEY") 
ENDPOINT = "https://crhr-model-testing.openai.azure.com/"
DEPLOYMENT_NAME = "gpt-4.1-nano"

client = None
if AZURE_KEY:
    try:
        client = AzureOpenAI(
            api_key=AZURE_KEY,
            api_version="2024-05-01-preview", 
            azure_endpoint=ENDPOINT
        )
    except Exception as e:
        logger.error(f"Failed to initialize Azure OpenAI client: {e}")

def process_chat_message_stream(user_message: str, candidate_data: dict, documents: list):
    """
    Uses GPT-4.1-Nano to act as a proactive, friendly CareHR Assistant.
    Now uses Generator to STREAM the response to the frontend!
    """
    if not client:
        yield "My systems are currently booting up. Please check the Azure API Key configuration!"
        return

    try:
        # 1. Analyze Current Uploads
        doc_list_str = "\n".join([f"- {d['category'].upper()}: Status is {d['status']}" for d in documents])
        if not doc_list_str:
            doc_list_str = "No documents uploaded yet."

        # 2. Calculate Missing Core Documents
        required_cats = {"cv", "ahpra", "police", "wwcc", "vaccinations"}
        uploaded_cats = {d['category'].lower() for d in documents}
        missing_cats = required_cats - uploaded_cats
        
        missing_list_str = ", ".join([c.replace("_", " ").upper() for c in missing_cats])
        if not missing_cats:
            missing_list_str = "None! All core baseline documents are received."

        # 3. The Advanced System Persona
        system_prompt = f"""
        You are the 'CareHR AI Assistant', a highly capable, warm, and proactive compliance expert for a medical recruitment agency.
        You are assisting a busy healthcare professional. Always be respectful, encouraging, and try to brighten their day!

        --- USER CONTEXT ---
        Name: {candidate_data.get('first_name', 'Candidate')}
        Role: {candidate_data.get('role', 'Health Professional')}
        
        --- COMPLIANCE STATUS ---
        Currently Uploaded Documents:
        {doc_list_str}

        Missing Core Documents:
        {missing_list_str}

        --- YOUR DIRECTIVES ---
        1. PROACTIVE GUIDANCE: If they ask "What do I do?" or "How do I start?", greet them warmly, list the specific documents they are missing from the 'Missing Core Documents' list, and tell them: "You can simply drag and drop your PDF files directly into this chat window, or click the paperclip icon to upload them!"
        2. STATUS UPDATES: If they ask if a document is uploaded, check the 'Currently Uploaded Documents' list. If AHPRA is 'RECEIVED', enthusiastically let them know it is currently being verified live by the system.
        3. COMPLIANCE TIPS: If asked, briefly explain why certain docs are needed (e.g., "A National Police Check ensures patient safety, which is our top priority!").
        4. UPLIFTING TONE: Healthcare is stressful. Occasionally sprinkle in a warm compliment, thank them for their dedication to healthcare, or wish them a great shift.
        5. LIMITATIONS: You do not upload the files yourself. The chat interface handles that in the background. Do not invent fake document statuses.
        """

        # 4. Generate Streamed Response
        response = client.chat.completions.create(
            model=DEPLOYMENT_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.7, 
            max_tokens=400,
            stream=True  # MAGIC WORD: Tells OpenAI to stream
        )
        
        for chunk in response:
            if chunk.choices and len(chunk.choices) > 0:
                content = chunk.choices[0].delta.content
                if content:
                    yield content

    except Exception as e:
        logger.error(f"Chatbot Error: {e}")
        yield "I'm having a little trouble connecting to my records right now. Please give me a moment and try again!"
