const errorRed = 'rgb(255, 59, 48)';
const backgroundBlack = 'rgb(29,30,31)';

let textResetFunction;
let applicationMenu = require('electron').remote.Menu.getApplicationMenu();

require('electron').ipcRenderer.on('cancel', (event, message) => {
    cancelKryss();
});

require('electron').ipcRenderer.on('kryss', (event, message) => {
    chargeBankAccount()
});

function showMessage(msg, color = 'cyan', timeout = 3000) {
    /**
     *  Use this function whenever the user performs a finishing action.
     *  The state will be reset, and a message will be shown for the timeout duration on the screen.
     */
    document.getElementById('spinner').style.display = 'none';
    let textField = document.getElementById('personName');
    textField.style.display = 'block';
    textResetFunction = setTimeout(() => {
        textField.style.color = 'white';
        textField.innerText = "Les kort...";
    }, timeout);
    textField.style.color = color;
    textField.innerText = msg;
    clearScreen();
}

function confirmKryss() {
    showMessage("Kryssing utført!");
}

function cancelKryss() {
    showMessage("Kryssing avbrutt!", errorRed);
}

function completeLogin() {
    /***
     *  This function should be called when the card scan has completed successfully
     *  and a bank account information for the user has been retrieved from the API.
     */
    const bankAccount = JSON.parse(sessionStorage.getItem('bankAccount'));
    const balance = bankAccount['balance'];

    if (balance < parseInt(localStorage.getItem('lowestPrice'))) {
        showMessage("Du er enten svart, eller har ikke råd til noe på listen", errorRed, 4000);
    } else {
        let overlay = document.getElementById('productListOverlay');
        overlay.style.opacity = "1";
        overlay.style.pointerEvents = 'all';

        document.getElementById('spinner').style.display = 'none';
        let personName = document.getElementById('personName');
        personName.style.display = 'block';
        personName.style.color = balance < 200 ? 'yellow' : 'white';
        personName.innerText = bankAccount['user'];
        clearTimeout(textResetFunction);

        applicationMenu.getMenuItemById('cancel').enabled = true;
        document.getElementById('cancelButton').disabled = false;

        [].forEach.call(document.getElementsByClassName('sku-number'), (skuElement) => {
            if (skuElement.innerText === 'X-BELOP') {
                let card = skuElement.parentElement.parentElement;
                card.getElementsByClassName('card-subtitle')[0].innerText = "_____ kr";
                card.style.pointerEvents = 'all';
            }
        });
    }
}

function clearScreen() {
    /**
     *  This function resets all user state, and returns the
     */
    [].forEach.call(document.getElementsByClassName('badge'), (badge) => {
        badge.innerText = "0";
        badge.style.visibility = "hidden";
    });
    let total = document.getElementById('totalPrice');
    total.style.color = 'white';
    total.innerText = "0 kr";
    sessionStorage.clear();

    [].forEach.call(document.getElementsByClassName('sku-number'), (skuElement) => {
        if (skuElement.innerText === 'X-BELOP') {
            let card = skuElement.parentElement.parentElement;
            card.getElementsByClassName('card-subtitle')[0].innerText = "_____ kr";
            hideNumberInput(card);
        }
    });

    let overlay = document.getElementById('productListOverlay');
    overlay.style.opacity = ".33";
    overlay.style.pointerEvents = 'none';
    let textField = document.getElementById('totalPriceTitle');
    textField.style.color = 'white';
    textField.innerText = "Totalsum";
    document.getElementById('totalPrice').hidden = false;

    applicationMenu.getMenuItemById('cancel').enabled = false;
    applicationMenu.getMenuItemById('kryss').enabled = false;
    document.getElementById('kryssButton').disabled = true;
    document.getElementById('cancelButton').disabled = true;
    document.getElementById("productViewCardNumberInput").value = "";
}

