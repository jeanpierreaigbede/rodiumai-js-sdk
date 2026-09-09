# Local CI — mirrors GitHub Actions lint + security checks.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "==> npm ci"
npm ci

Write-Host "==> lint"
npm run lint

Write-Host "==> typecheck"
npm run typecheck

Write-Host "==> format"
npm run format

Write-Host "==> audit"
npm run audit

Write-Host "==> unit tests"
npm run test:unit

Write-Host "CI passed"
