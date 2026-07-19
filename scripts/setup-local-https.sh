#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$ROOT_DIR/.certs"
PUBLIC_DIR="$CERT_DIR/public"
LAN_IP="${1:-$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)}"

if [[ -z "$LAN_IP" ]]; then
  echo "LAN IP を取得できません。例: npm run cert:setup -- 192.168.1.14" >&2
  exit 1
fi

mkdir -p "$CERT_DIR" "$PUBLIC_DIR"

if [[ ! -f "$CERT_DIR/dental-talk-local-ca.key" || ! -f "$CERT_DIR/dental-talk-local-ca.crt" ]]; then
  openssl genrsa -out "$CERT_DIR/dental-talk-local-ca.key" 4096
  openssl req -x509 -new -nodes \
    -key "$CERT_DIR/dental-talk-local-ca.key" \
    -sha256 -days 825 \
    -out "$CERT_DIR/dental-talk-local-ca.crt" \
    -subj "/CN=Dental Talk Local Test CA/O=Dental Talk"
fi

openssl genrsa -out "$CERT_DIR/server.key" 2048
openssl req -new \
  -key "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.csr" \
  -subj "/CN=$LAN_IP/O=Dental Talk"

cat > "$CERT_DIR/server.ext" <<EOF
subjectAltName = IP:$LAN_IP,DNS:localhost
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
EOF

openssl x509 -req \
  -in "$CERT_DIR/server.csr" \
  -CA "$CERT_DIR/dental-talk-local-ca.crt" \
  -CAkey "$CERT_DIR/dental-talk-local-ca.key" \
  -CAcreateserial -out "$CERT_DIR/server.crt" \
  -days 365 -sha256 -extfile "$CERT_DIR/server.ext"

openssl x509 -in "$CERT_DIR/dental-talk-local-ca.crt" -outform DER \
  -out "$PUBLIC_DIR/dental-talk-local-ca.cer"

echo "HTTPS certificate generated for $LAN_IP"
echo "Start app: npm run dev:https"
echo "Install CA on iPad: npm run cert:serve, then open http://$LAN_IP:5679/dental-talk-local-ca.cer"
