@echo off
chcp 65001 >nul
title LINE Webhook Tunnel (Cloudflare)
echo ===================================================
echo  Starting Cloudflare Tunnel for LINE Webhook...
echo  Target: http://localhost:3000
echo ===================================================
echo.
echo * Note: Copy the https://xxxx.trycloudflare.com URL
echo * and paste into LINE Developers Console (Webhook URL)
echo.
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000
pause

