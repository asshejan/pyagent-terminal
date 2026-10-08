import { chromium } from "playwright-core";

// Drives the running site (npm run preview) in headless Edge. Usage: npm run e2e
const SHOTS = process.env.SHOTS || (await import("node:os")).tmpdir();
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

const term = () => page.locator(".scroll").innerText();
const lastOut = async (n = 1400) => (await term()).slice(-n);
async function cmd(line) {
  await page.locator(".cmd-input").waitFor({ timeout: 60000 });
  await page.locator(".cmd-input").fill(line);
  await page.locator(".cmd-input").press("Enter");
  await page.locator(".cmd-input").waitFor({ timeout: 60000 }); // reappears when not busy
}
async function setCode(code) {
  await page.waitForFunction(() => window.monaco?.editor.getModels().length > 0, null, { timeout: 60000 });
  await page.evaluate((c) => {
    const ed = window.monaco.editor.getEditors()[0];
    ed.getModel().setValue(c);
  }, code);
}
const step = (s) => console.log(`\n===== ${s}`);

await page.goto("http://localhost:4173/");
await page.screenshot({ path: `${SHOTS}/1-boot.png` });
const t0 = Date.now();
await page.waitForFunction(() => /python 3\./.test(document.querySelector(".statusbar")?.textContent || ""), null, { timeout: 90000 });
step(`python ready after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${await page.locator(".py").innerText()}`);

step("submit starter (expect fail)");
await cmd("submit");
console.log(await lastOut(700));

step("submit correct answer");
await setCode('def make_greeting(user, model):\n    print("debug:", user)\n    return f"Hello {user}, I am {model}."\n');
await cmd("submit");
console.log(await lastOut(500));
await page.screenshot({ path: `${SHOTS}/2-solved.png` });

step("run shows stdout");
await setCode('print("hi from python")\nfor i in range(3):\n    print(i)\n');
await page.keyboard.press("Escape");
await cmd("run");
console.log(await lastOut(250));

step("infinite loop -> timeout");
await setCode("while True:\n    pass\n");
const t1 = Date.now();
await cmd("run");
console.log(`(${((Date.now() - t1) / 1000).toFixed(1)}s)`, await lastOut(300));
await page.waitForFunction(() => /python 3\./.test(document.querySelector(".statusbar")?.textContent || ""), null, { timeout: 90000 });
await setCode('def make_greeting(user, model):\n    return f"Hello {user}, I am {model}."\n');
await cmd("submit");
console.log("after restart:", (await lastOut(200)).includes("3/3 tests passed") ? "OK submit works" : await lastOut(300));

step("syntax error");
await setCode("def broken(:\n    pass\n");
await cmd("run");
console.log(await lastOut(300));

step("navigation + hint + ls");
await cmd("next");
await cmd("hint");
console.log(await lastOut(300));
await cmd("ls lc");
console.log(await lastOut(700));

step("pydantic problem ai-08");
await cmd("open ai-08");
await cmd("solution --force");
await cmd("solution --load");
await cmd("submit");
console.log(await lastOut(400));

step("async problem ai-09");
await cmd("open ai-09");
await cmd("solution --force");
await cmd("solution --load");
await cmd("submit");
console.log(await lastOut(300));

step("langgraph capstone ma-06");
await cmd("open ma-06");
await cmd("solution --force");
await cmd("solution --load");
await cmd("submit");
console.log(await lastOut(300));
await page.screenshot({ path: `${SHOTS}/3-capstone.png` });
await cmd("setup");
await page.screenshot({ path: `${SHOTS}/4-setup.png` });

step("theme + progress + reload persistence");
await cmd("theme amber");
await cmd("progress");
await page.screenshot({ path: `${SHOTS}/5-amber-progress.png` });
await page.reload();
await page.locator(".cmd-input").waitFor();
await page.waitForTimeout(800);
console.log("after reload:", (await term()).slice(0, 900).split("\n").filter((l) => /resuming|━━━/.test(l)).join(" | "));
console.log("theme:", await page.evaluate(() => document.documentElement.dataset.theme));

step("mobile");
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${SHOTS}/6-mobile.png` });
console.log("horizontal overflow:", await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));

step("console errors");
console.log(errors.length ? errors.join("\n") : "none");
await browser.close();
