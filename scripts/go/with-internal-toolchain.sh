#!/usr/bin/env bash
set -euo pipefail

required_version="${SYNAPLOOM_GO_VERSION:-1.26.5}"
current="$(GOTOOLCHAIN=local go env GOVERSION 2>/dev/null || true)"
if [[ "$current" == "go${required_version}" ]]; then
  export GOTOOLCHAIN=local
  exec go "$@"
fi

if [[ -z "${CAAS_ARTIFACTORY_GO_REGISTRY:-}" || -z "${CAAS_ARTIFACTORY_READER_USERNAME:-}" || -z "${CAAS_ARTIFACTORY_READER_PASSWORD:-}" ]]; then
  echo "Go ${required_version} is required and internal Artifactory credentials are unavailable." >&2
  exit 1
fi

cache_root="${SYNAPLOOM_TOOLCHAIN_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/synaploom/toolchains}"
module="golang.org/toolchain@v0.0.1-go${required_version}.linux-amd64"
install_root="$cache_root/toolchain@v0.0.1-go${required_version}.linux-amd64"
archive="$cache_root/toolchain@v0.0.1-go${required_version}.linux-amd64.zip"
mkdir -p "$cache_root"
if [[ ! -x "$install_root/bin/go" ]]; then
  rm -rf "$install_root" "$archive"
  curl --fail --location --retry 3 --silent --show-error \
    --user "${CAAS_ARTIFACTORY_READER_USERNAME}:${CAAS_ARTIFACTORY_READER_PASSWORD}" \
    "https://${CAAS_ARTIFACTORY_GO_REGISTRY}/golang.org/toolchain/@v/v0.0.1-go${required_version}.linux-amd64.zip" \
    --output "$archive"
  staging="$cache_root/.extract-go${required_version}"
  rm -rf "$staging"
  mkdir -p "$staging"
  unzip -q "$archive" -d "$staging"
  extracted="$staging/$module"
  mv "$extracted" "$install_root"
  rm -rf "$staging"
fi
export GOROOT="$install_root"
export PATH="$GOROOT/bin:$PATH"
export GOTOOLCHAIN=local
export GOSUMDB=off
export GOPROXY="https://${CAAS_ARTIFACTORY_READER_USERNAME}:${CAAS_ARTIFACTORY_READER_PASSWORD}@${CAAS_ARTIFACTORY_GO_REGISTRY}"
exec "$GOROOT/bin/go" "$@"
