// Google Apps Script Backend for Mitesh Sir's Group Tutions
// Make sure to configure the FOLDER_ID below for file uploads

var CONFIG = {
  FOLDER_ID: '1BHj_BocUTIkVbVDkssMrwV8qE-RIKsYy' // Replace with proper ID
};

function doPost(e) {
  var response = { success: false };
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    
    if (action === 'login') {
      response = handleLogin(data);
    } else if (action === 'uploadFile') {
      response = handleFileUpload(data);
    } else if (action === 'addAnnouncement') {
      response = handleAddAnnouncement(data);
    } else if (action === 'scheduleTest') {
      response = handleScheduleTest(data);
    } else if (action === 'enterMarks') {
      response = handleEnterMarks(data);
    } else if (action === 'addStudent') {
      response = handleAddStudent(data);
    }
  } catch (error) {
    response = { success: false, error: error.toString() };
  }
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var action = e.parameter.action;
  var response = {};
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (action === 'getResults') {
      response = getSheetData(ss, 'Results');
    } else if (action === 'getTestimonials') {
      response = getSheetData(ss, 'Testimonials');
    } else if (action === 'getFiles') {
      response = getSheetData(ss, 'Files');
    } else if (action === 'getAnnouncements') {
      response = getSheetData(ss, 'Announcements');
    } else if (action === 'getTests') {
      response = getSheetData(ss, 'Tests');
    } else if (action === 'getMarks') {
      response = getSheetData(ss, 'Marks');
    } else if (action === 'getStudents') {
      var sheetData = getSheetData(ss, 'Students');
      response = sheetData;
    } else {
      response = { success: false, error: 'Unknown GET action' };
    }
  } catch(err) {
    response = { success: false, error: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleLogin(data) {
  var role = data.role; // 'student' or 'teacher'
  var username = data.username;
  var password = data.password;
  
  var sheetName = role === 'teacher' ? 'Teachers' : 'Students';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return { success: false, error: 'Sheet not found' };
  
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  
  // Find column indices dynamically from headers
  var usernameCol = headers.indexOf('Username');
  var passwordCol = headers.indexOf('Password');
  var nameCol = headers.indexOf('Name');
  var gradeCol = headers.indexOf('Grade');
  
  if (usernameCol === -1 || passwordCol === -1) {
    return { success: false, error: 'Sheet columns misconfigured: Username or Password column not found' };
  }
  
  for (var i = 1; i < rows.length; i++) {
    var userRow = rows[i];
    if (String(userRow[usernameCol]).trim() === String(username).trim() && 
        String(userRow[passwordCol]).trim() === String(password).trim()) {
      return {
        success: true,
        user: {
          username: userRow[usernameCol],
          name: nameCol !== -1 ? userRow[nameCol] : '',
          role: role,
          studentClass: (role === 'student' && gradeCol !== -1) ? userRow[gradeCol] : null
        }
      };
    }
  }
  
  return { success: false, error: 'Invalid credentials' };
}

function handleFileUpload(data) {
  if (CONFIG.FOLDER_ID === 'YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE') {
    return { success: false, error: 'Google Drive Folder ID is not configured by Admin.' };
  }

  var folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
  
  // The frontend might have already stripped the prefix, handle both cases
  var base64Data = data.fileData;
  if (base64Data.indexOf(',') > -1) {
    base64Data = base64Data.split(',')[1];
  }
  
  var fileName = data.fileName || data.filename || 'uploaded_file';
  var grade = data.grade || data.class || '';
  
  var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), data.mimeType, fileName);
  var file = folder.createFile(blob);
  
  // Set view access to anyone with the link
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  var fileUrl = file.getUrl();
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Files');
  var now = new Date();
  var date = now.toISOString().split('T')[0];
  
  // Auto-generate Upload ID: UPL-XXXX-YYY
  var uploadId = generateRandomId('UPL');
  
  var uploadedBy = data.uploadedBy || '';
  
  // Columns: Upload ID, Title, Grade, Subject, Upload Date, Uploaded By, File URL
  sheet.appendRow([uploadId, data.title, grade, data.subject, date, uploadedBy, fileUrl]);
  
  return { success: true, fileUrl: fileUrl, uploadId: uploadId };
}

