import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { toStructuredShow, formatEvent } from "../src/services/algolia.js";
import { showsWidgetHtml } from "../src/ui/showsWidget.js";

/** Pure logic. No network, no credentials. */

const HIT = {
  objectID: "abc123",
  Title: "Harry Potter and the Sorcerer's Stone In Concert",
  "Event Date": "08/21/2026",
  "Show Code": "HP1",
  City: "San Diego",
  State: "California",
  Country: "United States",
  Venue: "The Shell",
  "Buy Tickets": "https://example.com/tickets",
  _geoloc: { lat: 32.7, lng: -117.1 },
};

describe("show mapping", () => {
  test("maps an Algolia hit to the structured shape", () => {
    const s = toStructuredShow(HIT);
    assert.equal(s.id, "abc123");
    assert.equal(s.showCode, "HP1");
    assert.equal(s.venue, "The Shell");
    assert.equal(s.latitude, 32.7);
  });

  test("builds a readable location from the parts present", () => {
    assert.equal(toStructuredShow(HIT).location, "The Shell, San Diego, California, United States");
  });

  test("turns blank and missing fields into null rather than empty strings", () => {
    const s = toStructuredShow({ objectID: "x", Title: "  ", Venue: "" });
    assert.equal(s.venue, null);
    assert.equal(s.eventDate, null);
    assert.equal(s.location, null);
    assert.equal(s.title, "CineConcerts Event", "an untitled show still needs a label");
  });

  test("formats an event without inventing missing values", () => {
    const text = formatEvent({ objectID: "x", Title: "Test Show" });
    assert.match(text, /Test Show/);
    assert.match(text, /Date: TBA/);
    assert.doesNotMatch(text, /undefined|null/);
  });
});

describe("widget URL guard", () => {
  // shows[] arrives from the model rather than straight from Algolia, so a
  // manipulated tool call could otherwise put javascript: on an href. The guard
  // runs in the browser, so it is lifted out and exercised directly here.
  const source = /function safeHttpUrl\(value\) \{[\s\S]*?\n      \}/.exec(showsWidgetHtml)?.[0];

  test("the guard is still present in the widget", () => {
    assert.ok(source, "safeHttpUrl has been removed from the widget");
  });

  const safeHttpUrl = new Function(
    "window",
    `${source}; return safeHttpUrl;`
  )({ location: { href: "https://widget.example.com/" } }) as (v: unknown) => string | null;

  test("passes http and https through", () => {
    assert.equal(safeHttpUrl("https://example.com/t"), "https://example.com/t");
    assert.equal(safeHttpUrl("http://example.com/t"), "http://example.com/t");
  });

  test("refuses javascript: and data: urls", () => {
    assert.equal(safeHttpUrl("javascript:alert(1)"), null);
    assert.equal(safeHttpUrl("JavaScript:alert(1)"), null);
    assert.equal(safeHttpUrl("data:text/html,<script>alert(1)</script>"), null);
  });

  test("refuses rubbish without throwing", () => {
    for (const v of ["", null, undefined, 42, {}]) {
      assert.equal(safeHttpUrl(v), null);
    }
  });
});
