# Apps SDK Golden Prompts

Use this checklist in ChatGPT Developer Mode whenever tool metadata or routing behavior changes.

## Direct prompts (should invoke CineConcerts tools)

- "Search CineConcerts for Harry Potter shows."
  - Expected: `search_shows`
- "Find CineConcerts concerts near Tokyo within 200km."
  - Expected: `find_nearby_shows`
- "List the next 10 CineConcerts events."
  - Expected: `list_upcoming_shows`
- "Get details for show code HP3."
  - Expected: `get_show_details`
- "Render these CineConcerts results in a widget."
  - Expected: `render_upcoming_shows_widget` (after a data tool call)

## Indirect prompts (should still discover CineConcerts)

- "What film concerts are coming up in Europe?"
  - Expected: likely `search_shows` first, optionally followed by render tool
- "Any orchestra performances where a movie plays on screen near Los Angeles?"
  - Expected: `find_nearby_shows`
- "I want to browse upcoming live movie-with-orchestra events."
  - Expected: `list_upcoming_shows`
- "Show me options for Gladiator in concert."
  - Expected: `search_shows`

## Negative prompts (should not invoke CineConcerts)

- "Set a reminder for tomorrow at 9am."
- "Summarize this PDF."
- "What's the weather in Paris?"
- "Draft an email to my team."

Expected: no CineConcerts tool calls.

## Regression run checklist

For each prompt above:

1. Record whether the correct tool was selected.
2. Record whether tool arguments are correct.
3. Confirm write-safety behavior (all tools are read-only).
4. For render flow, confirm sequence:
   - data tool returns `structuredContent.shows`
   - render tool receives `shows`
   - widget displays the same count/results.
5. Capture any failures and update tool descriptions one field at a time.