function handleAddAnnouncement(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Announcements');
  if (!sheet) return { success: false, error: 'Announcements sheet not found' };
  
  var now = new Date();
  var date = now.toISOString().split('T')[0];
  
  // Auto-generate Announcement ID: ANN-XXXX-YYY
  var annId = generateRandomId('ANN');
  
  var grade = data.grade || data.targetClass || '';
  var postedBy = data.postedBy || '';
  
  // Columns: Announcement ID, Title, Grade, Message, Date, Posted By
  sheet.appendRow([annId, data.title, grade, data.message, date, postedBy]);
  return { success: true, announcementId: annId };
}

function handleScheduleTest(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tests');
  if (!sheet) return { success: false, error: 'Tests sheet not found' };
  
  var now = new Date();
  
  // Auto-generate Test ID: TST-XXXX-YYY
  var testId = generateRandomId('TST');
  
  var grade = data.grade || data.targetClass || '';
  var scheduledBy = data.scheduledBy || '';
  
  // Columns: Test ID, Title, Grade, Subject, Date, Max Marks, Scheduled By
  sheet.appendRow([testId, data.title, grade, data.subject, data.date, data.maxMarks, scheduledBy]);
  
  return { success: true, testId: testId };
}

function handleEnterMarks(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Marks');
  if (!sheet) return { success: false, error: 'Marks sheet not found' };
  
  var testId = data.testId;
  var marksList = data.marks; // Array of { name: "...", marks: "..." }
  
  // Columns: Mark ID, Test ID, Student Name, Marks
  // We should ideally update existing marks if present, or append if new
  var rows = sheet.getDataRange().getValues();
  var existingMarks = {};
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][1] === testId) {
      existingMarks[rows[i][2]] = i + 1; // 1-indexed row number
    }
  }
  
  for (var j = 0; j < marksList.length; j++) {
    var m = marksList[j];
    var rowIndex = existingMarks[m.name];
    if (rowIndex) {
      // Update existing
      sheet.getRange(rowIndex, 4).setValue(m.marks);
    } else {
      // Append new with short hash ID
      var markId = generateShortHash('MRK');
      // Columns: Mark ID, Test ID, Student Name, Marks
      sheet.appendRow([markId, testId, m.name, m.marks]);
    }
  }
  
  return { success: true };
}

function getSheetData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, error: sheetName + ' sheet not found' };
  
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { success: true, data: [] };
  
  var headers = rows[0];
  var data = [];
  
  for (var i = 1; i < rows.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = rows[i][j];
    }
    data.push(obj);
  }
  
  return { success: true, data: data };
}

function handleAddStudent(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Students'); 
    
    if (!sheet) return { success: false, error: 'Students sheet not found' };
    
    // Auto-generate Student ID: STU-XXXX-YYY
    var studentId = generateRandomId('STU');
    
    // Append the row. Match this to your exact Google Sheets columns:
    // [Student ID, Name, Role, Username, Password, Grade, Subjects]
    sheet.appendRow([
      studentId,           
      data.name,           
      'student',           
      data.username,       
      data.password,       
      data.grade,          
      data.subjects        
    ]);
    
    return { success: true, data: { studentId: studentId } };
    
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Generates a random ID in the format: PREFIX-XXXX-YYY
 * @param {string} prefix The ID prefix (e.g., UPL, ANN, TST, STU)
 * @returns {string} The formatted ID
 */
function generateRandomId(prefix) {
  var part1 = Math.floor(1000 + Math.random() * 9000); // 4 random numbers
  var part2 = Math.floor(100 + Math.random() * 900);   // 3 random numbers
  return prefix + '-' + part1 + '-' + part2;
}

/**
 * Generates a short random hex hash ID: PREFIX-XXXXXX
 * @param {string} prefix The ID prefix (e.g., MRK)
 * @returns {string} The formatted ID
 */
function generateShortHash(prefix) {
  var hash = '';
  var chars = '0123456789ABCDEF';
  for (var i = 0; i < 6; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix + '-' + hash;
}
