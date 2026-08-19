export const SHOWS_WIDGET_URI = "ui://widget/shows.html";

export const showsWidgetHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>CineConcerts Shows</title>
    <style>
      :root {
        color: #0b0b0f;
        font-family: Inter, system-ui, -apple-system, sans-serif;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        width: 100%;
      }

      body {
        background: #f7f8fc;
      }

      main {
        padding: 12px;
      }

      h2 {
        margin: 0 0 10px;
        font-size: 16px;
      }

      p {
        margin: 0;
      }

      #summary {
        color: #4b5563;
        font-size: 13px;
        margin-bottom: 8px;
      }

      #empty {
        color: #4b5563;
        font-size: 14px;
      }

      #shows {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .card {
        border-radius: 12px;
        padding: 10px 12px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
      }

      .title {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 4px;
      }

      .meta {
        font-size: 12px;
        color: #4b5563;
        margin-bottom: 4px;
      }

      .cta {
        display: inline-block;
        margin-top: 4px;
        font-size: 12px;
        color: #1d4ed8;
        text-decoration: none;
      }

      .cta:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <main>
      <h2 id="title">Upcoming CineConcerts Shows</h2>
      <p id="summary">Waiting for results...</p>
      <p id="empty">Loading shows...</p>
      <ul id="shows"></ul>
    </main>

    <script type="module">
      const listEl = document.querySelector("#shows");
      const emptyEl = document.querySelector("#empty");
      const titleEl = document.querySelector("#title");
      const summaryEl = document.querySelector("#summary");
      let widgetTitle = "Upcoming CineConcerts Shows";
      let source = null;
      let shows = [];

      function showLocation(show) {
        if (show && typeof show.location === "string" && show.location.length) {
          return show.location;
        }

        const parts = [];
        if (show && show.venue) parts.push(show.venue);
        if (show && show.city) parts.push(show.city);
        if (show && show.country) parts.push(show.country);
        return parts.join(", ");
      }

      function render() {
        listEl.innerHTML = "";
        titleEl.textContent = widgetTitle;

        const summaryText = source
          ? shows.length + " show(s) from " + source
          : shows.length + " show(s)";
        summaryEl.textContent = summaryText;

        if (!shows.length) {
          emptyEl.textContent = "No shows to display.";
          emptyEl.hidden = false;
          return;
        }

        emptyEl.hidden = true;

        shows.forEach((show) => {
          const li = document.createElement("li");
          li.className = "card";

          const title = document.createElement("p");
          title.className = "title";
          title.textContent = show.title || "CineConcerts Event";

          const date = document.createElement("p");
          date.className = "meta";
          date.textContent = "Date: " + (show.eventDate || "TBA");

          const location = document.createElement("p");
          location.className = "meta";
          location.textContent = "Location: " + (showLocation(show) || "TBA");

          li.appendChild(title);
          li.appendChild(date);
          li.appendChild(location);

          if (show.ticketUrl) {
            const link = document.createElement("a");
            link.className = "cta";
            link.href = show.ticketUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "View Tickets";
            li.appendChild(link);
          }

          listEl.appendChild(li);
        });
      }

      function updateFromResult(result) {
        const structured = result && result.structuredContent;
        const nextShows = structured && structured.shows;
        if (!Array.isArray(nextShows)) return;

        if (
          structured &&
          typeof structured.title === "string" &&
          structured.title.trim().length
        ) {
          widgetTitle = structured.title.trim();
        }

        if (
          structured &&
          typeof structured.source === "string" &&
          structured.source.trim().length
        ) {
          source = structured.source.trim();
        } else {
          source = null;
        }

        shows = nextShows;
        render();
      }

      window.addEventListener(
        "message",
        (event) => {
          if (event.source !== window.parent) return;
          const message = event.data;
          if (!message || message.jsonrpc !== "2.0") return;
          if (message.method !== "ui/notifications/tool-result") return;
          updateFromResult(message.params);
        },
        { passive: true }
      );

      window.addEventListener(
        "openai:set_globals",
        (event) => {
          const output =
            event && event.detail && event.detail.globals && event.detail.globals.toolOutput;
          if (output) updateFromResult(output);
        },
        { passive: true }
      );

      if (window.openai && window.openai.toolOutput) {
        updateFromResult(window.openai.toolOutput);
      }

      render();
    </script>
  </body>
</html>
`;
