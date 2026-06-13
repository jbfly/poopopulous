#!/bin/bash
## Script to push Poopopulous 3000 to bonewitz.net
## Successor to deploy_poop.sh — the server is now the dockerized
## bonewitz-server-dev stack; content is bind-mounted from www/.
set -euo pipefail

cd "$(dirname "$0")"

npm run build
rsync -avz --delete dist/ bonewitz:/opt/bonewitz-server-dev/www/poopopulous-3000/

echo "Deployed: https://bonewitz.net/poopopulous-3000/"
