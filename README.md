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

# get the app
git clone https://github.com/ArchaicBlues/tonbox-radio.git
mv tonbox-radio Tonbox
cd Tonbox

# passwordless sudo for this user - the app calls sudo in many places and
# would otherwise hang on the first prompt once running unattended at boot
# (pass your username as an argument if it isn't "pi")
bash bashScript/setupNopasswd.sh

# system packages used by various features
sudo apt install -y ffmpeg mpv alsa-utils bluez cd-discid imagemagick pipewire wireplumber pamixer iputils-arping

# run it
npm install
node server.js
```

## Opening the app

Use an Ethernet cable connection for the initial installation. 
You can configure WiFi later via the WebApp.
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

## Using a DAC HAT for Line-Out (optional)

The app auto-detects any attached audio HAT as a Line-Out target, regardless
of model - no code change needed. What *is* needed, for most HATs, is
enabling the kernel driver by adding the matching `dtoverlay=` line to
`/boot/firmware/config.txt` (under `[all]`) and rebooting - this is a boot-time
setting the Pi's firmware reads before Linux (and this app) ever starts, so
it can't be selected automatically at runtime.

A few boards are genuine HAT-spec-compliant hardware with a pre-programmed
ID EEPROM, which the Pi's firmware reads at boot to load the right overlay
automatically - **no `dtoverlay=` line needed** for these: the official
**Raspberry Pi DAC+ / DAC Pro / DigiAMP+ / Codec Zero** boards, and the
**JustBoom** DAC/Digi/Amp HATs (you still need the onboard-audio-off step
below for either). Everything else below needs the manual line:

| HAT / chip | `dtoverlay=` |
|---|---|
| HiFiBerry DAC / DAC+ Light / Zero, generic PCM5102A boards | `hifiberry-dac` |
| HiFiBerry DAC+ / DAC+ Pro / Amp2 (PCM5122) | `hifiberry-dacplus` |
| HiFiBerry DAC2 HD | `hifiberry-dacplushd` |
| Allo Boss DAC (explicitly *not* HAT-compliant despite its own EEPROM) | `allo-boss-dac-pcm512x-audio` |
| WM8960-based boards (e.g. Waveshare) | `wm8960-soundcard` |

(HiFiBerry boards technically support the same EEPROM auto-config, but only
after a separate one-time flashing step via HiFiBerry's own tool - out of
the box they still need the `dtoverlay=` line above.)

Also disable the onboard audio in the same `[all]` section, so it doesn't
compete with the HAT:

```
# Onboard-Audio abschalten (Zeile auskommentieren bzw. auf off setzen)
dtparam=audio=off
```

Check `cat /proc/asound/cards` after rebooting to confirm the HAT shows up as
its own card (besides `Headphones` and `vc4hdmi*`), then select it as the
audio output from the web UI.

## Running as a systemd service (autostart on boot)

A ready-made unit file is provided at
[filter/conf/userServices/Tonbox.service](filter/conf/userServices/Tonbox.service).
It assumes the default `pi` user and the `/home/pi/Tonbox` install path from
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

# Tonbox.service is a USER unit (WantedBy=default.target in the user manager,
# not the system one) - without lingering, systemd only starts the user
# manager (and therefore Tonbox.service) once "pi" actually logs in via SSH
# or the console, not on every boot. This is easy to miss during testing
# since an SSH login shortly after boot starts it as a side effect - but on
# a real power-up with no keyboard/monitor and no SSH session, Tonbox never
# starts at all without this.
sudo loginctl enable-linger pi
```

### Bluetooth speaker mode

Two more unit files enable pairing a phone and streaming audio to the Tonbox
over Bluetooth (A2DP), without needing the web UI open first:

- [filter/conf/userServices/bt-agent.service](filter/conf/userServices/bt-agent.service)
  runs a headless pairing agent (`bt-agent -c NoInputNoOutput`) so a phone can
  pair without any interactive confirmation on the Tonbox itself.
- [filter/conf/userServices/btConCheck.service](filter/conf/userServices/btConCheck.service)
  watches `bluetoothctl` for a connected device and reflects that status as
  the Bluetooth icon in the web UI's top bar.

```bash
cp filter/conf/userServices/bt-agent.service filter/conf/userServices/btConCheck.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now bt-agent.service btConCheck.service
```


## License

MIT — see [LICENSE](LICENSE).
