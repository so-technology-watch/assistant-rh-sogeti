//#region init

const functions = require('firebase-functions');
const ApiAiApp = require('actions-on-google').ApiAiApp;

const MAP_GETOFFERS = "getOffers";
const MAP_SELECTINGOFFER = "getOffers.fallback";
const MAP_NEXTOFFER = "getOffers.nextOffer";
const MAP_PREVIOUSOFFER = "getOffers.previousOffer";
const MAP_PARSEROFFERS = "parseOffers";

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
    actionMap.set(MAP_PARSEROFFERS, updateAllOffers);
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

const URL_RH_website = "https://sogetifrance-recrute.talent-soft.com/offre-de-emploi/liste-offres.aspx";

const URL_RH_root = "https://sogetifrance-recrute.talent-soft.com";

const Datastore = require('@google-cloud/datastore');
const projectId = 'assistant-rh-sogeti';
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



//#region Parser

const cheerio = require('cheerio');
const request = require('request');

function getHtml(url) {
    return new Promise((resolve, reject) => {
        request(url, (error, res, html) => {
            if (!error && res.statusCode == 200) {
                resolve(html)
            } else {
                reject(error)
            }
        })

    })
    /*return axios.request({
        url: url,
        method: 'get'
    }).catch(err => {
        return getHtml(url).then(res => {return res})
    }).then(res => {
        return res.data
    })*/
}

function getOffersUrl() {

    return getOffersPages()
        .then(list_url_pages => {
            var list_url_offers = [];
            var promises = [];
            for (var i = 0; i < list_url_pages.length; i++) {
                promises.push(getHtml(list_url_pages[i])
                    .then(res => {
                        var doc = cheerio.load(res);
                        var list_url_offers_this_page = [];
                        doc('li.offerlist-item h3 a').each((i, el) => {
                            list_url_offers_this_page.push(new Offer(el.attribs['href']));
                        });
                        return list_url_offers_this_page;
                    })
                );
            }
            return Promise.all(promises).then(list_offers_all_pages => {
                return list_offers_all_pages.reduce((prev, curr) => {
                    return curr.concat(prev);
                })
            });
        });

}

function getOffersPages() {

    return getHtml(URL_RH_website)
        .catch(err => {
            console.log(err);
        })
        .then(html => {
            var $ = cheerio.load(html);
            //Get the list of urls where there are offers
            var list_url_pages = [];
            list_url_pages[0] = URL_RH_website;
            $('#resultatPagination').first().find('a')
                .filter((i, el) => {
                    // Remove the last element
                    return el.attribs['id'] != "ctl00_ctl00_corpsRoot_corps_Pagination_linkSuivPage";
                })
                .each((i, el) => {
                    list_url_pages.push(el.attribs['href']);
                });
            return list_url_pages;
        });
}

const CONTRAT = "Contrat";
const DESCRIPTION = "Description de la mission";
const POSTE = "Intitulé du poste";
const LIEU = "Lieu";
const LOCALISATION = "Localisation du poste";
const METIER = "Métier";
const PROFIL = "Profil";
const URL = "url";

const DESCRIPTION_SHORT = "Description";
const POSTE_SHORT = "Poste";
const METIER_SHORT = "Metier";
const VILLE = "Ville";
const DEPARTEMENT = "Departement";
const REGION = "Region";

var SHORT_KEY = {};
[CONTRAT, DESCRIPTION, POSTE, LIEU, LOCALISATION, METIER, PROFIL, URL, VILLE, DEPARTEMENT, REGION]
.forEach(key => {
    switch (key) {
        case (DESCRIPTION):
            SHORT_KEY[key] = DESCRIPTION_SHORT
            break;
        case (POSTE):
            SHORT_KEY[key] = POSTE_SHORT
            break;
        case (METIER):
            SHORT_KEY[key] = METIER_SHORT
            break;
        default:
            SHORT_KEY[key] = key
            break;
    }
})

function IsShortKey(key) {
    if (key == 'validated') {
        return true;
    }
    return Object.keys(SHORT_KEY)
        .map(longKey => {
            return SHORT_KEY[longKey];
        })
        .includes(key);
};

