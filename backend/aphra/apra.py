import asyncio
import json
import os
from playwright.async_api import async_playwright
from playwright_stealth import Stealth


async def verify_ahpra_registration(ahpra_number: str) -> dict:
    """
    Verify an AHPRA registration number against the official public register.
    Returns a dict with verification status and scraped practitioner info.
    """
    result = {
        "verified": False,
        "registration_number": ahpra_number,
        "practitioner_name": None,
        "profession": None,
        "division": None,
        "registration_status": None,
        "registration_type": None,
        "speciality": None,
        "location": None,
        "registration_expiry": None,
        "endorsements": None,
        "conditions": None,
        "qualifications": None,
        "raw_details": None,
        "error": None,
    }

    async with async_playwright() as p:
        user_data_dir = os.path.join(os.getcwd(), "ahpra_profile")

        print(f"\n🕵️  Launching browser with session storage...")
        print(f"📂 Profile stored at: {user_data_dir}")

        context = await p.chromium.launch_persistent_context(
            user_data_dir,
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/121.0.0.0 Safari/537.36"
            ),
        )

        page = context.pages[0] if context.pages else await context.new_page()
        stealth = Stealth()
        await stealth.apply_stealth_async(page)

        try:
            # ── Step 1: Navigate to the register page ────────────────
            print(f"🏥 Navigating to AHPRA register...")
            try:
                await page.goto(
                    "https://www.ahpra.gov.au/Registration/Registers-of-Practitioners.aspx",
                    wait_until="domcontentloaded",
                    timeout=30000,
                )
                print("   ✅ Navigation done, taking screenshot...")
                await page.screenshot(path="debug_nav_success.png")
            except Exception as nav_g:
                print(f"   ⚠️ Navigation error: {nav_g}")
                await page.screenshot(path="debug_nav_fail.png")
                raise nav_g

            await page.wait_for_load_state("networkidle", timeout=15000)
            await asyncio.sleep(2)

            # ── Check for firewall block ─────────────────────────────
            if await _is_blocked(page):
                cleared = await _wait_for_user_to_clear(page)
                if not cleared:
                    result["error"] = "Timed out waiting for firewall challenge."
                    await context.close()
                    return result

            # ── Step 2: Wait for search input ────────────────────────
            print("⏳ Waiting for the search form...")
            search_input = None
            for selector in ["#name-reg", "input[placeholder*='Name or Registration']"]:
                try:
                    await page.wait_for_selector(selector, state="visible", timeout=10000)
                    search_input = page.locator(selector).first
                    if await search_input.count() > 0:
                        print(f"   ✅ Found search input: {selector}")
                        break
                except Exception:
                    continue

            if search_input is None or await search_input.count() == 0:
                await page.screenshot(path="debug_no_input.png")
                result["error"] = "Could not find the search input."
                print(f"❌ {result['error']}")
                await context.close()
                return result

            # ── Step 3: Fill and submit search ───────────────────────
            print(f"🔍 Searching for: {ahpra_number}")
            await search_input.click()
            await asyncio.sleep(0.5)
            await search_input.fill(ahpra_number)
            await asyncio.sleep(1)
            print("   ⏎  Submitting search...")
            await search_input.press("Enter")

            print("⏳ Waiting for search results...")
            await page.wait_for_load_state("networkidle", timeout=20000)
            await asyncio.sleep(3)
            print("   📸 Taking search results screenshot...")
            await page.screenshot(path="debug_search_results.png")

            # Debug: Print all links
            try:
                links_data = await page.evaluate("""
                    () => Array.from(document.querySelectorAll('a')).map(a => ({
                        text: a.innerText.trim(),
                        href: a.getAttribute('href') || ''
                    }))
                """)
                print("\n🔗 --- DEBUG: SPECIFIC SEARCH RESULTS LINKS --- 🔗")
                for link in links_data:
                    txt = link['text']
                    href = link['href']
                    if 'Andrea' in txt or 'Lupson' in txt:
                        print(f"  👉 MATCH: Text: '{txt}' | Href: '{href}'")
                print("🔗 ----------------------------------- 🔗\n")
            except Exception as d_err:
                print(f"   ⚠️ Debug links error: {d_err}")

            # ── Check for firewall on results ────────────────────────
            if await _is_blocked(page):
                cleared = await _wait_for_user_to_clear(page)
                if not cleared:
                    result["error"] = "Blocked by firewall on search results."
                    await context.close()
                    return result

            # ── Step 4: Parse results page ───────────────────────────
            page_text = await page.inner_text("body")

            # Check for explicit "no results" message FIRST
            no_result_phrases = [
                "we cannot find any matches",
                "no results found",
                "no records found",
                "no matching",
                "0 result found",
                "did not match any",
            ]
            if any(phrase in page_text.lower() for phrase in no_result_phrases):
                print(f"❌ No practitioner found for: {ahpra_number}")
                result["verified"] = False
                result["error"] = None
                await context.close()
                return result

            # Check if we got results (look for "N result(s) found")
            if "result found" not in page_text.lower() and "results found" not in page_text.lower():
                print(f"❌ Could not determine search results for: {ahpra_number}")
                await page.screenshot(path="ambiguous_results.png")
                result["verified"] = False
                await context.close()
                return result

            print("✅ Results found!")

            # ── Step 5: Try to click practitioner name to get details ─
            # The practitioner name in results is a clickable link
            # Try several selectors for the link
            detail_clicked = False
            detail_selectors = [
                ".search-result-link",
                "a.practitioner-name-link",
                "a[href*='Registration-Detail']",
                "a[href*='registration-detail']",
                "tr td a",
                "table a",
                ".search-results table a",
                ".search-results a",
                ".result-item a",
            ]

            for selector in detail_selectors:
                loc = page.locator(selector).first
                try:
                    if await loc.count() > 0 and await loc.is_visible():
                        print(f"   🔗 Clicking detail link ({selector})...")
                        await loc.click()
                        detail_clicked = True
                        break
                except Exception:
                    continue

            # If no CSS selector worked, try clicking by the practitioner name text
            if not detail_clicked:
                # Extract practitioner name from the results table
                name_from_results = await _extract_name_from_results(page)
                if name_from_results:
                    print(f"   🔗 Trying to click on: {name_from_results}")
                    name_link = page.locator(f"a:has-text('{name_from_results}')").first
                    try:
                        if await name_link.count() > 0:
                            await name_link.click()
                            detail_clicked = True
                    except Exception:
                        pass

            if detail_clicked:
                print("⏳ Loading practitioner detail page...")
                await page.wait_for_load_state("networkidle", timeout=15000)
                await asyncio.sleep(3)

                if await _is_blocked(page):
                    cleared = await _wait_for_user_to_clear(page)
                    if not cleared:
                        result["error"] = "Blocked on detail page."
                        await context.close()
                        return result

                # Scrape the detail page
                result = await _scrape_detail_page(page, result)
                print("📋 Scraped detail page.")
            else:
                # Fall back: parse the search results page itself
                print("📋 Detail link not found — parsing search results page instead...")
                result = await _parse_search_results_page(page, result)

        except Exception as e:
            result["error"] = str(e)
            print(f"💥 Error: {e}")
            await page.screenshot(path="error_screenshot.png")

        await asyncio.sleep(3)
        await context.close()

    return result


