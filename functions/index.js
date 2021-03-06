//#region init

const functions = require('firebase-functions');
const DialogflowApp = require('actions-on-google').DialogflowApp;
var stringSimilarity = require('string-similarity');

const lang = "fr-FR";

const MAP_GetOffers = "getOffers";
const MAP_SelectingOffer = "getOffers.fallback";
const MAP_NextOffer = "getOffers.nextOffer";
const MAP_PreviousOffer = "getOffers.previousOffer";
const MAP_ParseOffers = "parseOffers";

//WARNING no uppercase in context names
const CONTEXT_ListOffers = 'context_list_offers'
const CONTEXT_OfferDetail = 'context_offer_detail'

const CONTEXT_PARAMETER_OffersPresented = 'Offers_presented'
const CONTEXT_PARAMETER_OfferPresented = 'Offer_presented'

const PARAMETER_City = 'Ville';
const PARAMETER_Region = 'Region';
const PARAMETER_Dept = 'Departement';
const PARAMETER_Type = 'Type';

// Agent Called on DialogFlow Request
exports.agent = functions.https.onRequest((request, response) => {
    var app = new DialogflowApp({
        request: request,
        response: response
    });
    var actionMap = new Map();
    actionMap.set(MAP_GetOffers, getOffers);
    actionMap.set(MAP_SelectingOffer, showSelectedOffer);
    actionMap.set(MAP_NextOffer, showNextOffer);
    actionMap.set(MAP_PreviousOffer, showPreviousOffer);
    actionMap.set(MAP_ParseOffers, updateAllOffers);
    let context = app.getContexts();
    app.handleRequest(actionMap);
})

//#endregion


//#region CONVERSATION API

//#region GETOFFERS

// Function called when asking for offers in a city for exemple
function getOffers(app) {
    var city = app.getArgument(PARAMETER_City);
    var region = app.getArgument(PARAMETER_Region);
    var dept = app.getArgument(PARAMETER_Dept);
    var type = app.getArgument(PARAMETER_Type);

    if (!city && !region && !dept && !type) {
        app.ask(RESPONSE_NOT_ENOUGH_INFO)
    }

    //Getting data from database
    dataGetter(city, dept, region, type)
        .catch(err => {
            console.log(err);
        })
        .then(res => {
            //There is a different output if only audio is available
            if (app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT)) {
                handleAnswerOnScreen(res, app);
            } else if (app.hasSurfaceCapability(app.SurfaceCapabilities.AUDIO_OUTPUT)) {
                handleAnswerNoScreen(res, app);
            } else {
                handleNotAOG(res, app);
            }
        })
}
//#region list offers

//If a screen is available
function handleAnswerOnScreen(res, app) {
    if (res.length == 0) {
        app.ask(RESPONSE_NO_OFFER_MATCHING[lang]);
    } else if (res.length == 1) {
        showOneOffer(app, res[0], RESPONSE_THIS_OFFER_MATCHES[lang]);
    } else if (res.length > 1 && res.length <= 10) {
        answerWithCarousel(app, res);
    } else if (res.length > 10 && res.length <= 30) {
        answerWithList(app, res);
    } else if (res.length > 30) {
        app.ask(RESPONSE_TOO_MANY_OFFERS[lang]);
    }
}

function answerWithCarousel(app, listOffers) {
    var items = listOffers.map(offer => {
        return app.buildOptionItem(offer.Poste, [])
            .setTitle(offer.Poste)
            .setDescription(offer.Contrat + ", " + offer.Ville);
    });

    let parameters = {};
    parameters[CONTEXT_PARAMETER_OffersPresented] = listOffers;
    app.setContext(CONTEXT_ListOffers, 5, parameters)

    app.askWithCarousel(
        app.buildRichResponse()
        .addSimpleResponse(RESPONSE_THOSE_OFFERS_MATCH[lang]),
        app.buildCarousel()
        .addItems(items)
    );
}

