# ZAY Youth Fundraiser

A fundraising website for Zomi SDA Tulsa with food orders, lawn-care bookings,
contact messages, customer accounts, email & SMS order notifications, a local
SQLite database, and optional Stripe Checkout payments.

## Run locally

1. Install dependencies with `npm install`.
2. Start the app with `npm start`.
3. Open `http://localhost:8000`.

The database is created automatically at `data/zay-fundraiser.db`. It is ignored by Git so customer information is never committed.

## Customer accounts

Visitors can sign up or sign in from the header. Signed-in customers can open
“My Orders & Bookings” to review their history. Passwords are hashed with
scrypt and sessions are stored in the local database.

## Dark mode

A moon/sun toggle in the header switches between light and dark themes. The
choice is saved in the browser and defaults to the visitor's system preference.

## Cancel or add items within 2 hours

For 2 hours after a food order is placed, the customer can cancel it or add
more items from “My Orders & Bookings”. Lawn bookings can be cancelled in the
same window. After the window closes the buttons lock and the site directs
customers to call the youth team.

## Email & SMS notifications

Customers receive a confirmation whenever they submit, update, or cancel an
order or booking.

- Email uses SMTP (nodemailer). For Gmail, set `SMTP_HOST=smtp.gmail.com`,
  `SMTP_PORT=587`, `SMTP_USER`, and an app password in `SMTP_PASS`.
- SMS uses the Twilio REST API: set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  and `TWILIO_FROM_NUMBER`.

When a channel is not configured, the message is logged to the server console
instead, so the site keeps working in development. Copy `.env.example` to
`.env` to configure these values.

## Enable Stripe payments

1. Copy `.env.example` to `.env`.
2. Add the Stripe test or live secret key to `STRIPE_SECRET_KEY`.
3. Set `BASE_URL` to the public address of the deployed website.
4. Configure the Stripe webhook endpoint as `https://your-domain.com/api/stripe/webhook` and add the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

Food orders are stored before checkout begins. The Stripe webhook changes their payment status to `paid` only after Stripe confirms the payment.

Lawn-care bookings are saved as payment pending, allowing the youth team to confirm the property and appointment before requesting payment.

## Track orders

Set a long, unique `ADMIN_PASSWORD` in `.env`, then open `/admin.html` in the running site, such as `http://localhost:8000/admin.html`. The private dashboard shows food orders, Stripe payment status, lawn bookings, and contact messages. It also links directly to the Stripe Payments dashboard for refunds, payouts, and payment receipts.
