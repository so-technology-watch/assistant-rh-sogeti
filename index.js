/////////////// APIAI Agent /////////////////////////


const ApiAiApp = require('actions-on-google').ApiAiApp;

const GETOFFERS_MAP = "getOffers";
const CITY_Parameter = 'geo-city';
const NUMBER_Parameter = 'number-integer';

function getOffers(appApiAiApp) {
  var city = appApiAiApp.getArgument(CITY_Parameter);
  var nbOffers = parseInt(appApiAiApp.getArgument(NUMBER_Parameter));

  dataGetter(city, nbOffers)
    .catch(err => {
      console.log(err);
    })
    .then(res => {
      try {
        handleAnswer(res, appApiAiApp);
      } catch (error) {
        console.log(error);
      }
    })
}

function handleAnswer(res, appApiAiApp) {
  if (res.length == 0) {
    appApiAiApp.ask("No offers matching your request \nDo you want to ask something else ?");
  }
  else if (res.length == 1) {
    showOneOffer(appApiAiApp, res[0]);
  }
  else if (res.length > 1 && res.length <= 10) {
    answerWithCarousel(appApiAiApp, res);
    // TODO after click carousel
  }
  else if (res.length > 10 && res.length <= 30) {
    answerWithList(appApiAiApp, res);
    // TODO after click list
  }
  else if (res.length > 30) {
    appApiAiApp.ask("Too many offers matching your request");
    // TODO help narrow research
  }
}

function showOneOffer(appApiAiApp, offer) {
  appApiAiApp.ask(appApiAiApp.buildRichResponse()
    .addSimpleResponse('This offer matches your request !')
    .addBasicCard(
      appApiAiApp.buildBasicCard(offer.Description)
      .setTitle(offer.Poste)
      .setSubtitle(offer.Contrat + ", " + offer.Lieu)
      .addButton('See online', offer.url)
    )
  );
}

function answerWithCarousel(appApiAiApp, listOffers) {
  var items = listOffers.map(offer => {
    return appApiAiApp.buildOptionItem(offer.Poste, [])
      .setTitle(offer.Poste)
      .setDescription(offer.Contrat + ", " + offer.Lieu);
  });
  appApiAiApp.askWithCarousel(
    appApiAiApp.buildRichResponse()
    .addSimpleResponse("Those offers match your request"),
    appApiAiApp.buildCarousel()
    .addItems(items)
  );
}

function answerWithList(appApiAiApp, listOffers) {
  var items = listOffers.map(offer => {
    return appApiAiApp.buildOptionItem(offer.Poste, [])
      .setTitle(offer.Poste)
      .setDescription(offer.Contrat + ", " + offer.Lieu);
  });
  appApiAiApp.askWithList("Those offers match your request",
    appApiAiApp.buildList()
    .addItems(items)
  );
}

exports.agent = function (request, response) {
  var appApiAiApp = new ApiAiApp({
    request: request,
    response: response
  });
  var actionMap = new Map();
  actionMap.set(GETOFFERS_MAP, getOffers);
  //Map Intent to functions
  appApiAiApp.handleRequest(actionMap);
};



/////////////// DATA GETTER FROM DATASTORE /////////////////////////



const Datastore = require('@google-cloud/datastore');
const projectId = 'chatbot-sogeti';
const datastore = Datastore({
  projectId: projectId
});

function dataGetter(city, nb) {
  var city_cleaned = city.toLowerCase();
  var query = datastore.createQuery("Offer")
    .filter('Lieu', '=', city_cleaned);
  if (nb){
    query = query.limit(nb);
  }

  return datastore.runQuery(query)
    .then(res => {
      return res[0];
    })

};