function answerWithList(app, listOffers) {
    var items = listOffers.map(offer => {
        return app.buildOptionItem(offer.Poste, [offer.url])
            .setTitle(offer.Poste)
            .setDescription(offer.Contrat + ", " + offer.Ville);
    });

    let parameters = {};
    parameters[CONTEXT_PARAMETER_OffersPresented] = listOffers;
    app.setContext(CONTEXT_ListOffers, 5, parameters)

    app.askWithList(RESPONSE_THOSE_OFFERS_MATCH[lang],
        app.buildList()
        .addItems(items)
    );
}

//#endregion

//#endregion

//#region SHOWSELECTEDOFFER NEXT PREVIOUS

//Showing only one offer
//fromList tells whether we show this offer out of a list of offers or as a standalone offer
function showOneOffer(app, offer, sentence, fromList = false) {
    var body = offer.Description.slice(0, 250).replace("\n", "  ") + "..."

    let parameters = {};
    parameters[CONTEXT_PARAMETER_OfferPresented] = offer;
    app.setContext(CONTEXT_OfferDetail, 2, parameters)

    if (fromList) {
        let parameters = {};
        parameters[CONTEXT_PARAMETER_OffersPresented] = app.getContextArgument(CONTEXT_ListOffers, CONTEXT_PARAMETER_OffersPresented).value;
        app.setContext(CONTEXT_ListOffers, 5, parameters)
    }

    app.ask(app.buildRichResponse()
        .addSuggestions(fromList ? [REQUEST_PREVIOUS_OFFER[lang], REQUEST_NEXT_OFFER[lang]] : [])
        .addSimpleResponse(sentence)
        .addBasicCard(
            app.buildBasicCard(body)
            .setTitle(offer.Poste)
            .setSubtitle(offer.Contrat + ", " + offer.Ville)
            .addButton(REQUEST_SEE_ONLINE[lang], offer.url)
            .setImage("https://raw.githubusercontent.com/so-technology-watch/assistant-rh-sogeti/master/images/banner.jpg", "Sogeti_Logo")
        )
    );
}

//Triggers showOneOffer with the right offer from the list
function showSelectedOffer(app) {
    let offersPresented = app.getContextArgument(CONTEXT_ListOffers, CONTEXT_PARAMETER_OffersPresented).value;
    var titlesPresented = offersPresented.map(offer => {
        return offer.Poste;
    })
    let titleSelected = app.getSelectedOption();

    if (titleSelected) {
        const bestMatch = stringSimilarity.findBestMatch(titleSelected, titlesPresented).bestMatch;
        if (bestMatch.rating > 0.7) {

            var offerSelected = offersPresented.find(offer => {
                return (offer.Poste == bestMatch.target);
            })

            showOneOffer(app, offerSelected, RESPONSE_THE_OFFER[lang], true);
        } else {
            app.ask(RESPONSE_OFFER_NOT_FOUND[lang]);
        }
    } else {
        app.ask(RESPONSE_OFFER_NOT_FOUND[lang]);
    }
}


function showNextOffer(app) {
    var offersPresented = app.getContextArgument(CONTEXT_ListOffers, CONTEXT_PARAMETER_OffersPresented).value;
    var offerPresented = app.getContextArgument(CONTEXT_OfferDetail, CONTEXT_PARAMETER_OfferPresented).value;

    var index = offersPresented.findIndex(offer => {
        return (offer.Poste == offerPresented.Poste)
    })

    try {
        var nextOffer = offersPresented[index + 1]
        showOneOffer(app, nextOffer, RESPONSE_HERE_IS_NEXT_OFFER[lang], true);
    } catch (ex) {
        app.ask(RESPONSE_NO_MORE_IN_LIST[lang])
    }

}

