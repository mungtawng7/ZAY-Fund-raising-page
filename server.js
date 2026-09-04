require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const Database = require('better-sqlite3');
const Stripe = require('stripe');
const notifications = require('./notifications');

const app = express();
const port = Number(process.env.PORT) || 8000;
const baseUrl = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Customers may cancel or add items within this window after placing an order.
const EDIT_WINDOW_MS = 2 * 60 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const dataDirectory = path.join(__dirname, 'data');
const db = new Database(path.join(dataDirectory, 'zay-fundraiser.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS food_orders (
    id TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    fulfillment_type TEXT NOT NULL CHECK (fulfillment_type IN ('pickup', 'delivery')),
    preferred_time TEXT NOT NULL,
    notes TEXT,
    subtotal_cents INTEGER NOT NULL,
    delivery_fee_cents INTEGER NOT NULL,
    donation_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    stripe_checkout_session_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS food_order_items (
    id INTEGER PRIMARY KEY,
    order_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES food_orders(id)
  );

  CREATE TABLE IF NOT EXISTS lawn_bookings (
    id TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    yard_size TEXT NOT NULL,
    preferred_date TEXT NOT NULL,
    preferred_time TEXT NOT NULL,
    notes TEXT,
    estimated_price_cents INTEGER NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Schema upgrades for databases created before these features existed.
for (const statement of [
  `ALTER TABLE food_orders ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`,
  `ALTER TABLE food_orders ADD COLUMN user_id INTEGER`,
  `ALTER TABLE lawn_bookings ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`,
  `ALTER TABLE lawn_bookings ADD COLUMN user_id INTEGER`
]) {
  try {
    db.exec(statement);
  } catch (error) {
    // Column already exists; safe to ignore.
  }
}

const menu = {
  'africa-donuts': { name: 'Africa Donuts', priceCents: 300 },
  'shwe-yin-aye': { name: 'Shwe Yin Aye', priceCents: 500 },
  'fried-rice': { name: 'Fried Rice', priceCents: 1000 },
  'fruit-juice': { name: 'Fruit Juice', priceCents: 400 }
};

const lawnPrices = {
  'Small Yard - $40': 4000,
  'Medium Yard - $60': 6000,
  'Large Yard - $80': 8000,
  'Custom / Need Quote': 0
};

const createCustomer = db.prepare(`
  INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)
`);
const createFoodOrder = db.prepare(`
  INSERT INTO food_orders (
    id, customer_id, fulfillment_type, preferred_time, notes, subtotal_cents,
    delivery_fee_cents, donation_cents, total_cents
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const createFoodItem = db.prepare(`
  INSERT INTO food_order_items (order_id, item_id, item_name, unit_price_cents, quantity)
  VALUES (?, ?, ?, ?, ?)
`);
const createBooking = db.prepare(`
  INSERT INTO lawn_bookings (
    id, customer_id, yard_size, preferred_date, preferred_time, notes, estimated_price_cents
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const createMessage = db.prepare(`
  INSERT INTO contact_messages (id, name, email, phone, subject, message)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const createUser = db.prepare(`
  INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)
`);
const createSession = db.prepare(`
  INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)
`);
const findUserByEmail = db.prepare(`SELECT * FROM users WHERE email = ?`);
const findUserById = db.prepare(`SELECT id, name, email, phone, created_at FROM users WHERE id = ?`);
const findSession = db.prepare(`SELECT * FROM sessions WHERE token = ?`);
const deleteSession = db.prepare(`DELETE FROM sessions WHERE token = ?`);

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
}

// ==========================================
// Authentication helpers
// ==========================================
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function getBearerToken(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

function getSessionUser(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const session = findSession.get(token);
  if (!session) return null;
  if (session.expires_at < Date.now()) {
    deleteSession.run(token);
    return null;
  }
  const user = findUserById.get(session.user_id);
  return user ? { user, token } : null;
}

function requireAuth(req, res, next) {
  const auth = getSessionUser(req);
  if (!auth) {
    return res.status(401).json({ error: 'Please sign in to continue.' });
  }
  req.user = auth.user;
  req.sessionToken = auth.token;
  next();
}

// Link any guest orders/bookings that used this email to the account.
function claimGuestRecords(user) {
  const email = user.email.toLowerCase();
  db.prepare(`
    UPDATE food_orders SET user_id = ?
    WHERE user_id IS NULL AND customer_id IN (SELECT id FROM customers WHERE LOWER(email) = ?)
  `).run(user.id, email);
  db.prepare(`
    UPDATE lawn_bookings SET user_id = ?
    WHERE user_id IS NULL AND customer_id IN (SELECT id FROM customers WHERE LOWER(email) = ?)
  `).run(user.id, email);
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone || '' };
}

function issueSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  createSession.run(token, userId, Date.now() + SESSION_TTL_MS);
  return token;
}

// ==========================================
// Two-hour edit window helpers
// ==========================================
function msSinceCreation(createdAt) {
  // SQLite CURRENT_TIMESTAMP is UTC; append Z so Date parses it correctly.
  return Date.now() - new Date(`${createdAt}Z`).getTime();
}

function assertWithinEditWindow(createdAt) {
  const elapsed = msSinceCreation(createdAt);
  if (elapsed > EDIT_WINDOW_MS) {
    throw Object.assign(
      new Error('The 2-hour change window for this order has ended. Please call (918) 346-4561 for help.'),
      { statusCode: 403 }
    );
  }
  return EDIT_WINDOW_MS - elapsed;
}

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

function asDonationCents(value) {
  const donation = Number(value);
  if (!Number.isFinite(donation) || donation < 0 || donation > 100) {
    throw new Error('Donation must be between $0 and $100.');
  }
  return Math.round(donation * 100);
}

function sendValidationError(res, error) {
  res.status(400).json({ error: error.message || 'Please check your submitted details.' });
}

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).send('Stripe webhook is not configured.');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.metadata?.foodOrderId && session.payment_status === 'paid') {
      db.prepare(`UPDATE food_orders SET payment_status = 'paid', stripe_checkout_session_id = ? WHERE id = ?`)
        .run(session.id, session.metadata.foodOrderId);
    }
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '100kb' }));
app.use(express.static(__dirname));

app.get(['/admin', '/admin/'], (_req, res) => {
  res.redirect('/admin.html');
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    paymentsConfigured: Boolean(stripe),
    emailConfigured: notifications.isEmailConfigured(),
    smsConfigured: notifications.isSmsConfigured()
  });
});

// ==========================================
// User authentication routes
// ==========================================
app.post('/api/auth/signup', (req, res) => {
  try {
    const name = requireText(req.body.name, 'Name');
    const email = requireText(req.body.email, 'Email').toLowerCase();
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const password = String(req.body.password || '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Please enter a valid email address.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    if (findUserByEmail.get(email)) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    const result = createUser.run(name, email, phone, hashPassword(password));
    const user = findUserById.get(result.lastInsertRowid);
    claimGuestRecords(user);
    const token = issueSession(user.id);
    return res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    return sendValidationError(res, error);
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const email = requireText(req.body.email, 'Email').toLowerCase();
    const password = String(req.body.password || '');
    const user = findUserByEmail.get(email);

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    claimGuestRecords(user);
    const token = issueSession(user.id);
    return res.json({ token, user: publicUser(user) });
  } catch (error) {
    return sendValidationError(res, error);
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  deleteSession.run(req.sessionToken);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

function requireAdmin(req, res, next) {
  const password = req.get('x-admin-password');
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Admin access is not configured. Set ADMIN_PASSWORD in .env.' });
  }
  const expectedPassword = Buffer.from(process.env.ADMIN_PASSWORD);
  const suppliedPassword = Buffer.from(password || '');
  if (suppliedPassword.length !== expectedPassword.length || !crypto.timingSafeEqual(suppliedPassword, expectedPassword)) {
    return res.status(401).json({ error: 'Invalid admin password.' });
  }
  next();
}

app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
  const orders = db.prepare(`
    SELECT o.*, c.name, c.email, c.phone, c.address,
      COALESCE(GROUP_CONCAT(i.quantity || 'x ' || i.item_name, ', '), '') AS items
    FROM food_orders o
    JOIN customers c ON c.id = o.customer_id
    LEFT JOIN food_order_items i ON i.order_id = o.id
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `).all();

  const bookings = db.prepare(`
    SELECT b.*, c.name, c.email, c.phone, c.address
    FROM lawn_bookings b
    JOIN customers c ON c.id = b.customer_id
    ORDER BY b.preferred_date ASC, b.preferred_time ASC
  `).all();

  const messages = db.prepare(`
    SELECT * FROM contact_messages
    ORDER BY created_at DESC
  `).all();

  const summary = db.prepare(`
    SELECT
      COUNT(*) AS total_orders,
      COALESCE(SUM(total_cents), 0) AS total_order_value_cents,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_cents ELSE 0 END), 0) AS paid_cents,
      COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN total_cents ELSE 0 END), 0) AS pending_cents
    FROM food_orders
  `).get();

  res.json({ orders, bookings, messages, summary, paymentsConfigured: Boolean(stripe) });
});

app.post('/api/orders', async (req, res) => {
  try {
    const auth = getSessionUser(req);
    const name = requireText(req.body.name, 'Name');
    const email = requireText(req.body.email, 'Email');
    const phone = requireText(req.body.phone, 'Phone number');
    const preferredTime = requireText(req.body.preferredTime, 'Preferred pickup or delivery time');
    const fulfillmentType = req.body.fulfillmentType;
    const address = fulfillmentType === 'delivery' ? requireText(req.body.address, 'Delivery address') : null;
    const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';
    const donationCents = asDonationCents(req.body.donation);

    if (!['pickup', 'delivery'].includes(fulfillmentType)) {
      throw new Error('Choose pickup or delivery.');
    }
    if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
      throw new Error('Add at least one food item to your order.');
    }

    const items = req.body.items.map(({ id, quantity }) => {
      const item = menu[id];
      const validQuantity = Number(quantity);
      if (!item || !Number.isInteger(validQuantity) || validQuantity < 1 || validQuantity > 50) {
        throw new Error('One or more food items or quantities are not valid.');
      }
      return { id, ...item, quantity: validQuantity };
    });

    const subtotalCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
    const deliveryFeeCents = fulfillmentType === 'delivery' ? 300 : 0;
    const totalCents = subtotalCents + deliveryFeeCents + donationCents;
    const orderId = createId('ZAY-FOOD');

    const saveOrder = db.transaction(() => {
      const customer = createCustomer.run(name, email, phone, address);
      createFoodOrder.run(
        orderId, customer.lastInsertRowid, fulfillmentType, preferredTime, notes,
        subtotalCents, deliveryFeeCents, donationCents, totalCents
      );
      for (const item of items) {
        createFoodItem.run(orderId, item.id, item.name, item.priceCents, item.quantity);
      }
      if (auth) {
        db.prepare('UPDATE food_orders SET user_id = ? WHERE id = ?').run(auth.user.id, orderId);
      }
    });
    saveOrder();

    // Notify the customer by email and SMS; never block the response on it.
    const notificationStatus = await notifications.notifyOrderConfirmation({
      name, email, phone, orderId, fulfillmentType, preferredTime, totalCents
    });

    if (!stripe) {
      return res.status(201).json({
        orderId,
        paymentMode: 'unconfigured',
        totalCents,
        notifications: notificationStatus,
        editWindowHours: EDIT_WINDOW_MS / 3600000,
        message: 'Your order was saved. Online payment is not configured yet; please pay at pickup or delivery.'
      });
    }

    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: { name: item.name },
        unit_amount: item.priceCents
      },
      quantity: item.quantity
    }));

    if (deliveryFeeCents) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Local Tulsa delivery' },
          unit_amount: deliveryFeeCents
        },
        quantity: 1
      });
    }
    if (donationCents) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'ZAY Youth Ministry Donation' },
          unit_amount: donationCents
        },
        quantity: 1
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: lineItems,
      metadata: { foodOrderId: orderId },
      success_url: `${baseUrl}/?payment=success&order=${orderId}`,
      cancel_url: `${baseUrl}/?payment=cancelled&order=${orderId}`
    });

    db.prepare('UPDATE food_orders SET stripe_checkout_session_id = ? WHERE id = ?').run(session.id, orderId);
    return res.status(201).json({
      orderId,
      paymentMode: 'stripe',
      checkoutUrl: session.url,
      totalCents,
      notifications: notificationStatus,
      editWindowHours: EDIT_WINDOW_MS / 3600000
    });
  } catch (error) {
    return sendValidationError(res, error);
  }
});

// ==========================================
// Customer order management (2-hour window)
// ==========================================
app.get('/api/my/orders', requireAuth, (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, c.name, c.email, c.phone, c.address
    FROM food_orders o
    JOIN customers c ON c.id = o.customer_id
    WHERE o.user_id = ?
    ORDER BY o.created_at DESC
  `).all(req.user.id);

  const itemStatement = db.prepare(`
    SELECT item_id, item_name, unit_price_cents, quantity
    FROM food_order_items WHERE order_id = ?
  `);

  const bookings = db.prepare(`
    SELECT b.*, c.name, c.email, c.phone, c.address
    FROM lawn_bookings b
    JOIN customers c ON c.id = b.customer_id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `).all(req.user.id);

  const decorate = record => {
    const elapsed = msSinceCreation(record.created_at);
    const remainingMs = Math.max(0, EDIT_WINDOW_MS - elapsed);
    return {
      ...record,
      editable: record.status === 'active' && remainingMs > 0,
      edit_remaining_ms: remainingMs
    };
  };

  res.json({
    orders: orders.map(order => ({ ...decorate(order), items: itemStatement.all(order.id) })),
    bookings: bookings.map(decorate),
    editWindowHours: EDIT_WINDOW_MS / 3600000
  });
});

