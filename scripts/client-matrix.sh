#!/usr/bin/env bash
# Replays the request shapes real MCP clients send, against any base URL.
# Every one of these must end with 5 tools listed.
#
#   ./scripts/client-matrix.sh http://127.0.0.1:8899
#   ./scripts/client-matrix.sh https://cineconcerts.digital/mcp
#   ./scripts/client-matrix.sh https://cineconcerts.digital/mcp/
set -u

BASE="${1:-http://127.0.0.1:8899}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"matrix","version":"1"}}}'

# handshake <label> [extra curl args...]
handshake() {
  local label="$1"; shift
  local code sid tools

  code=$(curl -s -o "$TMP/init" -D "$TMP/h" -w "%{http_code}" \
    -X POST "$BASE" --data-binary "$INIT" "$@")
  sid=$(grep -i '^mcp-session-id:' "$TMP/h" | head -1 | awk '{print $2}' | tr -d '\r')

  if [ "$code" != "200" ] || [ -z "$sid" ]; then
    printf '  FAIL  %-42s initialize -> HTTP %s %s\n' "$label" "$code" "$(head -c 110 "$TMP/init" | tr -d '\n')"
    FAIL=$((FAIL+1)); return
  fi

  curl -s -o /dev/null -X POST "$BASE" \
    -H "Mcp-Session-Id: $sid" \
    --data-binary '{"jsonrpc":"2.0","method":"notifications/initialized"}' "$@"

  code=$(curl -s -o "$TMP/tools" -w "%{http_code}" -X POST "$BASE" \
    -H "Mcp-Session-Id: $sid" \
    --data-binary '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' "$@")

  tools=$(grep -o '"name":"[a-z_]*"' "$TMP/tools" | wc -l | tr -d ' ')

  if [ "$code" = "200" ] && [ "$tools" -ge 5 ]; then
    printf '  ok    %-42s 5 tools (ct=%s)\n' "$label" \
      "$(grep -io '^content-type:.*' "$TMP/h" | head -1 | cut -d' ' -f2 | tr -d '\r')"
    PASS=$((PASS+1))
  else
    printf '  FAIL  %-42s tools/list -> HTTP %s, %s tools\n' "$label" "$code" "$tools"
    FAIL=$((FAIL+1))
  fi

  curl -s -o /dev/null -X DELETE "$BASE" -H "Mcp-Session-Id: $sid" "$@"
}

# expect <label> <expected-code> [curl args...]
expect() {
  local label="$1" want="$2"; shift 2
  local code
  code=$(curl -s -o "$TMP/o" -w "%{http_code}" "$@")
  if [ "$code" = "$want" ]; then
    printf '  ok    %-42s HTTP %s\n' "$label" "$code"; PASS=$((PASS+1))
  else
    printf '  FAIL  %-42s HTTP %s (want %s) %s\n' "$label" "$code" "$want" "$(head -c 90 "$TMP/o" | tr -d '\n')"
    FAIL=$((FAIL+1))
  fi
}

echo "MCP client matrix against: $BASE"
echo
echo "Handshakes:"
handshake "spec client (json + sse)"        -H 'Accept: application/json, text/event-stream' -H 'Content-Type: application/json'
handshake "sse-only Accept"                 -H 'Accept: text/event-stream'                   -H 'Content-Type: application/json'
handshake "json-only Accept"                -H 'Accept: application/json'                    -H 'Content-Type: application/json'
handshake "Accept: */* (fetch/curl default)" -H 'Accept: */*'                                -H 'Content-Type: application/json'
handshake "no Accept header"                -H 'Accept:'                                     -H 'Content-Type: application/json'
handshake "no Content-Type"                 -H 'Accept: application/json, text/event-stream' -H 'Content-Type:'
handshake "charset on Content-Type"         -H 'Accept: application/json, text/event-stream' -H 'Content-Type: application/json; charset=utf-8'
handshake "text/plain Content-Type"         -H 'Accept: */*'                                 -H 'Content-Type: text/plain'
handshake "no Accept, no Content-Type"      -H 'Accept:'                                     -H 'Content-Type:'

echo
echo "Edge cases:"
expect "initialize with a stale session id"  200 -X POST "$BASE" -H 'Accept: application/json, text/event-stream' -H 'Content-Type: application/json' -H 'Mcp-Session-Id: 00000000-0000-0000-0000-000000000000' --data-binary "$INIT"
expect "unknown session -> 404 (re-init)"    404 -X POST "$BASE" -H 'Accept: application/json, text/event-stream' -H 'Content-Type: application/json' -H 'Mcp-Session-Id: 00000000-0000-0000-0000-000000000000' --data-binary '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
expect "batched [initialize] array -> 200"   200 -X POST "$BASE" -H 'Accept: application/json, text/event-stream' -H 'Content-Type: application/json' --data-binary "[$INIT]"
expect "GET without session -> 405"          405 -X GET "$BASE" -H 'Accept: text/event-stream'
expect "HEAD -> 200"                         200 -I "$BASE"
expect "DELETE unknown session -> 200"       200 -X DELETE "$BASE" -H 'Mcp-Session-Id: 00000000-0000-0000-0000-000000000000'
expect "browser CORS preflight -> 204"       204 -X OPTIONS "$BASE" -H 'Origin: https://example.com' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type,mcp-session-id'
expect "malformed body -> 400 (not HTML)"    400 -X POST "$BASE" -H 'Accept: application/json, text/event-stream' -H 'Content-Type: application/json' --data-binary 'not json'

echo
echo "Browser CORS exposes the session id:"
if curl -s -D - -o /dev/null -X POST "$BASE" -H 'Origin: https://example.com' \
     -H 'Accept: application/json, text/event-stream' -H 'Content-Type: application/json' \
     --data-binary "$INIT" | grep -qi 'access-control-expose-headers:.*mcp-session-id'; then
  echo "  ok    Access-Control-Expose-Headers includes Mcp-Session-Id"; PASS=$((PASS+1))
else
  echo "  FAIL  Mcp-Session-Id not exposed to browser clients"; FAIL=$((FAIL+1))
fi

echo
echo "passed: $PASS   failed: $FAIL"
[ "$FAIL" -eq 0 ]