function showPreviousOffer(app) {
    var offersPresented = app.getContextArgument(CONTEXT_ListOffers, CONTEXT_PARAMETER_OffersPresented).value;
    var offerPresented = app.getContextArgument(CONTEXT_OfferDetail, CONTEXT_PARAMETER_OfferPresented).value;

    var index = offersPresented.findIndex(offer => {
        return (offer.Poste == offerPresented.Poste)
    })

    try {
        var nextOffer = offersPresented[index - 1]
        showOneOffer(app, nextOffer, RESPONSE_HERE_IS_PREVIOUS_OFFER[lang], true);
    } catch (ex) {
        app.ask(RESPONSE_NO_MORE_IN_LIST[lang])
    }

}

//#endregion

//#region SPEAKING API
function handleAnswerNoScreen(res, app) {

    if (res.length == 0) {
        app.ask(addSpeak("<p><s>No offers matching your request.</s> <s>Do you want to ask something else ?</s>"));
    } else if (res.length == 1) {
        app.ask(app.buildRichResponse()
            .addSimpleResponse("There is one offer matching your request. \n")
            .addSimpleResponse(tellOneOffer(app, res[0], true))
        )
    } else if (res.length > 1 && res.length <= 10) {
        app.ask(app.buildRichResponse()
            .addSimpleResponse("There several offers matching your request. \n")
            .addSimpleResponse(addSpeak('After every offer you can say next, select or quit'))
            .addSimpleResponse(tellOneOffer(app, res[0]))
        )
    }
}



function addSpeak(s) {
    return '<speak>' + s + '</speak>';
}

