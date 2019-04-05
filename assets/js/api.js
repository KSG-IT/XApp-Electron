const fs = require('fs');
const path = require('path');

const baseUrl = 'https://ksg.tormodhaugland.com/api/';
const auth = {user: 'funk', pass: '123456'};
// const baseUrl = 'http://localhost:8000/api/';
// const auth = {user: 'admin', pass: '123456'};
const request = require('request').defaults({baseUrl: baseUrl});
const remote = require('electron').remote;

const currentWindow = remote.getCurrentWindow();
const cookies = remote.session.defaultSession.cookies;

const handlebars = require('handlebars');

function writeAuthenticationCookie(token, callback) {

    cookies
        .set({url: baseUrl, name: 'Authentication', value: token}, (error) => {
            callback(error);
        });
}

function readAuthenticationCookie(callback) {

    cookies
        .get({url: baseUrl, name: 'Authentication'}, (error, cookies) => {
            if (cookies[0] !== undefined) {
                let token = cookies[0].value;
                callback(error, token);
            } else {
                let output = document.getElementById('output');
                if (output !== null) {
                    output.innerText = "No valid token could be found!";
                }
            }
        });
}

function deleteAuthenticationCookie() {

    cookies
        .remove(baseUrl, 'Authentication', () => {
        });
}

function obtainAuthenticationToken(loginForm) {

    request
        .post({
            url: '/authentication/obtain-token', form: {username: 'funk', password: loginForm.password.value}
        }, (error, response, body) => {

            if (error) {
                document.getElementById('loginOutput').innerText =
                    "Oisann, noe gikk galt! Vennligst sjekk om maskinen har internettilkobling.";

            } else if (response.statusCode === 200) {
                const token = JSON.parse(body).token;

                writeAuthenticationCookie(token, (error) => {
                    if (error) {
                        console.error(error);
                        document.getElementById('loginOutput').innerText = error.message;
                    } else {
                        currentWindow.loadFile('./api/api.html');
                    }
                })

            } else {
                document.getElementById('loginOutput').innerText =
                    "Sorry! Du må være funksjonær for å kunne åpne Soci.";
            }
            document.getElementById('loginSubmit').disabled = false;
        });

    return false;
}

function verifyAuthenticationToken() {

    readAuthenticationCookie((error, token) => {
        if (error) {
            console.error(error);
            document.getElementById('output').innerText = error.message;
        }
        request
            .post({url: '/authentication/verify-token', form: {token: token}}, (error, response) => {

                if (error) {
                    document.getElementById('output').innerText =
                        "Connection error. Please check your internet connection";

                } else if (response.statusCode === 200) {
                    document.getElementById('output').innerText = "Token is still valid!";

                } else {
                    document.getElementById('output').innerText = "Token has expired!";
                }
            })
    })
}

function refreshAuthenticationToken(token) {

    readAuthenticationCookie((error, token) => {
        if (error) {
            console.error(error);
            document.getElementById('output').innerText = error.message;
        }
        request
            .post({url: '/authentication/refresh-token', form: {token: token}}, (error, response, body) => {

                if (error) {
                    document.getElementById('output').innerText =
                        "Connection error. Please check your internet connection";

                } else if (response.statusCode === 200) {
                    let token = JSON.parse(body).token;

                    writeAuthenticationCookie(token, (error) => {
                        if (error) {
                            console.error(error);
                            document.getElementById('output').innerText = error.message;
                        } else {

                            readAuthenticationCookie((error, token) => {
                                if (error) {
                                    console.error(error);
                                    document.getElementById('output').innerText = error.message;
                                } else {
                                    document.getElementById('output').innerHTML =
                                        "Token refreshed successfully!"
                                        + "<br><br>"
                                        + "Your new token is: "
                                        + "<br>"
                                        + token;
                                }
                            })
                        }
                    })

                } else {
                    document.getElementById('output').innerText = "Token has expired!";
                }
            })
    })
}

function invalidateToken() {
    deleteAuthenticationCookie();
    document.getElementById('output').innerHTML =
        "Token was successfully deleted!"
        + "<br><br>"
        + "Redirecting back to login page...";

    document.getElementById('showToken').disabled = true;
    document.getElementById('verifyToken').disabled = true;
    document.getElementById('refreshToken').disabled = true;
    document.getElementById('invalidateToken').disabled = true;

    window.setTimeout(() => {
        currentWindow.loadFile('./api/index.html');
    }, 3000);
}

function getSociProducts() {
    request
        .get({
            url: '/economy/products',
            auth: auth,
            // headers: {Authorization: 'JWT TOKEN_HERE'}
        }, (error, response, body) => {
            if (error) {
                console.log(error);
            } else if (response.statusCode === 200) {
                const products = JSON.parse(body);

                products.forEach((product) => {
                    fs.readFile(path.join(__dirname, '../assets/templates/productCardTemplate.hbs'), (error, data) => {
                        const template = handlebars.compile(data.toString());
                        document.getElementById('productList').innerHTML += template({product: product});
                    })
                })
            }
        });
}

function getBalance() {
    request
        .get({
            url: '/economy/bank-accounts/balance',
            auth: auth,
            qs: {card_uuid: sessionStorage.getItem('cardNumber')}
        }, (error, response, body) => {
            if (error) {
                console.log(error);
            }
            else if (response.statusCode === 402) {
                showMessage("Du er svart.\nFyll på kontoen eller kjøp bong.");
            }
            else if (response.statusCode === 404) {
                showMessage("Fant ikke kortnummeret. Har du lagt inn riktig?");
            }
            else if (response.statusCode === 200) {
                sessionStorage.setItem('bankAccount', body.toString());
                completeLogin();
            }
        });
}
