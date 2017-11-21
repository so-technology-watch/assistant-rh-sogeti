# assistant-rh-sogeti

## Development Setup

``` bash
# go to functions' folder
cd functions

# install modules
npm i

# setup firebase
npm install -g firebase-tools
firebase login

# Start firebase functions emulator
cd ..
firebase serve --only functions

# Expose port 5000 online
ngrok http 5000
```


Copy the https link to console.dialogflow.com
and add `/us-central1/agent`

Follow the API activity on http://127.0.0.1:4040


## Deployment Setup

``` bash
# install modules
cd functions
npm i
cd ..

# setup firebase
npm install -g firebase-tools
firebase login

# deploy firebase functions
firebase deploy --only functions
```