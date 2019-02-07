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
        .post('/authentication/obtain-token')
        .form({
            'username': 'admin',
            'password': '123456',
        })
        .on('response', (response) => {
            response.on('data', (data) => {
                let parsed_data = JSON.parse(data);

                writeAuthenticationCookie(parsed_data.token, (error) => {
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
                                    "Token obtained successfully!" + "<br><br>" + "Your token is: " + '<br>' + token;
                            }
                        });
                    }
                })
            })
        })
}

function verifyAuthenticationToken() {

    readAuthenticationCookie((error, token) => {
        if (error) {
            console.error(error);
            document.getElementById('output').innerHTML = error.message;
        }
        request
            .post('/authentication/verify-token')
            .form({
                'token': token,
            })
            .on('response', (response) => {
                if (response.statusCode === 200) {
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
            .post('/authentication/refresh-token')
            .form({
                'token': token,
            })
            .on('response', (response) => {
                response.on('data', (data) => {
                    let parsed_data = JSON.parse(data);

                    writeAuthenticationCookie(parsed_data.token, (error) => {
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
                                        + "<br>" + "Your new token is: "
                                        + "<br>" + token;
                                }
                            });
                        }
                    })

                })
            })
    })
}

function invalidateToken() {
    deleteAuthenticationCookie();
    document.getElementById('output').innerHTML = "Token was successfully deleted!";
}