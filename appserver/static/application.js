require(['jquery'], function($) {

    // Vérifie qu'on est bien sur la vue "search"
    if (Splunk.util.getCurrentView() === 'search') {

        // Charge dynamiquement votre script custom
        require(['/static/app/Timeline-Explorer/custom.js']);
    }
});