# ═══════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════

async def _is_blocked(page) -> bool:
    try:
        content = await page.inner_text("body")
        title = await page.title()
        if "rejected" in title.lower():
            return True
        if "the requested url was rejected" in content.lower():
            return True
        if "support id" in content.lower() and len(content) < 500:
            return True
    except Exception:
        pass
    return False


async def _wait_for_user_to_clear(page, timeout=0) -> bool:
    print("⚠️  Firewall block detected! (Headless Mode - No human present)")
    await page.screenshot(path="firewall_block_headless.png")
    return False


async def _extract_name_from_results(page) -> str:
    """Try to extract the practitioner name from the search results table."""
    try:
        name = await page.evaluate("""
            () => {
                const body = document.body.innerText;
                const lines = body.split('\\n').map(l => l.trim()).filter(l => l.length > 0);

                let headerIdx = -1;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i] === 'Practitioner Name') {
                        headerIdx = i;
                        break;
                    }
                }

                if (headerIdx === -1) return null;

                const knownHeaders = ['Practitioner Name', 'Profession', 'Division',
                                       'Registration Type', 'Speciality', 'Location'];
                let dataStartIdx = headerIdx;

                for (let i = headerIdx; i < lines.length; i++) {
                    if (!knownHeaders.includes(lines[i])) {
                        dataStartIdx = i;
                        break;
                    }
                }

                const headerCount = dataStartIdx - headerIdx;
                const headers = lines.slice(headerIdx, dataStartIdx);
                const values = lines.slice(dataStartIdx, dataStartIdx + headerCount);

                for (let i = 0; i < headers.length && i < values.length; i++) {
                    if (headers[i] === 'Practitioner Name') {
                        return values[i];
                    }
                }
                return null;
            }
        """)
        return name
    except Exception:
        return None


