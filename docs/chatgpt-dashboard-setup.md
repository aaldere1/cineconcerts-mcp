# ChatGPT Dashboard Setup (Apps SDK)

Use this runbook to connect and validate this MCP app inside ChatGPT.

## 1) Enable Developer Mode in ChatGPT

1. Open ChatGPT web.
2. Go to **Settings -> Apps & Connectors -> Advanced settings**.
3. Turn on **Developer Mode**.

## 2) Create or refresh your connector

1. Go to **Settings -> Connectors -> Create**.
2. Fill in:
   - **Name**: `CineConcerts`
   - **Description**: Search and explore upcoming CineConcerts events worldwide.
   - **URL**: your public HTTPS MCP endpoint, including `/mcp` path.
     - Example: `https://your-domain.com/mcp`
3. Click **Create**.
4. Confirm the tool list shows:
   - `search_shows`
   - `find_nearby_shows`
   - `list_upcoming_shows`
   - `get_show_details`
   - `render_upcoming_shows_widget`

If the connector already exists, open it and click **Refresh** after deploying changes.

## 3) Validate in a new chat

1. Start a new ChatGPT chat.
2. Click **+ -> More** and enable your `CineConcerts` connector.
3. Run one data prompt:
   - "Find Harry Potter shows near London."
4. Run one render prompt:
   - "Render those results in a widget."
5. Verify:
   - A data tool is called first.
   - `render_upcoming_shows_widget` is called with `shows`.
   - The widget appears and matches the returned results.

## 4) If running locally

1. Start local server (`npm run dev`).
2. Expose it with tunnel (ngrok/Cloudflare Tunnel).
3. Use tunnel URL + `/mcp` in connector settings.
4. Keep tunnel process running while testing.

## 5) Ongoing update cycle

After each MCP/tool change:

1. Deploy (or restart local server).
2. Open connector settings.
3. Click **Refresh**.
4. Re-run golden prompts in `docs/apps-sdk-golden-prompts.md`.
