import type { Location } from './location.types';

type RouteLocation = Pick<Location, 'name' | 'address'>;

export function buildGoogleMapsDirectionsUrl(location: RouteLocation): string | undefined {
  const address = location.address.trim();
  if (!address) return undefined;

  const name = location.name.trim();
  const destination = [name, address].filter(Boolean).join(', ');
  const params = new URLSearchParams({ api: '1', destination });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
