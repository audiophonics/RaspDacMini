#!/bin/sh
scriptpath=`readlink -f "$0"`
configpath=`dirname "$scriptpath"`"/config.json"
case $1 in
"")
        printf "\033[32m rdmoled\033[0m contrast 0-254
\033[32m rdmoled\033[0m screensaver 0 ... (seconds)
\033[32m rdmoled\033[0m deepsleep 0 ... (seconds)
"
;;
contrast)
        curl -m 0.5 localhost:4153/contrast=$2
         jq '.contrast = '"$2" "$configpath" > /tmp/oledcconf.tmp && mv /tmp/oledcconf.tmp  "$configpath"
;;
screensaver)
        curl -m 0.5 localhost:4153/sleep_after=$2
         jq '.sleep_after = '"$2" "$configpath" > /tmp/oledcconf.tmp && mv /tmp/oledcconf.tmp  "$configpath"
;;
deepsleep)
        curl -m 0.5 localhost:4153/deep_sleep_after=$2
         jq '.deep_sleep_after = '"$2" "$configpath" > /tmp/oledcconf.tmp && mv /tmp/oledcconf.tmp  "$configpath"
;;
esac

