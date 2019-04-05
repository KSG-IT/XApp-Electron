let textResetFunction;
let applicationMenu = require('electron').remote.Menu.getApplicationMenu();

// TODO: Replace this with the card reader
require('electron').ipcRenderer.on('login', (event, message) => {
    sessionStorage.setItem('cardNumber', "1234567890");
    getBalance();
});

require('electron').ipcRenderer.on('cancel', (event, message) => {
    document.getElementById('kryssButton').disabled = true;
    document.getElementById('cancelButton').disabled = true;
    showMessage("Kryssing kansellert!");
    sessionStorage.removeItem('cardNumber');
});

function increaseCount(gridItem, event) {

    let badge = gridItem.parentElement.getElementsByTagName('span')[0];

    let originalCount = parseInt(badge.innerText);

    const productPrice = parseInt(gridItem.getElementsByClassName('card-subtitle')[0].innerText);
    let currentTotal = parseInt(
        document.getElementById('totalPrice').innerText.replace(/\s/g, ''));

    if (!isNaN(originalCount)) {
        if (event.which === 1) { // Left click
            originalCount += 1;
            currentTotal += productPrice;
        } else {
            originalCount -= 1;
            currentTotal -= productPrice;
            if (originalCount < 1) {
                badge.style.visibility = "hidden";
            }
        }
    } else if (event.which === 1) {
        originalCount = 1;
        currentTotal += productPrice;
        badge.style.visibility = "visible";
    }

    badge.innerText = originalCount.toString();
    document.getElementById('totalPrice').innerText = currentTotal.toLocaleString() + " kr";
    document.getElementById('kryssButton').disabled = currentTotal === 0;
    document.getElementById('cancelButton').disabled = currentTotal === 0;

    if (originalCount >= 0) {
        let skuNumber = gridItem.parentElement.getElementsByClassName('sku-number')[0].innerText;
        if (originalCount === 0) {
            sessionStorage.removeItem(skuNumber);
        } else {
            sessionStorage.setItem(skuNumber, originalCount.toString());
        }
    }
}

function confirmKryss(button) {
    button.disabled = true;
    document.getElementById('cancelButton').disabled = true;
    showMessage("Kryssing utført!");
    sessionStorage.removeItem('cardNumber');
}

function cancelKryss(button) {
    document.getElementById('kryssButton').disabled = true;
    button.disabled = true;
    showMessage("Kryssing kansellert!");
    sessionStorage.removeItem('cardNumber');
}

function completeLogin() {
    const bankAccount = JSON.parse(sessionStorage.getItem('bankAccount'));
    const balance = bankAccount['balance'];

    if (balance < 15) {
        showMessage("Du er ikke svart, men har heller ikke råd til noe")
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
    }
}

function clearScreen() {
    [].forEach.call(document.getElementsByClassName('badge'), (badge) => {
        badge.innerText = "0";
        badge.style.visibility = "hidden";
    });
    document.getElementById('totalPrice').innerText = "0 kr";
    sessionStorage.clear();

    let overlay = document.getElementById('productListOverlay');
    overlay.style.opacity = ".33";
    overlay.style.pointerEvents = 'none';

    applicationMenu.getMenuItemById('scan').enabled = true;
    applicationMenu.getMenuItemById('cancel').enabled = false;
}

function showMessage(msg, timeout = 3000, color = 'cyan') {
    let textField = document.getElementById('personName');
    textResetFunction = setTimeout(() => {
        textField.style.color = 'white';
        textField.innerText = "Les kort...";
    }, timeout);
    textField.style.color = color;
    textField.innerText = msg;
    clearScreen();
}
