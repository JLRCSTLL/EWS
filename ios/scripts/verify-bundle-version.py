"""Check the compiled app and extension, not just the Xcode project settings."""
from pathlib import Path
import plistlib
import re
import sys

spec = (Path(__file__).resolve().parents[1] / "project.yml").read_text()
expected = {
    "CFBundleShortVersionString": re.search(r'MARKETING_VERSION:\s*"([^"]+)"', spec).group(1),
    "CFBundleVersion": re.search(r'CURRENT_PROJECT_VERSION:\s*"([^"]+)"', spec).group(1),
}
app = Path(sys.argv[1])
for info in (app / "Info.plist", app / "PlugIns/AGILAAlerts.appex/Info.plist"):
    with info.open("rb") as source:
        bundle = plistlib.load(source)
    for key, value in expected.items():
        if str(bundle.get(key)) != value:
            raise SystemExit(f"{info}: {key} is {bundle.get(key)!r}; expected {value!r}")
    print(f"Verified {bundle['CFBundleIdentifier']}: {expected['CFBundleShortVersionString']} ({expected['CFBundleVersion']})")
