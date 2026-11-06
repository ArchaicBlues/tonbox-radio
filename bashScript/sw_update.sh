#!/bin/bash
set -e

INSTALL_DIR="/home/pi/Tonbox"
SETTINGS_FILE="$INSTALL_DIR/.settings.conf"
DOWNLOAD_URL="https://archaicblues.de/tonbox-media/checkout/download.php"

WORKDIR="/home/pi/update_tmp"
ARCHIVE="$WORKDIR/update.tar.gz"

echo "================================="
echo " Tonbox Update - Download Phase"
echo "================================="

rm -rf "$WORKDIR"
mkdir -p "$WORKDIR"

# Signierte Anfrage bauen (gleiches Schema wie checkUpdateAllowed() in funcsystem.js) -
# ohne gültige Signatur liefert download.php nur eine Fehlermeldung statt der Datei.
# Das schützt das Update auch dann, wenn dieses Skript direkt aufgerufen wird, statt
# über den "Update Tonbox"-Button in der App.
MAC=$(cat /sys/class/net/eth0/address 2>/dev/null || cat /sys/class/net/wlan0/address 2>/dev/null)
SECRET=$(python3 -c "import json; print(json.load(open('$SETTINGS_FILE')).get('updateSecret',''))" 2>/dev/null)
WAN_IP=$(curl -s --max-time 5 https://api.ipify.org || echo "")
TIMESTAMP=$(date +%s%3N)

if [ -z "$MAC" ] || [ -z "$SECRET" ]; then
    echo "ERROR: MAC-Adresse oder Update-Secret konnte nicht ermittelt werden"
    exit 1
fi

SIGNATURE=$(printf '%s' "${MAC}|${WAN_IP}|${TIMESTAMP}" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
BODY=$(python3 -c "import json,sys; print(json.dumps({'mac':sys.argv[1],'wanIp':sys.argv[2],'timestamp':int(sys.argv[3]),'signature':sys.argv[4]}))" "$MAC" "$WAN_IP" "$TIMESTAMP" "$SIGNATURE")

echo "Downloading (authorized)..."
HTTP_CODE=$(curl -s -o "$ARCHIVE" -w "%{http_code}" -X POST "$DOWNLOAD_URL" -H "Content-Type: application/json" -d "$BODY")
if [ "$HTTP_CODE" != "200" ]; then
    echo "ERROR: Download nicht autorisiert (HTTP $HTTP_CODE):"
    cat "$ARCHIVE" 2>/dev/null
    echo ""
    exit 1
fi

echo "Validating archive..."
if ! gunzip -c "$ARCHIVE" | tar t > /dev/null; then
    echo "ERROR: invalid archive"
    exit 1
fi

echo "Extracting..."
tar -xf "$ARCHIVE" -C "$WORKDIR"

echo "Files extracted to $WORKDIR"

#
# APPLY STARTEN
#
if [ ! -f "$WORKDIR/bashScript/sw_apply_update.sh" ]; then
    echo "ERROR: sw_apply_update.sh not found"
    find "$WORKDIR" | head -50
    exit 1
fi

echo "Starting apply phase..."
bash "$WORKDIR/bashScript/sw_apply_update.sh"
echo "installed" > /home/pi/Tonbox/help/update_status
