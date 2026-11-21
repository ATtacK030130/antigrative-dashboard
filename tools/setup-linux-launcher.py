#!/usr/bin/env python3
"""Create a launcher .sh script inside the Antigravity Desktop directory on Linux with loopback debugging flags."""
import argparse
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import stat
import sys

DEBUG_PORT_FLAG = '--remote-debugging-port=0'
DEBUG_ADDRESS_FLAG = '--remote-debugging-address=127.0.0.1'
DEFAULT_SCRIPT_NAME = 'start-antigravity.sh'


def is_link(path):
    """Return True if path is a symbolic link."""
    try:
        return stat.S_ISLNK(os.lstat(path).st_mode)
    except OSError:
        return False


def is_executable_file(path):
    """Return True if path exists as a regular executable file."""
    return path.is_file() and os.access(path, os.X_OK)


def atomic_write_text(path, text, mode=0o755):
    """Atomically write UTF-8 text to path, refusing symlinks."""
    if is_link(path.parent) or is_link(path):
        raise RuntimeError(f'Refusing to write through symbolic link: {path}')
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f'.{path.name}.{os.getpid()}.tmp')
    if is_link(tmp):
        raise RuntimeError(f'Refusing to write through temporary symbolic link: {tmp}')
    data = text.encode('utf-8')
    try:
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, mode)
        try:
            view = memoryview(data)
            written = 0
            while written < len(view):
                written += os.write(fd, view[written:])
        finally:
            os.close(fd)
        os.chmod(tmp, mode)
        os.replace(tmp, path)
    except Exception:
        try:
            tmp.unlink()
        except OSError:
            pass
        raise


def find_exe_in_dir(directory):
    """Find executable antigravity or Antigravity inside directory."""
    if not directory or not directory.is_dir():
        return None
    for name in ('antigravity', 'Antigravity'):
        candidate = directory / name
        if is_executable_file(candidate):
            return candidate
    return None


def find_from_resources(resources_dir):
    """Resolve executable given an app resources directory."""
    if not resources_dir:
        return None
    resources = Path(resources_dir).expanduser()
    asar = resources / 'app.asar'
    exe = find_exe_in_dir(resources.parent)
    if exe is not None and asar.is_file():
        return exe
    return None


def find_from_running_processes():
    """Find running Antigravity executable of current UID via /proc/<pid>/exe."""
    proc_root = Path('/proc')
    if not proc_root.is_dir():
        return None
    uid = os.getuid()
    try:
        entries = sorted(proc_root.iterdir(), key=lambda p: int(p.name) if p.name.isdigit() else -1)
    except OSError:
        return None
    for entry in entries:
        if not entry.name.isdigit():
            continue
        try:
            if entry.stat().st_uid != uid:
                continue
            target = os.readlink(entry / 'exe')
        except OSError:
            continue
        if target.endswith(' (deleted)'):
            continue
        exe = Path(target)
        if exe.name not in ('antigravity', 'Antigravity'):
            continue
        if is_executable_file(exe) and (exe.parent / 'resources' / 'app.asar').is_file():
            return exe
    return None


def resolve_app_executable(args, home, data_home):
    """Locate the Antigravity executable inside its application directory."""
    # 1. Explicit --exe
    if args.exe:
        exe = Path(os.path.abspath(os.path.expanduser(args.exe)))
        if not is_executable_file(exe):
            raise RuntimeError(f'Antigravity executable not found or not executable: {exe}')
        return exe

    # 2. Explicit --app-path
    if args.app_path:
        asar = Path(args.app_path).expanduser().resolve()
        if not asar.is_file():
            raise RuntimeError(f'Antigravity app.asar not found: {asar}')
        app_dir = asar.parent.parent
        exe = find_exe_in_dir(app_dir)
        if exe is None:
            raise RuntimeError(f'Antigravity executable not found next to {asar} (expected in {app_dir})')
        return exe

    # 3. Explicit --app-dir
    if args.app_dir:
        app_dir = Path(args.app_dir).expanduser().resolve()
        if not app_dir.is_dir():
            raise RuntimeError(f'Antigravity installation directory not found: {app_dir}')
        exe = find_exe_in_dir(app_dir)
        if exe is None:
            raise RuntimeError(f'Antigravity executable (antigravity / Antigravity) not found in: {app_dir}')
        return exe

    # 4. Saved AntigravityPulse/settings.json -> appResources
    settings_path = data_home / 'AntigravityPulse' / 'settings.json'
    if settings_path.is_file() and not is_link(settings_path):
        try:
            settings = json.loads(settings_path.read_text(encoding='utf-8-sig'))
            if isinstance(settings, dict) and isinstance(settings.get('appResources'), str) and settings['appResources']:
                exe = find_from_resources(settings['appResources'])
                if exe is not None:
                    return exe
        except (OSError, ValueError):
            pass

    # 5. Environment variables AG_PULSE_APP_ASAR / AG_PULSE_APP_RESOURCES
    if os.environ.get('AG_PULSE_APP_ASAR'):
        asar_cand = Path(os.environ['AG_PULSE_APP_ASAR']).expanduser()
        if asar_cand.is_file():
            exe = find_exe_in_dir(asar_cand.parent.parent)
            if exe is not None:
                return exe
    if os.environ.get('AG_PULSE_APP_RESOURCES'):
        exe = find_from_resources(os.environ['AG_PULSE_APP_RESOURCES'])
        if exe is not None:
            return exe

    # 6. Running processes of current UID via /proc/<pid>/exe
    exe = find_from_running_processes()
    if exe is not None:
        return exe

    # 7. Common Linux extraction and installation directories
    common_dirs = (
        home / 'Antigravity-x64',
        home / 'Antigravity-arm64',
        home / 'Antigravity',
        home / 'Applications' / 'Antigravity-x64',
        home / 'Applications' / 'Antigravity-arm64',
        home / 'Applications' / 'Antigravity',
        data_home / 'antigravity',
        data_home / 'Antigravity',
        home / 'Downloads' / 'Antigravity-x64',
        home / 'Downloads' / 'Antigravity-arm64',
        home / 'Downloads' / 'Antigravity',
        Path('/opt/Antigravity'),
        Path('/opt/antigravity'),
        Path('/usr/share/antigravity'),
    )
    for directory in common_dirs:
        exe = find_exe_in_dir(directory)
        if exe is not None and (directory / 'resources' / 'app.asar').is_file():
            return exe

    # 8. PATH lookup (resolving symlinks)
    for cmd_name in ('antigravity', 'Antigravity'):
        which = shutil.which(cmd_name)
        if which:
            resolved = Path(which).resolve()
            if is_executable_file(resolved) and (resolved.parent / 'resources' / 'app.asar').is_file():
                return resolved

    raise RuntimeError(
        'Antigravity Desktop executable could not be found automatically. '
        'Pass --app-dir /path/to/Antigravity-x64 or --exe /path/to/antigravity.'
    )


