"""Exercise the real app and write the four unedited Chromium renders."""
import json
import os
from pathlib import Path
import socket
import subprocess
import time
from urllib.request import urlopen

from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCRATCH = Path(os.environ.get("TMPDIR", ROOT / "out"))
SCRATCH.mkdir(parents=True, exist_ok=True)


def main():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    origin = f"http://127.0.0.1:{port}"
    server = subprocess.Popen(["node", "serve.ts", "--port", str(port)], cwd=ROOT, stdout=subprocess.DEVNULL)
    try:
        for attempt in range(50):
            try:
                with urlopen(origin, timeout=1) as response:
                    assert response.status == 200
                break
            except OSError:
                time.sleep(0.1)
        else:
            raise RuntimeError("Local app server did not start")
        executables = sorted((Path.home() / ".cache/ms-playwright").glob("chromium-*/chrome-linux/chrome"))
        if not executables:
            raise RuntimeError("No installed Playwright Chromium found")
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=str(executables[-1]), headless=True,
                                                 args=["--headless=new", "--no-sandbox"])
            context = browser.new_context(viewport={"width": 1280, "height": 720}, device_scale_factor=1,
                                          locale="en-US", timezone_id="UTC", reduced_motion="reduce")
            page = context.new_page()
            errors = []
            external = []
            requests = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("request", lambda request: requests.append(request.url))

            def local_only(route):
                if not route.request.url.startswith(origin + "/"):
                    external.append(route.request.url)
                    route.abort()
                else:
                    route.continue_()

            context.route("**/*", local_only)
            page.goto(origin)
            page.wait_for_selector("html[data-ready=true]")
            assert page.locator(".trophy-row").count() == 55
            assert page.locator("#earned-total").inner_text() == "0"
            assert page.locator("#spoilers").is_checked()
            assert "Just Like Paradise" not in page.locator("#results").inner_text()
            assert "Complete Gone Fishing." not in page.locator("#results").inner_text()
            page.locator('[data-open="2"]').click()
            assert "Your spoiler shield is on" in page.locator("#detail").inner_text()
            assert page.locator("#detail .guide-text").count() == 0
            page.locator('#detail button[data-toggle="2"]').click()
            assert "Just Like Paradise" in page.locator("#detail").inner_text()
            page.reload()
            page.wait_for_selector("html[data-ready=true]")
            assert page.locator('input[data-toggle="2"]').is_checked()
            assert page.locator("#earned-total").inner_text() == "1"
            print("PASS: fresh state, spoiler protection, earning reveal, persistence after reload")

            page.locator("#grade").select_option("silver")
            assert page.locator(".trophy-row").count() == 6
            page.locator('[data-kind="side"]').click()
            assert page.locator(".trophy-row").count() == 2
            page.locator("#search").fill("Shootist")
            assert page.locator(".trophy-row").count() == 1
            page.locator('[data-open="17"]').click()
            assert page.locator("#detail .source-list a").count() == 1
            page.locator("#counter").fill("29")
            page.locator("#counter").press("Tab")
            page.locator("#note").fill("Practice Griffin. <img src=x onerror=alert(1)>")
            page.reload()
            page.wait_for_selector("html[data-ready=true]")
            assert page.locator("#counter").input_value() == "29"
            assert "<img" in page.locator("#note").input_value()
            assert page.locator("#detail img").count() == 0
            print("PASS: combined grade/kind/search filters, cited detail, counters and escaped notes")

            backup = {"format": "leonida-fieldnotes", "version": 1, "earned": [17], "counters": {"17": 4}}
            page.locator("#import").set_input_files({"name": "backup.json", "mimeType": "application/json", "buffer": json.dumps(backup).encode()})
            page.wait_for_function("document.querySelector('#earned-total').textContent === '2'")
            assert page.locator('input[data-toggle="2"]').is_checked()
            assert page.locator('input[data-toggle="17"]').is_checked()
            assert page.locator("#counter").input_value() == "29"
            page.locator("#import").set_input_files({"name": "bad.json", "mimeType": "application/json", "buffer": b'{"earned":"not an array"}'})
            page.wait_for_function("document.querySelector('#toast').textContent.startsWith('Import not applied:')")
            assert page.locator("#earned-total").inner_text() == "2"
            with page.expect_download() as pending:
                page.locator("#export").click()
            download = pending.value
            export_path = SCRATCH / "fieldnotes-test-export.json"
            download.save_as(str(export_path))
            exported = json.loads(export_path.read_text())
            assert sorted(exported["earned"]) == [2, 17]
            assert exported["counters"]["17"] == 29
            print("PASS: real file import, atomic rejection, union merge and exported download contents")

            page.locator('[data-kind="story"]').click()
            page.locator("#search").fill("Headliners")
            assert page.locator(".trophy-row").count() == 0
            page.locator("#spoilers").uncheck()
            assert page.locator(".trophy-row").count() == 1
            page.locator('[data-open="11"]').click()
            assert "DWNFALL" in page.locator("#detail").inner_text()
            page.locator("#spoilers").check()
            assert "DWNFALL" not in page.locator("#detail").inner_text()
            assert "Headliners" not in page.locator("#results").inner_text()
            page.locator("#clear-filters").click()
            page.locator('[data-kind="online"]').click()
            assert "No lobby required" in page.locator("#results").inner_text()
            page.locator('[data-view="missable"]').click()
            assert page.locator(".trophy-row").count() == 1
            page.locator('[data-view="roadmap"]').click()
            assert page.locator(".route-stage").count() == 8
            assert page.locator(".trophy-row").count() == 55
            first = page.locator(".route-stage").first
            assert first.locator(".trophy-row").evaluate_all("rows => rows.map(row => Number(row.dataset.id))") == [2, 28, 3]
            assert "unconfirmed" in first.inner_text()
            print("PASS: spoiler-safe search, shield toggle, online empty state, missable watch and full roadmap")

            page.goto(origin + "/?shot=cover")
            page.wait_for_selector("html[data-ready=true]")
            assert page.locator("#earned-total").inner_text() == "13"
            page.locator('input[data-toggle="15"]').check()
            page.goto(origin)
            page.wait_for_selector("html[data-ready=true]")
            assert page.locator("#earned-total").inner_text() == "2"
            assert not page.locator('input[data-toggle="15"]').is_checked()
            print("PASS: deterministic shot progress never overwrites a real save")

            before = len(requests)
            context.set_offline(True)
            page.locator('[data-view="roadmap"]').click()
            page.locator(".route-stage summary").first.click()
            page.locator('[data-open="28"]').click()
            page.locator("#note").fill("Offline still works.")
            assert page.locator("#detail .guide-text").count() == 1
            assert len(requests) == before
            context.set_offline(False)
            assert not external, external
            print("PASS: interactions with browser offline; no external requests or interaction-time requests")

            page.set_viewport_size({"width": 390, "height": 844})
            page.goto(origin)
            page.wait_for_selector("html[data-ready=true]")
            assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
            page.locator("#close-detail").click()
            page.locator('[data-open="15"]').click()
            assert page.locator("#detail h2").inner_text() == "Cunning Stunts"
            page.locator("#close-detail").click()
            page.keyboard.press("/")
            assert page.locator("#search").evaluate("element => element === document.activeElement")
            print("PASS: 390px mobile layout and keyboard search shortcut")
            assert not errors, errors
            context.close()

            restricted = browser.new_context(viewport={"width": 1280, "height": 720})
            restricted.add_init_script("Object.defineProperty(globalThis, 'localStorage', {get() { throw new Error('Storage blocked'); }});")
            blocked_page = restricted.new_page()
            blocked_page.goto(origin)
            blocked_page.wait_for_selector("html[data-ready=true]")
            blocked_page.locator('input[data-toggle="15"]').check()
            assert blocked_page.locator("#earned-total").inner_text() == "1"
            assert "Unsaved" in blocked_page.locator("#save-state").inner_text()
            restricted.close()
            print("PASS: blocked localStorage getter degrades to an exportable in-memory tracker")

            shots = json.loads((ROOT / "shots.json").read_text())
            screenshot_dir = ROOT / "screenshots"
            screenshot_dir.mkdir(exist_ok=True)
            for starter in ("1-checklist.jpg", "2-silver.jpg", "3-bronze.jpg"):
                (screenshot_dir / starter).unlink(missing_ok=True)
            for shot in shots:
                capture = browser.new_context(viewport=shot["viewport"], device_scale_factor=1,
                                              locale="en-US", timezone_id="UTC", reduced_motion="reduce")
                tab = capture.new_page()
                tab.on("pageerror", lambda error: errors.append(str(error)))
                tab.goto(origin + shot["path"])
                tab.wait_for_selector("html[data-ready=true]")
                assert not tab.evaluate("document.documentElement.scrollWidth > innerWidth")
                assert tab.locator("#preview-label").is_visible()
                if shot["file"] not in ("02-spoiler-shield.png", "04-platinum-roadmap.png"):
                    box = tab.locator("#detail .source-list").bounding_box()
                    assert box and box["y"] + box["height"] <= 720, (shot["file"], box)
                if shot["file"] == "04-platinum-roadmap.png":
                    assert tab.locator(".route-stage").count() == 8
                    box = tab.locator(".route-stage").last.bounding_box()
                    assert box and box["y"] + box["height"] <= 720, box
                file = screenshot_dir / shot["file"]
                tab.screenshot(path=str(file), full_page=False, animations="disabled")
                image = Image.open(file).convert("RGB")
                assert image.size == (1280, 720)
                assert max(ImageStat.Stat(image).stddev) > 15
                assert file.stat().st_size <= 262144
                print(f"PASS: {shot['file']} — 1280x720, {file.stat().st_size} bytes, nonblank Chromium render")
                capture.close()
            assert len(list(screenshot_dir.iterdir())) == 4
            assert not errors, errors
            browser.close()
            print("PASS: all browser assertions; 4 screenshots match shots.json")
    finally:
        server.terminate()
        server.wait(timeout=5)


if __name__ == "__main__":
    main()
