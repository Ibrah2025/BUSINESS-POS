// ESP32 GSM Service — Web Serial API bridge
// Sends SMS via ESP32+SIM800L when internet is down

let port = null;
let writer = null;

export async function connectESP32() {
  port = await navigator.serial.requestPort();
  await port.open({ baudRate: 115200 });
  writer = port.writable.getWriter();
  return true;
}

export async function disconnectESP32() {
  if (writer) { writer.releaseLock(); writer = null; }
  if (port) { await port.close(); port = null; }
}

export function isConnected() {
  return port !== null && writer !== null;
}

export async function sendSMS(phone, message) {
  if (!isConnected()) throw new Error('ESP32 not connected');
  const data = JSON.stringify({ type: 'sms', phone, message });
  await writer.write(new TextEncoder().encode(data + '\n'));
  return true;
}

export async function sendSaleNotification(phone, saleData) {
  const { total, items, paymentMethod, attendantName, time } = saleData;
  const itemsSummary = items.map(i => `${i.name} x${i.quantity}`).join(', ');
  const message = `Sale: ${itemsSummary} = N${total.toLocaleString()} (${paymentMethod}) by ${attendantName} ${time}`;
  return sendSMS(phone, message);
}

export async function checkConnection() {
  if (!isConnected()) return false;
  try {
    await writer.write(new TextEncoder().encode('{"type":"ping"}\n'));
    return true;
  } catch {
    port = null; writer = null;
    return false;
  }
}
