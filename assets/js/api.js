const fs = require("fs");
const path = require("path");

const baseUrl = "https://ksg-nett.no/api/";
// const baseUrl = "http://localhost:8000/api/";

const requestPromise = require("request-promise-native").defaults({
  baseUrl: baseUrl,
  json: true,
});
const remote = require("electron").remote;

const currentWindow = remote.getCurrentWindow();
const cookies = remote.session.defaultSession.cookies;

const handlebars = require("handlebars");

function writeAuthenticationCookie(token, callback) {
  cookies.set(
    { url: baseUrl, name: "Authentication", value: token },
    (error) => {
      console.error(error);
      callback(error);
    }
  );
}

function readAuthenticationCookie(callback) {
  cookies.get({ url: baseUrl, name: "Authentication" }, (error, cookies) => {
    if (cookies[0] !== undefined) {
      let token = cookies[0].value;
      callback(error, token);
    } else {
      let output = document.getElementById("output");
      if (output !== null) {
        output.innerText = "No valid token could be found!";
      }
    }
  });
}

function deleteAuthenticationCookie() {
  cookies.remove(baseUrl, "Authentication", () => {});
  console.log("HI");
}

function obtainAuthenticationToken(loginForm) {
  console.log(loginForm.cardNumber.value);
  requestPromise({
    method: "POST",
    url: "/authentication/obtain-token",
    body: { card_uuid: loginForm.cardNumber.value },
  })
    .then((body) => {
      console.log(body);
      writeAuthenticationCookie(body.token, (error) => {
        console.log(error);

        if (error) {
          console.error(error);
          document.getElementById("loginOutput").innerText = error.message;
        } else {
          // We need the card number for other API calls later on.
          sessionStorage.setItem("cardNumber", loginForm.cardNumber.value);
          currentWindow.loadFile("./x_view/productView.html");
          getBalance();
        }
      });
    })
    .catch((error) => {
      console.log(error);
      if (error.statusCode === 401) {
        document.getElementById("loginOutput").innerText =
          "Sorry! Dette kortnummeret kan ikke brukes til å åpne Soci.";
      } else {
        document.getElementById("loginOutput").innerText =
          "Oisann, noe gikk galt! Vennligst sjekk om maskinen har internettilkobling.";
      }
      return false;
    });
}

function verifyAuthenticationToken() {
  readAuthenticationCookie((error, token) => {
    if (error) {
      console.error(error);
      document.getElementById("output").innerText = error.message;
    }
    requestPromise({
      method: "POST",
      url: "/authentication/verify-token",
      body: { token: token },
    })
      .then(() => {
        document.getElementById("output").innerText = "Token is still valid!";
      })
      .catch((error) => {
        if (error.statusCode === 401) {
          document.getElementById("output").innerText = "Token has expired!";
        } else {
          document.getElementById("output").innerText =
            "Connection error. Please check your internet connection";
        }
      });
  });
}

function refreshAuthenticationToken(token) {
  readAuthenticationCookie((error, token) => {
    if (error) {
      console.error(error);
      document.getElementById("output").innerText = error.message;
    }

    requestPromise({
      method: "POST",
      url: "/authentication/refresh-token",
      body: { token: token },
    })
      .then((body) => {
        writeAuthenticationCookie(body.token, (error) => {
          if (error) {
            console.error(error);
            document.getElementById("output").innerText = error.message;
          } else {
            readAuthenticationCookie((error, token) => {
              if (error) {
                console.error(error);
                document.getElementById("output").innerText = error.message;
              } else {
                document.getElementById("output").innerHTML =
                  "Token refreshed successfully!" +
                  "<br><br>" +
                  "Your new token is: " +
                  "<br>" +
                  token;
              }
            });
          }
        });
      })
      .catch((error) => {
        if (error.statusCode === 401) {
          document.getElementById("output").innerText = "Token has expired!";
        } else {
          document.getElementById("output").innerText =
            "Connection error. Please check your internet connection";
        }
      });
  });
}

