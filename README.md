# CineConcerts MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that provides real-time access to CineConcerts film-concert event data. Search for Harry Potter, Godfather, Gladiator, and other film-concert experiences happening worldwide.

Works with **Claude**, **ChatGPT**, **Cursor**, **VS Code**, **Windsurf**, and any MCP-compatible client.

## Server URL

```
https://cineconcerts.digital/mcp/
```

No API key required. No authentication. Just connect and start searching.

---

## Setup Instructions

### Claude Code

Run this in your terminal:

```bash
claude mcp add --transport http cineconcerts https://cineconcerts.digital/mcp/
```

To make it available across all your projects:

```bash
claude mcp add --transport http --scope user cineconcerts https://cineconcerts.digital/mcp/
```

To share with your team, add a `.mcp.json` file to your project root:

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

Verify with `claude mcp list` or type `/mcp` inside Claude Code.

### Claude Desktop

1. Open **Settings** (gear icon) > **Connectors**
2. Click **"Add custom connector"**
3. Paste the URL: `https://cineconcerts.digital/mcp/`
4. Click **"Add"**

Requires a Pro, Max, Team, or Enterprise plan.

### ChatGPT

1. Go to **Settings > Apps & Connectors > Advanced settings**
2. Toggle **Developer Mode** on
3. Go to **Settings > Connectors > Create**
4. Enter:
   - **Name:** `CineConcerts`
   - **URL:** `https://cineconcerts.digital/mcp/`
5. Click **Create**
6. In any chat, click **+** > **More** > select **CineConcerts**

Requires a Pro, Team, Enterprise, or Edu plan.

### Cursor

Add to `.cursor/mcp.json` in your project root (or `~/.cursor/mcp.json` for global):

```json
{
  "mcpServers": {
    "cineconcerts": {
      "url": "https://cineconcerts.digital/mcp/"
    }
  }
}
```

Or go to **Cursor Settings** (Cmd+,) and search for "MCP" to add it via the UI.

### VS Code + GitHub Copilot

Requires VS Code 1.99+ with the GitHub Copilot extension.

Add to `.vscode/mcp.json` in your project root:

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

Note: VS Code uses `"servers"` as the top-level key (not `"mcpServers"`). Tools are available in Copilot's **Agent mode**.

### Windsurf

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

Note: Windsurf uses `"serverUrl"` (not `"url"`).

### Cline

Open Cline's MCP panel > **Remote Servers** tab > **Edit Configuration**, then add:

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

### Continue

Add to `.continue/config.yaml` in your workspace:

```yaml
mcpServers:
  - name: cineconcerts
    type: streamable-http
    url: https://cineconcerts.digital/mcp/
```

Tools are available in Continue's **Agent mode**.

---

## Tools

### `search_shows`

Search for events by keyword — film title, city, venue, or any text.

```
"Find Harry Potter concerts"
"Any shows in Prague?"
"Gladiator in concert"
```

### `find_nearby_shows`

Find events near a location. Accepts city names, addresses, or landmarks.

```
"Shows near New York"
"Concerts within 200km of London"
"Anything near Tokyo Tower?"
```

### `list_upcoming_shows`

Browse all upcoming events (up to 60).

```
"What CineConcerts shows are coming up?"
"List the next 10 events"
```

### `get_show_details`

Get full details for a specific show by its show code.

```
"Get details for show HP3"
"Tell me about HP8"
```

Returns title, date, venue, city, country, poster image, ticket link, pre-sale status, and more.

---

## What You Get Back

Each event includes:

| Field | Example |
|-------|---------|
| **Title** | Harry Potter and the Prisoner of Azkaban™ In Concert |
| **Date** | 03/06/2026 to 03/07/2026 |
| **Location** | Popejoy Hall, Albuquerque, New Mexico, United States |
| **Show Code** | HP3 |
| **Poster** | Link to event poster image |
| **Tickets** | Direct link to purchase tickets |

## How It Works

The server connects to the same public event database that powers [cineconcerts.com](https://www.cineconcerts.com), the CineConcerts mobile app, and the interactive concert map. All data is public and read-only — the MCP server simply provides an AI-friendly interface to it.

Built with TypeScript, Express, and the [official MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) using [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) transport. Location search is powered by [Nominatim](https://nominatim.openstreetmap.org/) geocoding.

## Events

Currently ~60 active events including:

- Harry Potter film series (all 8 films)
- The Godfather
- Gladiator
- Breakfast at Tiffany's
- Elf
- It's a Wonderful Life
- DreamWorks Animation
- Polar Express
- Rudy
- Brave
- and more

## License

MIT

## About CineConcerts

[CineConcerts](https://www.cineconcerts.com) produces film-concert experiences worldwide — a full symphony orchestra performs a film's entire score live to picture on a giant screen. Since 2016, CineConcerts has performed over 1,500 shows across 48 countries to over 3 million fans.
