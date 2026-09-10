import sys, asyncio
from playwright.async_api import async_playwright

MODE = sys.argv[1] if len(sys.argv) > 1 else "A"
OUT = "/app/frontend/store-assets/raw"
import os; os.makedirs(OUT, exist_ok=True)

async def root_text(page):
    return await page.evaluate("() => document.getElementById('root') ? document.getElementById('root').innerText : ''")

async def wait_for(page, needle, tries=40):
    for _ in range(tries):
        t = await root_text(page)
        if needle in t:
            return True
        await page.wait_for_timeout(1500)
    return False

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3)
        page = await ctx.new_page()
        await page.goto("http://localhost:3000", timeout=120000)
        await wait_for(page, "KJAPP")
        await page.wait_for_timeout(3000)

        if MODE == "A":
            await page.screenshot(path=f"{OUT}/onboarding.png")
            print("onboarding ok")
            await page.get_by_text("Kom i gang", exact=True).click()
            await page.wait_for_timeout(1200)
            await page.get_by_test_id("login-demo-fill").click()
            await page.wait_for_timeout(400)
            await page.get_by_test_id("login-submit").click()
            await wait_for(page, "Hvor vil du")
            await page.wait_for_timeout(3500)
            await page.screenshot(path=f"{OUT}/home.png")
            print("home ok")
            await page.get_by_test_id("quick-Jobb").click()
            await wait_for(page, "Bestill bilen")
            await page.wait_for_timeout(2500)
            await page.screenshot(path=f"{OUT}/booking.png")
            print("booking ok")
        else:
            await page.get_by_text("Kom i gang", exact=True).click()
            await page.wait_for_timeout(1200)
            await page.get_by_test_id("login-demo-fill").click()
            await page.wait_for_timeout(400)
            await page.get_by_test_id("login-submit").click()
            ok = await wait_for(page, "på vei")
            await page.wait_for_timeout(3500)
            await page.screenshot(path=f"{OUT}/tracking.png")
            print("tracking ok", ok)

        await browser.close()

asyncio.run(main())
