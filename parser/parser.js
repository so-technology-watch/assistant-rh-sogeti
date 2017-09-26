const request = require('request');
const cheerio = require('cheerio');
const Promise = require('promise');
const Datastore = require('@google-cloud/datastore');

const projectId = 'chatbot-sogeti';
const datastore = Datastore({
    projectId: projectId
});


function getHtml(url) {
    return new Promise(function (resolve, reject) {
        request(url, function (error, res, html) {
            if (!error) {
                resolve(html);
            } else {
                reject(error);
            }
        });
    });
}

function getOffersUrl(URL_list_offers) {

    return getOffersPages(URL_list_offers)
        .then(list_url_pages => {
            var list_url_offers = [];
            var promises = [];
            for (var i = 0; i < list_url_pages.length; i++) {
                promises.push(getHtml(list_url_pages[i])
                    .catch(err => {
                        console.log(err);
                    })
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

function getOffersPages(URL_list_offers) {

    return getHtml(URL_list_offers)
        .catch(err => {
            console.log(err);
        })
        .then(html => {
            var $ = cheerio.load(html);
            //Get the list of urls where there are offers
            var list_url_pages = [];
            list_url_pages[0] = URL_list_offers;
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

class Offer {
    constructor(url) {
        this.url = "https://sogetifrance-recrute.talent-soft.com" + url;
        this.title = "";

    }

    getOfferHtml() {
        var offer = this;
        return new Promise(function (resolve, reject) {
            request(offer.url, function (error, res, html) {
                if (!error) {
                    offer.html = html;
                    resolve(1);
                } else {
                    reject(error);
                }
            });
        });
    }

    getContent() {

        if (this.html != undefined) {

            var $ = cheerio.load(this.html);

            this.title = $('#titrepages').first().find('h1 span').first().text().trim();

            var content = $('#contenu-ficheoffre').first();

            var list = content.find('h3').slice(1)
                .each((i, el) => {
                    let key = el.children[0].data.trim();
                    var next = el.next;
                    var value = "";
                    while (next.children.length < 1 && next.next != undefined && next.next != null) {
                        next = next.next
                    }
                    if (next.children.length == 1) {
                        value = next.children[0].data.trim();
                    } else {
                        value = next.children.reduce((prev, curr) => {
                            var prevText = prev;
                            if (typeof (prev) != typeof ("")) {
                                prevText = prev.type == "text" ? prev.data.trim() : "";
                            }

                            var currText = curr.type == "text" ? curr.data.trim() : "";

                            return prevText + "\n" + currText;
                        });
                    }
                    this[key] = value;

                });

            return 1;
        }

        return 0;

    }

}

function getOffersData(MainUrl) {

    var list_Offers = [];

    return getOffersUrl(MainUrl)
        .then(list => {
            list_Offers = list;
            console.log(list_Offers.length + " offres récupérées");

            var promisesContent = [];
            list_Offers.forEach(offer => {
                promisesContent.push(offer.getOfferHtml());
            });

            return Promise.all(promisesContent)
                .catch(err => {
                    console.log(err)
                })
                .then(listResponses => {
                    var allOk = listResponses.every(res => {
                        return res == 1;
                    });
                    console.log(allOk);

                    if (allOk) {

                        list_Offers.forEach(offer => {
                            try {
                                offer.getContent();
                            } catch (err) {
                                console.log(err);
                            }
                        })

                        console.log("ALL DATA PARSED");
                        return list_Offers;
                    }
                })
        });
}

function saveOffer(offer) {
    const kind = "Offer";
    const OfferKey = datastore.key(kind);
    var entity = {
        key: OfferKey,
        data: []
    };
    Object.keys(offer).forEach(key => {
        if (key != 'html') {
            if (key == 'Description de la mission' || key == 'Profil'){
                entity.data.push({
                    name: key,
                    value: offer[key],
                    excludeFromIndexes: true
                })
            }
            else{
                entity.data.push({
                    name: key,
                    value: offer[key]
            })}
        }
    })
    datastore.save(entity)
    .then(() => {
      console.log(`Offer ${OfferKey.id} created successfully.`);
    })
    .catch((err) => {
      console.error('ERROR:', err);
    });
}

function saveAllOffers() {
    const URL_list_offers = "https://sogetifrance-recrute.talent-soft.com/offre-de-emploi/liste-offres.aspx";

    getOffersData(URL_list_offers)
        .then(listOffers => {
            listOffers.forEach(offer =>{
                saveOffer(offer);
            })
            
        })
}


saveAllOffers();