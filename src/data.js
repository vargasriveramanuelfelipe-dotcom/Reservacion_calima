import { supabase, supabaseConfigured } from './supabase.js';

const DEMO_KEY = 'brisa-demo-v1';

const starterDestinations = [
  {
    id: 'cartagena',
    name: 'Cartagena',
    region: 'Bolívar · Caribe',
    note: 'Calles para perderse y tardes que terminan frente al mar.',
    theme: 'cartagena',
    featured: true,
  },
  {
    id: 'santa-marta',
    name: 'Santa Marta',
    region: 'Magdalena · Caribe',
    note: 'La montaña se encuentra con un mar de muchos azules.',
    theme: 'santamarta',
    featured: true,
  },
  {
    id: 'salento',
    name: 'Salento',
    region: 'Quindío · Eje Cafetero',
    note: 'Café recién hecho, neblina suave y palmas gigantes.',
    theme: 'salento',
    featured: true,
  },
  {
    id: 'guatape',
    name: 'Guatapé',
    region: 'Antioquia · Andes',
    note: 'Un pueblo de color y agua quieta para ir sin afán.',
    theme: 'guatape',
    featured: true,
  },
];

const starterHotels = [
  { id: 'casa-mar', destination_id: 'cartagena', name: 'Casa Mar y Patio', area: 'Getsemaní', description: 'Un patio fresco a pasos de la ciudad amurallada.', price_per_night: 285000, rating: 4.9, category: 'Casa boutique', is_available: true, accent: 'coral' },
  { id: 'hotel-luna', destination_id: 'cartagena', name: 'Hotel Luna Clara', area: 'Centro histórico', description: 'Balcones antiguos, desayuno local y piscina pequeña.', price_per_night: 360000, rating: 4.8, category: 'Hotel', is_available: true, accent: 'sand' },
  { id: 'brisa-tayrona', destination_id: 'santa-marta', name: 'Brisa del Tayrona', area: 'Bello Horizonte', description: 'Despertar entre palmas y caminar hasta la playa.', price_per_night: 245000, rating: 4.7, category: 'Eco lodge', is_available: true, accent: 'palm' },
  { id: 'casa-nativa', destination_id: 'santa-marta', name: 'Casa Nativa', area: 'Centro', description: 'Una casa tranquila para volver después de explorar.', price_per_night: 190000, rating: 4.6, category: 'Casa de huéspedes', is_available: true, accent: 'blue' },
  { id: 'finca-cafe', destination_id: 'salento', name: 'Finca El Recuerdo', area: 'Vereda Boquía', description: 'Café de origen y senderos entre guaduales.', price_per_night: 210000, rating: 4.9, category: 'Finca cafetera', is_available: true, accent: 'green' },
  { id: 'posada-cocora', destination_id: 'salento', name: 'Posada Cocora', area: 'Salento', description: 'Una ventana a las montañas y un desayuno de finca.', price_per_night: 175000, rating: 4.7, category: 'Posada', is_available: true, accent: 'sage' },
  { id: 'lago-sereno', destination_id: 'guatape', name: 'Lago Sereno', area: 'El Peñol', description: 'Terraza privada con vista abierta al embalse.', price_per_night: 320000, rating: 4.8, category: 'Cabaña', is_available: true, accent: 'lake' },
];

export const isDemoMode = !supabaseConfigured;
export const demoAccounts = {
  traveler: { email: 'viajero@brisa.demo', password: 'Brisa2026!' },
  admin: { email: 'admin@brisa.demo', password: 'Admin2026!' },
};

function readDemoStore() {
  try {
    const stored = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null');
    if (stored?.destinations && stored?.hotels && stored?.reservations) {
      return { ...stored, users: Array.isArray(stored.users) ? stored.users : [] };
    }
  } catch {
    // A malformed local demo record should not prevent the sample experience from loading.
  }
  return {
    destinations: starterDestinations,
    hotels: starterHotels,
    reservations: [],
    users: [],
  };
}

function writeDemoStore(store) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(store));
}

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map(byte => Number.parseInt(byte, 16)));
}

async function hashDemoPassword(password, salt) {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const result = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(result));
}

function normalizeHotel(hotel) {
  return {
    ...hotel,
    destination_id: hotel.destination_id ?? hotel.destinationId,
    price_per_night: Number(hotel.price_per_night ?? hotel.price),
    is_available: hotel.is_available ?? hotel.available ?? true,
  };
}

export async function restoreSession() {
  if (!supabaseConfigured) return null;
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) return null;
  return profileFor(session.user);
}

async function profileFor(authUser) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', authUser.id)
    .single();
  if (error) throw error;
  return {
    id: authUser.id,
    email: authUser.email,
    name: profile.full_name || authUser.user_metadata?.full_name || authUser.email,
    role: profile.role,
  };
}