function getOwnedOrder(req, res) {
  const order = db.prepare(`
    SELECT o.*, c.name, c.email, c.phone
    FROM food_orders o
    JOIN customers c ON c.id = o.customer_id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!order || order.user_id !== req.user.id) {
    res.status(404).json({ error: 'We could not find this order on your account.' });
    return null;
  }
  return order;
}

app.post('/api/orders/:id/cancel', requireAuth, async (req, res) => {
  try {
    const order = getOwnedOrder(req, res);
    if (!order) return;
    if (order.status === 'cancelled') {
      throw new Error('This order has already been cancelled.');
    }
    assertWithinEditWindow(order.created_at);

    db.prepare(`UPDATE food_orders SET status = 'cancelled' WHERE id = ?`).run(order.id);

    const notificationStatus = await notifications.notifyOrderCancelled({
      name: order.name, email: order.email, phone: order.phone, orderId: order.id
    });

    res.json({ ok: true, orderId: order.id, notifications: notificationStatus, message: 'Your order has been cancelled.' });
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message });
  }
});

app.post('/api/orders/:id/add-items', requireAuth, async (req, res) => {
  try {
    const order = getOwnedOrder(req, res);
    if (!order) return;
    if (order.status === 'cancelled') {
      throw new Error('This order has been cancelled and can no longer be changed.');
    }
    assertWithinEditWindow(order.created_at);

    if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
      throw new Error('Add at least one food item.');
    }

    const items = req.body.items.map(({ id, quantity }) => {
      const item = menu[id];
      const validQuantity = Number(quantity);
      if (!item || !Number.isInteger(validQuantity) || validQuantity < 1 || validQuantity > 50) {
        throw new Error('One or more food items or quantities are not valid.');
      }
      return { id, ...item, quantity: validQuantity };
    });

    const addedCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
    const newSubtotal = order.subtotal_cents + addedCents;
    const newTotal = newSubtotal + order.delivery_fee_cents + order.donation_cents;

    const applyChanges = db.transaction(() => {
      const updateItem = db.prepare(`
        UPDATE food_order_items SET quantity = quantity + ? WHERE order_id = ? AND item_id = ?
      `);
      for (const item of items) {
        const updated = updateItem.run(item.quantity, order.id, item.id);
        if (updated.changes === 0) {
          createFoodItem.run(order.id, item.id, item.name, item.priceCents, item.quantity);
        }
      }
      db.prepare(`
        UPDATE food_orders SET subtotal_cents = ?, total_cents = ? WHERE id = ?
      `).run(newSubtotal, newTotal, order.id);
    });
    applyChanges();

    const notificationStatus = await notifications.notifyOrderUpdated({
      name: order.name, email: order.email, phone: order.phone, orderId: order.id, totalCents: newTotal
    });

    res.json({
      ok: true,
      orderId: order.id,
      subtotalCents: newSubtotal,
      totalCents: newTotal,
      notifications: notificationStatus,
      message: 'Your items were added to the order.'
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message });
  }
});

app.post('/api/bookings/:id/cancel', requireAuth, async (req, res) => {
  try {
    const booking = db.prepare(`
      SELECT b.*, c.name, c.email, c.phone
      FROM lawn_bookings b
      JOIN customers c ON c.id = b.customer_id
      WHERE b.id = ?
    `).get(req.params.id);

    if (!booking || booking.user_id !== req.user.id) {
      return res.status(404).json({ error: 'We could not find this booking on your account.' });
    }
    if (booking.status === 'cancelled') {
      throw new Error('This booking has already been cancelled.');
    }
    assertWithinEditWindow(booking.created_at);

    db.prepare(`UPDATE lawn_bookings SET status = 'cancelled' WHERE id = ?`).run(booking.id);

    const notificationStatus = await notifications.notifyBookingCancelled({
      name: booking.name, email: booking.email, phone: booking.phone, bookingId: booking.id
    });

    res.json({ ok: true, bookingId: booking.id, notifications: notificationStatus, message: 'Your booking has been cancelled.' });
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const auth = getSessionUser(req);
    const name = requireText(req.body.name, 'Name');
    const email = requireText(req.body.email, 'Email');
    const phone = requireText(req.body.phone, 'Phone number');
    const address = requireText(req.body.address, 'Home address');
    const yardSize = requireText(req.body.yardSize, 'Yard size');
    const preferredDate = requireText(req.body.preferredDate, 'Preferred date');
    const preferredTime = requireText(req.body.preferredTime, 'Preferred time');
    const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';
    const bookingDate = new Date(`${preferredDate}T12:00:00`);

    if (Number.isNaN(bookingDate.getTime()) || [5, 6].includes(bookingDate.getDay())) {
      throw new Error('Please select a Sunday through Thursday service date.');
    }
    if (!Object.hasOwn(lawnPrices, yardSize)) {
      throw new Error('Choose a valid lawn service package.');
    }

    const bookingId = createId('ZAY-LAWN');
    const customer = createCustomer.run(name, email, phone, address);
    createBooking.run(
      bookingId, customer.lastInsertRowid, yardSize, preferredDate, preferredTime,
      notes, lawnPrices[yardSize]
    );
    if (auth) {
      db.prepare('UPDATE lawn_bookings SET user_id = ? WHERE id = ?').run(auth.user.id, bookingId);
    }

    const notificationStatus = await notifications.notifyBookingConfirmation({
      name, email, phone, bookingId, yardSize, preferredDate, preferredTime
    });

    return res.status(201).json({
      bookingId,
      estimatedPriceCents: lawnPrices[yardSize],
      notifications: notificationStatus,
      editWindowHours: EDIT_WINDOW_MS / 3600000,
      message: 'Your booking was saved. The youth team will confirm the appointment and payment details.'
    });
  } catch (error) {
    return sendValidationError(res, error);
  }
});

app.post('/api/messages', (req, res) => {
  try {
    const name = requireText(req.body.name, 'Name');
    const email = requireText(req.body.email, 'Email');
    const phone = requireText(req.body.phone, 'Phone number');
    const subject = requireText(req.body.subject, 'Subject');
    const message = requireText(req.body.message, 'Message');
    const messageId = createId('ZAY-MSG');
    createMessage.run(messageId, name, email, phone, subject, message);
    return res.status(201).json({ messageId, message: 'Your message was sent to ZAY Youth Ministry.' });
  } catch (error) {
    return sendValidationError(res, error);
  }
});

app.listen(port, () => {
  console.log(`ZAY Youth Fundraiser is running at ${baseUrl}`);
  console.log(stripe ? 'Stripe payments are enabled.' : 'Stripe is not configured: food orders will be saved as payment pending.');
  console.log(notifications.isEmailConfigured() ? 'Email notifications are enabled.' : 'Email is not configured: notifications will be logged to the console.');
  console.log(notifications.isSmsConfigured() ? 'SMS notifications are enabled.' : 'SMS is not configured: notifications will be logged to the console.');
});
