// Canonical release identity. Historical 4-part versions in RELEASE_REGISTRY remain immutable.
export const VERSION_SCHEME = 'MAJOR.MINOR.PATCH';

export function parseAppVersion(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(value)) {
    throw new Error(`Invalid three-part app version: ${value}`);
  }
  return value.split('.').map(Number);
}

export function compareAppVersions(left, right) {
  const a = parseAppVersion(left);
  const b = parseAppVersion(right);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

export function expectedPackageVersion(appVersion) {
  const [, , patch] = parseAppVersion(appVersion);
  return `${appVersion}-private.${patch}`;
}

export function expectedCheckpointZip(appVersion) {
  parseAppVersion(appVersion);
  return `IK_${appVersion}_PRIVATE.zip`;
}
