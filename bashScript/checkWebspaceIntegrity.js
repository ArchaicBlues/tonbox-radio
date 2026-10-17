#!/usr/bin/env node
// Vergleicht die Live-Version von customers.csv auf dem Webspace mit der zuletzt
// bekannten guten Kopie (webspace/customers_snapshot.csv). Neue Zeilen sind
// unproblematisch (legitimes Kundenwachstum durch PayPal/claim.php) - Alarm nur,
// wenn eine vorher bekannte, BEZAHLTE Zeile (gleiche MAC) verschwunden ist oder sich
// geändert hat (z.B. paid auf 0 gesetzt, Secret ausgetauscht).
//
// Aufruf: node bashScript/checkWebspaceIntegrity.js
// Beim allerersten Lauf (noch kein Snapshot vorhanden) wird der aktuelle Live-Stand
// einfach als Basis übernommen. Danach wird bei jedem Lauf verglichen; der Snapshot
// wird nur bei einem sauberen Ergebnis (keine Auffälligkeiten) aktualisiert, damit ein
// erkanntes Problem nicht durch den nächsten Lauf "überschrieben" wird, bevor es jemand
// gesehen hat.

const fs = require('fs');
const path = require('path');

const LIVE_URL = 'https://archaicblues.de/tonbox-media/checkout/customers.csv';
const SNAPSHOT_PATH = path.join(__dirname, '..', 'webspace', 'customers_snapshot.csv');

function parseCsv(text) {
    const lines = text.split('\n').filter(l => l.trim().length);
    if (!lines.length) return [];
    const header = lines.shift().split(',').map(h => h.trim());
    return lines.map(line => {
        const cols = (line.match(/(".*?"|[^,]+)/g) || []).map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"'));
        const row = {};
        header.forEach((h, i) => row[h] = cols[i] ?? '');
        return row;
    });
}

(async () => {
    const res = await fetch(LIVE_URL);
    if (!res.ok) {
        console.error('FEHLER: customers.csv nicht erreichbar (HTTP ' + res.status + ')');
        process.exit(1);
    }
    const liveText = await res.text();
    const liveRows = parseCsv(liveText);
    const liveByMac = new Map(liveRows.map(r => [r.mac.toLowerCase(), r]));

    if (!fs.existsSync(SNAPSHOT_PATH)) {
        fs.writeFileSync(SNAPSHOT_PATH, liveText);
        console.log('Kein vorheriger Snapshot gefunden - aktueller Live-Stand (' + liveRows.length + ' Einträge) als Basis gespeichert.');
        return;
    }

    const snapshotRows = parseCsv(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    const problems = [];

    for (const oldRow of snapshotRows) {
        if ((oldRow.paid || '0') !== '1') continue; // nur bezahlte Zeilen sind sicherheitsrelevant
        const mac = oldRow.mac.toLowerCase();
        const newRow = liveByMac.get(mac);
        if (!newRow) {
            problems.push('Gerät ' + oldRow.mac + ' (bezahlt) ist aus der Liste verschwunden!');
        } else if (newRow.secret !== oldRow.secret) {
            problems.push('Gerät ' + oldRow.mac + ': Secret hat sich geändert!');
        } else if ((newRow.paid || '0') !== '1') {
            problems.push('Gerät ' + oldRow.mac + ' ist nicht mehr als bezahlt markiert!');
        }
    }

    const newMacs = liveRows.filter(r => !snapshotRows.some(s => s.mac.toLowerCase() === r.mac.toLowerCase()));

    if (problems.length) {
        console.log('!!! AUFFÄLLIGKEITEN GEFUNDEN !!!');
        problems.forEach(p => console.log(' - ' + p));
        console.log('Snapshot wird NICHT aktualisiert - bitte manuell prüfen.');
        process.exit(1);
    }

    console.log('OK: alle ' + snapshotRows.filter(r => r.paid === '1').length + ' zuvor bekannten bezahlten Geräte sind unverändert vorhanden.');
    if (newMacs.length) {
        console.log(newMacs.length + ' neue(s) Gerät(e) seit letztem Check: ' + newMacs.map(r => r.mac).join(', '));
    }
    fs.writeFileSync(SNAPSHOT_PATH, liveText);
})();
