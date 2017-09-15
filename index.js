var ApiAiApp = require('actions-on-google').ApiAiApp;

var fs = require('fs');

const GETOFFERS_MAP = "getOffers";
const SUJET_Parameter = 'Sujet';

function getOffers(appApiAiApp) {
  var sujet = appApiAiApp.getArgument(SUJET_Parameter);
  var item1 = {
    title:"title", 
    description:"description",
    image:{
      url:"https://www.sogeti.com/Static/img/logo.png"
    },
    optionInfo:{
      key: "key1",
      synonyms: []
    }
  };
  var item2 = {
    title:"title2", 
    description:"description2",
    image:{
      url:"https://www.sogeti.com/Static/img/logo.png"
    },
    optionInfo:{
      key: "key2",
      synonyms: []
    }
  };
  appApiAiApp.askWithCarousel(
    appApiAiApp.buildRichResponse()
    .addSimpleResponse('Any text you want to send before carousel'),
    appApiAiApp.buildCarousel()
    .addItems(item1)
    .addItems(item2)
  );
  
}
exports.agent = function(request, response) {
    var appApiAiApp = new ApiAiApp({request: request, response: response});
    var actionMap = new Map();
    actionMap.set(GETOFFERS_MAP, getOffers);
    //Map Intent to functions
    appApiAiApp.handleRequest(actionMap);
};