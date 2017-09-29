/////////////// APIAI Agent /////////////////////////


const ApiAiApp = require('actions-on-google').ApiAiApp;

const MAP_GETOFFERS = "getOffers";
const MAP_SELECTINGOFFER = "getOffers.fallback";

//WARNING no uppercase in context names
const CONTEXT_LIST_OFFERS = 'context_list_offers'

const CITY_Parameter = 'geo-city';
const NUMBER_Parameter = 'number-integer';

exports.agent = function (request, response) {
  var appApiAiApp = new ApiAiApp({
    request: request,
    response: response
  });
  var actionMap = new Map();
  actionMap.set(MAP_GETOFFERS, getOffers);
  actionMap.set(MAP_SELECTINGOFFER, selectingOffer);
  let context = appApiAiApp.getContexts();
  //Map Intent to functions
  appApiAiApp.handleRequest(actionMap);
};

function getOffers(appApiAiApp) {
  var city = appApiAiApp.getArgument(CITY_Parameter);
  var nbOffers = parseInt(appApiAiApp.getArgument(NUMBER_Parameter));

  dataGetter(city, nbOffers)
    .catch(err => {
      console.log(err);
    })
    .then(res => {
      if (appApiAiApp.hasSurfaceCapability(appApiAiApp.SurfaceCapabilities.SCREEN_OUTPUT)) {
        handleAnswerOnScreen(res, appApiAiApp);
      } else if (appApiAiApp.hasSurfaceCapability(appApiAiApp.SurfaceCapabilities.AUDIO_OUTPUT)) {
        handleAnswerNoScreen(res, appApiAiApp);
      }
    })
}

function selectingOffer(appApiAiApp) {
  let offers = appApiAiApp.getContextArgument(CONTEXT_LIST_OFFERS, 'Offers_presented').value;
  console.log(offers);
}

function handleAnswerOnScreen(res, appApiAiApp) {
  if (res.length == 0) {
    appApiAiApp.ask("No offers matching your request \nDo you want to ask something else ?");
  } else if (res.length == 1) {
    showOneOffer(appApiAiApp, res[0]);
  } else if (res.length > 1 && res.length <= 10) {
    answerWithCarousel(appApiAiApp, res);
    // TODO after click carousel
  } else if (res.length > 10 && res.length <= 30) {
    answerWithList(appApiAiApp, res);
    // TODO after click list
  } else if (res.length > 30) {
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
      .setImage("https://pbs.twimg.com/profile_images/458977970716024832/_mOFbecc_400x400.png", "test")
    )
  );
}

function answerWithCarousel(appApiAiApp, listOffers) {
  var items = listOffers.map(offer => {
    return appApiAiApp.buildOptionItem(offer.Poste, [])
      .setTitle(offer.Poste)
      .setDescription(offer.Contrat + ", " + offer.Lieu);
  });
  let parameters = {};
  parameters['Offers_presented'] = listOffers;
  appApiAiApp.setContext(CONTEXT_LIST_OFFERS, 5, parameters)
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

function handleAnswerNoScreen(res, appApiAiApp) {

  if (res.length == 0) {
    appApiAiApp.ask(addSpeak("<p><s>No offers matching your request.</s> <s>Do you want to ask something else ?</s>"));
  } else if (res.length == 1) {
    appApiAiApp.ask(appApiAiApp.buildRichResponse()
      .addSimpleResponse("There is one offer matching your request. \n")
      .addSimpleResponse(tellOneOffer(appApiAiApp, res[0], true))
    )
  } else if (res.length > 1 && res.length <= 10) {
    appApiAiApp.ask(appApiAiApp.buildRichResponse()
      .addSimpleResponse("There several offers matching your request. \n")
      .addSimpleResponse(addSpeak('After every offer you can say next, select or quit'))
      .addSimpleResponse(tellOneOffer(appApiAiApp, res[0]))
    )
  }
}

function addSpeak(s) {
  return '<speak>' + s + '</speak>';
}

function tellOneOffer(appApiAiApp, offer, addDescription = false) {
  let answer = 'It is a ' +
    offer.Contrat +
    ' as ' +
    offer.Poste +
    '\n'

  if (addDescription) {
    answer = answer +
      'Here is the description <break time="1" />' +
      offer.Description +
      '\n'
  }

  return addSpeak(answer);
}

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
  if (nb) {
    // BUG if nb == 0
    query = query.limit(nb);
  }

  return datastore.runQuery(query)
    .then(res => {
      return res[0];
    })

};