import logging
import sys
import os

# Add the aphra directory to the path so we can import from it
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "aphra"))

from apra import verify_ahpra_registration

logger = logging.getLogger(__name__)


def _normalize_name(name: str) -> str:
    """Normalize a name for comparison: lowercase, strip titles, extra spaces."""
    if not name:
        return ""
    name = name.lower().strip()
    # Remove common titles/salutations
    for title in ["mr", "mrs", "ms", "miss", "dr", "prof", "professor"]:
        if name.startswith(title + " ") or name.startswith(title + "."):
            name = name[len(title):].lstrip(". ")
    return " ".join(name.split())  # collapse whitespace


def _names_match(scraped_name: str, candidate_first: str, candidate_last: str) -> bool:
    """
    Check if the scraped practitioner name matches the candidate.
    Flexible matching: checks if both first and last name appear in the scraped name.
    """
    if not scraped_name or not candidate_last:
        return False

    scraped = _normalize_name(scraped_name)
    first = _normalize_name(candidate_first)
    last = _normalize_name(candidate_last)

    # Check if last name appears in scraped name (required)
    if last not in scraped:
        return False

    # Check if first name appears (if provided)
    if first and first not in scraped:
        return False

    return True


async def verify_ahpra_live(registration_id: str, last_name: str) -> dict:
    """
    REAL VALIDATOR: Uses Playwright browser automation to verify AHPRA registration.
    Returns a dict with status, details, and full verification data.
    """
    logger.info(f"Starting REAL AHPRA verification for ID: {registration_id}")

    if not registration_id or registration_id == "Not Found":
        return {
            "status": "Error",
            "details": "No valid registration ID provided",
            "verification": None,
        }

    try:
        result = await verify_ahpra_registration(registration_id)

        if result.get("error"):
            return {
                "status": "Error",
                "details": result["error"],
                "verification": result,
            }

        if not result.get("verified"):
            return {
                "status": "Not Found",
                "details": "Registration number not found on AHPRA register",
                "verification": result,
            }

        # Verified — return full details
        return {
            "status": "Verified",
            "details": f"Verified as {result.get('practitioner_name', 'Unknown')}",
            "verification": result,
        }

    except Exception as e:
        logger.error(f"AHPRA verification failed: {e}")
        return {
            "status": "Error",
            "details": f"Verification system error: {str(e)}",
            "verification": None,
        }


async def verify_ahpra_full(registration_id: str, candidate_first: str, candidate_last: str) -> dict:
    """
    Full AHPRA verification with name matching.
    Returns structured result including name_match status.
    """
    base_result = await verify_ahpra_live(registration_id, candidate_last)

    verification_data = base_result.get("verification") or {}
    scraped_name = verification_data.get("practitioner_name")
    registration_expiry = verification_data.get("registration_expiry")

    name_match = None
    if base_result["status"] == "Verified" and scraped_name:
        name_match = _names_match(scraped_name, candidate_first, candidate_last)

    return {
        "status": base_result["status"],
        "details": base_result["details"],
        "practitioner_name": scraped_name,
        "registration_expiry": registration_expiry,
        "registration_status": verification_data.get("registration_status"),
        "profession": verification_data.get("profession"),
        "name_match": name_match,
        "verification": verification_data,
    }