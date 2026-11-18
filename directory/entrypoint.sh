#!/bin/sh
set -eu
umask 077
if [ ! -s /bootstrap/slapd.conf ] || [ ! -s /bootstrap/bootstrap.ldif ]; then
  echo 'Directory files are missing. Run scripts/prepare_week6.py first.' >&2
  exit 1
fi
mkdir -p /run/nhip-ldap /run/slapd /var/lib/ldap
cp /bootstrap/slapd.conf /run/nhip-ldap/slapd.conf
cp /bootstrap/server.crt /run/nhip-ldap/server.crt
cp /bootstrap/server.key /run/nhip-ldap/server.key
cp /bootstrap/ca.crt /run/nhip-ldap/ca.crt
chown -R openldap:openldap /run/nhip-ldap /run/slapd /var/lib/ldap
chmod 0700 /run/nhip-ldap
chmod 0600 /run/nhip-ldap/*
if [ ! -e /var/lib/ldap/data.mdb ]; then
  # Bootstrap only a new volume. Recreating the container never resets users/passwords.
  slapadd -f /run/nhip-ldap/slapd.conf -l /bootstrap/bootstrap.ldif
  chown -R openldap:openldap /var/lib/ldap
fi
exec slapd -f /run/nhip-ldap/slapd.conf -h 'ldaps://0.0.0.0:636/ ldapi:///' -u openldap -g openldap -d 256
