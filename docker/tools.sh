#!/bin/sh
# One-off commands in the "tools" image, e.g.
#   docker compose -f docker-compose.prod.yml run --rm tools setup --club "TV Muster" --admin du@example.ch
set -e
cd /app

command="${1:-help}"
[ "$#" -gt 0 ] && shift

case "$command" in
  migrate)
    # Applies pending database migrations; never deletes data.
    exec node_modules/.bin/prisma migrate deploy
    ;;
  setup)
    exec node_modules/.bin/tsx --conditions=react-server scripts/setup.ts "$@"
    ;;
  invite)
    exec node_modules/.bin/tsx --conditions=react-server scripts/invite.ts "$@"
    ;;
  *)
    echo "Commands:"
    echo "  migrate                                    apply database migrations"
    echo "  setup --club \"<name>\" --admin <email>      create the club, invite the first admin"
    echo "  invite --email <email> [--role ADMIN]      invite a person (all teams)"
    [ "$command" = "help" ] && exit 0 || exit 1
    ;;
esac
