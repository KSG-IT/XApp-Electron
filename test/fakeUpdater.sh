#!/bin/sh
# Stands in for deploy/xapp-update.sh in the update tests (XAPP_UPDATER).
# $FAKE_UPDATER_DIR/state says what happens: none, available, install-fails or
# check-fails. Each call is written to $FAKE_UPDATER_DIR/log.
dir="$FAKE_UPDATER_DIR"
state="$(cat "$dir/state")"
echo "$1" >>"$dir/log"

case "$1" in
check)
  # Long enough for the test to see "Ser etter oppdateringer".
  sleep 1
  case "$state" in
  none) echo none ;;
  available | install-fails) echo "available v2099.1.1" ;;
  *) exit 1 ;;
  esac
  ;;
update)
  sleep 1
  [ "$state" = install-fails ] && exit 1
  echo none >"$dir/state"
  ;;
esac
