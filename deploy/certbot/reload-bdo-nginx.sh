#!/bin/sh
set -eu

# certbot runs deploy hooks only after a certificate was successfully renewed.
# Never restart a server with invalid configuration.
if systemctl is-active --quiet nginx; then
    /usr/sbin/nginx -t
    systemctl reload nginx
fi
