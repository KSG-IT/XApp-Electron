const errorRed = 'rgb(255, 59, 48)';

let textResetFunction;
let applicationMenu = require('electron').remote.Menu.getApplicationMenu();

// TODO: Replace this with the card reader
require('electron').ipcRenderer.on('login', (event, message) => {
    sessionStorage.setItem('cardNumber', "1234567890");
    getBalance();
});

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
    let textField = document.getElementById('personName');
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

        let personName = document.getElementById('personName');
        personName.style.color = balance < 200 ? 'yellow' : 'white';
        personName.innerText = bankAccount['user'];
        clearTimeout(textResetFunction);

        applicationMenu.getMenuItemById('scan').enabled = false;
        applicationMenu.getMenuItemById('cancel').enabled = true;
        document.getElementById('cancelButton').disabled = false;
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
    document.getElementById('totalPrice').innerText = "0 kr";
    sessionStorage.clear();

    let overlay = document.getElementById('productListOverlay');
    overlay.style.opacity = ".33";
    overlay.style.pointerEvents = 'none';
    let textField = document.getElementById('totalPriceTitle');
    textField.style.color = 'white';
    textField.innerText = "Totalsum";
    document.getElementById('totalPrice').hidden = false;

    applicationMenu.getMenuItemById('scan').enabled = true;
    applicationMenu.getMenuItemById('cancel').enabled = false;
    applicationMenu.getMenuItemById('kryss').enabled = false;
    document.getElementById('kryssButton').disabled = true;
    document.getElementById('cancelButton').disabled = true;
}

function updateProductCount(gridItem, event) {
    /**
     *  This function updates the count for the provided product grid item,
     *  and displays it as a badge on the item.
     */
    const productPrice = parseInt(gridItem.getElementsByClassName('card-subtitle')[0].innerText);

    let badge = gridItem.parentElement.getElementsByTagName('span')[0];
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
        const skuNumber = gridItem.parentElement.getElementsByClassName('sku-number')[0].innerText;
        buildProductOrder(skuNumber, count);
    }

    checkIfTotalExceedsBalance(currentTotal);
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

        document.getElementById('totalPrice').hidden = true;
        document.getElementById('kryssButton').disabled = true;
        applicationMenu.getMenuItemById('kryss').enabled = false;
    } else {
        let textField = document.getElementById('totalPriceTitle');
        textField.style.color = 'white';
        textField.innerText = "Totalsum";

        document.getElementById('totalPrice').hidden = false;
        document.getElementById('kryssButton').disabled = currentTotal === 0;
        applicationMenu.getMenuItemById('kryss').enabled = !(currentTotal === 0);
    }
}

function buildProductOrder(skuNumber, count) {
    /**
     *  Store product orders as objects in a JSON array.
     *  This array can be sent to the KSG API in order to create a charge.
     */
    let productOrdersArray = JSON.parse(sessionStorage.getItem('productOrders')) || [];
    const index = productOrdersArray.findIndex((order) => order.sku === skuNumber);
    if (index === -1 && count > 0) {
        productOrdersArray.push({sku: skuNumber, order_size: count});
    } else if (count === 0) {
        delete productOrdersArray[index];
        productOrdersArray = productOrdersArray.filter(Object);
    } else {
        productOrdersArray[index].order_size = count;
    }
    sessionStorage.setItem('productOrders', JSON.stringify(productOrdersArray));
}
