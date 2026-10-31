#!/bin/sh
set -eu

if [ -z "${UWABAMI_CLOUDFRONT_SECRET:-}" ]; then
  echo "FATAL: UWABAMI_CLOUDFRONT_SECRET must be set and non-empty" >&2
  exit 1
fi

case "$UWABAMI_CLOUDFRONT_SECRET" in
  *[!A-Za-z0-9_-]*) echo "FATAL: UWABAMI_CLOUDFRONT_SECRET contains invalid characters (only A-Za-z0-9_- allowed)" >&2; exit 1 ;;
esac

envsubst '$UWABAMI_CLOUDFRONT_SECRET' < /nginx.template.conf > /etc/nginx/conf.d/default.conf
exec "$@"
