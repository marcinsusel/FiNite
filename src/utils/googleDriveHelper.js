/**
 * Google Drive API REST Client using direct Fetch and Google Identity Services.
 */

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

let tokenClient = null;

/**
 * Initializes the OAuth token client from GIS.
 */
export function initOAuthClient(clientId, onToken, onError) {
  if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
    if (onError) onError('Google Identity Services SDK not loaded yet. Retrying...');
    return null;
  }

  try {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      callback: (response) => {
        if (response.error) {
          if (onError) onError(response.error_description || response.error);
        } else if (response.access_token) {
          onToken(response.access_token, response.expires_in);
        }
      },
    });
    return tokenClient;
  } catch (err) {
    if (onError) onError('GIS Init Error: ' + err.message);
    return null;
  }
}

/**
 * Opens the Google Sign-in popup.
 */
export function loginToGoogle() {
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    throw new Error('Google OAuth client not initialized. Enter your Client ID first.');
  }
}

/**
 * Helper to execute fetch requests with Bearer Auth and JSON decoding.
 */
async function apiRequest(url, method = 'GET', token, body = null, headers = {}) {
  const defaultHeaders = {
    'Authorization': `Bearer ${token}`,
    ...headers
  };

  const options = {
    method,
    headers: defaultHeaders
  };

  if (body) {
    if (body instanceof Blob || body instanceof ArrayBuffer || body instanceof FormData) {
      options.body = body;
    } else {
      options.body = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
    }
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    let parsedErr;
    try {
      parsedErr = JSON.parse(errorText);
    } catch {
      parsedErr = { error: { message: errorText } };
    }
    throw new Error(parsedErr?.error?.message || `HTTP ${response.status} - ${response.statusText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

/**
 * Searches for a folder by name. Returns the folder object or null.
 */
async function findFolder(name, token) {
  const query = encodeURIComponent(`name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;
  const res = await apiRequest(url, 'GET', token);
  return res.files && res.files.length > 0 ? res.files[0] : null;
}

/**
 * Creates a folder. Returns the folder object.
 */
async function createFolder(name, token) {
  const url = `https://www.googleapis.com/drive/v3/files`;
  const body = {
    name,
    mimeType: 'application/vnd.google-apps.folder'
  };
  return apiRequest(url, 'POST', token, body);
}

/**
 * Searches for a file inside a specific parent folder.
 */
async function findFileInFolder(fileName, folderId, token) {
  const query = encodeURIComponent(`name = '${fileName}' and '${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;
  const res = await apiRequest(url, 'GET', token);
  return res.files && res.files.length > 0 ? res.files[0] : null;
}

/**
 * Downloads a file's content directly as JSON.
 */
async function downloadFileContent(fileId, token) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to download database file. Status ${response.status}`);
  }

  return response.json();
}

/**
 * Creates a file in a folder with content (JSON database).
 * Uses Google Drive's multipart upload API.
 */
async function createFileInFolder(fileName, folderId, content, token) {
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/json'
  };

  const boundary = 'finite_boundary_marker';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(content) +
    closeDelimiter;

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  return apiRequest(url, 'POST', token, multipartBody, {
    'Content-Type': `multipart/related; boundary=${boundary}`
  });
}

/**
 * Updates an existing file's content (JSON database).
 */
async function updateFileContent(fileId, content, token) {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(content)
  });

  if (!response.ok) {
    throw new Error(`Failed to save database. Status ${response.status}`);
  }
  return response.json();
}

/**
 * Loads the FiNite database. If the folder or file doesn't exist, it creates them.
 * Returns: { fileId, data }
 */
export async function syncAndLoadDatabase(token) {
  // 1. Find or create the "FiNite" folder
  let folder = await findFolder('FiNite', token);
  if (!folder) {
    folder = await createFolder('FiNite', token);
  }

  const folderId = folder.id;

  // 2. Find or create "transactions.json"
  let file = await findFileInFolder('transactions.json', folderId, token);
  
  if (!file) {
    // File doesn't exist, initialize default database state
    const defaultDb = {
      accounts: [],
      categories: [
        { id: 'cat-uncategorized', name: 'Uncategorized' },
        { id: 'cat-groceries', name: 'Groceries' },
        { id: 'cat-housing', name: 'Housing/Mortgage/Rent' },
        { id: 'cat-utilities', name: 'Utilities' },
        { id: 'cat-salary', name: 'Salary/Income' },
        { id: 'cat-entertainment', name: 'Entertainment/Dining' },
        { id: 'cat-transportation', name: 'Transportation/Auto' },
        { id: 'cat-transfer', name: 'Internal Transfer' }
      ],
      transactions: []
    };

    const newFile = await createFileInFolder('transactions.json', folderId, defaultDb, token);
    return {
      fileId: newFile.id,
      data: defaultDb
    };
  }

  // 3. File exists, download content
  const dbData = await downloadFileContent(file.id, token);
  return {
    fileId: file.id,
    data: dbData
  };
}

/**
 * Saves (updates) the database file in Google Drive.
 */
export async function saveDatabaseToDrive(fileId, data, token) {
  if (!fileId) throw new Error('Cannot save: No Google Drive file ID available.');
  return updateFileContent(fileId, data, token);
}