def build_launcher_script(exe_name):
    """Render a POSIX sh script placed beside the Antigravity binary."""
    if not re.fullmatch(r'[A-Za-z0-9._-]+', exe_name):
        quoted_target = f'"$app_dir"/{shlex.quote(exe_name)}'
    else:
        quoted_target = f'"$app_dir/{exe_name}"'
    lines = [
        '#!/bin/sh',
        'set -eu',
        'app_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)',
        'unset ELECTRON_RUN_AS_NODE',
        f'exec {quoted_target} {DEBUG_PORT_FLAG} {DEBUG_ADDRESS_FLAG} "$@"',
    ]
    return '\n'.join(lines) + '\n'


def inspect_script_flags(text):
    """Return True if the script contains both loopback debugging flags."""
    return '--remote-debugging-port' in text and '--remote-debugging-address' in text


def validate_script_name(name):
    """Ensure the launcher script filename is a safe single path segment."""
    cleaned = (name or '').strip()
    if not cleaned or '/' in cleaned or '\\' in cleaned or cleaned in ('.', '..'):
        raise ValueError(f'Invalid script filename: {name!r}')
    return cleaned


def main():
    parser = argparse.ArgumentParser(
        prog='setup-linux-launcher.sh',
        description='Create a launcher .sh script inside the Antigravity app directory on Linux with loopback debugging flags.',
    )
    parser.add_argument('--exe', help='Explicit path to the Antigravity executable')
    parser.add_argument('--app-dir', help='Explicit path to the Antigravity directory (e.g. ~/Antigravity-x64)')
    parser.add_argument('--app-path', help='Explicit path to resources/app.asar')
    parser.add_argument('--name', default=DEFAULT_SCRIPT_NAME,
                        help=f'Launcher script filename inside the app directory (default: {DEFAULT_SCRIPT_NAME})')
    parser.add_argument('--force', action='store_true', help='Overwrite an existing launcher script')
    args = parser.parse_args()

    if sys.version_info < (3, 8):
        print('Error: Python 3.8+ is required.', file=sys.stderr)
        return 1
    if not sys.platform.startswith('linux'):
        print('Error: setup-linux-launcher.sh is intended for Linux only.', file=sys.stderr)
        return 1
    if hasattr(os, 'geteuid') and os.geteuid() == 0:
        print('Error: Do not run this script as root / with sudo.', file=sys.stderr)
        return 1

    script_name = validate_script_name(args.name)
    home = Path.home()
    xdg_data = os.environ.get('XDG_DATA_HOME', '').strip()
    data_home = Path(xdg_data).expanduser() if xdg_data else (home / '.local' / 'share')

    exe = resolve_app_executable(args, home, data_home)
    app_dir = exe.parent
    script_path = app_dir / script_name

    if script_path.resolve() == exe.resolve():
        raise RuntimeError(f'Refusing to overwrite the Antigravity executable itself: {exe}')
    if is_link(app_dir) or is_link(script_path):
        raise RuntimeError(f'Refusing to write launcher script through symbolic link: {script_path}')

    if script_path.exists() and not args.force:
        if not script_path.is_file():
            raise RuntimeError(f'Existing launcher path is not a regular file: {script_path}')
        existing = script_path.read_text(encoding='utf-8', errors='replace')
        if inspect_script_flags(existing):
            print(f'Launcher script already exists with debugging flags: {script_path}')
        else:
            print(f'Launcher script already exists (unchanged): {script_path}')
            print(
                f'Warning: script is missing {DEBUG_PORT_FLAG} {DEBUG_ADDRESS_FLAG}. '
                'Re-run with --force to recreate it.',
                file=sys.stderr,
            )
        return 0

    content = build_launcher_script(exe.name)
    atomic_write_text(script_path, content, mode=0o755)
    print(f'Created launcher script: {script_path}')
    print(f'  Target executable: {exe}')
    print(f'  Start command: {script_path}')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError) as error:
        print(f'Error: {error}', file=sys.stderr)
        raise SystemExit(1)