async def _parse_search_results_page(page, result: dict) -> dict:
    """
    Parse practitioner info from the search results page when we can't
    navigate to the detail page. Uses JS to read the structured table.
    """
    result["verified"] = True

    try:
        # Use JavaScript to extract the table data from the search results
        data = await page.evaluate("""
            () => {
                const info = {};
                const body = document.body.innerText;

                // The results page shows data in a structured format:
                // Header row: Practitioner Name | Profession | Division | Registration Type | Speciality | Location
                // Value row:  Ms Foo Bar        | Nurse      | Division 1 | General        | -          | City, State

                // Look for all text nodes after "result found" and before the footer
                const lines = body.split('\\n').map(l => l.trim()).filter(l => l.length > 0);

                // Find index of the headers row
                let headerIdx = -1;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i] === 'Practitioner Name') {
                        headerIdx = i;
                        break;
                    }
                }

                if (headerIdx === -1) return info;

                // Read headers starting from headerIdx
                const knownHeaders = ['Practitioner Name', 'Profession', 'Division',
                                       'Registration Type', 'Speciality', 'Location'];
                let dataStartIdx = headerIdx;

                // Find where headers end and data begins
                // Headers are consecutive known fields
                for (let i = headerIdx; i < lines.length; i++) {
                    if (!knownHeaders.includes(lines[i])) {
                        dataStartIdx = i;
                        break;
                    }
                }

                // Now read the values in the same order as the headers
                const headerCount = dataStartIdx - headerIdx;
                const headers = lines.slice(headerIdx, dataStartIdx);
                const values = lines.slice(dataStartIdx, dataStartIdx + headerCount);

                for (let i = 0; i < headers.length && i < values.length; i++) {
                    info[headers[i]] = values[i];
                }

                return info;
            }
        """)

        if data:
            result["practitioner_name"] = data.get("Practitioner Name")
            result["profession"] = data.get("Profession")
            result["division"] = data.get("Division")
            result["registration_type"] = data.get("Registration Type")
            result["speciality"] = data.get("Speciality")
            result["location"] = data.get("Location")

            print(f"   👤 Name: {result['practitioner_name']}")
            print(f"   🏥 Profession: {result['profession']}")

    except Exception as e:
        print(f"   ⚠️  Could not parse results table: {e}")

    # Also store the raw text of just the results area
    try:
        results_area = page.locator(".search-results, .results-container, main").first
        if await results_area.count() > 0:
            result["raw_details"] = (await results_area.inner_text()).strip()
        else:
            result["raw_details"] = (await page.inner_text("body")).strip()
    except Exception:
        pass

    return result


