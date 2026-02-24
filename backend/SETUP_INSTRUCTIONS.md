# Google Apps Script Setup Instructions

Follow these steps to set up the backend for your website using Google Sheets and Google Drive.

## Step 1: Create the Google Sheet
1. Open Google Sheets (sheets.new) and create a new spreadsheet.
2. Name it something like "Mitesh Sir Tutions Database".
3. Rename the default sheet tabs and create the following tabs exactly as named below (case-sensitive):
   - **Teachers**
   - **Students**
   - **Files**
   - **Results**
   - **Testimonials**
   - **Announcements**
4. Add the following header rows (Row 1) to each respective tab:
   - **Teachers**: `Username`, `Password`, `Name`, `Role`
   - **Students**: `Username`, `Password`, `Name`, `Role`, `Class`
   - **Files**: `File ID`, `Title`, `Description`, `Subject`, `Class`, `Upload Date`, `File URL`
   - **Results**: `Student Name`, `Class`, `Subject`, `Score`, `Rank`, `File Link`
   - **Testimonials**: `ID`, `Student Name`, `Year`, `Subject`, `Testimonial Text`, `Photo URL`
   - **Announcements**: `Date`, `Title`, `Message`, `Class`

## Step 2: Create a Google Drive Folder
1. Go to Google Drive (drive.google.com).
2. Create a new folder (e.g., "Mitesh Sir Study Materials").
3. Right-click the folder and click **Share**. Change General Access to "Anyone with the link" and Role to "Viewer".
4. Copy the Folder ID from the URL. (e.g., if URL is `.../folders/1aBcDeFgHiJkLmNoP`, the ID is `1aBcDeFgHiJkLmNoP`).

## Step 3: Add the Apps Script
1. Go back to your Google Sheet. Click on **Extensions** > **Apps Script**.
2. Delete any code in the editor.
3. Replace it with the code from `backend/Code.gs`.
4. Replace `YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE` with the Folder ID you copied in Step 2.
5. Save the project (Ctrl+S or the Floppy Disk icon).

## Step 4: Deploy as a Web App
1. Click the blue **Deploy** button at the top right, then select **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Under "Description", type something like "v1".
4. Under "Execute as", select **Me (your email)**.
5. Under "Who has access", select **Anyone**.
6. Click **Deploy**.
7. *Important*: Google will ask for authorization. Click "Authorize access", choose your account, click "Advanced" at the bottom, and proceed to the script (unsafe). Then click "Allow".
8. Once deployed, copy the **Web app URL**.

## Step 5: Configure the Frontend
1. Open the file `js/config.js` in your website code.
2. Replace `YOUR_WEB_APP_URL_HERE` with the URL you copied in Step 4.

You're done! Your backend is fully connected.
