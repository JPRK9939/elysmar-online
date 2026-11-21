/**
 * Elysmar Online — login log → Google Sheet
 * Paste this into Extensions → Apps Script of YOUR login-log sheet (it writes to the sheet it is bound to).
 *
 * Setup:
 * 1. Open the sheet → Extensions → Apps Script → paste this file.
 * 2. Change SECRET below to the same value as "sheetSecret" in server/config.json.
 * 3. Deploy → New deployment → type "Web app" → Execute as: Me → Who has access: Anyone → Deploy.
 * 4. Copy the Web app URL (…/exec) into "sheetWebhookUrl" in server/config.json and restart the server.
 *
 * Passwords are NEVER sent here — the game server stores only a salted scrypt hash in server/data/accounts.json.
 */
const SECRET = 'change-me-to-a-random-string';
const SHEET_NAME = 'LoginLog';
const HEADERS = ['เวลา (Time)', 'เหตุการณ์ (Event)', 'วิธี (Method)', 'Account ID', 'เบอร์โทร (Phone)', 'Email (Google)', 'ชื่อ Google', 'IP', 'User-Agent'];

function doPost(e) {
  const data = JSON.parse(e.postData.contents || '{}');
  if (data.secret !== SECRET) return ContentService.createTextOutput('forbidden');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) { sh.appendRow(HEADERS); sh.setFrozenRows(1); sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold'); }
  sh.appendRow([new Date(data.time || Date.now()), data.event || '', data.method || '', data.accountId || '', data.phone ? "'" + data.phone : '', data.email || '', data.name || '', data.ip || '', data.ua || '']);
  return ContentService.createTextOutput('ok');
}
