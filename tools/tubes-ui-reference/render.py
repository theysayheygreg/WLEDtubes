#!/usr/bin/env python3
import argparse, pathlib, shutil, subprocess

def main():
 p=argparse.ArgumentParser(); p.add_argument('--variant',type=int,choices=[1,2,3],required=True); p.add_argument('--out',required=True); a=p.parse_args()
 root=pathlib.Path(__file__).parent; out=pathlib.Path(a.out); out.mkdir(parents=True,exist_ok=True)
 screens=('home','conductor','surveyor')
 try:
  from playwright.sync_api import sync_playwright
 except ImportError:
  chrome=shutil.which('chromium') or shutil.which('google-chrome') or '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  if not pathlib.Path(chrome).exists(): raise SystemExit('Install Playwright or make Chrome available')
  for screen in screens:
   url=(root/'index.html').as_uri()+f'?variant={a.variant}&screen={screen}'
   subprocess.run([chrome,'--headless=new','--hide-scrollbars','--disable-gpu','--window-size=480,480',f'--screenshot={str((out/(screen+".png")).resolve())}',url],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 else:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(); page=browser.new_page(viewport={'width':480,'height':480},device_scale_factor=1)
   for screen in screens:
    page.goto((root/'index.html').as_uri()+f'?variant={a.variant}&screen={screen}'); page.screenshot(path=str(out/(screen+'.png')))
   browser.close()
 print(f'rendered 3 screens at 480x480 in {out}')
if __name__=='__main__': main()
