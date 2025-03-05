# GoCICa Action

This is the official GitHub action for [GoCICa](https://github.com/gocica-go/gocica). GoCICa is a powerful build cache tool for Go projects that significantly speeds up your builds by caching and reusing build artifacts.

This action allows you to set up GoCICa in your workflow with **just one line**.

## Quick start

Add these steps to your workflow:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-go@v5
    with:
      go-version: 1.24.x # Go 1.24 or higher required
      cache: false # Using GoCICa instead
  - uses: gocica-go/gocica-action@v1
  - run: go build .
```

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
| `dir` | Cache file directory | No | |
| `log-level` | Log level (`debug`, `info`, `warn`, `error`, `silent`) | No | `info` |
| `remote` | Cache backend (`s3`, `github`) | No | `github` |
| `s3-region` | [AWS region](https://docs.aws.amazon.com/general/latest/gr/s3.html) for S3 | No | |
| `s3-bucket` | S3 bucket name | No | |
| `s3-access-key` | AWS access key | No | |
| `s3-secret-access-key` | AWS secret access key | No | |
| `s3-endpoint` | [S3 endpoint](https://docs.aws.amazon.com/general/latest/gr/s3.html) | No | `s3.amazonaws.com` |
| `s3-disable-ssl` | Disable SSL (not recommended) | No | `false` |
| `s3-use-path-style` | Use [path-style URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/VirtualHosting.html) | No | `false` |
