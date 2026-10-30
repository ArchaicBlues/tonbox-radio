# Tonbox

Tonbox is a Node.js/Express web application that turns a Raspberry Pi into a
networked audio/media center: Its is a comprehensive media handler. 
It processes audio, video, and images. 
Suitable for
• Targeted music search radio, video
• Analog music data restoration
• Modernization of older tube radios or receivers
• Media show consisting of pictures and videos on TV all
Controlled from a browser on your local network.

This is the free **Basis** build and let you search radio stations around the world for land, genre, station and quality.
Music comes thru Line-Out or HTTP i.e. your Smartphone
A small number of hardware/format-heavy features (USB media library, vinyl / video capture, ..)
are present in the UI but intentionally disabled as no-ops, marked with
`BASIS build` comments in the source.

## Prerequisites

- Raspberry Pi (tested on Raspberry Pi OS / Debian 12 "bookworm", `aarch64`)
- Node.js (tested with v21; install via [nvm](https://github.com/nvm-sh/nvm) for
  a pinned version, or simply via `apt` as shown below)
- Passwordless `sudo` for your user (the app runs many `sudo` commands - mount,
  network config, systemctl, reboot, ...). This is already the default on stock
  Raspberry Pi OS for the `pi` user (`/etc/sudoers.d/010_pi-nopasswd`), but set
  it up explicitly anyway (see Installation below) - otherwise the app hangs
  waiting for a password prompt that never comes, especially once running
  unattended as a systemd service after a reboot.
- System packages used by various features (ffmpeg, mpv, bluetooth, imaging,
  audio - also covered in the Installation steps below).

## Installation

```bash
# basic tools
sudo apt update
sudo apt install -y git npm

# passwordless sudo for this user - the app calls sudo in many places and
# would otherwise hang on the first prompt once running unattended at boot
# (replace "pi" with your actual username if different)
echo "pi ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/010_pi-nopasswd
sudo chmod 440 /etc/sudoers.d/010_pi-nopasswd

# system packages used by various features
sudo apt install -y ffmpeg mpv alsa-utils bluez cd-discid imagemagick pipewire wireplumber

# get the app and run it
git clone https://github.com/archaicblues/tonbox-media.git
mv tonbox-media ArchaicNodeEJS
cd ArchaicNodeEJS
npm install
node server.js
```

## Opening the app

Open `http://tonbox.local:8000` in a browser on any device in the same local
network (replace `tonbox` with your Pi's actual hostname if you changed it).
If `.local` addresses don't resolve on your network/device, use the Pi's IP
address instead, e.g. `http://192.168.1.50:8000` - you can find it with
`hostname -I` on the Pi itself, or check your router's device list.

## Adding a home screen / desktop icon

Tonbox ships as a PWA (Progressive Web App), so your browser can add it as an
app-like icon instead of having to type the address every time:

- **Chrome/Edge (desktop):** open the Tonbox page, click the install icon (a
  small monitor with a down-arrow) at the right of the address bar, then
  "Install".
- **Chrome (Android):** open the Tonbox page, tap the three-dot menu, then
  "Add to Home screen" (or "Install app").
- **Safari (iOS/iPadOS):** open the Tonbox page, tap the Share icon, then
  "Add to Home Screen".

The icon will show up like a regular app and open Tonbox directly, without
browser address bar/tabs.

On first start there is no `.settings.conf` yet — the app runs with built-in
defaults. Configure WiFi, audio output, a YouTube Data API key (optional, for
YouTube playback) and a Discogs user token (optional, for vinyl metadata
lookups) from the web UI; this writes `.settings.conf` in the project
directory, which is git-ignored and never shared.

## Running as a systemd service (autostart on boot)

A ready-made unit file is provided at
[filter/conf/userServices/Tonbox.service](filter/conf/userServices/Tonbox.service).
It assumes the default `pi` user and the `/home/pi/ArchaicNodeEJS` install path from
the Installation steps above — adjust `WorkingDirectory` if yours differs. `ExecStart`
sources nvm's core `nvm.sh` script directly and then runs `nvm use` rather than a
hardcoded version path, since nvm installs a different exact patch version depending
on when/where you ran `nvm install` - it resolves the version via the `.nvmrc` file in
the project root (pins only the major version). This intentionally avoids nvm's own
`nvm-exec` convenience script, since that extra file isn't present on every device's
nvm installation, while `nvm.sh` itself always is. If nvm itself is installed
somewhere other than the default `~/.nvm`, adjust `NVM_DIR` in `ExecStart` accordingly.
Then:

```bash
mkdir -p ~/.config/systemd/user
cp filter/conf/userServices/Tonbox.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now Tonbox.service
```


## License

MIT — see [LICENSE](LICENSE).
