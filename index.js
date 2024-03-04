const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/presentations.readonly','https://www.googleapis.com/auth/drive'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    /**
     * AUTH A USER
     */
    // const content = await fs.readFile(TOKEN_PATH);
    // const credentials = JSON.parse(content);
    // return google.auth.fromJSON(credentials, {
    //   scopes: SCOPES,
    // });

    /**
     * SERVICE ACCOUNT
     */
    const auth = new google.auth.GoogleAuth({
      keyFile: TOKEN_PATH,
      scopes: SCOPES,
    })
    return auth
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * 
 * Only function worth looking at. Everything else is from google set up example
 */
async function replaceText(auth) {
  // id of template presentation
  const presentationId = '11mx9C5Z8TGUAU1VOnXNtq7R37fj624HtAo1He37AaF8';
  const newPresentationName = 'My New Presentation';

  /**
   * INITIALIZE APIs
   */
  const driveApi = google.drive({version: 'v3', auth});
  const slidesApi = google.slides({version: 'v1', auth});
  const presentationCopy = await driveApi.files.copy({
    fileId: presentationId,
  });


  /**
   * GET PRESENTATION FOR LAYOUTS
   */
  const newPresentation = await slidesApi.presentations.get({
    presentationId: presentationCopy.data.id,
  })


  /**
   * FIND AUDIO LAYOUT
   */
  const audioLayout = newPresentation.data.layouts.find(layout => layout.layoutProperties.displayName === 'AUDIO');


  /**
   * UPDATE {{ placeholder-text }}
   */
  const requests = [
    {
      replaceAllText: {
        containsText: {
          text: '{{ presentation-title }}',
          matchCase: true,
        },
        replaceText: 'Google Slides API TEST',
      },
    }, {
      replaceAllText: {
        containsText: {
          text: '{{ presentation-subtitle }}',
          matchCase: true,
        },
        replaceText: 'Giving it a shot',
      },
    }
  ]
  const updateResponse = await slidesApi.presentations.batchUpdate({
    presentationId: newPresentation.data.presentationId,
    resource: {requests},
  });
  console.log('Replaced text in presentation');


  /**
   * ADD NEW SLIDE FROM CUSTOM TEMPLATE NAMED 'AUDIO'
   */
  const addSlideRequests = [{
    createSlide: {
      slideLayoutReference: {
        layoutId: newPresentation.data.layouts.find(layout => layout.layoutProperties.displayName === 'AUDIO').objectId,
      }
    }
  }]
  const addSlideResponse = await slidesApi.presentations.batchUpdate({
    presentationId: newPresentation.data.presentationId,
    resource: {requests: addSlideRequests},
  });
  console.log('Added slide to presentation');


  /**
   * DELETE CUSTOM LAYOUTS FROM COPY
   * (Can not delete layouts that have been used in the presentation)
   */
  const deleteLayoutRequests = slidesApi.presentations.batchUpdate({
    presentationId: newPresentation.data.presentationId,
    resource: {
      requests: newPresentation.data.layouts
        .filter(layout => layout.layoutProperties.displayName === 'AUDIO')
        .map(layout => ({
          deleteObject: {objectId: layout.objectId},
        })),
    },
  });
  


  /**
   * EXPORT TO .PPTX file
   */
  const pptVersion = await driveApi.files.export({
    fileId: newPresentation.data.presentationId,
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }, {
    responseType: 'arraybuffer',
  });
  fs.writeFile('new-presentation.pptx', Buffer.from(pptVersion.data));
  console.log('Downloaded presentation as .pptx file');


  /**
   * DELETE COPY PRESENTATION FROM DRIVE
   */
  const deleteResponse = await driveApi.files.delete({
    fileId: newPresentation.data.presentationId
  });
  console.log('Deleted copy in drive');
}

authorize().then(replaceText).catch(console.error);



