//#region init

const functions = require('firebase-functions');
const ApiAiApp = require('actions-on-google').ApiAiApp;

const MAP_GETOFFERS = "getOffers";
const MAP_SELECTINGOFFER = "getOffers.fallback";
const MAP_NEXTOFFER = "getOffers.nextOffer";
const MAP_PREVIOUSOFFER = "getOffers.previousOffer";

//WARNING no uppercase in context names
const CONTEXT_LIST_OFFERS = 'context_list_offers'
const CONTEXT_OFFER_DETAIL = 'context_offer_detail'


const CONTEXT_PARAMETER_Offers_presented = 'Offers_presented'
const CONTEXT_PARAMETER_Offer_presented = 'Offer_presented'

const CITY_Parameter = 'geo-city';
const NUMBER_Parameter = 'number';

exports.agent = functions.https.onRequest((request, response) => {
  var appApiAiApp = new ApiAiApp({
    request: request,
    response: response
  });
  var actionMap = new Map();
  actionMap.set(MAP_GETOFFERS, getOffers);
  actionMap.set(MAP_SELECTINGOFFER, showSelectedOffer);
  actionMap.set(MAP_NEXTOFFER, showNextOffer);
  actionMap.set(MAP_PREVIOUSOFFER, showPreviousOffer);
  let context = appApiAiApp.getContexts();
  //Map Intent to functions
  appApiAiApp.handleRequest(actionMap);
})

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

//#endregion

//#region after selection

function showSelectedOffer(appApiAiApp) {
  let offersPresented = appApiAiApp.getContextArgument(CONTEXT_LIST_OFFERS, CONTEXT_PARAMETER_Offers_presented).value;
  let titleSelected = appApiAiApp.getSelectedOption();

  var offerSelected = offersPresented.find(offer => {
    return (offer.Poste == titleSelected);
  })

  const lang = appApiAiApp.getUserLocale();

  showOneOffer(appApiAiApp, offerSelected, RESPONSE_THE_OFFER[lang], true);
}

function showNextOffer(appApiAiApp) {
  const lang = appApiAiApp.getUserLocale();
  var offersPresented = appApiAiApp.getContextArgument(CONTEXT_LIST_OFFERS, CONTEXT_PARAMETER_Offers_presented).value;
  var offerPresented = appApiAiApp.getContextArgument(CONTEXT_OFFER_DETAIL, CONTEXT_PARAMETER_Offer_presented).value;

  var index = offersPresented.findIndex(offer => {
    return (offer.Poste == offerPresented.Poste)
  })

  try {
    var nextOffer = offersPresented[index + 1]
    showOneOffer(appApiAiApp, nextOffer, RESPONSE_HERE_IS_NEXT_OFFER[lang], true);
  } catch (ex) {
    appApiAiApp.ask(RESPONSE_NO_MORE_IN_LIST[lang])
  }

}

function showPreviousOffer(appApiAiApp) {
  const lang = appApiAiApp.getUserLocale();
  var offersPresented = appApiAiApp.getContextArgument(CONTEXT_LIST_OFFERS, CONTEXT_PARAMETER_Offers_presented).value;
  var offerPresented = appApiAiApp.getContextArgument(CONTEXT_OFFER_DETAIL, CONTEXT_PARAMETER_Offer_presented).value;

  var index = offersPresented.findIndex(offer => {
    return (offer.Poste == offerPresented.Poste)
  })

  try {
    var nextOffer = offersPresented[index - 1]
    showOneOffer(appApiAiApp, nextOffer, RESPONSE_HERE_IS_PREVIOUS_OFFER[lang], true);
  } catch (ex) {
    appApiAiApp.ask(RESPONSE_NO_MORE_IN_LIST[lang])
  }

}

//#endregion

//#region list offers

function handleAnswerOnScreen(res, appApiAiApp) {
  const lang = appApiAiApp.getUserLocale();
  if (res.length == 0) {
    appApiAiApp.ask(RESPONSE_NO_OFFER_MATCHING[lang]);
  } else if (res.length == 1) {
    showOneOffer(appApiAiApp, res[0], RESPONSE_THIS_OFFER_MATCHES[lang]);
  } else if (res.length > 1 && res.length <= 10) {
    answerWithCarousel(appApiAiApp, res);
  } else if (res.length > 10 && res.length <= 30) {
    answerWithList(appApiAiApp, res);
  } else if (res.length > 30) {
    appApiAiApp.ask(RESPONSE_TOO_MANY_OFFERS[lang]);
    // TODO help narrow research
  }
}

