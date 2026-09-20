# GoCICa Action

This is the official GitHub action for [GoCICa](https://github.com/gocica-go/gocica). GoCICa is a powerful build cache tool for Go projects that significantly speeds up your builds by caching and reusing build artifacts.

This action allows you to set up GoCICa in your workflow with **just one line**.

## Quick start

Add these steps to your workflow:

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-go@v6
    with:
      go-version: 1.24.x # Go 1.24 or higher required
      cache: false # GoCICa serves both caches
  - uses: gocica-go/gocica-action@v1
  - run: go build .
```

The action exports `GOCACHEPROG` for the build cache, starts a `GOPROXY`
daemon for the module cache, and flushes both in its post step. Set
`actions/setup-go`'s `cache: false`: GoCICa replaces that cache entirely.

### Faster warm runs: caches in RAM, daemon before setup-go

Restoring the module cache is tens of thousands of small files, and on the
runner's OS disk that is disk-bound. Two opt-ins take it off the disk and out
of the critical path:

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: gocica-go/gocica-action@v1
    with:
      tmpfs: true # GOMODCACHE and the store on a RAM-backed mount
      wait-for: listening # return at once; warm up while setup-go runs
  - uses: actions/setup-go@v6
    with:
      go-version: 1.24.x
      cache: false
  - uses: gocica-go/gocica-action/ready@v1 # wait for the restore before go runs
  - run: go build .
```

Measured on `ubuntu-latest` against `tailscale/tailscale` (401 modules, 1.1 GB
build cache), a warm build-only job takes 31-32s this way against 37-43s with
`actions/setup-go`'s cache; on the OS disk the two are a tie, because the
daemon's restore and setup-go's toolchain copy wait for the same disk. `tmpfs`
is Linux only and skipped, with a note in the log, when passwordless sudo is
missing or less than 8 GiB of memory is available. `ready` is only needed with
`wait-for: listening`; it never fails the job.

Starting the daemon before the toolchain is installed needs a GoCICa newer
than `v0.1.0-alpha10`: older ones ask `go env` for `GOMODCACHE` and fall back
to not restoring the module cache when `go` is missing.

## Usage

This action sets up GoCICa and its environment variables. The action supports multiple platforms (Linux, macOS, Windows) and architectures (x86_64, arm64, i386).

GoCICa provides two options for cache storage:
- GitHub Actions Cache
    - Built-in caching mechanism
    - Zero configuration required
    - High performance
    - Not available for self-hosted runners
- S3 Storage
    - Any S3-compatible service
    - Requires S3 bucket and credentials
    - Fast and reliable performance
    - Works with self-hosted runners

### Using GitHub Actions Cache

No configuration needed - GoCICa automatically uses GitHub Actions environment variables.

#### Example
```yaml
- uses: gocica-go/gocica-action@v1
```

### Using S3 Storage

Required [S3 permissions](https://docs.aws.amazon.com/IAM/latest/UserGuide/list_amazons3.html#amazons3-actions-as-permissions):
- `s3:GetObject` - Read cache
- `s3:PutObject` - Write cache
- `s3:DeleteObject` - Clean up cache
- `s3:ListBucket` - List cache

[Create an IAM policy](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_create-console.html) with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ],
    "Resource": [
      "arn:aws:s3:::your-bucket-name",
      "arn:aws:s3:::your-bucket-name/*"
    ]
  }]
}
```

#### Example
```yaml
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
| `version` | GoCICa version to use | No | `latest` |
| `binary-path` | Use this GoCICa binary instead of downloading a release (for benchmarking unreleased builds) | No | |
| `dir` | Cache file directory | No | |
| `log-level` | Log level (`debug`, `info`, `warn`, `error`, `silent`) | No | `info` |
| `module-proxy` | Serve the module cache over `GOPROXY` | No | `true` |
| `upstream-proxy` | Proxy to fetch module cache misses from | No | the ambient `GOPROXY` |
| `clean-module-cache` | Run `go clean -modcache` first (benchmarking only) | No | `false` |
| `wait-for` | `ready` (caches restored) or `listening` (return as soon as `GOPROXY` is known; run `gocica-go/gocica-action/ready` before the first go command) | No | `ready` |
| `tmpfs` | Put `GOMODCACHE` and the store on a RAM-backed tmpfs (Linux, passwordless sudo, 8 GiB available) | No | `false` |
| `tmpfs-size` | Size limit of that mount; a ceiling, not a reservation | No | `10g` |
| `remote` | Cache backend (`s3`, `github`) | No | `github` |
| `s3-region` | [AWS region](https://docs.aws.amazon.com/general/latest/gr/s3.html) for S3 | No | |
| `s3-bucket` | S3 bucket name | No | |
| `s3-access-key` | AWS access key | No | |
| `s3-secret-access-key` | AWS secret access key | No | |
| `s3-endpoint` | [S3 endpoint](https://docs.aws.amazon.com/general/latest/gr/s3.html) | No | `s3.amazonaws.com` |
| `s3-disable-ssl` | Disable SSL (not recommended) | No | `false` |
| `s3-use-path-style` | Use [path-style URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/VirtualHosting.html) | No | `false` |
