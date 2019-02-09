const baseUrl = 'http://localhost:8000/api/';
const request = require('request').defaults({baseUrl: baseUrl});
const cookies = require('electron').remote.session.defaultSession.cookies;


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
                document.getElementById('output').innerHTML = "No valid token could be found!";
            }
        });
}


function deleteAuthenticationCookie() {

    cookies
        .remove(baseUrl, 'Authentication', () => {
        });
}


function obtainAuthenticationToken() {

    request
        .post({
            url: '/authentication/obtain-token', form: {username: 'gjengis', password: '123456',}
        }, (error, response, body) => {

            if (error) {
                document.getElementById('output').innerHTML =
                    "Connection error. Please check your internet connection";

            } else if (response.statusCode === 200) {
                const token = JSON.parse(body).token;

                writeAuthenticationCookie(token, (error) => {
                    if (error) {
                        console.error(error);
                        document.getElementById('output').innerHTML = error.message;
                    } else {

                        readAuthenticationCookie((error, token) => {
                            if (error) {
                                console.error(error);
                                document.getElementById('output').innerHTML = error.message;
                            } else {
                                document.getElementById('output').innerHTML =
                                    "Token obtained successfully!"
                                    + "<br><br>"
                                    + "Your token is: "
                                    + '<br>'
                                    + token;
                            }
                        })
                    }
                })

            } else {
                document.getElementById('output').innerHTML =
                    "You need to be a funksjonær in order to log in";
            }
        })
}

function verifyAuthenticationToken() {

    readAuthenticationCookie((error, token) => {
        if (error) {
            console.error(error);
            document.getElementById('output').innerHTML = error.message;
        }
        request
            .post({url: '/authentication/verify-token', form: {token: token}}, (error, response) => {

                if (error) {
                    document.getElementById('output').innerHTML =
                        "Connection error. Please check your internet connection";

                } else if (response.statusCode === 200) {
                    document.getElementById('output').innerHTML = "Token is still valid!";

                } else {
                    document.getElementById('output').innerHTML = "Token has expired!";
                }
            })
    })
}

function refreshAuthenticationToken(token) {

    readAuthenticationCookie((error, token) => {
        if (error) {
            console.error(error);
            document.getElementById('output').innerHTML = error.message;
        }
        request
            .post({url: '/authentication/refresh-token', form: {token: token}}, (error, response, body) => {

                if (error) {
                    document.getElementById('output').innerHTML =
                        "Connection error. Please check your internet connection";

                } else if (response.statusCode === 200) {
                    let token = JSON.parse(body).token;

                    writeAuthenticationCookie(token, (error) => {
                        if (error) {
                            console.error(error);
                            document.getElementById('output').innerHTML = error.message;
                        } else {

                            readAuthenticationCookie((error, token) => {
                                if (error) {
                                    console.error(error);
                                    document.getElementById('output').innerHTML = error.message;
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
                    document.getElementById('output').innerHTML = "Token has expired!";
                }
            })
    })
}

function invalidateToken() {
    deleteAuthenticationCookie();
    document.getElementById('output').innerHTML = "Token was successfully deleted!";
}