# Saluna Self-Hosted GitLab Runner

This runner is a temporary cost-control measure for HamGit shared runner minute
pressure. It runs on the Saluna VPS, so treat it as production-adjacent compute:
keep it project-scoped, protected, tagged, and low-concurrency.

## Recommended Shape

- Runner host: `deploy@195.177.255.24`
- Runner directory: `/opt/saluna/gitlab-runner`
- GitLab URL: `https://hamgit.ir`
- Runner tag: `saluna-vps`
- Executor: Docker
- Concurrency: `1`
- Runner container limit: `0.75` CPU, `768m` RAM
- Job container limit: `1` CPU, `1100m` RAM
- Allowed job images: Kaniko and mirrored Alpine only
- Helper image: `hub.hamdocker.ir/gitlab/gitlab-runner-helper:x86_64-v19.0.1`

This is intentionally not a general shared runner. Do not enable untagged jobs.
Do not enable privileged mode unless the CI design changes and the risk is
accepted again.

## Register

Create a project runner in HamGit and copy the runner authentication token. New
GitLab runner tokens normally start with `glrt-`.

Set these options in the HamGit UI while creating or editing the runner:

- Tags: `saluna-vps`
- Run untagged jobs: off
- Protected runner: on, if the `main` branch and deployment variables are
  protected
- Description: `saluna-vps`

From your local machine:

```sh
export VPS_HOST=195.177.255.24
export SSH_KEY=.codex/deploy/saluna_vps_ed25519
export RUNNER_TOKEN='glrt-...'

ssh -i "$SSH_KEY" deploy@"$VPS_HOST" 'mkdir -p /opt/saluna/gitlab-runner/config'
scp -i "$SSH_KEY" deploy/gitlab-runner/docker-compose.yml \
  deploy@"$VPS_HOST":/opt/saluna/gitlab-runner/docker-compose.yml

ssh -i "$SSH_KEY" deploy@"$VPS_HOST" \
  "cd /opt/saluna/gitlab-runner && docker compose up -d"

ssh -i "$SSH_KEY" deploy@"$VPS_HOST" \
  "docker run --rm \
    -v /opt/saluna/gitlab-runner/config:/etc/gitlab-runner \
    hub.hamdocker.ir/gitlab/gitlab-runner:alpine register \
      --non-interactive \
      --url 'https://hamgit.ir' \
      --token '$RUNNER_TOKEN' \
      --executor docker \
      --docker-image 'hub.hamdocker.ir/library/alpine:3.20' \
      --description 'saluna-vps'"

ssh -i "$SSH_KEY" deploy@"$VPS_HOST" \
  "cd /opt/saluna/gitlab-runner && docker compose restart && docker logs --tail=80 saluna-gitlab-runner"
```

After registration, edit `/opt/saluna/gitlab-runner/config/config.toml` and
make it match the resource and image restrictions from
[`deploy/gitlab-runner/config.template.toml`](../deploy/gitlab-runner/config.template.toml).
Preserve the generated `token = "..."` value. Some GitLab Runner versions
rewrite parts of `config.toml` during registration.

## Route Jobs To The Runner

The shared `.kaniko-build` and `.deploy` templates in
[`.gitlab-ci.yml`](../.gitlab-ci.yml) are tagged with `saluna-vps`, so current
build and deploy jobs route to this runner.

Keep deploy jobs manual.

## Busy Hours

To reduce resource pressure without unregistering the runner:

```sh
ssh -i .codex/deploy/saluna_vps_ed25519 deploy@195.177.255.24 \
  'cd /opt/saluna/gitlab-runner && docker compose stop'
```

Resume it:

```sh
ssh -i .codex/deploy/saluna_vps_ed25519 deploy@195.177.255.24 \
  'cd /opt/saluna/gitlab-runner && docker compose up -d'
```

If you want automatic quiet hours, add a cron entry for the `deploy` user that
stops the runner during busy hours and starts it again later.

## Monitor

```sh
ssh -i .codex/deploy/saluna_vps_ed25519 deploy@195.177.255.24 \
  'docker stats --no-stream saluna-gitlab-runner saluna-api saluna-web saluna-pwa saluna-postgres'

ssh -i .codex/deploy/saluna_vps_ed25519 deploy@195.177.255.24 \
  'docker logs --tail=120 saluna-gitlab-runner'
```

## Roll Back

Stop the runner immediately:

```sh
ssh -i .codex/deploy/saluna_vps_ed25519 deploy@195.177.255.24 \
  'cd /opt/saluna/gitlab-runner && docker compose down'
```

Then remove or pause the runner in HamGit project settings.
