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
  var password = data.password; // For simplicity, we compare raw or basic hashed on client. Real hash should be done securely.
  
  var sheetName = role === 'teacher' ? 'Teachers' : 'Students';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return { success: false, error: 'Sheet not found' };
  
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  
  for (var i = 1; i < rows.length; i++) {
    var userRow = rows[i];
    if (String(userRow[0]) === String(username) && String(userRow[1]) === String(password)) {
      // Columns: Username, Password, Name, Role, Class (students only)
      return {
        success: true,
        user: {
          username: userRow[0],
          name: userRow[2],
          role: userRow[3] || role,
          studentClass: role === 'student' ? userRow[4] : null
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
  
  // Auto-generate Upload ID: UPL-DDMMYY-NNN
  var dd = ('0' + now.getDate()).slice(-2);
  var mm = ('0' + (now.getMonth() + 1)).slice(-2);
  var yy = String(now.getFullYear()).slice(-2);
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var count = lastRow - 1;
  var paddedId = ('000' + (count + 1)).slice(-3);
  var uploadId = 'UPL-' + dd + mm + yy + '-' + paddedId;
  
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
  
  // Auto-generate Announcement ID: ANN-DDMMYY-NNN
  var dd = ('0' + now.getDate()).slice(-2);
  var mm = ('0' + (now.getMonth() + 1)).slice(-2);
  var yy = String(now.getFullYear()).slice(-2);
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var count = lastRow - 1;
  var paddedId = ('000' + (count + 1)).slice(-3);
  var annId = 'ANN-' + dd + mm + yy + '-' + paddedId;
  
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
  
  // Auto-generate Test ID: TST-DDMMYY-NNN
  var dd = ('0' + now.getDate()).slice(-2);
  var mm = ('0' + (now.getMonth() + 1)).slice(-2);
  var yy = String(now.getFullYear()).slice(-2);
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var count = lastRow - 1;
  var paddedId = ('000' + (count + 1)).slice(-3);
  var testId = 'TST-' + dd + mm + yy + '-' + paddedId;
  
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
  var marksList = data.marks; // Array of { username: "...", marks: "..." }
  
  // Columns: Test ID, Student Username, Marks
  // We should ideally update existing marks if present, or append if new
  var rows = sheet.getDataRange().getValues();
  var existingMarks = {};
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === testId) {
      existingMarks[rows[i][1]] = i + 1; // 1-indexed row number
    }
  }
  
  for (var j = 0; j < marksList.length; j++) {
    var m = marksList[j];
    var rowIndex = existingMarks[m.username];
    if (rowIndex) {
      // Update existing
      sheet.getRange(rowIndex, 3).setValue(m.marks);
    } else {
      // Append new
      sheet.appendRow([testId, m.username, m.marks]);
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
    
    // Auto-generate hidden Student ID (e.g. STU-2026-001)
    var year = new Date().getFullYear();
    var lastRow = Math.max(sheet.getLastRow(), 1); 
    var count = lastRow - 1; 
    var rawId = count + 1;
    var paddedId = ('000' + rawId).slice(-3); // Pads to 3 digits
    var studentId = 'STU-' + year + '-' + paddedId;
    
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
