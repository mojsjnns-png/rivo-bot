#!/bin/bash
cd /home/revo/RIVO_bot
/opt/nodejs18/bin/node index.js </dev/null >/tmp/bot_run.log 2>&1 &
echo $!