function showOneOffer(appApiAiApp, offer, sentence, fromList = false) {
  const lang = appApiAiApp.getUserLocale();
  var body = offer.Description.slice(0, 250).replace("\n", "  ") + "..."

  let parameters = {};
  parameters[CONTEXT_PARAMETER_Offer_presented] = offer;
  appApiAiApp.setContext(CONTEXT_OFFER_DETAIL, 2, parameters)

  if (fromList) {
    let parameters = {};
    parameters[CONTEXT_PARAMETER_Offers_presented] = appApiAiApp.getContextArgument(CONTEXT_LIST_OFFERS, CONTEXT_PARAMETER_Offers_presented).value;
    appApiAiApp.setContext(CONTEXT_LIST_OFFERS, 5, parameters)
  }

  appApiAiApp.ask(appApiAiApp.buildRichResponse()
    .addSuggestions(fromList ? [REQUEST_PREVIOUS_OFFER[lang], REQUEST_NEXT_OFFER[lang]] : []) // TODO no next offer if end of list
    .addSimpleResponse(sentence)
    .addBasicCard(
      appApiAiApp.buildBasicCard(body)
      .setTitle(offer.Poste)
      .setSubtitle(offer.Contrat + ", " + offer.Lieu)
      .addButton(REQUEST_SEE_ONLINE[lang], offer.url)
      .setImage("https://raw.githubusercontent.com/so-technology-watch/assistant-rh-sogeti/master/images/banner.jpg", "test")
    )
  );
}

function answerWithCarousel(appApiAiApp, listOffers) {
  const lang = appApiAiApp.getUserLocale();
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
    .addSimpleResponse(RESPONSE_THOSE_OFFERS_MATCH[lang]),
    appApiAiApp.buildCarousel()
    .addItems(items)
  );
}

function answerWithList(appApiAiApp, listOffers) {
  const lang = appApiAiApp.getUserLocale();
  var items = listOffers.map(offer => {
    return appApiAiApp.buildOptionItem(offer.Poste, [offer.url])
      .setTitle(offer.Poste)
      .setDescription(offer.Contrat + ", " + offer.Lieu);
  });

  let parameters = {};
  parameters[CONTEXT_PARAMETER_Offers_presented] = listOffers;
  appApiAiApp.setContext(CONTEXT_LIST_OFFERS, 5, parameters)

  appApiAiApp.askWithList(RESPONSE_THOSE_OFFERS_MATCH[lang],
    appApiAiApp.buildList()
    .addItems(items)
  );
}

//#endregion


//#region SPEAKING API

function handleAnswerNoScreen(res, appApiAiApp) {
  const lang = appApiAiApp.getUserLocale();

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

//#endregion


//#region DATA GETTER FROM DATASTORE

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

//#endregion


//#region LANGAGE MANAGEMENT


const FR_FR = "fr-FR";
const EN_GB = "en-GB";
const EN_US = "en-US";

function NewSentence(english, french) {
  var sentence = {};
  sentence[FR_FR] = french;
  sentence[EN_GB] = english;
  sentence[EN_US] = english;
  return sentence;
}

const RESPONSE_THE_OFFER = NewSentence('Here is the offer you want', "Voilà l'offre qui vous intéresse");

const REQUEST_NEXT_OFFER = NewSentence('Next Offer', "Offre suivante");
const RESPONSE_HERE_IS_NEXT_OFFER = NewSentence('Here is the next one', "Voilà l'offre l'offre suivante");

const REQUEST_PREVIOUS_OFFER = NewSentence('Previous Offer', "Offre précédente");
const RESPONSE_HERE_IS_PREVIOUS_OFFER = NewSentence('Here is the previous one', "Voilà l'offre l'offre suivante");
const RESPONSE_NO_MORE_IN_LIST = NewSentence('Sorry, no more offers in the list', "Désolé, il n'y a plus d'offres dans la liste");

const RESPONSE_NO_OFFER_MATCHING = NewSentence('Sorry, no offers matching your request', "Désolé, aucune offre ne correspond à votre requête");
const RESPONSE_TOO_MANY_OFFERS = NewSentence('Sorry, too many offers matching your request', "Désolé, il y a trop d'offres correspondant à votre requête");

const RESPONSE_THIS_OFFER_MATCHES = NewSentence('This offer matches your request', "Cette offre correspond à votre requête");
const RESPONSE_THOSE_OFFERS_MATCH = NewSentence('Those offers match your request', "Ces offres correspondent à votre requête");

const REQUEST_SEE_ONLINE = NewSentence('See Online', "Voir en ligne");

//#endregion