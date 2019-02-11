const baseUrl = 'https://ksg.tormodhaugland.com/api/';
const request = require('request').defaults({baseUrl: baseUrl});
const remote = require('electron').remote;

const currentWindow = remote.getCurrentWindow();
const cookies = remote.session.defaultSession.cookies;

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

    const password = loginForm.password.value;

    if (password.length === 0) {
        document.getElementById('loginOutput').innerText = "You need to supply a password";

    } else {
        request
            .post({
                url: '/authentication/obtain-token', form: {username: 'funk', password: password}
            }, (error, response, body) => {

                if (error) {
                    document.getElementById('loginOutput').innerText =
                        "Connection error. Please check your internet connection";

                } else if (response.statusCode === 200) {
                    const token = JSON.parse(body).token;

                    writeAuthenticationCookie(token, (error) => {
                        if (error) {
                            console.error(error);
                            document.getElementById('loginOutput').innerText = error.message;
                        } else {
                            document.getElementById('loginOutput').innerText =
                                "Login successful! Redirecting...";
                            window.setTimeout(() => {
                                currentWindow.loadFile('./api/api.html');
                            }, 1000);
                        }
                    })

                } else {
                    document.getElementById('loginOutput').innerText =
                        "You need to be a funksjonær in order to log in";
                }
            });
    }

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
    document.getElementById('output').innerText = "Token was successfully deleted!";
}
