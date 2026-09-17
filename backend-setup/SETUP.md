# Farukat - Google Sheets Backend Setup Instructions

To replace local/fake data with a real, persistent backend using Google Sheets, follow these exact steps.

### Step 1: Create the Google Sheet
1. Open [Google Sheets](https://sheets.new) and create a new blank spreadsheet.
2. Name it "Farukat Database".

### Step 2: Add Google Apps Script
1. In your new Google Sheet, click **Extensions** > **Apps Script** from the top menu.
2. This opens the Apps Script editor. Delete the default `function myFunction() {}` code.
3. Open the `backend-setup/Code.gs` file in this repository.
4. Copy ALL the code from `backend-setup/Code.gs` and paste it into the Apps Script editor.
5. Click the **Save** button (floppy disk icon) or press Ctrl+S / Cmd+S.

### Step 3: Initialize the Database Tables
1. At the top of the Apps Script editor, you will see a dropdown menu with a function name (usually `doPost`).
2. Click the dropdown and select `initSetup`.
3. Click the **Run** button.
4. Google will ask for permission to access your spreadsheet. Click **Review permissions**, select your Google account, click **Advanced**, and then **Go to Untitled project (unsafe)**. Finally, click **Allow**.
5. Once the script finishes, look back at your Google Sheet. You will see 6 new tabs created: `Users`, `XP_Transactions`, `Follows`, `Achievements`, `User_Achievements`, and `Notifications`.

### Step 4: Deploy the API
1. In the Apps Script editor, click the blue **Deploy** button in the top right corner.
2. Select **New deployment**.
3. Click the gear icon ⚙️ next to "Select type" and choose **Web app**.
4. Fill out the configuration exactly like this:
   - **Description**: Farukat API v1
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone
5. Click **Deploy**.
6. Copy the resulting **Web app URL** (it ends in `/exec`).

### Step 5: Connect Your App
1. Go to your app's codebase.
2. Open the `.env` file (or create one in the root folder).
3. Add the following line, replacing the URL with the one you copied in Step 4:
   ```
   VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_ACTUAL_ID/exec
   ```
4. Restart your development server.

Your app is now connected to a real backend! All XP, levels, digital card metadata, and follows will persist securely in your Google Sheet!
