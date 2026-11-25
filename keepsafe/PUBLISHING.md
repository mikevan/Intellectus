# Publishing KeepSafe

This document explains how to package and distribute KeepSafe for local-only use.

KeepSafe is intended to stay local and does not require publishing to public registries.

## 1. Prerequisites

1. Python 3.10+ available in your shell.
2. Build tools installed:

```bash
python -m pip install --upgrade build twine
```

## 2. Update Version

1. Open [pyproject.toml](pyproject.toml).
2. Bump `project.version` to a new value for your local release.
3. Save changes.

## 3. Build Artifacts

From project root:

```bash
python -m build
```

This creates:

- `dist/*.whl`
- `dist/*.tar.gz`

## 4. Validate Artifacts

```bash
python -m twine check dist/*
```

## 5. Test Local Install

Use one of these:

```bash
python -m pip install --force-reinstall dist/keepsafe-<version>-py3-none-any.whl
keepsafe --help
```

or

```bash
pipx install dist/keepsafe-<version>-py3-none-any.whl
keepsafe --help
```

PowerShell helper to pick the latest built wheel:

```powershell
$wheel = Get-ChildItem -Path .\dist\*.whl | Sort-Object LastWriteTime -Descending | Select-Object -First 1
python -m pip install --force-reinstall $wheel.FullName
```

## 6. Share Artifacts Locally

Share one of these files from `dist/`:

- `keepsafe-<version>-py3-none-any.whl` (recommended)
- `keepsafe-<version>.tar.gz`

Examples:

- Copy to a shared drive or internal file share.
- Attach to an internal ticket/release note.
- Hand off directly to teammates.

## 7. Install From Shared Artifact

```bash
python -m pip install path/to/keepsafe-<version>-py3-none-any.whl
```

or

```bash
pipx install path/to/keepsafe-<version>-py3-none-any.whl
```

## 8. Notes For Local-Only Distribution

- No PyPI or TestPyPI account is needed.
- No GitHub release automation is required.
- Do not reuse a local version if people may cache wheels; bump `project.version` when sharing an update.
- For reproducible local releases, build from a clean workspace state.


