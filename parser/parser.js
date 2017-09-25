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
            return list_url_pages.slice(0,1); //HACK Remove slice
        });
}


URL_list_offers = "https://sogetifrance-recrute.talent-soft.com/offre-de-emploi/liste-offres.aspx";

getOffersUrl(URL_list_offers)
.then(list => {
    console.log(list.length);
    list.forEach(offer => {
        offer.getContent().then(data => {
            offer.data = data;
        });
    })
});

class Offer {
    constructor (url){
        this.url = "https://sogetifrance-recrute.talent-soft.com" + url;
        this.title = "";

    }

    getContent(){

        return getHtml(this.url).then(html => {
            this.html = html;

            var $ = cheerio.load(this.html);
    
            this.title = $('#titrepages').first().find('h1 span').first().text().trim();
    
            var content = $('#contenu-ficheoffre').first();
    
            var dataDictionary = {};


            var list = content.find('h3').slice(1)
            .each((i,el) => {
                // console.log(el.children[0].data.trim() + " : " + el.next.children[0].data.trim());
                let key = el.children[0].data.trim();
                var next = el.next;
                var value = "";
                while (next.children.length < 1){
                    next = next.next
                }
                if (next.children.length == 1){
                    value = next.children[0].data.trim();
                }
                else {
                    value = next.children.reduce((prev, curr) =>{
                        var prevText = prev;
                        if (typeof(prev) != typeof("")){
                            prevText = prev.type == "text" ? prev.data : "";
                        }
                        
                        var currText = curr.type == "text" ? curr.data : "";

                        return prevText + "\n" + currText;
                    });
                }
                dataDictionary[key] = value;
                
            });

            return dataDictionary;

        });


    }

}