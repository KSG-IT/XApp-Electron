function clickHandler() {
    let input = document.getElementById('ksg-logo');

    input.animate([
        {transform: 'translate(-150px,-150px)'},
        {transform: 'translate(-140px,-140px)'}
    ], {
        duration: 40,
        iterations: 1
    });
}