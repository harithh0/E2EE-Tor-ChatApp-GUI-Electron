const { app, BrowserWindow,ipcMain } = require('electron');
const path = require('node:path');

const fs = require('fs');
const forge = require('node-forge');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const dbPath = path.join(__dirname, "data.db")

let db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});



db.run(`CREATE TABLE IF NOT EXISTS main_user (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  token TEXT NOT NULL,
  public_key NOT NULL,
  private_key TEXT NOT NULL

)`);




function insertMainUser(user_id, username, token, public_key, private_key) {
  db.run(`INSERT INTO main_user (user_id, username, token, public_key, private_key) VALUES (?, ?, ?, ?, ?)`, 
    [user_id, username, token, public_key, private_key], 
    function(err) {
      if (err) {
        return console.error(err.message);
      }
      console.log(`A row has been inserted with rowid ${this.lastID}`);
    }
  );
}

function getMainUser() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM main_user LIMIT 1`, [], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}


ipcMain.on('save-main-user', (event, user_data) => {

  const user_token = user_data.token
  const username = user_data.user_data.username
  const user_id = user_data.user_data.id;
  const user_public_key = user_data.user_data.public_key;
  const user_private_key = user_data.private_key;
  insertMainUser(user_id, username, user_token, user_public_key, user_private_key);
});


// db.close((err) => {
//   if (err) {
//     console.error(err.message);
//   } else {
//     console.log('Close the database connection.');
//   }
// });



function checkForToken() {

}



// Function to get the username from data.json
// function getUserName() {
//   if (fs.existsSync(dataFilePath)) {
//     try {
//       const data = fs.readFileSync(dataFilePath, 'utf8');
//       const parsedData = JSON.parse(data);
//       if (parsedData.main_user && parsedData.main_user.user_data && parsedData.main_user.user_data.username) {
//         console.log('Username found:', parsedData.main_user.user_data.username);
//         return parsedData.main_user.user_data.username;
//       } else {
//         console.log('Username not found in data.json');
//         return null;
//       }
//     } catch (error) {
//       console.error('Error reading or parsing data.json:', error);
//       return null;
//     }
//   } else {
//     console.log('data.json does not exist');
//     return null;
//   }
// }



async function getUserName() {
  const user_data = await getMainUser();
  const username = user_data.username
  return username;
}


async function getUserPrivate() {
  const user_data = await getMainUser();
  const username = user_data.private_key
  return username;
}


async function getUserToken() {
  const user_data = await getMainUser();
  const token = user_data.token
  return token;

}

// Function to get the token from data.json
// function getUserToken() {
//   if (fs.existsSync(dataFilePath)) {
//     try {
//       const data = fs.readFileSync(dataFilePath, 'utf8');
//       const parsedData = JSON.parse(data);
//       if (parsedData.main_user && parsedData.main_user.token) {
//         console.log('Token found:', parsedData.main_user.token);
//         return parsedData.main_user.token;
//       } else {
//         console.log('Token not found in data.json');
//         return null;
//       }
//     } catch (error) {
//       console.error('Error reading or parsing data.json:', error);
//       return null;
//     }
//   } else {
//     console.log('data.json does not exist');
//     return null;
//   }
// }



function generateRSAKeys() {
  return new Promise((resolve, reject) => {
      forge.pki.rsa.generateKeyPair({ bits: 3072, workers: 2 }, (err, keypair) => {
          if (err) {
              reject(err);
          } else {
              const publicKeyPem = forge.pki.publicKeyToPem(keypair.publicKey);
              const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
              resolve({ publicKey: publicKeyPem, privateKey: privateKeyPem });
          }
      });
  });
}


function encryptMessage(message, public_key){
  const encryptedMessage = crypto.publicEncrypt(public_key, Buffer.from(message));
  return encryptedMessage.toString('base64'); // binary to base64 (text) format (makes it easier to transport over the internet HTTP, JSON)  | proviedes compatbility between devices
}

function decryptMessage(encrypted_message, private_key){
  const encryptedMessageBuffer = Buffer.from(encrypted_message, "base64"); // takes a base64 encrypted text
  // Decrypt the message
  const decryptedMessage = crypto.privateDecrypt(private_key, encryptedMessageBuffer);
  return decryptedMessage.toString('utf8'); // takes it in binary format and converts it into human readable string format

}

function signMessage(message, private_key){
  const signer = crypto.createSign('sha256');
  signer.update(message);
  signer.end();
  const signature = signer.sign(private_key, 'base64');
  return signature;
}

function verifyMessage(message, signature, public_key){
  const verifier = crypto.createVerify('sha256');
  verifier.update(message);
  verifier.end();
  // Convert the signature from base64 to a buffer
  const signatureBuffer = Buffer.from(signature, 'base64');
  // Verify the signature
  const isVerified = verifier.verify(public_key, signatureBuffer);
  return isVerified;

}

ipcMain.handle('verify-message', (event, message, signature, public_key) => {
  return verifyMessage(message, signature, public_key);
});

ipcMain.handle('sign-message', (event, message, private_key) => {
  return signMessage(message, private_key);
});


ipcMain.handle('decrypt-message', (event, encrypted_message, private_key) => {
  return decryptMessage(encrypted_message, private_key);
});


ipcMain.handle('encrypt-message', (event, message, public_key) => {
  return encryptMessage(message, public_key);
});



ipcMain.handle('generate-rsa-keys', () => {
  return generateRSAKeys();
});





// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}


// Handle IPC messages to get the username
ipcMain.handle('get-username', () => {
  return getUserName();
});

ipcMain.handle('get-user-token', () => {
  return getUserToken();
});

ipcMain.handle('get-user-private', () => {
  return getUserPrivate();
});


// Handle IPC message to open the "Add Friend" window
ipcMain.on('open-add-friend-window', () => {
  const addFriendWindow = new BrowserWindow({
    width: 400,
    height: 300,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  addFriendWindow.loadFile(path.join(__dirname, './screens/add_friend.html'));
});


ipcMain.on('open-view-pending-friends-window', () => {
  const pendingFriendsWindow = new BrowserWindow({
    width: 400,
    height: 300,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  pendingFriendsWindow.loadFile(path.join(__dirname, './screens/view_pending_friends.html'));
});

ipcMain.on('open-view-friends-window', () => {
  const FriendsWindow = new BrowserWindow({
    width: 400,
    height: 300,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  FriendsWindow.loadFile(path.join(__dirname, './screens/view_friends.html'));
});



ipcMain.on('open-chatroom-window', (event, { friend, realFriendName, chatroomId, friendPublicKey }) => {
  const chatroomWindow = new BrowserWindow({
    width: 750,
    height: 550,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  chatroomWindow.loadFile(path.join(__dirname, './screens/chatroom.html'));

  // Pass data to the chatroom window
  chatroomWindow.webContents.on('did-finish-load', () => {
    chatroomWindow.webContents.send('chatroom-data', { friend, realFriendName, chatroomId, friendPublicKey });
  });
});


const createRootWindow = () => {
  // Create the browser window.
  const rootWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  rootWindow.loadFile(path.join(__dirname, './screens/root.html'));

}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));


  // Listen for when the registration window is closed

  let isProgrammaticClose = false;

// if user clicks X
  mainWindow.on('close', (event) => {
    if (!isProgrammaticClose) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  function closeMainWindowProgrammatically() {
    isProgrammaticClose = true;
    mainWindow.close();
  }

mainWindow.on('closed', async () => {
    const rootWindow = new BrowserWindow({
      width: 800,
      height: 600,
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    });
  
    rootWindow.loadFile(path.join(__dirname, './screens/root.html'));
});




 



  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

ipcMain.on('save-json', (event, jsonData) => {
  fs.writeFile(path.join(__dirname, 'data.json'), jsonData, (err) => {
      if (err) {
          event.reply('save-json-response', 'Error saving file');
      } else {
          event.reply('save-json-response', 'File saved successfully');
      }
  });
});


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.


function checkDatabase() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(dbPath)) {
      return resolve(false);
    }

    let db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return reject(err);
      }
    });

    db.get("SELECT token FROM main_user", (err, row) => {
      if (err) {
        db.close();
        return reject(err);
      }
      db.close();
      resolve(!!row);
    });
  });
}

checkDatabase().then(isValid => {
  if (isValid) {
    app.whenReady().then(() => {
      createRootWindow();
    
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createRootWindow();
        }
      });
    });
  } else {
    app.whenReady().then(() => {
      createWindow();
    
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });
    });
  }
}).catch(err => {
  app.whenReady().then(() => {
    createWindow();
  
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
});



// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.