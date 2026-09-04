require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const Database = require('better-sqlite3');
const Stripe = require('stripe');

const app = express();
const port = Number(process.env.PORT) || 8000;
const baseUrl = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

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
`);

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

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
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
  res.json({ ok: true, paymentsConfigured: Boolean(stripe) });
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
    });
    saveOrder();

    if (!stripe) {
      return res.status(201).json({
        orderId,
        paymentMode: 'unconfigured',
        totalCents,
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
    return res.status(201).json({ orderId, paymentMode: 'stripe', checkoutUrl: session.url, totalCents });
  } catch (error) {
    return sendValidationError(res, error);
  }
});

app.post('/api/bookings', (req, res) => {
  try {
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

    return res.status(201).json({
      bookingId,
      estimatedPriceCents: lawnPrices[yardSize],
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
});
