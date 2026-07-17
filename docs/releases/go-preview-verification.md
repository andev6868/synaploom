# Go Preview Release Verification

Native preview builds use `CGO_ENABLED=0`, `-trimpath`, injected version/schema metadata, embedded Web assets and SHA-256 checksums for darwin/amd64, darwin/arm64, linux/amd64, linux/arm64, windows/amd64 and windows/arm64.
