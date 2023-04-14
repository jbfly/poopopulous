#!/bin/bash

# Set variables
LOCAL_PATH="$HOME/git/poopopulous/WebGLBuild"
REMOTE_PATH="/srv/http/poopopulous"
REMOTE_USER="jbfly"
REMOTE_HOST="bonewitz.net"

# Rsync the files to the remote server
rsync -avz --delete "$LOCAL_PATH/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

# Connect to the remote server and change the group ownership and permissions
ssh "$REMOTE_USER@$REMOTE_HOST" "chgrp -R http $REMOTE_PATH && chmod -R g+w $REMOTE_PATH"
