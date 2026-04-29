const { google } = require('googleapis');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=300',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: 'A1:Z2000',
    });

    const rows = data.values || [];
    if (rows.length < 2) {
      return { statusCode: 200, headers: CORS, body: '[]' };
    }

    const headerRow = rows[0].map(h => (h || '').trim().toLowerCase());
    const col = (name) => headerRow.indexOf(name.toLowerCase());

    const iCliente   = col('cliente');
    const iLat       = col('latitud');
    const iLng       = col('longitud');
    const iActivo    = col('activo');
    const iInstagram = col('instagram');

    if (iCliente < 0 || iLat < 0 || iLng < 0) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: 'Columnas requeridas no encontradas' }),
      };
    }

    const clientes = rows
      .slice(1)
      .filter(row => {
        if (iActivo >= 0) {
          const val = (row[iActivo] || '').toString().trim().toUpperCase();
          return ['TRUE', 'SI', 'SÍ', '1', 'VERDADERO'].includes(val);
        }
        return true;
      })
      .map(row => ({
        nombre:    (row[iCliente]   || '').trim(),
        lat:       parseFloat(row[iLat]),
        lng:       parseFloat(row[iLng]),
        instagram: iInstagram >= 0 ? (row[iInstagram] || '').trim() : '',
      }))
      .filter(c =>
        c.nombre &&
        !isNaN(c.lat) && isFinite(c.lat) &&
        !isNaN(c.lng) && isFinite(c.lng)
      );

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify(clientes),
    };

  } catch (err) {
    console.error('Error:', err.message);
    return {
      statusCode: 500,
      headers: CORS,
