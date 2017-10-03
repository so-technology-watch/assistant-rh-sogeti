/////////////// APIAI Agent /////////////////////////


const ApiAiApp = require('actions-on-google').ApiAiApp;

const MAP_GETOFFERS = "getOffers";
const MAP_SELECTINGOFFER = "getOffers.fallback";
const MAP_NEXTOFFER = "getOffers.nextOffer";

//WARNING no uppercase in context names
const CONTEXT_LIST_OFFERS = 'context_list_offers'
const CONTEXT_OFFER_DETAIL = 'context_offer_detail'


const CONTEXT_PARAMETER_Offers_presented = 'Offers_presented'
const CONTEXT_PARAMETER_Offer_presented = 'Offer_presented'

const CITY_Parameter = 'geo-city';
const NUMBER_Parameter = 'number-integer';

exports.agent = function (request, response) {
  var appApiAiApp = new ApiAiApp({
    request: request,
    response: response
  });
  var actionMap = new Map();
  actionMap.set(MAP_GETOFFERS, getOffers);
  actionMap.set(MAP_SELECTINGOFFER, showSelectedOffer);
  actionMap.set(MAP_NEXTOFFER, showNextOffer); //////////////////HERE !!!!!!!!!!!!!!!!!
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

function showSelectedOffer(appApiAiApp) {
  let offersPresented = appApiAiApp.getContextArgument(CONTEXT_LIST_OFFERS, CONTEXT_PARAMETER_Offers_presented).value;
  let titleSelected = appApiAiApp.getSelectedOption();

  var offerSelected = offersPresented.find(offer => {
    return (offer.Poste == titleSelected);
  })

  showOneOffer(appApiAiApp, offerSelected, 'Here is the offer you want', true);
}

function showNextOffer(appApiAiApp) {
  let offersPresented = appApiAiApp.getContextArgument(CONTEXT_LIST_OFFERS, CONTEXT_PARAMETER_Offers_presented).value;
  let offerPresented = appApiAiApp.getContextArgument(CONTEXT_OFFER_DETAIL, CONTEXT_PARAMETER_Offer_presented).value;

  var index = offersPresented.findIndex(offer => {
    return (offer.Poste == offerPresented.Poste)
  })

  try {
    var nextOffer = offersPresented[index + 1]
    showOneOffer(appApiAiApp, nextOffer, 'Here is the next one', true);
  } catch (ex) {
    appApiAiApp.ask("Sorry, no more offers in the list")
  }

}

function handleAnswerOnScreen(res, appApiAiApp) {
  if (res.length == 0) {
    appApiAiApp.ask("No offers matching your request \nDo you want to ask something else ?");
  } else if (res.length == 1) {
    showOneOffer(appApiAiApp, res[0]);
  } else if (res.length > 1 && res.length <= 10) {
    answerWithCarousel(appApiAiApp, res);
  } else if (res.length > 10 && res.length <= 30) {
    answerWithList(appApiAiApp, res);
  } else if (res.length > 30) {
    appApiAiApp.ask("Too many offers matching your request");
    // TODO help narrow research
  }
}

function showOneOffer(appApiAiApp, offer, sentence = 'This offer matches your request !', fromList = false) {
  var body = offer.Description.slice(0, 250).replace("\n", "  ") + "..."

  let parameters = {};
  parameters[CONTEXT_PARAMETER_Offer_presented] = offer;
  appApiAiApp.setContext(CONTEXT_OFFER_DETAIL, 1, parameters)

  appApiAiApp.ask(appApiAiApp.buildRichResponse()
    .addSuggestions(fromList ? ['Next Offer', 'Back To List'] : []) // TODO no next offer if end of list
    .addSimpleResponse(sentence)
    .addBasicCard(
      appApiAiApp.buildBasicCard(body)
      .setTitle(offer.Poste)
      .setSubtitle(offer.Contrat + ", " + offer.Lieu)
      .addButton('See online', offer.url)
      .setImage("https://raw.githubusercontent.com/so-technology-watch/assistant-rh-sogeti/master/images/banner.jpg", "test")
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
  parameters[CONTEXT_PARAMETER_Offers_presented] = listOffers;
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
    return appApiAiApp.buildOptionItem(offer.Poste, [offer.url])
      .setTitle(offer.Poste)
      .setDescription(offer.Contrat + ", " + offer.Lieu);
  });

  let parameters = {};
  parameters[CONTEXT_PARAMETER_Offers_presented] = listOffers;
  appApiAiApp.setContext(CONTEXT_LIST_OFFERS, 5, parameters)

  appApiAiApp.askWithList("Those offers match your request",
    appApiAiApp.buildList()
    .addItems(items)
  );
}


//////////////////// SPEAKING API /////////////////////


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