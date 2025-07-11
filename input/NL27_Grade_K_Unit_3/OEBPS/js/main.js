document.addEventListener("DOMContentLoaded", adjustMargin);
window.addEventListener("resize", adjustMargin);
window.addEventListener("load", adjustMargin);

function adjustMargin() {
    var html = document.documentElement;
    var body = document.body;
    var columnCountHtml = getComputedStyle(html).columnCount;
    var columnsHtml = getComputedStyle(html).columns;
    var columnWidthHtml = getComputedStyle(html).columnWidth;
    var columnCountBody = getComputedStyle(body).columnCount;
    var columnsBody = getComputedStyle(body).columns;
    var columnWidthBody = getComputedStyle(body).columnWidth;
    var isiBooks = false;
    if(navigator.userAgent.includes('Books')){
        isiBooks = true;
    }
    if (columnCountHtml.includes('2') || columnsHtml.includes('2') || columnCountBody.includes('2') || columnsBody.includes('2') || columnWidthHtml.includes('px') || columnWidthBody.includes('px') || isiBooks) {
        html.style.setProperty('--body-margin-left', '1rem');
        html.style.setProperty('--body-margin-right', '1rem');
        html.style.setProperty('--body-margin-top', '1rem');
        html.style.setProperty('--body-margin-bottom', '1rem');
        body.classList.add('twoPageViewMode');
    } else {
        body.classList.remove('twoPageViewMode');
        if(window.innerWidth < 1025 && window.innerWidth > 767){ 
            // Tablet
            html.style.setProperty('--body-margin-left', '4rem');
            html.style.setProperty('--body-margin-right', '4rem');
            html.style.setProperty('--body-margin-top', '2rem');
            html.style.setProperty('--body-margin-bottom', '2rem');
        } else if(window.innerWidth <= 767){
            // Mobile
            html.style.setProperty('--body-margin-left', '2rem');
            html.style.setProperty('--body-margin-right', '2rem');
            html.style.setProperty('--body-margin-top', '2rem');
            html.style.setProperty('--body-margin-bottom', '2rem');
        } else {
            // Desktop
            html.style.setProperty('--body-margin-left', '6rem');
            html.style.setProperty('--body-margin-right', '6rem');
            html.style.setProperty('--body-margin-top', '2.5rem');
            html.style.setProperty('--body-margin-bottom', '2.5rem');
        }
    }
}