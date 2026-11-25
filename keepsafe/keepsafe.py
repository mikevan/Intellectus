from __future__ import annotations

import importlib
import importlib.util
import sys
from pathlib import Path


def _load_impl_package() -> None:
    if "keepsafe_impl" in sys.modules:
        return

    src_root = Path(__file__).resolve().parent / "src" / "keepsafe"
    spec = importlib.util.spec_from_file_location(
        "keepsafe_impl",
        src_root / "__init__.py",
        submodule_search_locations=[str(src_root)],
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load KeepSafe implementation package")

    module = importlib.util.module_from_spec(spec)
    sys.modules["keepsafe_impl"] = module
    spec.loader.exec_module(module)


def main() -> None:
    _load_impl_package()
    cli = importlib.import_module("keepsafe_impl.cli")
    cli.main()


if __name__ == "__main__":
    main()