function tellOneOffer(app, offer, addDescription = false) {
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

//#region NOT GOOGLE ASSISTANT
function handleNotAOG(res, app) {
    answerWithListNotAOG(app, res);
}

function answerWithListNotAOG(app, listOffers) {
    var items = listOffers.map(offer => {
        return app.buildOptionItem(offer.Poste, [offer.url])
            .setTitle(offer.Poste)
            .setDescription(offer.Contrat + ", " + offer.Ville);
    });

    let parameters = {};
    parameters[CONTEXT_PARAMETER_OffersPresented] = listOffers;
    app.setContext(CONTEXT_ListOffers, 5, parameters)


    app.askWithList(RESPONSE_THOSE_OFFERS_MATCH[lang],
        app.buildList()
        .addItems(items)
    );
}
//#endregion

//#region DATA GETTER FROM DATASTORE

const URL_RH_website = "https://sogetifrance-recrute.talent-soft.com/offre-de-emploi/liste-offres.aspx";

const URL_RH_root = "https://sogetifrance-recrute.talent-soft.com";

const Datastore = require('@google-cloud/datastore');
const projectId = 'assistant-rh-sogeti-8a30a';
const datastore = Datastore({
    projectId: projectId
});

function dataGetter(cities, depts, regions, type) {
    return cleanCitiesDeptsRegions(cities, depts, regions).then(cleanedPlace => {
        promisesQueries = []

        if (cleanedPlace.cities.length < 1 && cleanedPlace.depts.length < 1 && cleanedPlace.regions.length < 1) {
            const query = datastore.createQuery("Offer")
                .filter('validated', '=', true)
            if (type) {
                query.filter('Contrat', '=', type)
            }
            promisesQueries.push(datastore.runQuery(query)
                .then(res => {
                    return res[0];
                }))
        }

        cleanedPlace.cities.forEach(city => {
            const query = datastore.createQuery("Offer")
                .filter('validated', '=', true)
            if (type) {
                query.filter('Contrat', '=', type)
            }
            promisesQueries.push(datastore.runQuery(query.filter(PARAMETER_City, '=', city))
                .then(res => {
                    return res[0];
                }))
        })
        cleanedPlace.depts.forEach(dept => {
            const query = datastore.createQuery("Offer")
                .filter('validated', '=', true)
            if (type) {
                query.filter('Contrat', '=', type)
            }
            promisesQueries.push(datastore.runQuery(query.filter(PARAMETER_Dept, '=', dept))
                .then(res => {
                    return res[0];
                }))
        })
        cleanedPlace.regions.forEach(region => {
            const query = datastore.createQuery("Offer")
                .filter('validated', '=', true)
            if (type) {
                query.filter('Contrat', '=', type)
            }
            promisesQueries.push(datastore.runQuery(query.filter(PARAMETER_Region, '=', region))
                .then(res => {
                    return res[0];
                }))
        })

        return Promise.all(promisesQueries)
            .then(results => {
                return [].concat.apply([], results)
            })
    })

};

function cleanCitiesDeptsRegions(cities, depts, regions) {
    var promises = []
    var values = {
        cities: [],
        depts: [],
        regions: []
    }
    cities.forEach(city => {
        promises.push(
            cleanCity(city)
            .then(cityCleaned => {
                values.cities.push(cityCleaned)
            }))
    });
    depts.forEach(dept => {
        promises.push(cleanDept(dept)
            .then(deptCleaned => {
                values.depts.push(deptCleaned)
            }))
    });
    regions.forEach(region => {
        promises.push(cleanRegion(region)
            .then(regionCleaned => {
                values.regions.push(regionCleaned)
            }))
    });
    return Promise.all(promises).then(list => {
        return values;
    })
}

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
const RESPONSE_OFFER_NOT_FOUND = NewSentence('Sorry, we could not find the offer you want', "Désolé, nous n'avons pas pu trouver l'offre que vous cherchez");

const REQUEST_NEXT_OFFER = NewSentence('Next Offer', "Offre suivante");

const RESPONSE_HERE_IS_NEXT_OFFER = NewSentence('Here is the next one', "Voilà l'offre suivante");

const REQUEST_PREVIOUS_OFFER = NewSentence('Previous Offer', "Offre précédente");
const RESPONSE_HERE_IS_PREVIOUS_OFFER = NewSentence('Here is the previous one', "Voilà l'offre précédente");

const RESPONSE_NO_MORE_IN_LIST = NewSentence('Sorry, no more offers in the list', "Désolé, il n'y a plus d'offres dans la liste");

const RESPONSE_NO_OFFER_MATCHING = NewSentence('Sorry, no offers matching your request', "Désolé, aucune offre ne correspond à votre requête");
const RESPONSE_TOO_MANY_OFFERS = NewSentence('Sorry, too many offers matching your request', "Désolé, il y a trop d'offres correspondant à votre requête. Pouvez vous être plus précis?");
const RESPONSE_NOT_ENOUGH_INFO = NewSentence('Can you please narrow your research to a city or a region?', "Il y a beaucoup d'offres en France. Pouvez vous être plus précis sur l'endroit ou le type?");

const RESPONSE_THIS_OFFER_MATCHES = NewSentence('This offer matches your request', "Cette offre correspond à votre requête");
const RESPONSE_THOSE_OFFERS_MATCH = NewSentence('Those offers match your request', "Voilà des offres susceptibles de vous intéresser");

const REQUEST_SEE_ONLINE = NewSentence('See Online', "Voir en ligne");

//#endregion

//#endregion

//#region NEW OFFERS PARSER

const cheerio = require('cheerio');
const request = require('request');



function getHtml(url) {
    const requestOptions = {
        url: url,
        method: 'GET',
        timeout: 120000,
        headers: {
            'Accept-Charset': 'utf-8',
            'User-Agent': 'my-reddit-client'
        }
    };
    return new Promise((resolve, reject) => {
        request(url, (error, res, html) => {
            if (!error && res.statusCode == 200) {
                resolve(html)
            } else {
                reject(error)
            }
        })

    })
}

// Gets the list of all the offers' urls
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

//Get the urls of all the pages containing offers
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

// The Short key is what we store, the long version is what's on the website
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

// Object containing all the attributes of an offer, initiated by the url of the offer
class Offer {
    constructor(url) {
        this.url = URL_RH_root + url;
    }

    getOfferHtml(count = 0, err = "") {
        var offer = this;
        return getHtml(offer.url).catch(err => {
            //console.log(err)
        }).then(html => {
            offer.html = html
        })
    }

    // Gets all the attributes of the offer from the html
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

    // An offer is valid if it has a city attribute
    validateOffer() {
        if (this[VILLE]) {
            this.validated = true;
        } else {
            this.validated = false;

        }
    }
}

// General function to interrogate the geo API
function cleanApi(url) {
    return getHtml(url)
        .catch(err => {
            //console.log(err);
        })
        .then(clean => {
            if (clean && clean != "") {
                const cleanObject = JSON.parse(clean);
                return cleanObject[0] ? cleanObject[0].nom : undefined;
            }
        })
}

function cleanCity(city) {
    return city ? cleanApi(`https://geo.api.gouv.fr/communes?nom=${encodeURI(city)}&fields=nom&format=json`) : new Promise((resolve, reject) => {
        resolve(undefined)
    })
}

function cleanRegion(region) {
    return region ? cleanApi(`https://geo.api.gouv.fr/regions?nom=${encodeURI(region)}&fields=nom`) : new Promise((resolve, reject) => {
        resolve(undefined)
    })
}

function cleanDept(dept) {
    return dept ? cleanApi(`https://geo.api.gouv.fr/departements?nom=${encodeURI(dept)}&fields=nom`) : new Promise((resolve, reject) => {
        resolve(undefined)
    })
}

function cleanCityDeptRegion(city, dept, region) {
    var promises = []
    var values = {}

    promises.push(
        cleanCity(city)
        .then(cityCleaned => {
            values.city = cityCleaned
        }))
    promises.push(cleanDept(dept)
        .then(deptCleaned => {
            values.dept = deptCleaned
        }))
    promises.push(cleanRegion(region)
        .then(regionCleaned => {
            values.region = regionCleaned
        }))
    return Promise.all(promises).then(list => {
        return values;
    })
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
            return cleanDept(dept)
                .then(deptCleaned => {
                    valuesCleaned.push({
                        key: DEPARTEMENT,
                        value: deptCleaned ? deptCleaned : dept
                    })
                    return valuesCleaned;
                })
        })
}

