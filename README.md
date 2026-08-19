<div align="center">

# 🎬🎻 CineConcerts MCP Server

### Real-time film-concert events, piped straight into your AI.

*Ask Claude, ChatGPT, Cursor, or any MCP client where Harry Potter, The Godfather, or Gladiator are playing live with a full symphony orchestra — and get back real shows, real dates, real ticket links.*

[![MCP](https://img.shields.io/badge/MCP-Compatible-7C3AED?style=flat-square)](https://modelcontextprotocol.io/)
[![Transport](https://img.shields.io/badge/transport-Streamable%20HTTP-0EA5E9?style=flat-square)](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![No Auth](https://img.shields.io/badge/auth-none%20required-22C55E?style=flat-square)](#-connect-in-30-seconds)
[![License: MIT](https://img.shields.io/badge/license-MIT-black?style=flat-square)](./LICENSE)

```
https://cineconcerts.digital/mcp/
```

**No API key. No signup. No config file required.** Just connect and start asking.

<sub>Both `…/mcp` and `…/mcp/` work. If your client reports `failed_to_load` or 0 tools, it must accept **both** `application/json` and `text/event-stream` — that is required by the Streamable HTTP transport, and a client sending only `application/json` gets a 406.</sub>

</div>

---

## ⚡ Connect in 30 seconds

If you use **Claude Code**, that's one command:

```bash
claude mcp add --transport http cineconcerts https://cineconcerts.digital/mcp/
```

Then just ask:

> *"What Harry Potter concerts are coming up near London?"*

Using a different client? Jump to **[Setup](#-setup)** below — every major one is covered.

---

## 🎥 See it in action

**You ask:**

> *Find Harry Potter concerts*

**Claude calls `search_shows("Harry Potter")` and gets back:**

```
Found 20 show(s) matching "Harry Potter":

**Harry Potter and the Prisoner of Azkaban™ In Concert**
Date: 03/06/2026 to 03/07/2026
Location: Popejoy Hall, Albuquerque, New Mexico, United States
Show Code: HP3
Poster: https://cineconcerts.com/posters/hp3.jpg
Tickets: https://tickets.example.com/hp3

---

**Harry Potter and the Goblet of Fire™ In Concert**
Date: 04/18/2026
Location: Benaroya Hall, Seattle, Washington, United States
Show Code: HP4
Tickets: https://tickets.example.com/hp4

...
```

Your assistant turns that into a clean, conversational answer — with live links to buy tickets. No copy-pasting from a website, no out-of-date scraping.

---

## 📋 Table of contents

- [Why use it](#-why-use-it)
- [Setup](#-setup) — Claude Code · Codex · Claude Desktop · ChatGPT · Cursor · VS Code · Windsurf · Cline · Continue
- [Tools](#-tools)
- [What you get back](#-what-you-get-back)
- [Rate limits](#-rate-limits)
- [How it works](#-how-it-works)
- [Events catalog](#-events-catalog)
- [FAQ](#-faq)
- [License](#-license)

---

## 💡 Why use it

| | |
|---|---|
| 🔴 **Live data** | Pulls from the same event database that powers [cineconcerts.com](https://www.cineconcerts.com), the mobile app, and the interactive concert map. Always current. |
| 🌍 **Search how humans think** | By film, by city, by venue, or "anything near me." Natural-language geocoding handles the rest. |
| 🔓 **Zero friction** | No key, no auth, no account. Add one URL and go. |
| 🧰 **Works everywhere** | One server, every MCP client — Claude, ChatGPT, Cursor, VS Code, and more. |
| 🪶 **Read-only & safe** | Every tool is read-only. Nothing it touches can change your data or the catalog. |

---

## 🔌 Setup

> **One URL, every client:** `https://cineconcerts.digital/mcp/`

<details open>
<summary><b>Claude Code</b></summary>

<br>

Add it to the current project:

```bash
claude mcp add --transport http cineconcerts https://cineconcerts.digital/mcp/
```

Make it available across **all** your projects:

```bash
claude mcp add --transport http --scope user cineconcerts https://cineconcerts.digital/mcp/
```

Share it with your **team** — commit a `.mcp.json` to the project root:

```json
{
  "mcpServers": {
    "cineconcerts": {
      "type": "http",
      "url": "https://cineconcerts.digital/mcp/"
    }
  }
}
```

Verify with `claude mcp list`, or type `/mcp` inside Claude Code.

</details>

<details>
<summary><b>Codex CLI</b></summary>

<br>

```bash
codex mcp add cineconcerts --url https://cineconcerts.digital/mcp/
```

Or edit `~/.codex/config.toml` directly:

```toml
[mcp_servers.cineconcerts]
url = "https://cineconcerts.digital/mcp/"
```

Verify with `codex mcp list`.

</details>

<details>
<summary><b>Claude Desktop</b></summary>

<br>

1. Open **Settings** (gear icon) → **Connectors**
2. Click **Add custom connector**
3. Paste the URL: `https://cineconcerts.digital/mcp/`
4. Click **Add**

> Requires a Pro, Max, Team, or Enterprise plan.

</details>

<details>
<summary><b>ChatGPT</b></summary>

<br>

1. **Settings → Apps & Connectors → Advanced settings** → toggle **Developer Mode** on
2. **Settings → Connectors → Create**
3. Enter:
   - **Name:** `CineConcerts`
   - **URL:** `https://cineconcerts.digital/mcp/`
4. Click **Create**
5. In any chat: **+ → More →** select **CineConcerts**

> Requires a Pro, Team, Enterprise, or Edu plan.

</details>

<details>
<summary><b>Cursor</b></summary>

<br>

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "cineconcerts": {
      "url": "https://cineconcerts.digital/mcp/"
    }
  }
}
```

Or open **Cursor Settings** (`Cmd+,`) and search **MCP** to add it via the UI.

</details>

<details>
<summary><b>VS Code + GitHub Copilot</b></summary>

<br>

Requires VS Code 1.99+ with the GitHub Copilot extension. Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "cineconcerts": {
      "type": "http",
      "url": "https://cineconcerts.digital/mcp/"
    }
  }
}
```

> ⚠️ VS Code uses `"servers"` as the top-level key (not `"mcpServers"`). Tools show up in Copilot's **Agent mode**.

</details>

<details>
<summary><b>Windsurf</b></summary>

<br>

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "cineconcerts": {
      "serverUrl": "https://cineconcerts.digital/mcp/"
    }
  }
}
```

> ⚠️ Windsurf uses `"serverUrl"` (not `"url"`).

</details>

<details>
<summary><b>Cline</b></summary>

<br>

Open Cline's MCP panel → **Remote Servers** → **Edit Configuration**:

```json
{
  "mcpServers": {
    "cineconcerts": {
      "url": "https://cineconcerts.digital/mcp/",
      "disabled": false
    }
  }
}
```

</details>

<details>
<summary><b>Continue</b></summary>

<br>

Add to `.continue/config.yaml`:

```yaml
mcpServers:
  - name: cineconcerts
    type: streamable-http
    url: https://cineconcerts.digital/mcp/
```

> Tools are available in Continue's **Agent mode**.

</details>

---

## 🛠 Tools

Five read-only tools. Your AI picks the right one automatically from your question.

| Tool | What it does | Parameters |
|------|--------------|------------|
| 🔍 **`search_shows`** | Search by keyword — film title, city, venue, anything | `query` *(string, required)* |
| 📍 **`find_nearby_shows`** | Find shows near a place — city, address, or landmark | `location` *(string, required)*, `radius_km` *(number, default 500)* |
| 📅 **`list_upcoming_shows`** | Browse everything coming up | `limit` *(number, default 20, max 60)* |
| 🎟 **`get_show_details`** | Full details for one show by its code | `show_code` *(string, required)* |
| 🖼 **`render_upcoming_shows_widget`** | Render already-fetched shows as a visual widget | `shows` *(array, required)*, `title` *(string)*, `source` *(string)* |

### Example prompts

```
🔍  "Find Harry Potter concerts"
🔍  "Any shows in Prague?"
🔍  "Gladiator in concert"

📍  "Shows near New York"
📍  "Concerts within 200km of London"
📍  "Anything near Tokyo Tower?"

📅  "What CineConcerts shows are coming up?"
📅  "List the next 10 events"

🎟  "Get details for show HP3"
🎟  "Tell me about HP8"
```

### `render_upcoming_shows_widget`

Renders the shows you just fetched as a visual card list, for clients that
support MCP UI resources (such as the ChatGPT Apps SDK).

```
🖼  "Render the search results as a widget"
🖼  "Show these nearby events in UI"
```

It deliberately does **not** fetch anything itself — data and presentation stay
separate. Two steps:

1. Call a data tool (`search_shows`, `find_nearby_shows`, or `list_upcoming_shows`).
2. Pass that tool's `structuredContent.shows` straight into `render_upcoming_shows_widget`.

All four data tools now return `structuredContent` alongside their text, so the
hand-off needs no reshaping.

---

## 📦 What you get back

Every event comes back with:

| Field | Example |
|-------|---------|
| **Title** | Harry Potter and the Prisoner of Azkaban™ In Concert |
| **Date** | 03/06/2026 to 03/07/2026 |
| **Location** | Popejoy Hall, Albuquerque, New Mexico, United States |
| **Show Code** | HP3 |
| **Poster** | Link to the event poster image |
| **Tickets** | Direct link to buy tickets |

`get_show_details` returns the **complete** record — adding pre-sale status, "coming soon" flags, country flag, property, and any other field on the event.

---

## 🚦 Rate limits

Generous limits keep the service fast and free for everyone. Normal usage — even a long, query-heavy conversation — will never come close.

| Limit | Value |
|-------|-------|
| **Requests / minute** | 60 per IP |
| **Concurrent sessions** | 100 |
| **Idle session timeout** | 30 minutes |

Standard [`RateLimit`](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/) headers (draft-7) are included on every response, so well-behaved clients can self-pace.

---

## ⚙️ How it works

```
  Your AI client                CineConcerts MCP                   Data sources
 ┌──────────────┐   MCP /    ┌───────────────────┐   query    ┌────────────────────┐
 │ Claude /     │  Streamable│  Express server    │──────────► │ Algolia (live      │
 │ ChatGPT /    │◄──HTTP────►│  4 read-only tools │            │ event index)       │
 │ Cursor / ... │  JSON-RPC  │  rate-limited      │──────────► │ Nominatim (geocode)│
 └──────────────┘            └───────────────────┘            └────────────────────┘
```

- **Transport:** [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — the modern MCP transport, with proper session management and SSE notifications.
- **Stack:** TypeScript · Express · the [official MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) · `express-rate-limit`.
- **Event data:** Algolia-backed search over the same public catalog that powers [cineconcerts.com](https://www.cineconcerts.com), the mobile app, and the interactive map.
- **Location search:** [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap) geocoding turns "near Tokyo Tower" into coordinates, then does a radius search.
- **Health check:** `GET /health` returns server status, version, active session count, and the tool list — handy for uptime monitoring.

All data is **public and read-only**. The server is just an AI-friendly window onto it.

---

## 🎞 Events catalog

~60 active events at any time, refreshed live. Currently touring:

- 🦉 **Harry Potter** — all 8 films, in concert
- 🎩 **The Godfather**
- ⚔️ **Gladiator**
- 💎 **Breakfast at Tiffany's**
- 🎄 **Elf** · **The Polar Express** · **It's a Wonderful Life**
- 🐉 **DreamWorks Animation** in Concert
- 🏈 **Rudy**
- 🏹 **Brave**
- …and more

---

## ❓ FAQ

**Do I need an API key or account?**
No. The server is open and unauthenticated — just add the URL.

**Is it free?**
Yes. It's rate-limited to keep infrastructure costs sane, but there's no charge.

**Can it book tickets or change anything?**
No. Every tool is strictly read-only. It returns ticket *links* you can follow yourself.

**My client isn't listed — will it still work?**
Almost certainly. Any client that speaks MCP over Streamable HTTP can connect using the URL above.

**How fresh is the data?**
Live. It queries the production event index directly, so what you see is what's on sale right now.

**Why am I getting rate-limited?**
You're sending more than 60 requests/minute from one IP. Back off briefly — the `RateLimit` response headers tell you exactly when to retry.

---

## 📄 License

[MIT](./LICENSE) — free to use, fork, and build on.

---

## 🎼 About CineConcerts

[CineConcerts](https://www.cineconcerts.com) produces film-concert experiences worldwide: a full symphony orchestra performs a film's entire score, live to picture, on a giant screen. Since 2016, CineConcerts has staged **1,500+ shows across 48 countries** for over **3 million fans**.

<div align="center">

*Find your next show. Just ask your AI.*

</div>