function IsLongKey(key) {
    return Object.keys(SHORT_KEY)
        .includes(key);
};

var compt = 0;

class Offer {
    constructor(url) {
        this.url = URL_RH_root + url;
    }

    getOfferHtml(count = 0, err = "") {
        var offer = this;
        return getHtml(offer.url).catch(err => {
            console.log("no html")
        }).then(html => {
            offer.html = html
        })
    }

    getContent() {
        if (this.html) {
            var $ = cheerio.load(this.html);
            var content = $('#contenu-ficheoffre').first();
            var promises = [];
            var list = content.find('h3').slice(1)
                .each((i, el) => {
                    let key = getValueTag(el.children[0]);
                    if (IsLongKey(key)) {
                        var value = getNextValue(el);
                        promises.push(cleanValue(key, value).then(valuesCleaned => {
                            valuesCleaned.forEach(valueCleaned => {
                                this[valueCleaned.key] = valueCleaned.value;
                            })
                        }))
                    }
                });
            return Promise.all(promises).then(data => {
                this.validateOffer();
                return 1;
            })
        } else {
            this.validated = false;
            return new Promise((resolve, reject) => {
                resolve(0)
            })
        }
    }

    validateOffer() {
        if (this[VILLE] && this[DEPARTEMENT] && this[REGION]) {
            this.validated = true;
        } else {
            this.validated = false;
        }
    }
}

function cleanApi(url) {
    return getHtml(url)
        .catch(err => {
            console.log("no API answer")
        })
        .then(clean => {
            if (clean && clean != "") {
                const cleanObject = JSON.parse(clean);
                return cleanObject[0] ? cleanObject[0].nom : undefined;
            }
            return undefined
        })
}

function cleanCity(city) {
    return cleanApi(`https://geo.api.gouv.fr/communes?nom=${encodeURI(city)}&fields=nom&format=json`)
}

function cleanRegion(region) {
    return cleanApi(`https://geo.api.gouv.fr/regions?nom=${encodeURI(region)}&fields=nom`)
}

function cleanDepartement(dept) {
    return cleanApi(`https://geo.api.gouv.fr/departements?nom=${encodeURI(dept)}&fields=nom`)
}

function cleanLocalisation(localisation) {
    const region = localisation.split(',')[0];
    const dept = localisation.split(',')[1];
    var valuesCleaned = [];
    return cleanRegion(region)
        .then(regionCleaned => {
            valuesCleaned.push({
                key: REGION,
                value: regionCleaned ? regionCleaned : region
            })
        })
        .then(data => {
            return cleanDepartement(dept)
                .then(deptCleaned => {
                    valuesCleaned.push({
                        key: DEPARTEMENT,
                        value: deptCleaned ? deptCleaned : dept
                    })
                    return valuesCleaned;
                })
        })
}


function cleanValue(key, value) {
    if (key == LIEU) {
        return cleanCity(value)
            .then(cityCleaned => {
                return [{
                    key: VILLE,
                    value: cityCleaned
                }]
            })
    } else if (key == LOCALISATION) {
        return cleanLocalisation(value)
    } else if (key == CONTRAT) {
        if (value.includes("CDI")) {
            value = "CDI";
        }
        if (value.includes("CDD")) {
            value = "CDD";
        }
        if (value.includes("Contrat d'apprentissage")) {
            value = "Contrat d'apprentissage";
        }
        if (value.includes("Stage conventionné")) {
            value = "Stage";
        }
        if (value.includes("Contrat de professionnalisation")) {
            value = "Contrat de professionnalisation";
        }
    } else if (key == POSTE) {
        value = value.replace(" H/F", "").replace("(H/F)", "");
    }

    const valuesCleaned = [{
        key: SHORT_KEY[key],
        value: value
    }]

    return new Promise((resolve, reject) => {
        resolve(valuesCleaned);
    });
}

