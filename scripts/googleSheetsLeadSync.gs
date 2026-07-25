const CRM_ID_HEADER = 'CRM Lead ID';

function configureCrmSync() {
  PropertiesService.getScriptProperties().setProperties({
    CRM_WEBHOOK_URL: 'https://YOUR-CRM-DOMAIN/webhooks/google-sheets',
    CRM_WEBHOOK_SECRET: 'PASTE_LEAD_WEBHOOK_SECRET_HERE'
  });
  installCrmSyncTriggers();
}

function installCrmSyncTriggers() {
  ScriptApp.getProjectTriggers().forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('syncEditedRows').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  ScriptApp.newTrigger('syncSubmittedRow').forSpreadsheet(SpreadsheetApp.getActive()).onFormSubmit().create();
}

function syncEditedRows(event) {
  syncRange_(event.range);
}

function syncSubmittedRow(event) {
  syncRange_(event.range);
}

function syncRange_(range) {
  if (!range || range.getRow() === 1) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
  const sheet = range.getSheet();
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  let idColumn = headers.indexOf(CRM_ID_HEADER) + 1;
  if (!idColumn) {
    idColumn = lastColumn + 1;
    sheet.getRange(1, idColumn).setValue(CRM_ID_HEADER);
    headers.push(CRM_ID_HEADER);
  }

  const firstRow = range.getRow();
  const rowCount = Math.min(range.getNumRows(), 100);
  const values = sheet.getRange(firstRow, 1, rowCount, headers.length).getDisplayValues();
  const rows = values.map((cells, index) => ({
    rowNumber: firstRow + index,
    values: headers.reduce((row, header, column) => {
      row[header] = cells[column] || '';
      return row;
    }, {})
  }));

  const properties = PropertiesService.getScriptProperties();
  const response = UrlFetchApp.fetch(properties.getProperty('CRM_WEBHOOK_URL'), {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-lead-webhook-secret': properties.getProperty('CRM_WEBHOOK_SECRET') },
    payload: JSON.stringify({ spreadsheetId: sheet.getParent().getId(), sheetName: sheet.getName(), rows }),
    muteHttpExceptions: true
  });
  const body = JSON.parse(response.getContentText());
  (body.results || []).forEach(result => {
    if (result.ok) sheet.getRange(result.rowNumber, idColumn).setValue(result.leadId);
  });
  if (response.getResponseCode() >= 300 || !body.ok) {
    throw new Error(body.error || JSON.stringify(body.results));
  }
  } finally {
    lock.releaseLock();
  }
}
