function increaseCount(gridItem, event) {

    let badge = gridItem.parentElement.getElementsByTagName('span')[0];

    let originalCount = parseInt(badge.innerText);

    const productPrice = parseInt(gridItem.getElementsByClassName('card-subtitle')[0].innerText);
    let currentTotal = parseInt(
        document.getElementById('totalPrice').innerText.replace(/\s/g, ''));

    if (!isNaN(originalCount)) {
        if (event.which === 1) { // Left click
            originalCount += 1;
            currentTotal += productPrice
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

    badge.innerText = originalCount;
    document.getElementById('totalPrice').innerText = currentTotal.toLocaleString() + " kr";
}
