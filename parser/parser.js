var request = require('request');
var cheerio = require('cheerio');
var Promise = require('promise');


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
                promises.push( getHtml(list_url_pages[i])
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
            return Promise.all(promises).then( list_offers_all_pages => {
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


URL_list_offers = "https://sogetifrance-recrute.talent-soft.com/offre-de-emploi/liste-offres.aspx";

getOffersUrl(URL_list_offers)
.then(list => {
    console.log(list.length);
    list.forEach(offer => {
        offer.getContent();
    })
});

class Offer {
    constructor (url){
        this.url = "https://sogetifrance-recrute.talent-soft.com" + url
    }

    getContent(){
        return getHtml(this.url)
        .catch(err => {
            console.log(err);
        })
        .then(html =>{
            var $ = cheerio.load(html);

            this.title = $('#titrepages').first().find('h1 span').first().text().trim();
            console.log(this.title);
        })
    }

}