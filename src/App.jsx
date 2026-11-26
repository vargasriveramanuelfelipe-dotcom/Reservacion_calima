import { useEffect, useMemo, useState } from 'react';
import {
  createHotel,
  createReservation,
  demoAccounts,
  isDemoMode,
  loadCatalog,
  loadReservations,
  restoreSession,
  setHotelAvailability,
  setReservationStatus,
  signIn,
  signOut,
  signUp,
} from './data.js';

const money = amount => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
}).format(amount || 0);

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${value}T12:00:00`));
}

function stayLength(start, end) {
  return Math.max(1, Math.round((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000));
}

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('explore');
  const [destinations, setDestinations] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('all');
  const [bookingHotel, setBookingHotel] = useState(null);
  const [notice, setNotice] = useState('');

  const refresh = async (activeUser = user) => {
    if (!activeUser) return;
    setLoading(true);
    setError('');
    try {
      const [catalog, bookings] = await Promise.all([
        loadCatalog(),
        loadReservations(activeUser),
      ]);
      setDestinations(catalog.destinations);
      setHotels(catalog.hotels);
      setReservations(bookings);
    } catch (caught) {
      setError(caught.message || 'No pudimos cargar tus datos. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    restoreSession()
      .then(restored => {
        if (active && restored) setUser(restored);
        else if (active) setLoading(false);
      })
      .catch(caught => {
        if (active) {
          setError(caught.message || 'No fue posible conectar con Supabase.');
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (user) refresh(user);
  }, [user]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const destinationById = useMemo(
    () => Object.fromEntries(destinations.map(destination => [destination.id, destination])),
    [destinations],
  );
  const visibleHotels = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('es');
    return hotels.filter(hotel => {
      const destination = destinationById[hotel.destination_id];
      const matchesDestination = destinationFilter === 'all' || hotel.destination_id === destinationFilter;
      const matchesQuery = !term || [
        hotel.name,
        hotel.area,
        hotel.category,
        destination?.name,
      ].some(value => value?.toLocaleLowerCase('es').includes(term));
      return hotel.is_available && matchesDestination && matchesQuery;
    });
  }, [destinationById, destinationFilter, hotels, query]);

  const handleLogin = async (email, password) => {
    setBusy(true);
    setError('');
    try {
      const nextUser = await signIn(email, password);
      setUser(nextUser);
      setPage('explore');
    } catch (caught) {
      setError(caught.message || 'No pudimos iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async form => {
    setBusy(true);
    setError('');
    try {
      const result = await signUp(form);
      if (result.confirmationRequired) {
        setNotice('Supabase aún exige confirmar el correo. Desactiva «Confirm email» en Authentication → Providers → Email para permitir el acceso inmediato.');
      } else {
        setUser(result);
      }
    } catch (caught) {
      setError(caught.message || 'No pudimos crear tu cuenta.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await signOut();
      setUser(null);
      setReservations([]);
      setPage('explore');
    } catch (caught) {
      setError(caught.message || 'No pudimos cerrar sesión.');
    } finally {
      setBusy(false);
    }
  };

  const submitBooking = async booking => {
    setBusy(true);
    setError('');
    try {
      await createReservation(user, bookingHotel, booking);
      setBookingHotel(null);
      setNotice('¡Listo! Tu solicitud ya aparece en Mis reservas.');
      await refresh(user);
      setPage('reservations');
    } catch (caught) {
      setError(caught.message || 'No pudimos completar la reserva.');
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (reservationId, status) => {
    setBusy(true);
    setError('');
    try {
      await setReservationStatus(reservationId, status);
      await refresh(user);
      setNotice('Estado de la reserva actualizado.');
    } catch (caught) {
      setError(caught.message || 'No pudimos actualizar la reserva.');
    } finally {
      setBusy(false);
    }
  };

  const addHotel = async hotel => {
    setBusy(true);
    setError('');
    try {
      await createHotel(hotel);
      await refresh(user);
      setNotice('El alojamiento ya está publicado.');
    } catch (caught) {
      setError(caught.message || 'No pudimos guardar el alojamiento.');
    } finally {
      setBusy(false);
    }
  };

  const updateAvailability = async (hotel, available) => {
    setBusy(true);
    setError('');
    try {
      await setHotelAvailability(hotel.id, available);
      await refresh(user);
      setNotice(available ? 'Alojamiento visible para viajeros.' : 'Alojamiento pausado.');
    } catch (caught) {
      setError(caught.message || 'No pudimos actualizar el alojamiento.');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !user) return <LoadingScreen />;
  if (!user) {
    return (
      <LoginScreen
        error={error}
        busy={busy}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onClearError={() => setError('')}
        notice={notice}
      />
    );
  }

  return (
    <div className="app-shell">
      <Header user={user} page={page} setPage={setPage} onLogout={handleLogout} />
      {error && (
        <div className="app-alert" role="alert">
          <span>{error}</span>
          <button type="button" aria-label="Cerrar aviso" onClick={() => setError('')}>×</button>
        </div>
      )}
      {loading ? (
        <main className="page-wrap"><LoadingInline /></main>
      ) : (
        <main className="page-wrap">
          {page === 'explore' && (
            <ExplorePage
              user={user}
              destinations={destinations}
              hotels={visibleHotels}
              allHotels={hotels}
              destinationById={destinationById}
              query={query}
              setQuery={setQuery}
              destinationFilter={destinationFilter}
              setDestinationFilter={setDestinationFilter}
              onBook={setBookingHotel}
              onGoReservations={() => setPage('reservations')}
              onGoAdmin={() => setPage('admin')}
              reservations={reservations}
            />
          )}
          {page === 'reservations' && (
            <ReservationsPage
              reservations={reservations}
              hotels={hotels}
              destinationById={destinationById}
              isAdmin={user.role === 'admin'}
              onExplore={() => setPage('explore')}
            />
          )}
          {page === 'admin' && user.role === 'admin' && (
            <AdminPage
              destinations={destinations}
              hotels={hotels}
              reservations={reservations}
              destinationById={destinationById}
              onAddHotel={addHotel}
              onSetAvailability={updateAvailability}
              onSetStatus={updateStatus}
              busy={busy}
            />
          )}
        </main>
      )}
      <footer className="site-footer">
        <span>Brisa <span className="footer-dot">·</span> Un viaje a la vez</span>
        <span>{isDemoMode ? 'Modo demostración · datos guardados en este navegador' : 'Conectado a tu espacio Supabase'}</span>
      </footer>
      {bookingHotel && (
        <BookingModal
          hotel={bookingHotel}
          destination={destinationById[bookingHotel.destination_id]}
          onClose={() => setBookingHotel(null)}
          onSubmit={submitBooking}
          busy={busy}
        />
      )}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}

function Header({ user, page, setPage, onLogout }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" type="button" onClick={() => setPage('explore')} aria-label="Ir a explorar">
          <span className="brand-mark">b.</span>
          <span className="brand-word">brisa<span className="brand-period">.</span></span>
        </button>
        <nav className="main-nav" aria-label="Navegación principal">
          <button className={page === 'explore' ? 'nav-link active' : 'nav-link'} type="button" onClick={() => setPage('explore')}>Explorar</button>
          <button className={page === 'reservations' ? 'nav-link active' : 'nav-link'} type="button" onClick={() => setPage('reservations')}>Mis reservas</button>
          {user.role === 'admin' && (
            <button className={page === 'admin' ? 'nav-link active' : 'nav-link'} type="button" onClick={() => setPage('admin')}>Administración</button>
          )}
        </nav>
        <div className="account-menu">
          <span className="avatar">{user.name?.slice(0, 1).toLocaleUpperCase('es') || 'B'}</span>
          <div className="account-copy">
            <strong>{user.name?.split(' ')[0] || 'Viajero'}</strong>
            <span>{user.role === 'admin' ? 'Administración' : 'Viajero'}</span>
          </div>
          <button className="logout-button" type="button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function ExplorePage({
  user, destinations, hotels, allHotels, destinationById, query, setQuery,
  destinationFilter, setDestinationFilter, onBook, onGoReservations,
  onGoAdmin, reservations,
}) {
  const featured = destinations.filter(destination => destination.featured !== false).slice(0, 4);
  const firstName = user.name?.split(' ')[0] || 'viajero';
  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> UNA ESCAPADA TE ESTÁ ESPERANDO</div>
          <h1>Hola, {firstName}<span className="title-period">.</span><br />¿A dónde te lleva la brisa?</h1>
          <p className="welcome-copy">Lugares elegidos con cariño, para que viajar se sienta fácil desde el primer día.</p>
        </div>
        <div className="season-note">
          <span className="season-icon">✳</span>
          <div><small>ESTA TEMPORADA</small><strong>El Caribe está<br />en su mejor momento</strong></div>
          <span className="season-arrow">↗</span>
        </div>
      </section>

      <section className="hero-panel" aria-label="Destino recomendado">
        <div className="hero-copy">
          <div className="hero-kicker"><span className="kicker-number">01</span> NUESTRA RECOMENDACIÓN</div>
          <h2>Cartagena,<br /><em>sin itinerario.</em></h2>
          <p>Un café a la sombra, calles de colores y el atardecer que nunca se apura.</p>
          <button
            className="hero-button"
            type="button"
            onClick={() => setDestinationFilter(destinations.find(item => item.name === 'Cartagena')?.id || 'all')}
          >
            Descubrir Cartagena <span aria-hidden="true">↗</span>
          </button>
          <div className="hero-note">4 alojamientos · desde {money(285000)} / noche</div>
        </div>
        <div className="hero-art art-cartagena" role="img" aria-label="Ilustración de casas coloniales bajo un sol cálido">
          <span className="hero-stamp">COLOMBIA<br /><b>11° N</b></span>
          <span className="art-sun" />
          <span className="art-cloud cloud-one" />
          <span className="art-cloud cloud-two" />
          <span className="art-water" />
          <span className="art-building building-back" />
          <span className="art-building building-front" />
          <span className="art-palm palm-one" />
          <span className="art-palm palm-two" />
          <span className="art-boat" />
          <span className="art-caption">CARTAGENA DE INDIAS <span>·</span> BOLÍVAR</span>
        </div>
      </section>

      <section className="section-block journal-section">
        <div className="section-heading">
          <div><div className="eyebrow"><span className="eyebrow-line" /> PEQUEÑOS GRANDES LUGARES</div><h2>Recomendados para ti</h2></div>
          <span className="section-aside">Una buena historia empieza<br />con un buen destino.</span>
        </div>
        {featured.length ? (
          <div className="destination-grid">
            {featured.map((destination, index) => (
              <button
                type="button"
                className={`destination-card destination-${destination.theme || 'coast'}`}
                key={destination.id}
                onClick={() => setDestinationFilter(destination.id)}
              >
                <span className="destination-art" aria-hidden="true">
                  <span className="destination-sun" />
                  <span className="destination-shape shape-back" />
                  <span className="destination-shape shape-front" />
                  <span className="destination-palm" />
                  <span className="destination-water" />
                  <span className="destination-index">0{index + 1}</span>
                </span>
                <span className="destination-info">
                  <span className="destination-region">{destination.region}</span>
                  <span className="destination-name">{destination.name}<span>↗</span></span>
                  <span className="destination-note">{destination.note}</span>
                </span>
              </button>
            ))}
          </div>
        ) : <EmptyState title="Aún no hay destinos" copy="Cuando haya lugares para recomendar, los verás aquí." />}
      </section>

      <section className="section-block stays-section" id="alojamientos">
        <div className="section-heading stays-heading">
          <div><div className="eyebrow"><span className="eyebrow-line" /> UNA CAMA BONITA, UNA HISTORIA NUEVA</div><h2>Alojamientos con encanto</h2></div>
          <div className="stays-count">{hotels.length} {hotels.length === 1 ? 'lugar disponible' : 'lugares disponibles'}</div>
        </div>
        <div className="search-bar">
          <label className="search-query">
            <span className="search-symbol" aria-hidden="true">⌕</span>
            <span className="sr-only">Buscar por hotel, zona o destino</span>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Busca un lugar, una ciudad..." />
          </label>
          <label className="destination-select">
            <span className="filter-label">DESTINO</span>
            <select value={destinationFilter} onChange={event => setDestinationFilter(event.target.value)}>
              <option value="all">Todos los destinos</option>
              {destinations.map(destination => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
            </select>
          </label>
          {destinationFilter !== 'all' && <button className="clear-filter" type="button" onClick={() => setDestinationFilter('all')}>Quitar filtro ×</button>}
        </div>
        {hotels.length ? (
          <div className="hotel-list">
            {hotels.map((hotel, index) => (
              <HotelRow
                key={hotel.id}
                hotel={hotel}
                destination={destinationById[hotel.destination_id]}
                index={index}
                onBook={() => onBook(hotel)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={allHotels.some(hotel => hotel.is_available) ? 'No encontramos ese lugar' : 'Por aquí todo está tranquilo'}
            copy={allHotels.some(hotel => hotel.is_available) ? 'Prueba con otro nombre o destino.' : 'Estamos preparando nuevas recomendaciones para ti.'}
            action={query || destinationFilter !== 'all' ? <button className="text-button" type="button" onClick={() => { setQuery(''); setDestinationFilter('all'); }}>Ver todos los alojamientos ↗</button> : null}
          />
        )}
      </section>

      <section className="bottom-note">
        <span className="bottom-spark">✳</span>
        <div><strong>Tu próximo recuerdo está más cerca.</strong><span>Las buenas escapadas no necesitan demasiada planeación.</span></div>
        <button type="button" onClick={user.role === 'admin' ? onGoAdmin : onGoReservations}>
          {user.role === 'admin' ? 'Ir a administración' : `${reservations.length ? 'Revisar' : 'Ver'} mis reservas`} <span>↗</span>
        </button>
      </section>
    </>
  );
}

function HotelRow({ hotel, destination, index, onBook }) {
  return (
    <article className="hotel-row">
      <div className={`hotel-thumb thumb-${hotel.accent || ['coral', 'blue', 'green'][index % 3]}`} aria-hidden="true">
        <span className="thumb-sun" /><span className="thumb-roof" /><span className="thumb-window" />
        <span className="thumb-stem" /><span className="thumb-leaf" />
        <span className="thumb-number">B{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="hotel-main">
        <div className="hotel-category">{hotel.category || 'Alojamiento'} <span>·</span> {destination?.name || 'Colombia'}</div>
        <h3>{hotel.name}</h3>
        <p>{hotel.description || `${hotel.area || 'Una zona especial'} para disfrutar tu destino con calma.`}</p>
        <div className="hotel-meta"><span>⌖ {hotel.area || destination?.region}</span><span className="rating"><b>★</b> {Number(hotel.rating || 4.8).toFixed(1)}</span></div>
      </div>
      <div className="hotel-price">
        <strong>{money(hotel.price_per_night)}</strong>
        <span>por noche</span>
        <button className="book-button" type="button" onClick={onBook}>Reservar <span>↗</span></button>
      </div>
    </article>
  );
}

function ReservationsPage({ reservations, hotels, destinationById, isAdmin, onExplore }) {
  const hotelMap = Object.fromEntries(hotels.map(hotel => [hotel.id, hotel]));
  return (
    <section className="inner-page">
      <div className="eyebrow"><span className="eyebrow-line" /> TU VIAJE, A TU RITMO</div>
      <div className="inner-title-row"><div><h1>{isAdmin ? 'Todas las reservas' : 'Mis reservas'}<span className="title-period">.</span></h1><p>Un resumen sencillo de tus próximas escapadas.</p></div><span className="count-badge">{reservations.length} {reservations.length === 1 ? 'reserva' : 'reservas'}</span></div>
      {reservations.length ? (
        <div className="reservation-list">
          {reservations.map(reservation => {
            const hotel = hotelMap[reservation.hotel_id];
            const destination = destinationById[hotel?.destination_id];
            const statusLabel = reservation.status === 'confirmed' ? 'Confirmada' : reservation.status === 'cancelled' ? 'Cancelada' : 'Pendiente';
            return (
              <article className="reservation-card" key={reservation.id}>
                <div className={`reservation-mark ${hotel?.accent ? `thumb-${hotel.accent}` : ''}`} aria-hidden="true"><span>✳</span></div>
                <div className="reservation-detail">
                  <span className="hotel-category">{destination?.name || 'Brisa · Colombia'}</span>
                  <h2>{hotel?.name || 'Alojamiento reservado'}</h2>
                  <p>{formatDate(reservation.check_in)} <span>→</span> {formatDate(reservation.check_out)} · {reservation.guest_count} {reservation.guest_count === 1 ? 'huésped' : 'huéspedes'}</p>
                </div>
                <span className={`status-pill status-${reservation.status}`}>{statusLabel}</span>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={isAdmin ? 'Todavía no hay reservas' : 'Tu próxima aventura empieza aquí'}
          copy={isAdmin ? 'Cuando alguien reserve, el detalle aparecerá en esta lista.' : 'Aún no tienes escapadas guardadas. Explora lugares y encuentra uno que te haga ilusión.'}
          action={<button className="primary-button" type="button" onClick={onExplore}>Explorar alojamientos <span>↗</span></button>}
        />
      )}
    </section>
  );
}

function AdminPage({ destinations, hotels, reservations, destinationById, onAddHotel, onSetAvailability, onSetStatus, busy }) {
  const [showForm, setShowForm] = useState(false);
  const activeCount = hotels.filter(hotel => hotel.is_available).length;
  const pendingCount = reservations.filter(reservation => reservation.status === 'pending').length;
  const [form, setForm] = useState({ name: '', destination_id: destinations[0]?.id || '', area: '', price: '', category: 'Hotel', description: '' });
  const hotelMap = Object.fromEntries(hotels.map(hotel => [hotel.id, hotel]));

  useEffect(() => {
    if (!form.destination_id && destinations[0]) setForm(current => ({ ...current, destination_id: destinations[0].id }));
  }, [destinations, form.destination_id]);

  const submit = async event => {
    event.preventDefault();
    if (!form.name.trim() || !form.destination_id || Number(form.price) <= 0) return;
    await onAddHotel({
      name: form.name.trim(),
      destination_id: form.destination_id,
      area: form.area.trim(),
      price_per_night: Number(form.price),
      rating: 4.8,
      category: form.category,
      description: form.description.trim(),
      is_available: true,
    });
    setForm({ name: '', destination_id: destinations[0]?.id || '', area: '', price: '', category: 'Hotel', description: '' });
    setShowForm(false);
  };

  return (
    <section className="inner-page admin-page">
      <div className="eyebrow"><span className="eyebrow-line" /> ESPACIO DE EQUIPO</div>
      <div className="inner-title-row"><div><h1>Administración<span className="title-period">.</span></h1><p>Cuida los detalles para que alguien más disfrute el viaje.</p></div><span className="admin-role-chip">✳ Admin Brisa</span></div>
      <div className="admin-stats">
        <div className="stat-card"><span>ALOJAMIENTOS ACTIVOS</span><strong>{activeCount}<small> / {hotels.length}</small></strong><i>En el catálogo</i></div>
        <div className="stat-card stat-coral"><span>RESERVAS POR REVISAR</span><strong>{pendingCount}</strong><i>Solicitudes pendientes</i></div>
        <div className="stat-card stat-sage"><span>DESTINOS</span><strong>{destinations.length}</strong><i>Lugares recomendados</i></div>
      </div>

      <div className="admin-section-heading">
        <div><span className="section-number">01 / CATÁLOGO</span><h2>Alojamientos</h2></div>
        <button className="primary-button" type="button" onClick={() => setShowForm(value => !value)}>{showForm ? 'Cerrar formulario' : '+ Añadir alojamiento'}</button>
      </div>
      {showForm && (
        <form className="admin-form" onSubmit={submit}>
          <div className="form-grid">
            <label>Nombre del alojamiento<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Casa del Sol" /></label>
            <label>Destino<select required value={form.destination_id} onChange={event => setForm({ ...form, destination_id: event.target.value })}>{destinations.map(destination => <option value={destination.id} key={destination.id}>{destination.name}</option>)}</select></label>
            <label>Zona o barrio<input value={form.area} onChange={event => setForm({ ...form, area: event.target.value })} placeholder="Centro histórico" /></label>
            <label>Precio por noche (COP)<input required type="number" min="1" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} placeholder="250000" /></label>
            <label>Categoría<input value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} placeholder="Casa boutique" /></label>
            <label className="wide-field">Descripción<input value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Un lugar tranquilo para..." /></label>
          </div>
          <button className="primary-button" disabled={busy} type="submit">{busy ? 'Guardando…' : 'Publicar alojamiento ↗'}</button>
        </form>
      )}
      <div className="admin-list">
        {hotels.map(hotel => (
          <div className="admin-list-row" key={hotel.id}>
            <span className={`admin-led ${hotel.is_available ? 'led-on' : ''}`} />
            <div className="admin-item-copy"><strong>{hotel.name}</strong><span>{destinationById[hotel.destination_id]?.name || 'Destino'} · {money(hotel.price_per_night)} / noche</span></div>
            <span className={hotel.is_available ? 'listing-state' : 'listing-state paused'}>{hotel.is_available ? 'Publicado' : 'Pausado'}</span>
            <button className="outline-button" type="button" disabled={busy} onClick={() => onSetAvailability(hotel, !hotel.is_available)}>{hotel.is_available ? 'Pausar' : 'Activar'}</button>
          </div>
        ))}
        {!hotels.length && <EmptyState title="Catálogo vacío" copy="Añade un alojamiento para comenzar a recibir reservas." />}
      </div>

      <div className="admin-section-heading reservations-admin-heading">
        <div><span className="section-number">02 / OPERACIÓN</span><h2>Reservas recientes</h2></div>
        <span className="stays-count">{reservations.length} en total</span>
      </div>
      <div className="admin-list admin-bookings">
        {reservations.slice(0, 8).map(reservation => (
          <div className="admin-list-row" key={reservation.id}>
            <span className="booking-date">{formatDate(reservation.check_in)}</span>
            <div className="admin-item-copy"><strong>{hotelMap[reservation.hotel_id]?.name || 'Alojamiento'}</strong><span>{reservation.guest_count} {reservation.guest_count === 1 ? 'huésped' : 'huéspedes'} · {formatDate(reservation.check_in)} al {formatDate(reservation.check_out)}</span></div>
            <span className={`status-pill status-${reservation.status}`}>{reservation.status === 'confirmed' ? 'Confirmada' : reservation.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}</span>
            {reservation.status !== 'cancelled' && (
              <select aria-label={`Estado de ${hotelMap[reservation.hotel_id]?.name || 'reserva'}`} className="status-select" value={reservation.status} disabled={busy} onChange={event => onSetStatus(reservation.id, event.target.value)}>
                <option value="pending">Pendiente</option><option value="confirmed">Confirmada</option><option value="cancelled">Cancelar</option>
              </select>
            )}
          </div>
        ))}
        {!reservations.length && <EmptyState title="Sin reservas por ahora" copy="Las solicitudes nuevas aparecerán en este espacio." />}
      </div>
    </section>
  );
}

function BookingModal({ hotel, destination, onClose, onSubmit, busy }) {
  const [checkIn, setCheckIn] = useState(dateOffset(7));
  const [checkOut, setCheckOut] = useState(dateOffset(10));
  const [guests, setGuests] = useState('2');
  const [formError, setFormError] = useState('');
  const nights = stayLength(checkIn, checkOut);

  const submit = event => {
    event.preventDefault();
    if (checkOut <= checkIn) {
      setFormError('La fecha de salida debe ser posterior a la de llegada.');
      return;
    }
    setFormError('');
    onSubmit({ checkIn, checkOut, guests: Number(guests) });
  };

  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <button className="modal-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
        <div className="eyebrow"><span className="eyebrow-line" /> UN PLAN QUE YA SE SIENTE BIEN</div>
        <h2 id="booking-title">Reserva tu escapada<span className="title-period">.</span></h2>
        <p className="modal-hotel">{hotel.name} <span>·</span> {destination?.name || 'Colombia'}</p>
        <form onSubmit={submit}>
          <div className="booking-fields">
            <label>Entrada<input required type="date" min={dateOffset(0)} value={checkIn} onChange={event => setCheckIn(event.target.value)} /></label>
            <label>Salida<input required type="date" min={checkIn} value={checkOut} onChange={event => setCheckOut(event.target.value)} /></label>
            <label className="guests-field">Huéspedes<select value={guests} onChange={event => setGuests(event.target.value)}><option value="1">1 huésped</option><option value="2">2 huéspedes</option><option value="3">3 huéspedes</option><option value="4">4 huéspedes</option><option value="5">5 huéspedes</option><option value="6">6 huéspedes</option></select></label>
          </div>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="booking-summary"><span>{money(hotel.price_per_night)} × {nights} {nights === 1 ? 'noche' : 'noches'}</span><strong>{money(hotel.price_per_night * nights)}</strong></div>
          <p className="summary-note">El total es orientativo. El alojamiento confirmará los detalles contigo.</p>
          <button className="primary-button modal-submit" type="submit" disabled={busy}>{busy ? 'Guardando reserva…' : 'Solicitar reserva'} <span>↗</span></button>
        </form>
      </section>
    </div>
  );
}

function LoginScreen({ error, busy, onLogin, onSignup, onClearError, notice }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const submit = event => {
    event.preventDefault();
    onClearError();
    if (mode === 'signup') onSignup({ name, email, password });
    else onLogin(email, password);
  };

  const fillDemo = role => {
    const account = demoAccounts[role];
    setEmail(account.email);
    setPassword(account.password);
    setMode('login');
    onClearError();
  };

  return (
    <div className="login-shell">
      <div className="login-left">
        <div className="login-brand"><span className="brand-mark">b.</span><span className="brand-word">brisa<span className="brand-period">.</span></span></div>
        <div className="login-intro">
          <div className="eyebrow"><span className="eyebrow-line" /> VIAJAR TAMBIÉN ES BAJAR EL RITMO</div>
          <h1>Hay lugares<br />que te encuentran<span className="title-period">.</span></h1>
          <p>Descubre rincones especiales, quédate un poco más y deja que el viaje haga lo suyo.</p>
        </div>
        <div className="login-landscape art-cartagena" aria-hidden="true">
          <span className="login-sun" /><span className="login-hill hill-back" /><span className="login-hill hill-front" />
          <span className="login-house house-one" /><span className="login-house house-two" /><span className="login-palm" />
          <span className="login-landmark">CARTAGENA, COLOMBIA <b>11° N</b></span>
        </div>
        <span className="login-caption">LUGARES ELEGIDOS CON CARIÑO · COLOMBIA</span>
      </div>
      <div className="login-right">
        <div className="auth-card">
          <div className="eyebrow"><span className="eyebrow-line" /> {mode === 'login' ? 'QUÉ BUENO TENERTE AQUÍ' : 'EMPIEZA A VIAJAR CON BRISA'}</div>
          <h2>{mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}<span className="title-period">.</span></h2>
          <p className="auth-subtitle">{mode === 'login' ? 'Entra para guardar tus próximas escapadas.' : 'Un buen viaje comienza con un primer paso.'}</p>
          {error && <div className="auth-error" role="alert">{error}</div>}
          {notice && <div className="auth-success" role="status">{notice}</div>}
          <form className="auth-form" onSubmit={submit}>
            {mode === 'signup' && <label>Tu nombre<input required autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="¿Cómo te llamas?" /></label>}
            <label>Correo electrónico<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="hola@correo.com" /></label>
            <label>Contraseña<input required type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength="8" value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••" /></label>
            <button className="primary-button auth-submit" disabled={busy} type="submit">{busy ? 'Un momento…' : mode === 'login' ? 'Entrar a Brisa' : 'Crear mi cuenta'} <span>↗</span></button>
          </form>
          {mode === 'login' ? (
            <button className="auth-switch" type="button" onClick={() => { setMode('signup'); onClearError(); }}>¿Primera vez por aquí? <strong>Crea tu cuenta</strong></button>
          ) : (
            <button className="auth-switch" type="button" onClick={() => { setMode('login'); onClearError(); }}>¿Ya tienes cuenta? <strong>Inicia sesión</strong></button>
          )}
          {isDemoMode && mode === 'login' && (
            <div className="demo-box">
              <div className="demo-title"><span>✳</span> Prueba Brisa en modo demo</div>
              <p>Usa una cuenta de prueba o crea una cuenta de viajero. Los datos se guardan solo en este navegador.</p>
              <div className="demo-actions">
                <button type="button" onClick={() => fillDemo('traveler')}><span>Viajera</span><small>Ver destinos y reservar</small></button>
                <button type="button" onClick={() => fillDemo('admin')}><span>Administración</span><small>Gestionar catálogo y reservas</small></button>
              </div>
              <div className="demo-footnote">Acceso de demostración · no es una cuenta real.</div>
            </div>
          )}
          <div className="auth-footer"><span>BRISA <b>·</b> VIAJAR CON CALMA</span><span>COLOMBIA, CON CARIÑO</span></div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, copy, action }) {
  return <div className="empty-state"><span className="empty-icon">✳</span><h3>{title}</h3><p>{copy}</p>{action}</div>;
}

function LoadingInline() {
  return <div className="loading-inline"><span className="loading-mark">b.</span><p>Preparando tu próxima escapada…</p></div>;
}

function LoadingScreen() {
  return <div className="loading-screen"><span className="loading-mark">b.</span><p>Preparando tu próxima escapada…</p></div>;
}

export default App;
