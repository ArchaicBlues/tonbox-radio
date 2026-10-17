#!/usr/bin/env node
// Lädt die LIVE .htaccess per FTP (Apache blockiert sie über HTTP grundsätzlich mit
// 403, egal ob der Inhalt stimmt) und vergleicht sie byte-genau mit der lokalen
// Referenzkopie (webspace/.htaccess). Diese Datei wird nie automatisch verändert -
// jede Abweichung zwischen Live-Version und Referenz ist verdächtig.
//
// Zugangsdaten werden NUR über Umgebungsvariablen übergeben, nie im Code/Repo
// gespeichert:
//   FTP_HOST=ftp.deinhoster.de FTP_USER=... FTP_PASS=... node bashScript/checkHtaccessIntegrity.js
// Optional: FTP_PATH (Default: /tonbox-media/checkout/.htaccess), FTP_SECURE=1 für FTPS.

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REFERENCE_PATH = path.join(__dirname, '..', 'webspace', '.htaccess');
const FTP_PATH = process.env.FTP_PATH || '/tonbox-media/checkout/.htaccess';

const host = process.env.FTP_HOST;
const user = process.env.FTP_USER;
const pass = process.env.FTP_PASS;

if (!host || !user || !pass) {
    console.error('FEHLER: FTP_HOST, FTP_USER und FTP_PASS müssen als Umgebungsvariablen gesetzt sein.');
    process.exit(1);
}

if (!fs.existsSync(REFERENCE_PATH)) {
    console.error('FEHLER: keine lokale Referenz unter ' + REFERENCE_PATH + ' gefunden.');
    process.exit(1);
}

const scheme = process.env.FTP_SECURE ? 'ftps' : 'ftp';
const url = `${scheme}://${host}${FTP_PATH}`;
const tmpFile = path.join(os.tmpdir(), 'htaccess_live_' + Date.now());

const args = ['-sf', '--user', `${user}:${pass}`, url, '-o', tmpFile];
if (process.env.FTP_SECURE) args.splice(1, 0, '--ftp-ssl');

execFile('curl', args, (err) => {
    if (err) {
        console.error('FEHLER: .htaccess per FTP nicht abrufbar - ' + err.message);
        process.exit(1);
    }
    const live = fs.readFileSync(tmpFile, 'utf8');
    fs.unlinkSync(tmpFile);
    const reference = fs.readFileSync(REFERENCE_PATH, 'utf8');

    if (live === reference) {
        console.log('OK: .htaccess auf dem Webspace stimmt exakt mit der lokalen Referenz überein.');
    } else {
        console.log('!!! ABWEICHUNG GEFUNDEN: .htaccess auf dem Webspace unterscheidet sich von der lokalen Referenz !!!');
        process.exit(1);
    }
});