function updateProductCount(card, event) {
    /**
     *  This function updates the count for the provided product card,
     *  and displays it as a badge on the item.
     */
    const skuNumber = card.getElementsByClassName('sku-number')[0].innerText;

    if (skuNumber === 'X-BELOP') {
        if (event.which === 1) { // Left click
            showNumberInput(card);
        } else {
            cancelInput(card.getElementsByClassName('btn-warning')[0]);
        }
        return;
    }

    const productPrice = parseInt(card.getElementsByClassName('card-subtitle')[0].innerText);

    let badge = card.getElementsByTagName('span')[0];
    let count = parseInt(badge.innerText) || 0;
    let currentTotal = parseInt(document.getElementById('totalPrice').innerText.replace(/\s/g, ''));

    if (event.which === 1) { // Left click
        count += 1;
        currentTotal += productPrice;
        badge.style.visibility = "visible";
    } else if (count > 0) {
        count -= 1;
        currentTotal -= productPrice;
        if (count === 0) {
            badge.style.visibility = "hidden";
        }
    }

    badge.innerText = count.toString();
    document.getElementById('totalPrice').innerText = currentTotal.toLocaleString() + " kr";

    if (count >= 0) {
        buildProductOrder(skuNumber, count);
    }

    checkIfTotalExceedsBalance(currentTotal);

    hideNumberInput(card);
}

function checkIfTotalExceedsBalance(currentTotal) {
    /**
     *  Show a user error if the current amount exceeds the user's balance.
     *  The error will be removed once the current amount falls below the balance again.
     */
    const bankAccount = JSON.parse(sessionStorage.getItem('bankAccount'));
    if (currentTotal > bankAccount['balance']) {
        let textField = document.getElementById('totalPriceTitle');
        textField.style.color = errorRed;
        textField.innerText = "- " + (currentTotal - bankAccount['balance']).toString() + " kr";

        document.getElementById('totalPrice').style.color = backgroundBlack;
        document.getElementById('kryssButton').disabled = true;
        applicationMenu.getMenuItemById('kryss').enabled = false;
    } else {
        let textField = document.getElementById('totalPriceTitle');
        textField.style.color = 'white';
        textField.innerText = "Totalsum";

        document.getElementById('totalPrice').style.color = 'white';

        if (!amountInputIsActive()) {
            document.getElementById('kryssButton').disabled = currentTotal === 0;
            applicationMenu.getMenuItemById('kryss').enabled = !(currentTotal === 0);
        }
    }
}

function buildProductOrder(skuNumber, count, directChargeAmount = null) {
    /**
     *  Store product orders as objects in a JSON array.
     *  This array can be sent to the KSG API in order to create a charge.
     */
    let productOrdersArray = JSON.parse(sessionStorage.getItem('productOrders')) || [];
    const index = productOrdersArray.findIndex((order) => order.sku === skuNumber);
    if (index === -1 && count > 0) {
        let data = {sku: skuNumber, order_size: count};
        if (directChargeAmount != null) {
            data['order_size'] = directChargeAmount;
        }
        productOrdersArray.push(data);
    } else if (count === 0) {
        delete productOrdersArray[index];
        productOrdersArray = productOrdersArray.filter(Object);
    } else if (productOrdersArray[index].direct_charge_amount !== undefined && directChargeAmount != null) {
        productOrdersArray[index].direct_charge_amount = directChargeAmount;
    } else {
        productOrdersArray[index].order_size = count;
    }
    sessionStorage.setItem('productOrders', JSON.stringify(productOrdersArray));
}

function showNumberInput(card) {
    card.style.pointerEvents = 'none';
    card.style.boxShadow = 'none';
    card.onmousedown = 'none';

    card.getElementsByClassName('productInfo')[0].style.display = 'none';

    let inputTool = card.getElementsByClassName('amountInputTool')[0];
    inputTool.style.display = 'block';
    inputTool.style.pointerEvents = 'auto';

    if (isNaN(parseInt(card.getElementsByClassName('card-subtitle')[0].innerText))) {
        card.getElementsByClassName('card-subtitle')[0].innerText = "0 kr";
    }

    applicationMenu.getMenuItemById('kryss').enabled = false;
    document.getElementById('kryssButton').disabled = true;
}

