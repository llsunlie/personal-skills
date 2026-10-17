#!/usr/bin/env python3
"""Link this repository's skills into a local agent skill directory."""
import argparse
from datetime import datetime
from pathlib import Path
import re


def install(source: Path, target_dir: Path) -> None:
    target = target_dir / source.name
    if target.is_symlink() and target.resolve() == source.resolve():
        print(f"Already installed: {source.name}")
        return
    backup = None
    if target.exists() or target.is_symlink():
        backup_dir = target_dir.parent / "skill-backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup = backup_dir / f"{source.name}-{datetime.now():%Y%m%d-%H%M%S-%f}"
        target.rename(backup)
    try:
        target.symlink_to(source.resolve(), target_is_directory=True)
    except OSError:
        if backup is not None:
            backup.rename(target)
        raise
    print(f"Installed: {target} -> {source.resolve()}")
    if backup is not None:
        print(f"Previous installation saved: {backup}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skill", help="Install one skill by directory name (default: all)")
    parser.add_argument("--target", type=Path, default=Path.home() / ".agents" / "skills")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1] / "skills"
    if args.skill and not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", args.skill):
        parser.error("--skill must be a lowercase name with optional hyphens")
    sources = [root / args.skill] if args.skill else sorted(root.iterdir())
    sources = [p for p in sources if p.is_dir() and (p / "SKILL.md").is_file()]
    if not sources:
        parser.error("No matching skill with a SKILL.md file")
    target_dir = args.target.expanduser().absolute()
    if target_dir.resolve() == root.resolve():
        parser.error("The installation target cannot be the repository's source directory")
    target_dir.mkdir(parents=True, exist_ok=True)
    for source in sources:
        install(source, target_dir)


if __name__ == "__main__":
    main()
