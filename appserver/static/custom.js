require(['jquery', 'splunkjs/mvc'], function($, mvc) {
    $(document).ready(function() {

        // Injecte le CSS
        $('<link>', {
            rel: 'stylesheet',
            href: '/static/app/my_app/custom.css'
        }).appendTo('head');

        // Injecte vos boutons dans le DOM de la page Search
        var toolbar = $(
            '<div id="custom-toolbar">' +
                '<button id="btn-errors">🔴 Erreurs</button>' +
                '<button id="btn-warn">⚠️ Warnings</button>' +
            '</div>'
        );

        $('.search-bar-wrapper').before(toolbar);

        $('#btn-errors').on('click', function() {
            var base = window.location.pathname;
            window.location.href = base + '?q=' + encodeURIComponent('index=main level=ERROR | stats count by host');
        });
    });
});