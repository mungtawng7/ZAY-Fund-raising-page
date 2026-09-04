const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('adminPassword');
const loginError = document.getElementById('loginError');
const passwordStorageKey = 'zayAdminPassword';
let dashboardData = { orders: [], bookings: [], messages: [], summary: {} };

function money(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function dateTime(value) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(`${value}Z`));
}

function safe(value) {
  const element = document.createElement('span');
  element.textContent = value || '-';
  return element.innerHTML;
}

async function loadDashboard() {
  const password = sessionStorage.getItem(passwordStorageKey);
  const response = await fetch('/api/admin/dashboard', { headers: { 'x-admin-password': password || '' } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Could not load the dashboard.');
  dashboardData = result;
  renderDashboard();
}

function renderDashboard() {
  const { orders, bookings, messages, summary, paymentsConfigured } = dashboardData;
  document.getElementById('orderCount').textContent = summary.total_orders || 0;
  document.getElementById('paidTotal').textContent = money(summary.paid_cents);
  document.getElementById('pendingTotal').textContent = money(summary.pending_cents);
  document.getElementById('orderValue').textContent = money(summary.total_order_value_cents);
  document.getElementById('ordersTabCount').textContent = orders.length;
  document.getElementById('bookingsTabCount').textContent = bookings.length;
  document.getElementById('messagesTabCount').textContent = messages.length;
  document.getElementById('stripeState').className = `stripe-state ${paymentsConfigured ? 'configured' : 'not-configured'}`;
  document.getElementById('stripeState').innerHTML = paymentsConfigured
    ? '<i class="fa-solid fa-circle-check"></i> Stripe connected'
    : '<i class="fa-solid fa-circle-exclamation"></i> Stripe not configured';
  renderOrders(orders);
  renderBookings(bookings);
  renderMessages(messages);
}

function statusBadge(status) {
  return `<span class="status-badge ${safe(status)}">${safe(status)}</span>`;
}

function renderOrders(orders) {
  document.getElementById('ordersTable').innerHTML = orders.length ? orders.map(order => `
    <tr>
      <td><strong>${safe(order.id)}</strong><small>${safe(order.preferred_time)}</small></td>
      <td><strong>${safe(order.name)}</strong><small>${safe(order.phone)}<br>${safe(order.email)}</small></td>
      <td>${safe(order.items)}</td>
      <td>${safe(order.fulfillment_type)}${order.address ? `<small>${safe(order.address)}</small>` : ''}</td>
      <td><strong>${money(order.total_cents)}</strong><small>Donation: ${money(order.donation_cents)}</small></td>
      <td>${statusBadge(order.payment_status)} ${statusBadge(order.status || 'active')}</td>
      <td>${dateTime(order.created_at)}</td>
    </tr>`).join('') : emptyRow(7, 'No food orders yet.');
}

function renderBookings(bookings) {
  document.getElementById('bookingsTable').innerHTML = bookings.length ? bookings.map(booking => `
    <tr>
      <td><strong>${safe(booking.id)}</strong></td>
      <td><strong>${safe(booking.name)}</strong><small>${safe(booking.phone)}<br>${safe(booking.email)}</small></td>
      <td>${safe(booking.address)}</td>
      <td>${safe(booking.yard_size)}</td>
      <td><strong>${safe(booking.preferred_date)}</strong><small>${safe(booking.preferred_time)}</small></td>
      <td>${booking.estimated_price_cents ? money(booking.estimated_price_cents) : 'Quote needed'}</td>
      <td>${statusBadge(booking.payment_status)} ${statusBadge(booking.status || 'active')}</td>
    </tr>`).join('') : emptyRow(7, 'No lawn bookings yet.');
}

function renderMessages(messages) {
  document.getElementById('messagesList').innerHTML = messages.length ? messages.map(message => `
    <article class="message-card">
      <div><p class="message-meta">${safe(message.subject)} · ${dateTime(message.created_at)}</p><h3>${safe(message.name)}</h3><a href="mailto:${safe(message.email)}">${safe(message.email)}</a> · <a href="tel:${safe(message.phone)}">${safe(message.phone)}</a></div>
      <p>${safe(message.message)}</p>
    </article>`).join('') : '<p class="empty-state">No customer messages yet.</p>';
}

function emptyRow(columns, text) {
  return `<tr><td colspan="${columns}" class="empty-state">${text}</td></tr>`;
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  loginError.textContent = '';
  sessionStorage.setItem(passwordStorageKey, passwordInput.value);
  try {
    await loadDashboard();
    loginScreen.hidden = true;
    dashboard.hidden = false;
  } catch (error) {
    sessionStorage.removeItem(passwordStorageKey);
    loginError.textContent = error.message;
  }
});

document.getElementById('togglePassword').addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
});

document.getElementById('refreshButton').addEventListener('click', async () => {
  try { await loadDashboard(); } catch (error) { alert(error.message); }
});

document.getElementById('logoutButton').addEventListener('click', () => {
  sessionStorage.removeItem(passwordStorageKey);
  dashboard.hidden = true;
  loginScreen.hidden = false;
  loginForm.reset();
});

document.querySelectorAll('.tab-button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.tab-button, .data-panel').forEach(element => element.classList.remove('active'));
  button.classList.add('active');
  document.getElementById(`${button.dataset.tab}Panel`).classList.add('active');
}));

document.getElementById('orderSearch').addEventListener('input', event => {
  const query = event.target.value.trim().toLowerCase();
  const filtered = dashboardData.orders.filter(order => [order.id, order.name, order.email, order.phone, order.items]
    .some(value => String(value).toLowerCase().includes(query)));
  renderOrders(filtered);
});

if (sessionStorage.getItem(passwordStorageKey)) {
  loadDashboard().then(() => {
    loginScreen.hidden = true;
    dashboard.hidden = false;
  }).catch(() => sessionStorage.removeItem(passwordStorageKey));
}