function hideNumberInput(card) {
    card.style.pointerEvents = null;
    card.style.boxShadow = null;
    card.onmousedown = function () {
        updateProductCount(this, event)
    };

    card.getElementsByClassName('productInfo')[0].style.display = 'block';
    card.getElementsByClassName('amountInputTool')[0].style.display = 'none';

    const currentTotal = parseInt(document.getElementById('totalPrice').innerText.replace(/\s/g, ''));
    if (currentTotal > 0 && !amountInputIsActive()) {
        applicationMenu.getMenuItemById('kryss').enabled = true;
        document.getElementById('kryssButton').disabled = false;
    } else {
        applicationMenu.getMenuItemById('kryss').enabled = false;
        document.getElementById('kryssButton').disabled = true;
    }
}

function inputNumber(button) {
    let card = button.parentElement.parentElement.parentElement.parentElement;

    let totalDirectAmount = card.getElementsByClassName('card-subtitle')[0];

    let oldValue = parseInt(totalDirectAmount.innerText) || 0;

    const buttonValue = parseInt(button.innerText);

    let currentTotal = parseInt(document.getElementById('totalPrice').innerText.replace(/\s/g, ''));

    if (event.which === 1) { // Left click
        totalDirectAmount.innerText = oldValue + buttonValue + " kr";
        currentTotal += buttonValue;
    } else if (oldValue >= buttonValue) {
        totalDirectAmount.innerText = oldValue - buttonValue + " kr";
        currentTotal -= buttonValue;
    }

    document.getElementById('totalPrice').innerText = currentTotal.toLocaleString() + " kr";

    if (parseInt(totalDirectAmount.innerText) > 0) {
        card.getElementsByClassName('btn-primary')[0].disabled = false;
    } else {
        card.getElementsByClassName('btn-primary')[0].disabled = true;
    }

    checkIfTotalExceedsBalance(currentTotal);
}

function cancelInput(button) {

    let card = button.parentElement.parentElement.parentElement.parentElement.parentElement;

    const currentDirectAmount = parseInt(card.getElementsByClassName('card-subtitle')[0].innerText);

    if (!isNaN(currentDirectAmount)) {
        let currentTotal = parseInt(document.getElementById('totalPrice').innerText.replace(/\s/g, ''));
        currentTotal -= currentDirectAmount;
        document.getElementById('totalPrice').innerText = currentTotal.toLocaleString() + " kr";
    }

    card.getElementsByClassName('card-subtitle')[0].innerText = "_____ kr";

    const skuNumber = card.getElementsByClassName('sku-number')[0].innerText;
    buildProductOrder(skuNumber, 0);

    card.getElementsByClassName('btn-primary')[0].disabled = true;

    card.getElementsByTagName('span')[0].innerText = "";
    card.getElementsByTagName('span')[0].style.visibility = 'hidden';

    hideNumberInput(card);

    let currentTotal = parseInt(document.getElementById('totalPrice').innerText.replace(/\s/g, ''));
    checkIfTotalExceedsBalance(currentTotal);
}


function confirmInput(button) {
    let card = button.parentElement.parentElement.parentElement.parentElement.parentElement;

    const newDirectAmount = parseInt(card.getElementsByClassName('card-subtitle')[0].innerText);

    let badge = card.getElementsByTagName('span')[0];

    const skuNumber = card.getElementsByClassName('sku-number')[0].innerText;

    if (newDirectAmount > 0) {
        badge.innerText = "Aktiv";
        badge.style.visibility = "visible";

        buildProductOrder(skuNumber, 1, newDirectAmount);

    } else {
        card.getElementsByClassName('card-subtitle')[0].innerText = "_____ kr";
    }

    hideNumberInput(card);

    let currentTotal = parseInt(document.getElementById('totalPrice').innerText.replace(/\s/g, ''));
    checkIfTotalExceedsBalance(currentTotal);
}

function amountInputIsActive() {
    let is_active = false;

    [].forEach.call(document.getElementsByClassName('sku-number'), (skuElement) => {
        if (skuElement.innerText === 'X-BELOP') {
            let card = skuElement.parentElement.parentElement;
            is_active = (card.getElementsByClassName('amountInputTool')[0].style.display !== 'none')
        }
    });

    return is_active;
}
