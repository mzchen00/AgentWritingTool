import asyncio
import base64
import re
from urllib.parse import urljoin, urlparse
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SKIP_PATTERNS = re.compile(
    r'(pixel|tracking|analytics|beacon|logo|icon|sprite|avatar|badge|banner-ad|adsystem|doubleclick|googletag)',
    re.IGNORECASE
)
SKIP_EXTENSIONS = {'.svg', '.gif', '.webp'}


class ScrapeRequest(BaseModel):
    urls: list[str]

class ScrapeOneRequest(BaseModel):
    url: str


async def download_image(page, img_url: str, source_page: str):
    """Download one image via Playwright request context; return base64 data URL or None."""
    try:
        resp = await page.request.get(
            img_url,
            timeout=6000,
            headers={
                'Referer': source_page,
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            },
        )
        if not resp.ok:
            return None
        body = await resp.body()
        if len(body) < 2000:          # skip tracking pixels / tiny placeholders
            return None
        ct = resp.headers.get('content-type', 'image/jpeg').split(';')[0].strip()
        if not ct.startswith('image/'):
            return None
        return f"data:{ct};base64,{base64.b64encode(body).decode()}"
    except Exception:
        return None


async def scrape_one(browser, url: str) -> dict:
    page = await browser.new_page()
    try:
        await page.set_extra_http_headers({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        })
        await page.goto(url, timeout=15000, wait_until="domcontentloaded")

        # Scroll halfway to trigger lazy-load images
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight * 0.5)")
        await page.wait_for_timeout(1200)

        # Screenshot
        screenshot_bytes = await page.screenshot(type='jpeg', quality=55, full_page=False)
        screenshot_data_url = f"data:image/jpeg;base64,{base64.b64encode(screenshot_bytes).decode()}"

        title = await page.title()

        raw = await page.evaluate("""
            () => {
                const imgs = Array.from(document.querySelectorAll('img, [data-src], [data-lazy-src]'));
                return imgs.map(el => {
                    const src = el.src || el.getAttribute('data-src') || el.getAttribute('data-lazy-src') || '';
                    return {
                        url:    src,
                        alt:    el.alt || el.getAttribute('title') || '',
                        width:  el.naturalWidth  || el.width  || 0,
                        height: el.naturalHeight || el.height || 0,
                    };
                });
            }
        """)

        images = []
        seen = set()
        for img in raw:
            src = img.get('url', '').strip()
            if not src or not src.startswith('http'):
                continue
            if src in seen:
                continue
            seen.add(src)
            if SKIP_PATTERNS.search(src):
                continue
            path = urlparse(src).path.lower()
            if any(path.endswith(ext) for ext in SKIP_EXTENSIONS):
                continue
            w, h = img.get('width', 0), img.get('height', 0)
            if w and h and (w < 150 or h < 100):
                continue
            images.append({
                'url':         src,
                'alt':         img.get('alt', ''),
                'width':       w,
                'height':      h,
                'source_page': url,
            })

        images.sort(key=lambda i: i['width'] * i['height'], reverse=True)
        top = images[:6]

        # Download all images in parallel using the browser's request context
        data_urls = await asyncio.gather(*[download_image(page, img['url'], url) for img in top])
        for img, data_url in zip(top, data_urls):
            img['data_url'] = data_url   # base64 data URI, or None if download failed

        return {
            'url':        url,
            'title':      title,
            'images':     top,
            'screenshot': screenshot_data_url,
            'error':      None,
        }

    except PlaywrightTimeout:
        return {'url': url, 'title': '', 'images': [], 'screenshot': None, 'error': 'timeout'}
    except Exception as e:
        return {'url': url, 'title': '', 'images': [], 'screenshot': None, 'error': str(e)[:120]}
    finally:
        await page.close()


@app.post('/scrape-one')
async def scrape_one_endpoint(req: ScrapeOneRequest):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            result = await scrape_one(browser, req.url)
        finally:
            await browser.close()
    return result


@app.post('/scrape')
async def scrape(req: ScrapeRequest):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            tasks = [scrape_one(browser, url) for url in req.urls[:6]]
            results = await asyncio.gather(*tasks)
        finally:
            await browser.close()

    all_images = []
    seen_urls = set()
    for r in results:
        for img in r['images']:
            if img['url'] not in seen_urls:
                seen_urls.add(img['url'])
                all_images.append(img)

    all_images.sort(key=lambda i: i['width'] * i['height'], reverse=True)

    return {
        'results': results,
        'images':  all_images[:20],
    }


@app.get('/health')
async def health():
    return {'status': 'ok'}
