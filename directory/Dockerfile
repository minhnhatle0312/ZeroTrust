FROM debian:bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN printf 'slapd slapd/no_configuration boolean true\n' | debconf-set-selections \
    && apt-get update \
    && apt-get install -y --no-install-recommends slapd ldap-utils ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY entrypoint.sh /usr/local/bin/nhip-directory
RUN sed -i 's/\r$//' /usr/local/bin/nhip-directory && chmod 0755 /usr/local/bin/nhip-directory
EXPOSE 636
ENTRYPOINT ["/usr/local/bin/nhip-directory"]
