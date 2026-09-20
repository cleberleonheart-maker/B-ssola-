#!/bin/sh
exec /usr/bin/qemu-x86_64 -cpu max /root/bussola/node_modules/hermes-compiler/hermesc/linux64-bin/hermesc "$@"