// Cleans the values of the attributes from the website
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

// Tool for the html parser to get the value of any object
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

// Tool for the parser to get the closest sibling with a value
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

// fill up the attributes, html and content of the offers in the list
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

// save the offer in the datastore
function saveOffer(offer) {
    const kind = "Offer";
    const OfferKey = datastore.key(kind);
    var entity = {
        key: OfferKey,
        data: []
    };
    Object.keys(offer).forEach(key => {
        if (IsShortKey(key) && offer[key] != undefined) {
            if (key == "Description" || key == "Profil") {
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

// Gets the existing offers in the datastore
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

// Clears the datastore
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

// Gets the list of all the new offers, not already in the datastore
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
                if (!offer.validated) {
                    numberInvalid++;
                }
                saveOffer(offer);
            })
            console.log(numberInvalid + " invalid offers");
        })
    })
}

//#region saving entities
var http = require("https");

var options = {
    "method": "POST",
    "hostname": "api.dialogflow.com",
    "port": null,
    "path": "/v1/entities?v=20150910",
    "headers": {
        "content-type": "application/json; charset=utf-8",
        "authorization": "Bearer 9b33cf29903f46cab467342277f1c544"
    }
};


function addEntity(entity) {
    var req = http.request(options, function (res) {
        var chunks = [];

        res.on("data", function (chunk) {
            chunks.push(chunk);
        });

        res.on("end", function () {
            var body = Buffer.concat(chunks);
            console.log(body.toString());
        });
    });

    req.write(JSON.stringify(entity))

    req.end();
}

class Entity {
    constructor(name, entries = []) {
        this.name = name,
            this.entries = entries
    }

    add(value, synonyms = []) {
        this.entries.push({
            value: value,
            synonyms: synonyms
        })
        return this
    }
}

//#endregion


//#endregion