export async function signIn(email, password) {
  if (isDemoMode) {
    const normalizedEmail = email.trim().toLowerCase();
    const builtInAccount = Object.values(demoAccounts).find(
      account => account.email === normalizedEmail && account.password === password,
    );
    if (builtInAccount) {
      const admin = normalizedEmail === demoAccounts.admin.email;
      return {
        id: admin ? 'demo-admin' : 'demo-traveler',
        email: normalizedEmail,
        name: admin ? 'Marina · Administradora' : 'Sofía · Viajera',
        role: admin ? 'admin' : 'traveler',
      };
    }

    const account = readDemoStore().users.find(user => user.email === normalizedEmail);
    if (!account || !globalThis.crypto?.subtle) {
      throw new Error('Revisa el correo y la contraseña de demostración.');
    }
    const passwordHash = await hashDemoPassword(password, hexToBytes(account.passwordSalt));
    if (passwordHash !== account.passwordHash) {
      throw new Error('Revisa el correo y la contraseña de demostración.');
    }
    return { id: account.id, email: account.email, name: account.name, role: 'traveler' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return profileFor(data.user);
}

export async function signUp({ name, email, password }) {
  if (isDemoMode) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error('Escribe tu nombre para crear la cuenta.');
    if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
    if (!globalThis.crypto?.subtle) {
      throw new Error('El registro demo requiere un navegador compatible con HTTPS o localhost.');
    }
    if (Object.values(demoAccounts).some(account => account.email === normalizedEmail)) {
      throw new Error('Ese correo ya está registrado en Brisa.');
    }

    const store = readDemoStore();
    if (store.users.some(account => account.email === normalizedEmail)) {
      throw new Error('Ya existe una cuenta demo con ese correo.');
    }

    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const account = {
      id: `demo-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      email: normalizedEmail,
      name: normalizedName,
      passwordSalt: bytesToHex(salt),
      passwordHash: await hashDemoPassword(password, salt),
    };
    store.users.push(account);
    writeDemoStore(store);
    return { id: account.id, email: account.email, name: account.name, role: 'traveler' };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) throw error;
  if (!data.session) return { confirmationRequired: true };
  return profileFor(data.user);
}

export async function signOut() {
  if (supabaseConfigured) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
}

export async function loadCatalog() {
  if (isDemoMode) {
    const store = readDemoStore();
    return { destinations: store.destinations, hotels: store.hotels.map(normalizeHotel) };
  }
  const [destinationsResult, hotelsResult] = await Promise.all([
    supabase.from('destinations').select('*').order('name'),
    supabase.from('hotels').select('*').order('name'),
  ]);
  if (destinationsResult.error) throw destinationsResult.error;
  if (hotelsResult.error) throw hotelsResult.error;
  return {
    destinations: destinationsResult.data || [],
    hotels: (hotelsResult.data || []).map(normalizeHotel),
  };
}

export async function loadReservations(user) {
  if (isDemoMode) {
    const store = readDemoStore();
    return store.reservations
      .filter(item => user.role === 'admin' || item.user_id === user.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  let request = supabase.from('reservations').select('*').order('created_at', { ascending: false });
  if (user.role !== 'admin') request = request.eq('user_id', user.id);
  const { data, error } = await request;
  if (error) throw error;
  return data || [];
}

export async function createReservation(user, hotel, booking) {
  if (isDemoMode) {
    const store = readDemoStore();
    const reservation = {
      id: `demo-${Date.now()}`,
      user_id: user.id,
      hotel_id: hotel.id,
      check_in: booking.checkIn,
      check_out: booking.checkOut,
      guest_count: booking.guests,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    store.reservations.push(reservation);
    writeDemoStore(store);
    return reservation;
  }
  const { data, error } = await supabase
    .from('reservations')
    .insert({
      user_id: user.id,
      hotel_id: hotel.id,
      check_in: booking.checkIn,
      check_out: booking.checkOut,
      guest_count: booking.guests,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setReservationStatus(reservationId, status) {
  if (isDemoMode) {
    const store = readDemoStore();
    store.reservations = store.reservations.map(item =>
      item.id === reservationId ? { ...item, status } : item,
    );
    writeDemoStore(store);
    return;
  }
  const { error } = await supabase
    .from('reservations')
    .update({ status })
    .eq('id', reservationId);
  if (error) throw error;
}

export async function createHotel(hotel) {
  if (isDemoMode) {
    const store = readDemoStore();
    store.hotels.push({ ...hotel, id: `hotel-${Date.now()}` });
    writeDemoStore(store);
    return;
  }
  const { error } = await supabase.from('hotels').insert(hotel);
  if (error) throw error;
}

export async function setHotelAvailability(hotelId, isAvailable) {
  if (isDemoMode) {
    const store = readDemoStore();
    store.hotels = store.hotels.map(hotel =>
      hotel.id === hotelId ? { ...hotel, is_available: isAvailable } : hotel,
    );
    writeDemoStore(store);
    return;
  }
  const { error } = await supabase
    .from('hotels')
    .update({ is_available: isAvailable })
    .eq('id', hotelId);
  if (error) throw error;
}