function getValueTag(el) {
    var type = typeof (el);
    var value = "";
    if (type == "object") {
        if (el instanceof cheerio) {
            value = el.text();
        } else if (el.data) {
            value = el.data;
        }
    } else if (type == "string") {
        value = el;
    }
    return value.trim();
}

function getNextValue(el) {
    var next = el.next;
    var value = "";
    while (next.children.length < 1 && next.next != undefined && next.next != null) {
        next = next.next
    }
    if (next.children.length == 1) {
        value = getValueTag(next.children[0]);
    } else {
        value = next.children.reduce((prev, curr) => {
            return getValueTag(prev) + "\n" + getValueTag(curr);
        });
    }
    return value.trim();
}

function getOffersData(list_Offers) {

    console.log(list_Offers.length + " offres récupérées");

    var promisesHtml = [];
    list_Offers.forEach(offer => {
        promisesHtml.push(offer.getOfferHtml());
    });

    return Promise.all(promisesHtml)
        .then(x => {
            var promisesContent = []
            list_Offers.forEach(offer => {
                promisesContent.push(offer.getContent());
            });
            return Promise.all(promisesContent).then(x => {
                console.log("All Data Parsed")
                return list_Offers;
            })
        })
}

function saveOffer(offer) {
    const kind = "Offer";
    const OfferKey = datastore.key(kind);
    var entity = {
        key: OfferKey,
        data: []
    };
    Object.keys(offer).forEach(key => {
        if (IsShortKey(key) && offer[key]) {
            if (key == DESCRIPTION_SHORT || key == PROFIL) {
                entity.data.push({
                    name: key,
                    value: offer[key],
                    excludeFromIndexes: true
                })
            } else {
                entity.data.push({
                    name: key,
                    value: offer[key]
                })
            }
        }
    })
    datastore.save(entity)
        .then(() => {
            // console.log(`Offer ${OfferKey.id} created successfully.`);
        })
        .catch((err) => {
            console.error('ERROR:', err);
        });
}

function saveAllOffers() {
    getOffersData()
        .then(listOffers => {
            listOffers.forEach(offer => {
                if (offer.validated) {
                    saveOffer(offer);
                }
            })

        });
}

function getAllExistingOffers() {
    var query = datastore.createQuery("Offer");

    return datastore.runQuery(query)
        .then(res => {
            return res[0];
        })
}

function getAllExistingUrls(offers) {
    return offers.map(offer => {
        return offer.url;
    })
}

function getAllExistingKeys(offers) {
    return offers.map(offer => {
        return offer[datastore.KEY];
    })
}

function deleteAllOffers() {
    getAllExistingOffers().then(existingOffers => {
        getAllExistingKeys(existingOffers).forEach(key => {
            datastore.delete(key, err => {
                if (err) {
                    console.log(err);
                }
            })
        })
        console.log("All data deleted")
    })
}

function deleteOffers(list) {
    getAllExistingKeys(list).forEach(key => {
        datastore.delete(key, err => {
            if (err) {
                console.log(err);
            }
        })
    })
}

function getNewOffers() {
    return getAllExistingOffers().then(existingOffers => {
        const existingUrls = getAllExistingUrls(existingOffers);
        return getOffersUrl().then(offersUrls => {
            return offersUrls.filter(newOffer => {
                return !existingUrls.includes(newOffer.url);
            })
        })
    })
}

function updateAllOffers() {
    getNewOffers().then(newOffers => {
        getOffersData(newOffers).then(listOffers => {
            // Saving all new offers
            var numberInvalid = 0;
            listOffers.forEach(offer => {
                saveOffer(offer);
                if (!offer.validated) {
                    numberInvalid++;
                }
            })
            console.log(numberInvalid + " invalid offers");
        })
        /*getAllExistingOffers().then(existingOffers => {
            const newUrls = newOffers.map(offer => {
                return offer.url
            })
            const oldOffers = existingOffers.filter(offer => {
                return !newUrls.includes(offer.url)
            })
            console.log(oldOffers.length + " old offers");
            deleteOffers(oldOffers)
        })*/
    })
}

updateAllOffers()

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