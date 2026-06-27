# Deploying SmokerPi to Dokku

This app is a Node.js (Express + Socket.IO) server that uses file-based
[nedb](https://github.com/seald/nedb) databases. The steps below set it up on a
[Dokku](https://dokku.com/) host using the default Node.js (Herokuish/Cloud
Native) buildpack.

## What was prepared

- **`Procfile`** — declares the `web: npm start` process Dokku runs.
- **Dynamic port** — `app.js` binds to `process.env.PORT` (Dokku assigns the port
  and proxies HTTP/HTTPS to it).
- **`engines.node`** in `package.json` pins the Node version (`22.x`).
- **`CHECKS`** — zero-downtime health check hitting the existing `/health-check`
  endpoint before traffic is switched to a new container.
- **Configurable via environment variables:**
  - `SESSION_SECRET` — Express session signing secret (defaults to an insecure
    value; set this in production).
  - `BACKEND_URL` — base URL of the hardware controller (Raspberry Pi), e.g.
    `http://smokerpi.local:3081`.
  - `DATA_DIR` — directory for the nedb `*.db` files. Point this at a mounted
    persistent volume so data survives deploys.
  - `MQTT_URL` — optional; enables Home Assistant temperature alerts and live
    sensors over MQTT, e.g. `mqtt://user:pass@10.0.10.3:1883`. Unset = disabled.
    See [docs/home-assistant-mqtt.md](docs/home-assistant-mqtt.md).
- **`.gitignore`** — keeps `node_modules/` and the `*.db` data files out of git.
- **`trust proxy`** is enabled so secure cookies work behind Dokku's nginx.

## One-time setup on the Dokku host

```bash
# 1. Create the app
dokku apps:create smokerpi

# 2. Persistent storage for the nedb data files (survives redeploys)
dokku storage:ensure-directory smokerpi
dokku storage:mount smokerpi /var/lib/dokku/data/storage/smokerpi:/data

# 3. Configuration
dokku config:set smokerpi \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  DATA_DIR=/data \
  BACKEND_URL=http://smokerpi.local:3081

# 4. (Optional) TLS via Let's Encrypt
dokku domains:set smokerpi smoker.example.com
dokku letsencrypt:enable smokerpi
```

## Deploy

From a local clone, add the Dokku remote and push:

```bash
git remote add dokku dokku@your-dokku-host:smokerpi
git push dokku master
```

(Push whichever branch you want to deploy to the remote's `master`, e.g.
`git push dokku my-branch:master`.)

Dokku will detect the Node.js buildpack, run `npm install`, start the `web`
process from the `Procfile`, and run the `CHECKS` health check before going live.

## WebSocket / Socket.IO support (required)

This app uses **Socket.IO** for live temperature updates. Socket.IO starts on
HTTP long-polling and then upgrades to a WebSocket. nginx must forward the
WebSocket `Upgrade` handshake or the connection never upgrades and falls back to
long-polling — which is unstable on mobile networks and shows up as a
**constantly reconnecting connection indicator and temperatures that stop
updating**, while desktop browsers appear fine.

### Symptom check

In the browser (desktop DevTools → Network → filter `socket.io`):

- **Good:** a request to `…/socket.io/?...` returns **HTTP 101 Switching
  Protocols** (a `websocket` entry).
- **Bad:** only repeated `…/socket.io/?...&transport=polling` requests, no 101.

### Fix

1. Make sure Dokku's proxy config is current (modern Dokku ships WebSocket
   support in its nginx template; an old vhost may predate it):

   ```bash
   dokku proxy:build-config smokerpi
   ```

2. If it still won't upgrade, add an app-specific nginx snippet. Dokku includes
   any `*.conf` file under `/home/dokku/<app>/nginx.conf.d/` into the app's
   `server { }` block. First find the upstream name Dokku generated:

   ```bash
   grep -E '^\s*upstream' /home/dokku/smokerpi/nginx.conf
   # e.g. "upstream smokerpi-3080 { ... }"  -> use that name below
   ```

   Then create the snippet (replace `smokerpi-3080` with what you found):

   ```bash
   mkdir -p /home/dokku/smokerpi/nginx.conf.d
   cat > /home/dokku/smokerpi/nginx.conf.d/socketio.conf <<'EOF'
   location /socket.io/ {
       proxy_pass http://smokerpi-3080;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_read_timeout 86400s;
       proxy_buffering off;
   }
   EOF
   chown dokku:dokku /home/dokku/smokerpi/nginx.conf.d/socketio.conf
   service nginx reload   # or: nginx -t && systemctl reload nginx
   ```

3. Reload the page on mobile and confirm the indicator stays green and
   temperatures update. The DevTools check should now show the 101 upgrade.

The server side is already tuned to tolerate brief mobile network stalls
(`pingTimeout`/`pingInterval` in `config/socket.io.js`) so long-polling degrades
gracefully even before the WebSocket upgrade is working.

## Notes

- The hardware backend (`BACKEND_URL`) must be reachable from the Dokku host's
  network for temperature polling and blower control to work.
- nedb is a single-process, file-based store. Run only **one** web container
  (do not scale `web` past 1) to avoid concurrent writes to the same files.
