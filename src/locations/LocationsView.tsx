import type { Location } from './location.types';
import { EmptyState } from '../ui/EmptyState';
import { buildGoogleMapsDirectionsUrl } from './google-maps';

const typeLabels = {
  HOME_AREA: 'Obszar domowy',
  WORK: 'Praca',
  UNIVERSITY: 'Uczelnia',
  CLINIC: 'Klinika',
  OTHER: 'Inne',
} as const;

interface LocationsViewProps {
  locations: Location[];
  homeLocationId?: string | undefined;
  workLocationId?: string | undefined;
  onAdd: () => void;
  onEdit: (location: Location) => void;
}

export function LocationsView({ locations, homeLocationId, workLocationId, onAdd, onEdit }: LocationsViewProps) {
  return (
    <section className="view-shell">
      <header className="view-header">
        <div>
          <p className="eyebrow">Miejsca</p>
          <h1>Twoje punkty dnia</h1>
          <p className="view-subtitle">Miejsca są zapisywane lokalnie. Zapisany adres możesz otworzyć jako trasę w Mapach Google.</p>
        </div>
        <button type="button" className="button button-primary" onClick={onAdd}>+ Dodaj miejsce</button>
      </header>

      {locations.length ? (
        <div className="location-grid">
          {locations.map((location) => {
            const directionsUrl = buildGoogleMapsDirectionsUrl(location);
            return (
              <article className="panel location-card" key={location.id}>
                <div className="location-topline">
                  <span className="location-type">{typeLabels[location.type]}</span>
                  <div className="location-statuses">
                    {location.id === homeLocationId ? <span className="status-pill">Start</span> : null}
                    {location.id === workLocationId ? <span className="status-pill">Praca</span> : null}
                  </div>
                </div>
                <h2>{location.name}</h2>
                <p>{location.address}</p>
                {location.note ? <small>{location.note}</small> : null}
                <div className="location-card-actions">
                  {directionsUrl ? <a className="text-button align-start" href={directionsUrl} target="_blank" rel="noopener noreferrer" aria-label={`Wyznacz trasę do ${location.name} w Mapach Google`}>Trasa</a> : null}
                  <button type="button" className="text-button align-start" onClick={() => onEdit(location)}>Edytuj miejsce</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="panel"><EmptyState title="Brak miejsc" description="Dodaj pierwszy punkt, z którego korzystasz w planie dnia." actionLabel="Dodaj miejsce" onAction={onAdd} /></div>
      )}
    </section>
  );
}
