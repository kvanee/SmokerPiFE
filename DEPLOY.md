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

## Notes

- The hardware backend (`BACKEND_URL`) must be reachable from the Dokku host's
  network for temperature polling and blower control to work.
- nedb is a single-process, file-based store. Run only **one** web container
  (do not scale `web` past 1) to avoid concurrent writes to the same files.
