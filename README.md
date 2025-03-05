# GoCICa Action

This is the official GitHub action for [GoCICa](https://github.com/gocica-go/gocica). GoCICa is a powerful build cache tool for Go projects that significantly speeds up your builds by caching and reusing build artifacts.

This action allows you to set up GoCICa in your workflow with **just one line**.

## Quick start

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: 1.24.x # Require Go 1.24.x or higher
          cache: false # Disable Go cache because it's not needed with GoCICa
      - uses: gocica-go/gocica-action@v1
      - run: go build . # Build your project with GoCICa
```

## Usage

This action installs GoCICa and sets up the environment variables needed for GoCICa to run. After running this action, you can use the `gocica` command in your workflow.
The action supports multiple platforms (Linux, macOS, Windows) and architectures (x86_64, arm64, i386).

GoCICa provides two options for cache storage:
- GitHub Actions Cache
    - Uses the built-in GitHub Actions caching mechanism
    - Zero configuration required
    - High performance
    - Not available for self-hosted runners
- S3 Compatible Storage
    - Store cache in any S3-compatible storage service
    - Requires your own S3 bucket and credentials
    - Good performance, though slightly slower than GitHub Actions Cache
    - Works with self-hosted runners

### Using GitHub Actions Cache

All settings are automatically read from environment variables set in GitHub Actions.
Therefore, there is no need to configure anything.

```yaml
steps:
  - uses: gocica-go/gocica-action@v1
```

### Using S3 Compatible Storage

The S3 account requires the following permissions on the target bucket:
- `s3:GetObject`
- `s3:PutObject`
- `s3:DeleteObject`
- `s3:ListBucket`

```yaml
steps:
  - uses: gocica-go/gocica-action@v1
    with:
      remote: s3
      s3-region: us-east-1
      s3-bucket: my-bucket
      s3-access-key: ${{ secrets.S3_ACCESS_KEY_ID }}
      s3-secret-access-key: ${{ secrets.S3_SECRET_ACCESS_KEY }}
```

## Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `version` | The version of GoCICa to use. If not specified, the latest version will be used. | No | `latest` |
| `dir` | Directory to store cache files | No | |
| `log-level` | Log level (`debug`, `info`, `warn`, `error`, `silent`) | No | `info` |
| `remote` | Remote backend (`s3`, `github`) | No | `GitHub` |
| `s3-region` | AWS region for S3 backend | No | |
| `s3-bucket` | S3 bucket name for S3 backend | No | |
| `s3-access-key` | AWS access key for S3 backend | No | |
| `s3-secret-access-key` | AWS secret access key for S3 backend | No | |
| `s3-endpoint` | S3 endpoint | No | `s3.amazonaws.com` |
| `s3-disable-ssl` | Disable SSL for S3 connection | No | `false` |
| `s3-use-path-style` | Use path style for S3 connection | No | `false` |
