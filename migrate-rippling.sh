#!/bin/bash

BASE_URL="https://app.rippling.com/api/hardware"
INSTALLER="$(mktemp -d)/install-rippling"

curl -f -L -o "$INSTALLER" "$BASE_URL/agent/installer/installer/6839adf7cbf49ef7049a7d49?os=mac"
chmod +x "$INSTALLER"

"$INSTALLER" install --token "QURNSU5fRU5ST0xMX1RPS0VOOjY4MzlhZGY3Y2JmNDllZjcwNDlhN2Q0OTozODUxMGUwNWY4ZTEyYmViYWZiNDAwZTUwNDU3OThhYTYyYWNjZjhlZTVlNWZkYmRkNDMyMWI2MzBkOTlmNDhl"
