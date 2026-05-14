import { google, sheets_v4 } from 'googleapis';

// ─── Column mapping ─────────────────────────────────
const SHEET_COLUMNS = {
  ROW_NUMBER: 'A',
  PROJECT_NAME: 'B',
  PM_NAME: 'C',
  ASSIGNED_TO: 'D',
  ROLE: 'E',
  TASK_TYPE: 'F',
  DATE_ASSIGNED: 'G',
  ETA: 'H',
  ACTUAL_COMPLETION: 'I',
  STATUS: 'J',
  MINOR_CHANGES: 'K',
  MAJOR_CHANGES: 'L',
  MAJOR_CHANGE_REASON: 'M',
  SIGN_OFF: 'N',
  CRM_ID: 'O',
} as const;

// ─── Board → Role mapping ───────────────────────────
const BOARD_ROLE_MAP: Record<string, string> = {
  'Logo Design': 'Logo Designer',
  'Web Design': 'Figma Designer',
  'Web Development': 'Developer',
  'Content Creation': 'Content Writer',
};

export function getBoardRole(boardName: string): string {
  return BOARD_ROLE_MAP[boardName] || boardName;
}

// ─── Auth ────────────────────────────────────────────
let sheetsClient: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets | null {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    return null;
  }

  if (sheetsClient) return sheetsClient;

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
    return sheetsClient;
  } catch (err) {
    console.error('[GoogleSheets] Failed to initialize auth client:', err);
    return null;
  }
}

function getSpreadsheetId(): string {
  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
}

function getTrackerTab(): string {
  return process.env.GOOGLE_SHEETS_TRACKER_TAB || 'Tracker';
}

// ─── Types ───────────────────────────────────────────
export interface SheetRowData {
  projectName: string;
  pmName: string;
  assignedTo: string;
  role: string;
  taskType: string;
  dateAssigned: string;
  eta: string;
  status: string;
  crmId: string;
}

// ─── Row count (for auto # column) ──────────────────
async function getRowCount(): Promise<number> {
  const client = getSheetsClient();
  if (!client) return 1;

  try {
    const response = await client.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `${getTrackerTab()}!${SHEET_COLUMNS.CRM_ID}:${SHEET_COLUMNS.CRM_ID}`,
    });
    const rows = response.data.values || [];
    // Subtract 1 for header row, minimum 0
    return Math.max(0, rows.length - 1);
  } catch (err) {
    console.error('[GoogleSheets] getRowCount failed:', err);
    return 0;
  }
}

// ─── Append a new project row ────────────────────────
export async function appendProjectRow(data: SheetRowData): Promise<void> {
  const client = getSheetsClient();
  if (!client) return;

  try {
    const rowNumber = (await getRowCount()) + 1;
    const values = [[
      rowNumber,
      data.projectName,
      data.pmName,
      data.assignedTo,
      data.role,
      data.taskType,
      data.dateAssigned,
      data.eta,
      '',             // Actual Completion — empty on creation
      data.status,
      0,              // Minor Changes
      0,              // Major Changes
      '',             // Major Change Reason
      '',             // Sign Off
      data.crmId,     // CRM ID (hidden column O)
    ]];

    await client.spreadsheets.values.append({
      spreadsheetId: getSpreadsheetId(),
      range: `${getTrackerTab()}!A:O`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
  } catch (err) {
    console.error('[GoogleSheets] appendProjectRow failed:', err);
  }
}

// ─── Find row by CRM ID (column O) ──────────────────
export async function findRowByCrmId(crmId: string): Promise<number | null> {
  const client = getSheetsClient();
  if (!client) return null;

  try {
    const response = await client.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `${getTrackerTab()}!${SHEET_COLUMNS.CRM_ID}:${SHEET_COLUMNS.CRM_ID}`,
    });
    const rows = response.data.values || [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === crmId) {
        return i + 1; // 1-based row number
      }
    }
    return null;
  } catch (err) {
    console.error('[GoogleSheets] findRowByCrmId failed:', err);
    return null;
  }
}

// ─── Update a single cell ────────────────────────────
export async function updateCell(row: number, column: string, value: string | number): Promise<void> {
  const client = getSheetsClient();
  if (!client) return;

  try {
    await client.spreadsheets.values.update({
      spreadsheetId: getSpreadsheetId(),
      range: `${getTrackerTab()}!${column}${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[value]] },
    });
  } catch (err) {
    console.error(`[GoogleSheets] updateCell ${column}${row} failed:`, err);
  }
}

// ─── Read a single cell ──────────────────────────────
export async function getCellValue(row: number, column: string): Promise<string> {
  const client = getSheetsClient();
  if (!client) return '';

  try {
    const response = await client.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: `${getTrackerTab()}!${column}${row}`,
    });
    const rows = response.data.values || [];
    return rows[0]?.[0] ?? '';
  } catch (err) {
    console.error(`[GoogleSheets] getCellValue ${column}${row} failed:`, err);
    return '';
  }
}

// ─── Increment a numeric cell by 1 ──────────────────
export async function incrementCell(row: number, column: string): Promise<number> {
  const current = await getCellValue(row, column);
  const newValue = (parseInt(current, 10) || 0) + 1;
  await updateCell(row, column, newValue);
  return newValue;
}

export { SHEET_COLUMNS };