async def _scrape_detail_page(page, result: dict) -> dict:
    """Scrape details from the AHPRA practitioner detail page."""
    result["verified"] = True
    orig_name = result.get("practitioner_name")

    # Try to find the details container
    for selector in [".registration-details-list", ".practitioner-details",
                     "#registration-details", ".content-area", "main"]:
        locator = page.locator(selector).first
        if await locator.count() > 0:
            text = await locator.inner_text()
            if text.strip():
                result["raw_details"] = text.strip()
                break

    if not result["raw_details"]:
        result["raw_details"] = (await page.inner_text("body")).strip()

    text = result["raw_details"] or ""
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    def find_next(label):
        clean_label = label.lower().replace("\xa0", " ").strip()
        for i, line in enumerate(lines):
            clean_line = line.lower().replace("\xa0", " ").strip()
            if clean_label == clean_line:
                if i + 1 < len(lines):
                    val = lines[i + 1].strip()
                    if "expiry" in clean_label:
                        is_valid_date = "/" in val and len(val) <= 12
                        if not is_valid_date:
                            continue
                    return val
        return None

    # Parse key fields using line-by-line lookahead
    result["registration_expiry"] = find_next("Registration Expiry Date")
    result["profession"] = find_next("Profession")
    result["registration_status"] = find_next("Registration status")
    
    # Try alternate capitalizations or wording if first lookahead fails
    if not result["registration_expiry"]:
        result["registration_expiry"] = find_next("Registration expiry date")

    # If original name was a valid string from result, keep it
    if orig_name and len(orig_name) > 3 and orig_name != "Registration Details":
        result["practitioner_name"] = orig_name
    else:
        # Fallback to look for Name right after "Start new search" or "results" text
        for i, line in enumerate(lines):
            if "Start new search" in line and i + 1 < len(lines):
                result["practitioner_name"] = lines[i + 1]
                break
        
        # Heading fallback
        if not result["practitioner_name"] or result["practitioner_name"] == "Registration Details":
            for sel in ["h1", "h2", ".practitioner-name"]:
                heading = page.locator(sel).first
                if await heading.count() > 0:
                    name = (await heading.inner_text()).strip()
                    if name and len(name) < 200 and name != "Registration Details":
                        result["practitioner_name"] = name
                        break

    return result


# ═══════════════════════════════════════════════════════
#  Output
# ═══════════════════════════════════════════════════════

def print_result(result: dict):
    print("\n" + "=" * 55)
    if result["verified"]:
        print("  ✅  VERIFIED — Practitioner found on AHPRA Register")
    else:
        print("  ❌  NOT VERIFIED — Practitioner NOT found")
    print("=" * 55)

    for label, key in [
        ("Registration #", "registration_number"),
        ("Name", "practitioner_name"),
        ("Profession", "profession"),
        ("Division", "division"),
        ("Status", "registration_status"),
        ("Type", "registration_type"),
        ("Speciality", "speciality"),
        ("Location", "location"),
        ("Expiry", "registration_expiry"),
        ("Endorsements", "endorsements"),
        ("Conditions", "conditions"),
        ("Qualifications", "qualifications"),
    ]:
        value = result.get(key)
        if value:
            print(f"  {label:20s}: {value}")

    if result.get("error"):
        print(f"\n  ⚠️  Error: {result['error']}")

    print("=" * 55)
    print("\n📋 Full JSON result:")
    print(json.dumps(result, indent=2, default=str))


# ═══════════════════════════════════════════════════════
#  Main — test with valid + invalid number
# ═══════════════════════════════════════════════════════

async def main():
    print("\n" + "─" * 55)
    print("  TEST 1 — Valid AHPRA number")
    print("─" * 55)
    valid = await verify_ahpra_registration("NMW0001537428")
    print_result(valid)

    print("\n" + "─" * 55)
    print("  TEST 2 — Invalid AHPRA number (should NOT be verified)")
    print("─" * 55)
    invalid = await verify_ahpra_registration("XYZ0000000000")
    print_result(invalid)


if __name__ == "__main__":
    asyncio.run(main())