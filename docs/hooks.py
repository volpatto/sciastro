"""Keep the documentation version tied to the checked-out package."""

import json
import os
from pathlib import Path


def on_post_build(*, config):
    root = Path(config.config_file_path).parent
    version = json.loads((root / "package.json").read_text(encoding="utf-8"))["version"]
    metadata = {"version": version, "commit": os.environ.get("DOCS_COMMIT", "local")}
    (Path(config.site_dir) / "release.json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )
