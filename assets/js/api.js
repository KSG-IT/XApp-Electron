// Page side of the REST calls. window.xapp comes from preload.js. The calls
// run in the main process (apiClient.js), which also keeps the token.

function obtainAuthenticationToken(loginForm) {
  window.xapp.obtainToken(loginForm.cardNumber.value).then((response) => {
    if (response.ok) {
      // index.html has cleared the field by now, so this stores "". The
      // product screen then reads the next card as the buyer. Storing the
      // opener's card number here would make it ignore that first scan.
      sessionStorage.setItem("cardNumber", loginForm.cardNumber.value);
      window.location.href = "x_view/productView.html";
    } else if (response.status === 401) {
      document.getElementById("loginOutput").innerText =
        "Sorry! Dette kortnummeret kan ikke brukes til å åpne Soci.";
    } else {
      console.log(response);
      document.getElementById("loginOutput").innerText =
        "Oisann, noe gikk galt! Vennligst sjekk om maskinen har internettilkobling.";
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function productCard(product) {
  const p = Object.fromEntries(
    ["sku_number", "icon", "price", "name", "description"].map((key) => [
      key,
      escapeHtml(product[key] ?? ""),
    ])
  );
  return `
<div class="grid-item card text-white bg-dark mb-3" onmousedown="updateProductCount(this, event)">
    <div class="productContent" style="display: block">
        <p class="sku-number" hidden>${p.sku_number}</p>
        <div class="card-header top-row">
            <div>${p.icon}</div>
            <span class="badge badge-pill badge-primary" style="font-size: 20px;">0</span>
            <div class="card-subtitle">${p.price} kr</div>
        </div>
        <div class="card-body">
            <div class="productInfo">
                <h4 class="card-title">${p.name}</h4>
                <p class="card-text">${p.description}</p>
            </div>
            <div class="amountInputTool">
                <div class="numpad">
                    <div class="btn btn-outline-light numpad-btn" onmousedown="inputNumber(this, event)">+5</div>
                    <div class="btn btn-outline-light numpad-btn" onmousedown="inputNumber(this, event)">+10</div>
                </div>
                <div class="numpad-controls">
                    <button class="btn btn-warning numpad-btn" onclick="cancelInput(this)" style="min-width: 80px">Slett</button>
                    <button class="btn btn-primary numpad-btn" onclick="confirmInput(this)" style="min-width: 80px" disabled>OK</button>
                </div>
            </div>
        </div>
    </div>
</div>`;
}

function getSociProducts() {
  localStorage.clear();
  window.xapp.getProducts().then((response) => {
    if (!response.ok) {
      console.log(response);
      return;
    }

    let lowestPrice = Infinity;
    response.data.forEach((product) => {
      if (product.sku_number === "X-BELOP") product.price = "_____";
      document.getElementById("productList").innerHTML += productCard(product);
      if (typeof product.price == "number" && product.price < lowestPrice)
        lowestPrice = product.price;
    });
    localStorage.setItem("lowestPrice", lowestPrice.toString());
    setTimeout(() => {
      document.getElementById("spinner").style.display = "none";
      document.getElementById("personName").style.display = "block";
    }, 100);
  });
}

function getBalance() {
  // Start spinner
  document.getElementById("spinner").style.display = "block";
  document.getElementById("personName").style.display = "none";

  window.xapp
    .getBalance(sessionStorage.getItem("cardNumber"))
    .then((response) => {
      if (response.ok) {
        sessionStorage.setItem("bankAccount", JSON.stringify(response.data));
        completeLogin();
      } else if (response.status === 404) {
        showMessage("Fant ikke kortnummeret. Har du lagt inn riktig?");
      } else {
        console.log(response);
      }
    });
}

function chargeBankAccount() {
  const request_data = JSON.parse(sessionStorage.getItem("productOrders"));

  if (!request_data) return;

  // Disable buttons to prevent multiple API requests
  setMenuItemEnabled("kryss", false);
  document.getElementById("kryssButton").disabled = true;
  setMenuItemEnabled("cancel", false);
  document.getElementById("cancelButton").disabled = true;

  // Start spinner
  document.getElementById("spinner").style.display = "block";
  document.getElementById("personName").style.display = "none";

  const bankAccount = JSON.parse(sessionStorage.getItem("bankAccount"));

  const formData = {
    bank_account_id: bankAccount.id,
    products: request_data,
  };

  window.xapp
    .charge(formData)
    .then((response) => {
      if (response.ok) {
        confirmKryss();
      } else if (response.status === 400) {
        // This shouldn't happen since we control the request
        console.log(response);
      } else if (response.status === 402) {
        showMessage(
          "Kryssingen ble avbrutt: Du har ikke råd til alt dette.",
          errorRed,
          4000
        );
      } else if (response.status === 404) {
        // This shouldn't happen since we control the request
      } else if (response.status === 424) {
        showMessage(
          "Kryssingen ble avbrutt: Det er ingen aktiv økt.",
          errorRed,
          4000
        );
      } else {
        console.log(response);
      }
    })
    .finally(() => {
      // Enable buttons
      setMenuItemEnabled("kryss", true);
      document.getElementById("kryssButton").disabled = true;
      setMenuItemEnabled("cancel", true);
      document.getElementById("cancelButton").disabled = true;

      // Stop spinner
      document.getElementById("spinner").style.display = "none";
    });
}

function terminateSesion() {
  window.xapp.terminateSession().then((response) => {
    if (!response.ok) {
      console.log(response);
      return;
    }
    document.getElementById("productList").innerHTML =
      "Token was successfully deleted!" +
      "<br><br>" +
      "Redirecting back to login page...";
    window.location.href = "../index.html";
  });
}
