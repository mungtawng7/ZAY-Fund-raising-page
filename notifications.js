/**
 * Customer notification helpers for ZAY Youth Fundraiser.
 *
 * Email is sent through SMTP with nodemailer when these env vars are set:
 *   SMTP_HOST, SMTP_PORT (optional, default 587), SMTP_USER, SMTP_PASS, SMTP_FROM (optional)
 *
 * SMS is sent through the Twilio REST API when these env vars are set:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 *
 * When a channel is not configured the message is logged to the server
 * console instead, so the app keeps working in development.
 */

const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

const smsConfigured = Boolean(
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
);

function isEmailConfigured() {
  return Boolean(transporter);
}

function isSmsConfigured() {
  return smsConfigured;
}

async function sendEmail(to, subject, text) {
  if (!to) return false;
  if (!transporter) {
    console.log(`[email:not-configured] To: ${to} | ${subject}\n${text}`);
    return false;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text
    });
    console.log(`[email:sent] To: ${to} | ${subject}`);
    return true;
  } catch (error) {
    console.error(`[email:failed] To: ${to} | ${error.message}`);
    return false;
  }
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (String(phone).trim().startsWith('+')) return String(phone).trim();
  return digits.length > 10 ? `+${digits}` : null;
}

async function sendSms(to, body) {
  const normalized = normalizePhone(to);
  if (!normalized) return false;
  if (!smsConfigured) {
    console.log(`[sms:not-configured] To: ${normalized} | ${body}`);
    return false;
  }
  try {
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: normalized,
          From: process.env.TWILIO_FROM_NUMBER,
          Body: body
        })
      }
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Twilio responded ${response.status}: ${detail.slice(0, 200)}`);
    }
    console.log(`[sms:sent] To: ${normalized}`);
    return true;
  } catch (error) {
    console.error(`[sms:failed] To: ${normalized} | ${error.message}`);
    return false;
  }
}

function formatMoney(cents) {
  return `$${((cents || 0) / 100).toFixed(2)}`;
}

async function notifyOrderConfirmation({ name, email, phone, orderId, fulfillmentType, preferredTime, totalCents }) {
  const subject = `ZAY Youth Fundraiser - Order ${orderId} received`;
  const text = [
    `Hi ${name},`,
    '',
    `Thank you for supporting the ZAY Youth Fundraiser at Zomi SDA Tulsa!`,
    `Your food order ${orderId} has been received.`,
    '',
    `Fulfillment: ${fulfillmentType === 'delivery' ? 'Local Tulsa Delivery' : 'Church Pickup (1437 S 129th E Ave)'}`,
    `Requested time: ${preferredTime}`,
    `Estimated total: ${formatMoney(totalCents)}`,
    '',
    `You can cancel or add more items within 2 hours of placing this order by signing in on our website.`,
    '',
    'Questions? Call or text (918) 346-4561.',
    '',
    '- ZAY Youth Ministry, Zomi SDA Tulsa'
  ].join('\n');

  const smsBody = `ZAY Youth: Hi ${name}, your food order ${orderId} was received (${fulfillmentType}, total ${formatMoney(totalCents)}). You can cancel or add items within 2 hours on our website. Questions? (918) 346-4561.`;

  const [emailSent, smsSent] = await Promise.all([
    sendEmail(email, subject, text),
    sendSms(phone, smsBody)
  ]);
  return { emailSent, smsSent };
}

async function notifyOrderCancelled({ name, email, phone, orderId }) {
  const subject = `ZAY Youth Fundraiser - Order ${orderId} cancelled`;
  const text = [
    `Hi ${name},`,
    '',
    `Your food order ${orderId} has been cancelled as requested.`,
    'If this was a mistake, you can place a new order anytime on our website.',
    '',
    'Questions? Call or text (918) 346-4561.',
    '',
    '- ZAY Youth Ministry, Zomi SDA Tulsa'
  ].join('\n');

  const smsBody = `ZAY Youth: Hi ${name}, your order ${orderId} has been cancelled. Place a new order anytime on our website. Questions? (918) 346-4561.`;

  const [emailSent, smsSent] = await Promise.all([
    sendEmail(email, subject, text),
    sendSms(phone, smsBody)
  ]);
  return { emailSent, smsSent };
}

async function notifyOrderUpdated({ name, email, phone, orderId, totalCents }) {
  const subject = `ZAY Youth Fundraiser - Order ${orderId} updated`;
  const text = [
    `Hi ${name},`,
    '',
    `Your food order ${orderId} has been updated with additional items.`,
    `New estimated total: ${formatMoney(totalCents)}`,
    '',
    'Questions? Call or text (918) 346-4561.',
    '',
    '- ZAY Youth Ministry, Zomi SDA Tulsa'
  ].join('\n');

  const smsBody = `ZAY Youth: Hi ${name}, items were added to your order ${orderId}. New total ${formatMoney(totalCents)}. Questions? (918) 346-4561.`;

  const [emailSent, smsSent] = await Promise.all([
    sendEmail(email, subject, text),
    sendSms(phone, smsBody)
  ]);
  return { emailSent, smsSent };
}

async function notifyBookingConfirmation({ name, email, phone, bookingId, yardSize, preferredDate, preferredTime }) {
  const subject = `ZAY Youth Fundraiser - Booking ${bookingId} received`;
  const text = [
    `Hi ${name},`,
    '',
    `Thank you for booking lawn mowing with the ZAY Youth crew!`,
    `Your booking ${bookingId} has been received.`,
    '',
    `Package: ${yardSize}`,
    `Preferred date: ${preferredDate}`,
    `Preferred time: ${preferredTime}`,
    '',
    'The youth team will confirm your appointment shortly.',
    'You can cancel this booking within 2 hours by signing in on our website.',
    '',
    'Questions? Call or text (918) 346-4561.',
    '',
    '- ZAY Youth Ministry, Zomi SDA Tulsa'
  ].join('\n');

  const smsBody = `ZAY Youth: Hi ${name}, your lawn booking ${bookingId} (${yardSize}, ${preferredDate}) was received. You can cancel within 2 hours on our website. Questions? (918) 346-4561.`;

  const [emailSent, smsSent] = await Promise.all([
    sendEmail(email, subject, text),
    sendSms(phone, smsBody)
  ]);
  return { emailSent, smsSent };
}

async function notifyBookingCancelled({ name, email, phone, bookingId }) {
  const subject = `ZAY Youth Fundraiser - Booking ${bookingId} cancelled`;
  const text = [
    `Hi ${name},`,
    '',
    `Your lawn mowing booking ${bookingId} has been cancelled as requested.`,
    'If this was a mistake, you can book again anytime on our website.',
    '',
    'Questions? Call or text (918) 346-4561.',
    '',
    '- ZAY Youth Ministry, Zomi SDA Tulsa'
  ].join('\n');

  const smsBody = `ZAY Youth: Hi ${name}, your booking ${bookingId} has been cancelled. Book again anytime on our website. Questions? (918) 346-4561.`;

  const [emailSent, smsSent] = await Promise.all([
    sendEmail(email, subject, text),
    sendSms(phone, smsBody)
  ]);
  return { emailSent, smsSent };
}

module.exports = {
  isEmailConfigured,
  isSmsConfigured,
  sendEmail,
  sendSms,
  notifyOrderConfirmation,
  notifyOrderCancelled,
  notifyOrderUpdated,
  notifyBookingConfirmation,
  notifyBookingCancelled
};
