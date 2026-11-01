#!/bin/bash

#./setupNopasswd.sh
#
#    //Richtet passwortlosen sudo fuer den aktuellen Benutzer ein (/etc/sudoers.d/010_<user>-nopasswd).
#    //Noetig, weil die App an vielen Stellen sudo aufruft (mount, Netzwerkkonfiguration,
#    //systemctl, reboot, ...) - ohne NOPASSWD haengt der erste sudo-Aufruf beim unbeaufsichtigten
#    //Start als systemd-Dienst an einem Passwort-Prompt, der nie beantwortet wird.
#    //Idempotent: ueberspringt die Einrichtung, wenn die Datei schon existiert.

USER_NAME="${1:-$(whoami)}"
SUDOERS_FILE="/etc/sudoers.d/010_${USER_NAME}-nopasswd"

if [ -f "$SUDOERS_FILE" ]; then
	echo "NOPASSWD ist fuer '$USER_NAME' bereits eingerichtet ($SUDOERS_FILE)."
	exit 0
fi

echo "$USER_NAME ALL=(ALL) NOPASSWD: ALL" | sudo tee "$SUDOERS_FILE" > /dev/null
sudo chmod 440 "$SUDOERS_FILE"
echo "NOPASSWD fuer '$USER_NAME' eingerichtet ($SUDOERS_FILE)."