function invalidateToken() {
  console.log("sup");
  deleteAuthenticationCookie();

  // Can probably be done a bit smoother
  document.getElementById("productList").innerHTML =
    "Token was successfully deleted!" +
    "<br><br>" +
    "Redirecting back to login page...";

  // document.getElementById("showToken").disabled = true;
  // document.getElementById("verifyToken").disabled = true;
  // document.getElementById("refreshToken").disabled = true;
  // document.getElementById("invalidateToken").disabled = true;
  
  console.log("sup 2");

  window.setTimeout(() => {
    currentWindow.loadFile("./index.html");
  }, 2000);
}

function getSociProducts() {
  localStorage.clear();
  readAuthenticationCookie((error, token) => {
    requestPromise({
      method: "GET",
      url: "/economy/products",
      headers: { Authorization: "JWT " + token },
    })
      .then((products) => {
        const template = handlebars.compile(
          fs
            .readFileSync(
              path.join(
                __dirname,
                "../assets/templates/productCardTemplate.hbs"
              )
            )
            .toString()
        );

        let lowestPrice = Infinity;
        products.forEach((product) => {
          if (product.sku_number === "X-BELOP") product.price = "_____";
          document.getElementById("productList").innerHTML += template({
            product: product,
          });
          if (typeof product.price == "number" && product.price < lowestPrice)
            lowestPrice = product.price;
        });
        localStorage.setItem("lowestPrice", lowestPrice.toString());
        setTimeout(() => {
          document.getElementById("spinner").style.display = "none";
          document.getElementById("personName").style.display = "block";
        }, 100);
      })
      .catch((error) => {
        console.log(error);
      });
  });
}

function getBalance() {
  // Start spinner
  document.getElementById("spinner").style.display = "block";
  document.getElementById("personName").style.display = "none";

  readAuthenticationCookie((error, token) => {
    requestPromise({
      method: "GET",
      url: "/economy/bank-accounts/balance",
      headers: { Authorization: "JWT " + token },
      qs: { card_uuid: sessionStorage.getItem("cardNumber") },
      json: false,
    })
      .then((account) => {
        sessionStorage.setItem("bankAccount", account);
        completeLogin();
      })
      .catch((error) => {
        if (error.statusCode === 404) {
          showMessage("Fant ikke kortnummeret. Har du lagt inn riktig?");
        } else {
          console.log(error);
        }
      });
  });
}

function chargeBankAccount() {
  // Disable buttons to prevent multiple API requests
  applicationMenu.getMenuItemById("kryss").enabled = false;
  document.getElementById("kryssButton").disabled = true;
  applicationMenu.getMenuItemById("cancel").enabled = false;
  document.getElementById("cancelButton").disabled = true;

  // Start spinner
  document.getElementById("spinner").style.display = "block";
  document.getElementById("personName").style.display = "none";

  const bankAccount = JSON.parse(sessionStorage.getItem("bankAccount"));
  const request_data = JSON.parse(sessionStorage.getItem("productOrders"));

  const formData = {
    bank_account_id: bankAccount.id,
    api_key: "LIAUHSDILAUHSDLIUHWLIU",
    products: request_data,
  };

  readAuthenticationCookie((error, token) => {
    requestPromise({
      method: "POST",
      url: "/economy/charge",
      headers: { Authorization: "JWT " + token },
      body: formData,
    })
      .then((body) => {
        confirmKryss();
      })
      .catch((error) => {
        if (error.statusCode === 400) {
          // This shouldn't happen since we control the request
          console.log(error);
        } else if (error.statusCode === 402) {
          showMessage(
            "Kryssingen ble avbrutt: Du har ikke råd til alt dette.",
            errorRed,
            4000
          );
        } else if (error.statusCode === 404) {
          // This shouldn't happen since we control the request
          console.log(error);
        } else if (error.statusCode === 424) {
          showMessage(
            "Kryssingen ble avbrutt: Det er ingen aktiv økt.",
            errorRed,
            4000
          );
        } else {
          console.log(error);
        }
      })
      .finally(() => {
        // Enable buttons
        applicationMenu.getMenuItemById("kryss").enabled = true;
        document.getElementById("kryssButton").disabled = false;
        applicationMenu.getMenuItemById("cancel").enabled = true;
        document.getElementById("cancelButton").disabled = false;

        // Stop spinner
        document.getElementById("spinner").style.display = "none";
      });
  });
}
