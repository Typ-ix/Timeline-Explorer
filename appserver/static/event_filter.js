require([
    'splunkjs/mvc/tableview',
    'splunkjs/mvc/eventsviewerview',
    'splunkjs/mvc/searchmanager',
    'splunkjs/mvc',
    'underscore',
    'jquery',
    'splunkjs/mvc/simplexml/ready!'
], function(
    TableView,
    EventsViewer,
    SearchManager,
    mvc,
    _,
    $
) {
    var tokens_submitted = mvc.Components.getInstance('submitted');
    var tokens_default   = mvc.Components.getInstance('default');

    var currentUser = Splunk.util.getConfigValue("USERNAME");
    tokens_default.set("current_user", currentUser);
    tokens_submitted.set("current_user", currentUser);

    var MITRE_TACTICS = [
        "Reconnaissance", "Resource Development", "Initial Access", "Execution",
        "Persistence", "Privilege Escalation", "Defense Evasion", "Credential Access",
        "Discovery", "Lateral Movement", "Collection", "Command and Control",
        "Exfiltration", "Impact"
    ];
    var STATUSES = ["Suspicious", "Under Investigation", "Malicious", "Benign", "False Positive"];

    var tacticOpts = '<option value="">-- Select --</option>';
    MITRE_TACTICS.forEach(function(t) { tacticOpts += '<option value="'+t+'">'+t+'</option>'; });
    var statusOpts = '<option value="">-- Select --</option>';
    STATUSES.forEach(function(s) { statusOpts += '<option value="'+s+'">'+s+'</option>'; });

    // =========================================================================
    // CSS — DTF (light theme) + Filter Manager rows + Profile Manager (dark modal)
    // =========================================================================
    $('<style id="dtf-styles">').text([
        /* ── Variables Splunk light ── */
        ':root{',
        '  --dtf-bg:#ffffff;',
        '  --dtf-surface:#f2f4f5;',
        '  --dtf-surface2:#eaedf0;',
        '  --dtf-border:#c3cbd4;',
        '  --dtf-text:#1a1c1e;',
        '  --dtf-dim:#5c656e;',
        '  --dtf-orange:#f98b00;',
        '  --dtf-orange-dk:#d97a00;',
        '  --dtf-orange-light:#fff3e0;',
        '  --dtf-green:#1a8929;',
        '  --dtf-green-dk:#286728;',
        '  --dtf-red:#ae1c1c;',
        '  --dtf-blue:#1a85c2;',
        '  --dtf-blue-dk:#1570a6;',
        '  --dtf-green-light:#e8f8ed',
        '}',

        /* ── Toolbar ── */
        '#dtf-toolbar{',
        '  display:flex;align-items:center;gap:8px;padding:10px 16px;flex-wrap:wrap;',
        '  background:var(--dtf-surface);border-bottom:1px solid var(--dtf-border);',
        '  margin-bottom:8px;',
        '}',

        /* ── Buttons ── */
        '#dtf-toolbar .dtf-btn{',
        '  display:inline-flex;align-items:center;gap:5px;padding:5px 12px;',
        '  border:none;border-radius:3px;font-size:13px;font-weight:500;',
        '  cursor:pointer;white-space:nowrap;transition:background .15s,color .15s;',
        '  font-family:inherit;',
        '}',
        '#dtf-toolbar .dtf-btn-outline{',
        '  background:#fff;border:1px solid var(--dtf-border);color:var(--dtf-text);',
        '}',
        '#dtf-toolbar .dtf-btn-outline:hover{background:var(--dtf-surface2);}',
        '#dtf-toolbar .dtf-btn-primary{background:var(--dtf-green);color:#fff;}',
        '#dtf-toolbar .dtf-btn-primary:hover{background:var(--dtf-green-dk);}',
        '#dtf-toolbar .dtf-btn-save{',
        '  background:#fff;border:1px solid var(--dtf-green);color:var(--dtf-green);',
        '}',
        '#dtf-toolbar .dtf-btn-save:hover{background:var(--dtf-surface2);}',
        '#dtf-toolbar .dtf-btn-save:disabled{border-color:var(--dtf-border);color:var(--dtf-dim);cursor:not-allowed;}',
        '#dtf-toolbar .dtf-btn-confirm{background:var(--dtf-green);color:#fff;padding:5px 10px;}',
        '#dtf-toolbar .dtf-btn-confirm:hover{background:var(--dtf-green-dk);}',
        '#dtf-toolbar .dtf-btn-cancel{background:transparent;color:var(--dtf-dim);padding:5px 8px;font-size:15px;}',
        '#dtf-toolbar .dtf-btn-cancel:hover{color:var(--dtf-text);}',

        /* ── Manage Profiles button (right side, distinct border) ── */
        '#dtf-manage-profiles-btn{border-color:var(--dtf-blue);color:var(--dtf-blue);}',
        '#dtf-manage-profiles-btn:hover{background:#e8f3fa;}',

        /* ── Separator ── */
        '#dtf-toolbar .dtf-sep{width:1px;height:24px;background:var(--dtf-border);margin:0 2px;}',

        /* ── Dropdown ── */
        '.dtf-dropdown{position:relative;}',
        '.dtf-dropdown-menu{',
        '  display:none;position:absolute;top:calc(100% + 6px);left:0;',
        '  background:#fff;border:1px solid var(--dtf-border);border-radius:4px;',
        '  box-shadow:0 4px 16px rgba(0,0,0,.12);min-width:220px;z-index:9999;overflow:hidden;',
        '}',
        '.dtf-dropdown-menu.open{display:block;}',
        '.dtf-dropdown-section{',
        '  padding:6px 14px 4px;font-size:10px;font-weight:700;',
        '  text-transform:uppercase;letter-spacing:.08em;color:var(--dtf-dim);',
        '}',
        '.dtf-dropdown-item{',
        '  display:flex;align-items:center;justify-content:space-between;',
        '  padding:8px 14px;cursor:pointer;color:var(--dtf-text);font-size:13px;',
        '}',
        '.dtf-dropdown-item:hover{background:var(--dtf-surface);}',
        '.dtf-dropdown-item.danger{color:var(--dtf-red);}',
        '.dtf-dropdown-item.manage{color:var(--dtf-blue);font-weight:500;}',
        '.dtf-dropdown-item .dtf-saved-del{',
        '  color:var(--dtf-dim);font-size:13px;margin-left:8px;cursor:pointer;',
        '}',
        '.dtf-dropdown-item .dtf-saved-del:hover{color:var(--dtf-red);}',
        '.dtf-dropdown-sep{border-top:1px solid var(--dtf-border);margin:4px 0;}',

        /* ── Inline form ── */
        '.dtf-inline-wrapper{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}',
        '#dtf-inline-form{',
        '  display:none;align-items:center;gap:6px;',
        '  background:#fff;border:1px solid var(--dtf-border);border-radius:4px;padding:4px 8px;',
        '}',

        /* ── Inputs (toolbar + modals) ── */
        '.dtf-input{',
        '  border:1px solid var(--dtf-border);border-radius:3px;padding:5px 8px;font-size:13px;',
        '  outline:none;background:#fff;color:var(--dtf-text);font-family:inherit;',
        '}',
        '.dtf-input::placeholder{color:var(--dtf-dim);}',
        '.dtf-input:focus{border-color:var(--dtf-green);box-shadow:0 0 0 2px rgba(26, 137, 41, 0.5);}',
        '.dtf-input.full{width:100%;}',
        '.dtf-select{',
        '  border:1px solid var(--dtf-border);border-radius:3px;padding:5px 8px;font-size:13px;',
        '  outline:none;background:#fff;color:var(--dtf-text);cursor:pointer;font-family:inherit;',
        '}',
        '.dtf-select:focus{border-color:var(--dtf-green);box-shadow:0 0 0 2px rgba(26, 137, 41, 0.5);}',
        '.dtf-select.full{width:100%;}',
        '.dtf-label{',
        '  display:block;font-size:11px;font-weight:700;text-transform:uppercase;',
        '  letter-spacing:.05em;color:var(--dtf-dim);margin-bottom:4px;margin-top:14px;',
        '}',

        /* ── Chips ── */
        '#dtf-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}',
        '.dtf-chip{',
        '  display:inline-flex;align-items:center;gap:5px;',
        '  background:var(--dtf-green-light);color:var(--dtf-text);',
        '  border:1px solid rgba(26, 137, 41, 0.5);border-radius:3px;',
        '  padding:3px 8px 3px 10px;font-size:12px;',
        '}',
        '.dtf-chip strong{color:var(--dtf-green);font-weight:600;}',
        '.dtf-chip em{font-style:normal;color:var(--dtf-text);}',
        '.dtf-chip .dtf-chip-op{color:var(--dtf-dim);font-size:11px;margin:0 2px;}',
        '.dtf-chip button{',
        '  background:none;border:none;color:var(--dtf-dim);cursor:pointer;',
        '  font-size:13px;line-height:1;padding:0;',
        '}',
        '.dtf-chip button:hover{color:var(--dtf-green-dk);}',

        /* ── Overlays / Modals ── */
        '.dtf-overlay{',
        '  position:fixed;inset:0;background:rgba(0,0,0,.4);',
        '  display:flex;align-items:center;justify-content:center;z-index:10001;',
        '}',
        '.dtf-modal{',
        '  background:#fff;border:1px solid var(--dtf-border);border-radius:4px;',
        '  width:420px;max-width:95vw;',
        '  box-shadow:0 8px 32px rgba(0,0,0,.15);overflow:hidden;',
        '}',
        '.dtf-modal.wide{width:620px;}',
        '.dtf-modal-header{',
        '  display:flex;align-items:center;justify-content:space-between;',
        '  padding:14px 20px;border-bottom:1px solid var(--dtf-border);background:var(--dtf-surface);',
        '}',
        '.dtf-modal-title{font-size:14px;font-weight:600;color:var(--dtf-text);}',
        '.dtf-modal-close{',
        '  background:none;border:none;font-size:18px;color:var(--dtf-dim);cursor:pointer;',
        '}',
        '.dtf-modal-close:hover{color:var(--dtf-text);}',
        '.dtf-modal-body{padding:6px 20px 18px;}',
        '.dtf-modal-footer{',
        '  display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;',
        '  border-top:1px solid var(--dtf-border);background:var(--dtf-surface);',
        '}',

        /* ── Modal buttons (outside toolbar) ── */
        '.dtf-overlay .dtf-btn{',
        '  display:inline-flex;align-items:center;gap:5px;padding:6px 14px;',
        '  border:none;border-radius:3px;font-size:13px;font-weight:500;',
        '  cursor:pointer;font-family:inherit;transition:background .15s;',
        '}',
        '.dtf-overlay .dtf-btn-outline{background:#fff;border:1px solid var(--dtf-border);color:var(--dtf-text);}',
        '.dtf-overlay .dtf-btn-outline:hover{background:var(--dtf-surface);}',
        '.dtf-overlay .dtf-btn-primary{background:var(--dtf-green);color:#fff;}',
        '.dtf-overlay .dtf-btn-primary:hover{background:var(--dtf-green-dk);}',
        '.dtf-overlay .dtf-btn-danger{background:var(--dtf-red);color:#fff;}',
        '.dtf-overlay .dtf-btn-danger:hover{background:#8e1717;}',

        /* ── Save preview ── */
        '.dtf-save-preview{',
        '  margin-top:10px;padding:10px 12px;background:var(--dtf-surface);',
        '  border:1px solid var(--dtf-border);border-radius:3px;',
        '  font-size:12px;color:var(--dtf-dim);max-height:100px;overflow-y:auto;line-height:1.8;',
        '}',
        '.dtf-save-preview strong{color:var(--dtf-green);}',

        /* ── Filter Manager rows (light theme) ── */
        '.dtf-fm-row{',
        '  display:flex;align-items:center;gap:8px;',
        '  padding:8px 10px;border-radius:4px;',
        '  border:1px solid var(--dtf-border);margin-bottom:6px;',
        '  background:#fff;',
        '}',
        '.dtf-fm-row:hover{background:var(--dtf-surface);}',
        '.dtf-fm-name{',
        '  flex:1;font-size:14px;color:var(--dtf-text);',
        '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:80px;',
        '}',
        '.dtf-fm-preview{',
        '  flex:2;font-size:11px;color:var(--dtf-dim);',
        '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
        '}',
        '.dtf-fm-btn{',
        '  padding:4px 10px;border-radius:3px;border:1px solid var(--dtf-border);',
        '  background:#fff;color:var(--dtf-text);cursor:pointer;font-size:12px;white-space:nowrap;',
        '}',
        '.dtf-fm-btn:hover{background:var(--dtf-surface2);}',
        '.dtf-fm-btn-danger{border-color:var(--dtf-red);color:var(--dtf-red);}',
        '.dtf-fm-btn-danger:hover{background:#fde8e8;}',
        '.dtf-fm-btn-load{border-color:var(--dtf-blue);color:var(--dtf-blue);}',
        '.dtf-fm-btn-load:hover{background:#e8f3fa;}',
        '.dtf-fm-btn-primary{border-color:var(--dtf-green);color:var(--dtf-green);}',
        '.dtf-fm-btn-primary:hover{background:#e8f8ed;}',
        '.dtf-fm-rename-input{',
        '  flex:1;padding:3px 6px;font-size:13px;',
        '  border:1px solid var(--dtf-border);border-radius:3px;',
        '  color:var(--dtf-text);background:#fff;outline:none;',
        '}',
        '.dtf-fm-rename-input:focus{border-color:var(--dtf-green);}',
        '.dtf-fm-status{',
        '  padding:6px 10px;font-size:12px;border-radius:3px;',
        '  margin-bottom:10px;display:none;',
        '}',
        '.dtf-fm-status.ok{display:block;background:#e8f8ed;color:var(--dtf-green);border:1px solid #c3e8cc;}',
        '.dtf-fm-status.err{display:block;background:#fde8e8;color:var(--dtf-red);border:1px solid #f5c6c6;}',
        '.dtf-fm-empty{text-align:center;color:var(--dtf-dim);padding:20px 0;font-size:13px;}',

        /* ── Profile Manager modal (light theme — DTF) ── */
        '.pm-overlay{',
        '  display:none;position:fixed;top:0;left:0;right:0;bottom:0;',
        '  background:rgba(0,0,0,.4);z-index:10002;',
        '  justify-content:center;align-items:center;',
        '}',
        '.pm-overlay.pm-visible{display:flex;}',
        '.pm-modal{',
        '  background:#fff;border:1px solid var(--dtf-border);border-radius:4px;',
        '  width:680px;max-height:85vh;',
        '  display:flex;flex-direction:column;',
        '  box-shadow:0 8px 32px rgba(0,0,0,.15);overflow:hidden;',
        '  font-family:"Splunk Platform Sans","Helvetica Neue",Helvetica,Arial,sans-serif;',
        '}',
        '.pm-header{',
        '  display:flex;justify-content:space-between;align-items:center;',
        '  padding:14px 20px;border-bottom:1px solid var(--dtf-border);background:var(--dtf-surface);',
        '}',
        '.pm-header h2{margin:0;font-size:14px;font-weight:600;color:var(--dtf-text);}',
        '.pm-close{background:none;border:none;font-size:18px;color:var(--dtf-dim);cursor:pointer;padding:0;}',
        '.pm-close:hover{color:var(--dtf-text);}',
        '.pm-tabs{display:flex;border-bottom:1px solid var(--dtf-border);padding:0 20px;gap:0;background:#fff;}',
        '.pm-tab{',
        '  padding:9px 16px;cursor:pointer;font-size:13px;color:var(--dtf-dim);',
        '  border-bottom:2px solid transparent;transition:all .15s;',
        '}',
        '.pm-tab:hover{color:var(--dtf-text);}',
        '.pm-tab.pm-tab-active{color:var(--dtf-blue);border-bottom-color:var(--dtf-blue);}',
        '.pm-tab-panel{display:none;padding:14px 20px;overflow-y:auto;flex:1;}',
        '.pm-tab-panel.pm-tab-panel-active{display:block;}',
        '.pm-body{overflow-y:auto;flex:1;display:flex;flex-direction:column;}',
        '.pm-profile-row{',
        '  display:flex;align-items:center;gap:8px;',
        '  padding:8px 10px;border-radius:4px;',
        '  border:1px solid var(--dtf-border);margin-bottom:6px;background:#fff;',
        '}',
        '.pm-profile-row:hover{background:var(--dtf-surface);}',
        '.pm-profile-name{',
        '  flex:1;font-size:14px;color:var(--dtf-text);',
        '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:100px;',
        '}',
        '.pm-profile-fields{flex:2;font-size:11px;color:var(--dtf-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
        '.pm-btn{',
        '  padding:4px 10px;border-radius:3px;border:1px solid var(--dtf-border);',
        '  background:#fff;color:var(--dtf-text);cursor:pointer;font-size:12px;white-space:nowrap;',
        '}',
        '.pm-btn:hover{background:var(--dtf-surface2);}',
        '.pm-btn.pm-btn-danger{border-color:var(--dtf-red);color:var(--dtf-red);}',
        '.pm-btn.pm-btn-danger:hover{background:#fde8e8;}',
        '.pm-btn.pm-btn-primary{border-color:var(--dtf-green);color:var(--dtf-green);}',
        '.pm-btn.pm-btn-primary:hover{background:var(--dtf-green-light);}',
        '.pm-btn.pm-btn-load{border-color:var(--dtf-blue);color:var(--dtf-blue);}',
        '.pm-btn.pm-btn-load:hover{background:#e8f3fa;}',
        '.pm-rename-input{',
        '  flex:1;padding:3px 6px;font-size:13px;',
        '  background:#fff;color:var(--dtf-text);border:1px solid var(--dtf-border);border-radius:3px;outline:none;',
        '}',
        '.pm-rename-input:focus{border-color:var(--dtf-green);}',
        '.pm-field-picker-wrap{margin-top:10px;}',
        '.pm-field-picker-wrap label{',
        '  display:block;font-size:11px;font-weight:700;text-transform:uppercase;',
        '  letter-spacing:.05em;color:var(--dtf-dim);margin-bottom:6px;',
        '}',
        '.pm-field-search{',
        '  width:100%;padding:5px 8px;font-size:13px;',
        '  background:#fff;color:var(--dtf-text);border:1px solid var(--dtf-border);border-radius:3px;',
        '  box-sizing:border-box;margin-bottom:6px;outline:none;',
        '}',
        '.pm-field-search:focus{border-color:var(--dtf-green);box-shadow:0 0 0 2px rgba(26,137,41,.2);}',
        '.pm-field-list{',
        '  max-height:200px;overflow-y:auto;',
        '  border:1px solid var(--dtf-border);border-radius:3px;background:#fff;padding:4px 0;',
        '}',
        '.pm-field-item{',
        '  display:flex;align-items:center;gap:8px;',
        '  padding:4px 10px;cursor:pointer;font-size:13px;color:var(--dtf-text);',
        '}',
        '.pm-field-item:hover{background:var(--dtf-surface);}',
        '.pm-field-item input[type="checkbox"]{accent-color:var(--dtf-green);cursor:pointer;}',
        '.pm-field-item.pm-field-selected{color:var(--dtf-green);}',
        '.pm-field-actions{display:flex;gap:8px;margin-top:6px;align-items:center;}',
        '.pm-field-actions .pm-selected-summary{font-size:11px;color:var(--dtf-dim);flex:1;}',
        '.pm-field-loading{text-align:center;color:var(--dtf-dim);padding:16px;font-size:12px;}',
        '.pm-new-section{margin-top:0;}',
        '.pm-new-section label{',
        '  display:block;font-size:11px;font-weight:700;text-transform:uppercase;',
        '  letter-spacing:.05em;color:var(--dtf-dim);margin-bottom:4px;margin-top:14px;',
        '}',
        '.pm-new-input{',
        '  width:100%;padding:5px 8px;font-size:13px;',
        '  background:#fff;color:var(--dtf-text);border:1px solid var(--dtf-border);border-radius:3px;',
        '  box-sizing:border-box;margin-bottom:8px;outline:none;',
        '}',
        '.pm-new-input:focus{border-color:var(--dtf-green);box-shadow:0 0 0 2px rgba(26,137,41,.2);}',
        '.pm-edit-fields-panel{',
        '  border:1px solid var(--dtf-border);border-radius:3px;',
        '  background:var(--dtf-surface);padding:10px;margin-top:6px;margin-bottom:6px;',
        '}',
        '.pm-status{',
        '  padding:6px 10px;font-size:12px;border-radius:3px;',
        '  margin:0 20px 10px;display:none;',
        '}',
        '.pm-status.pm-success{display:block;background:#e8f8ed;color:var(--dtf-green);border:1px solid #c3e8cc;}',
        '.pm-status.pm-error{display:block;background:#fde8e8;color:var(--dtf-red);border:1px solid #f5c6c6;}',
        '.pm-empty{text-align:center;color:var(--dtf-dim);padding:24px 0;font-size:13px;}',
        '.pm-footer{padding:10px 20px;border-top:1px solid var(--dtf-border);display:flex;justify-content:flex-end;background:var(--dtf-surface);}',

        /* ── Table cell hints ── */
        '.dtf-cell-clickable{cursor:pointer;}',
        '.dtf-cell-clickable:hover td:not(:has(.flag-icon)){background:rgba(249,139,0,.06) !important;}'
    ].join('')).appendTo('head');

    // =========================================================================
    // TOOLBAR HTML
    // =========================================================================
    var OP_OPTIONS = [
        '<option value="eq">Equal</option>',
        '<option value="neq">Not equal</option>',
        '<option value="gt">Greater than</option>',
        '<option value="lt">Less than</option>',
        '<option value="gte">Greater or equal</option>',
        '<option value="lte">Less or equal</option>',
        '<option value="contains">Contains</option>',
        '<option value="starts">Starts with</option>',
        '<option value="ends">Ends with</option>'
    ].join('');

    var $toolbar = $(
        '<div id="dtf-toolbar">' +
          /* ── Filter dropdown (left) ── */
          '<div class="dtf-dropdown" id="dtf-filter-dd">' +
            '<button class="dtf-btn dtf-btn-outline" id="dtf-filter-btn">&#9776; Filter</button>' +
            '<div class="dtf-dropdown-menu" id="dtf-filter-menu">' +
              '<div class="dtf-dropdown-item danger" data-dtf-action="clear">&#x2715; Clear all filters</div>' +
              '<div class="dtf-dropdown-sep"></div>' +
              '<div class="dtf-dropdown-item manage" id="dtf-manage-filters-link">&#9965; Manage filters&hellip;</div>' +
              '<div class="dtf-dropdown-sep"></div>' +
              '<div class="dtf-dropdown-section">Saved filters</div>' +
              '<div id="dtf-saved-list"></div>' +
            '</div>' +
          '</div>' +
          '<div class="dtf-sep"></div>' +
          /* ── Add inline ── */
          '<div class="dtf-inline-wrapper">' +
            '<button class="dtf-btn dtf-btn-primary" id="dtf-add-btn">+ Add filter</button>' +
            '<div id="dtf-inline-form">' +
              '<input type="text" class="dtf-input" id="dtf-inline-field" placeholder="Field" />' +
              '<select class="dtf-select" id="dtf-inline-op">' + OP_OPTIONS + '</select>' +
              '<input type="text" class="dtf-input" id="dtf-inline-value" placeholder="Value" />' +
              '<button class="dtf-btn dtf-btn-confirm" id="dtf-inline-ok">OK</button>' +
              '<button class="dtf-btn dtf-btn-cancel" id="dtf-inline-cancel">&#x2715;</button>' +
            '</div>' +
          '</div>' +
          '<div class="dtf-sep"></div>' +
          /* ── Save ── */
          '<button class="dtf-btn dtf-btn-save" id="dtf-save-btn" disabled>&#128190; Save filter</button>' +
          /* ── Active filter chips ── */
          '<div id="dtf-chips"></div>' +
          /* ── Spacer pushes Manage Profiles to the far right ── */
          '<div style="flex:1;"></div>' +
          /* ── Manage Profiles (right) ── */
          '<button class="dtf-btn dtf-btn-outline" id="dtf-manage-profiles-btn">&#128203; Manage Profiles</button>' +
        '</div>'
    );

    var $target = $('.dashboard-row').first();
    if ($target.length) {
        $target.before($toolbar);
    } else {
        $('.main-section-body').prepend($toolbar);
    }

    // =========================================================================
    // MODALS HTML
    // =========================================================================

    // ── Add filter modal ──
    $('body').append(
        '<div class="dtf-overlay" id="dtf-add-overlay" style="display:none;">' +
          '<div class="dtf-modal">' +
            '<div class="dtf-modal-header">' +
              '<span class="dtf-modal-title">Add a filter</span>' +
              '<button class="dtf-modal-close" id="dtf-add-modal-close">&#x2715;</button>' +
            '</div>' +
            '<div class="dtf-modal-body">' +
              '<label class="dtf-label">Field</label>' +
              '<input type="text" class="dtf-input full" id="dtf-modal-field" placeholder="e.g. status" />' +
              '<label class="dtf-label">Operation</label>' +
              '<select class="dtf-select full" id="dtf-modal-op">' + OP_OPTIONS + '</select>' +
              '<label class="dtf-label">Value</label>' +
              '<input type="text" class="dtf-input full" id="dtf-modal-value" placeholder="e.g. active" />' +
            '</div>' +
            '<div class="dtf-modal-footer">' +
              '<button class="dtf-btn dtf-btn-outline" id="dtf-modal-cancel">Cancel</button>' +
              '<button class="dtf-btn dtf-btn-primary" id="dtf-modal-confirm">Add filter</button>' +
            '</div>' +
          '</div>' +
        '</div>'
    );

    // ── Save filter modal ──
    $('body').append(
        '<div class="dtf-overlay" id="dtf-save-overlay" style="display:none;">' +
          '<div class="dtf-modal">' +
            '<div class="dtf-modal-header">' +
              '<span class="dtf-modal-title">Save current filters</span>' +
              '<button class="dtf-modal-close" id="dtf-save-modal-close">&#x2715;</button>' +
            '</div>' +
            '<div class="dtf-modal-body">' +
              '<label class="dtf-label">Filter set name</label>' +
              '<input type="text" class="dtf-input full" id="dtf-save-name" placeholder="e.g. Active errors" />' +
              '<label class="dtf-label">Filters to save</label>' +
              '<div class="dtf-save-preview" id="dtf-save-preview"></div>' +
            '</div>' +
            '<div class="dtf-modal-footer">' +
              '<button class="dtf-btn dtf-btn-outline" id="dtf-save-modal-cancel">Cancel</button>' +
              '<button class="dtf-btn dtf-btn-primary" id="dtf-save-modal-confirm">&#128190; Save</button>' +
            '</div>' +
          '</div>' +
        '</div>'
    );

    // ── Filter Manager modal ──
    $('body').append(
        '<div class="dtf-overlay" id="dtf-fm-overlay" style="display:none;">' +
          '<div class="dtf-modal wide">' +
            '<div class="dtf-modal-header">' +
              '<span class="dtf-modal-title">&#9965; Manage Saved Filters</span>' +
              '<button class="dtf-modal-close" id="dtf-fm-close">&#x2715;</button>' +
            '</div>' +
            '<div class="dtf-modal-body" style="max-height:60vh;overflow-y:auto;">' +
              '<div class="dtf-fm-status" id="dtf-fm-status"></div>' +
              '<div id="dtf-fm-list"></div>' +
            '</div>' +
            '<div class="dtf-modal-footer">' +
              '<button class="dtf-btn dtf-btn-outline" id="dtf-fm-close-footer">Close</button>' +
            '</div>' +
          '</div>' +
        '</div>'
    );

    // ── Profile Manager modal (dark themed) ──
    $('body').append(
        '<div class="pm-overlay" id="pm-overlay">' +
          '<div class="pm-modal">' +
            '<div class="pm-header">' +
              '<h2>&#128203; Profile Manager</h2>' +
              '<button class="pm-close" id="pm-close">&#x2715;</button>' +
            '</div>' +
            '<div class="pm-tabs">' +
              '<div class="pm-tab pm-tab-active" data-tab="profiles">Profiles</div>' +
              '<div class="pm-tab" data-tab="create">+ New Profile</div>' +
            '</div>' +
            '<div class="pm-body">' +
              '<div class="pm-tab-panel pm-tab-panel-active" data-tab="profiles">' +
                '<div id="pm-profile-list"></div>' +
              '</div>' +
              '<div class="pm-tab-panel" data-tab="create">' +
                '<div class="pm-new-section">' +
                  '<label>Profile Name</label>' +
                  '<input class="pm-new-input" id="pm-new-name" placeholder="e.g. Network Logs, Auth Events\u2026" />' +
                  '<div class="pm-field-picker-wrap" id="pm-create-picker-wrap">' +
                    '<label>Select Fields</label>' +
                    '<input class="pm-field-search" id="pm-create-field-search" placeholder="Search fields\u2026" />' +
                    '<div class="pm-field-list" id="pm-create-field-list">' +
                      '<div class="pm-field-loading">Select an index &amp; source first, then open this modal.</div>' +
                    '</div>' +
                    '<div class="pm-field-actions">' +
                      '<span class="pm-selected-summary" id="pm-create-selected-summary">0 fields selected</span>' +
                      '<button class="pm-btn" id="pm-create-select-all">Select All</button>' +
                      '<button class="pm-btn" id="pm-create-select-none">Clear</button>' +
                    '</div>' +
                  '</div>' +
                  '<div style="margin-top:12px;">' +
                    '<button class="pm-btn pm-btn-primary" id="pm-create-btn">+ Create Profile</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="pm-status" id="pm-status"></div>' +
            '<div class="pm-footer">' +
              '<button class="pm-btn" id="pm-close-footer">Close</button>' +
            '</div>' +
          '</div>' +
        '</div>'
    );

    // =========================================================================
    // SHARED HELPERS
    // =========================================================================
    function escHtml(s) {
        return String(s)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function escSpl(str) {
        return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    function runSpl(spl, callback) {
        var sm = new SearchManager({
            preview: false,
            cache: false,
            search: spl,
            earliest_time: '0',
            latest_time: 'now',
            autostart: true
        });
        sm.on('search:done', function(props) {
            if (callback) callback(null, props);
            sm.cancel();
        });
        sm.on('search:error', function(props) {
            if (callback) callback(props);
            sm.cancel();
        });
        sm.on('search:failed', function(props) {
            if (callback) callback(props);
            sm.cancel();
        });
    }

    // =========================================================================
    // FILTER BAR — LOGIC
    // =========================================================================
    var OP_LABELS = {
        eq: 'Equal', neq: 'Not equal', gt: 'Greater than', lt: 'Less than',
        gte: 'Greater or equal', lte: 'Less or equal',
        contains: 'Contains', starts: 'Starts with', ends: 'Ends with'
    };

    var dtfFilters = [];
    var dtfSaved   = [];   // loaded async from lookup

    // ── Filter dropdown ──
    $('#dtf-filter-btn').on('click', function(e) {
        e.stopPropagation();
        $('#dtf-filter-menu').toggleClass('open');
    });
    $(document).on('click', function() { $('#dtf-filter-menu').removeClass('open'); });

    $('#dtf-filter-menu').on('click', '[data-dtf-action="clear"]', function() {
        dtfFilters = [];
        renderFilters();
        $('#dtf-filter-menu').removeClass('open');
    });
    $('#dtf-saved-list').on('click', '.dtf-dropdown-item', function() {
        var idx = parseInt($(this).data('idx'), 10);
        if (isNaN(idx) || !dtfSaved[idx]) return;
        dtfFilters = dtfSaved[idx].filters.map(function(f) {
            return { id: Date.now() + Math.random(), field: f.field, op: f.op, value: f.value };
        });
        renderFilters();
        $('#dtf-filter-menu').removeClass('open');
    });
    $('#dtf-saved-list').on('click', '.dtf-saved-del', function(e) {
        e.stopPropagation();
        var idx = parseInt($(this).data('del'), 10);
        if (isNaN(idx)) return;
        dtfSaved.splice(idx, 1);
        persistSaved();
        renderSaved();
    });

    // ── "Manage Filters" link in dropdown ──
    $('#dtf-manage-filters-link').on('click', function(e) {
        e.stopPropagation();
        $('#dtf-filter-menu').removeClass('open');
        openFmModal();
    });

    // ── Inline Add ──
    $('#dtf-add-btn').on('click', function() {
        var $form = $('#dtf-inline-form');
        var open  = $form.css('display') === 'flex';
        $form.css('display', open ? 'none' : 'flex');
        if (!open) setTimeout(function() { $('#dtf-inline-field').focus(); }, 50);
    });
    $('#dtf-inline-ok').on('click', function() {
        var field = $('#dtf-inline-field').val().trim();
        var value = $('#dtf-inline-value').val().trim();
        if (!field || !value) return;
        addFilter(field, $('#dtf-inline-op').val(), value);
        $('#dtf-inline-field').val('');
        $('#dtf-inline-value').val('');
        $('#dtf-inline-op').val('eq');
        $('#dtf-inline-form').css('display', 'none');
    });
    $('#dtf-inline-cancel').on('click', function() {
        $('#dtf-inline-form').css('display', 'none');
    });
    $('#dtf-inline-value').on('keydown', function(e) {
        if (e.key === 'Enter')  $('#dtf-inline-ok').trigger('click');
        if (e.key === 'Escape') $('#dtf-inline-cancel').trigger('click');
    });

    // ── Add filter modal ──
    $('#dtf-add-modal-close, #dtf-modal-cancel').on('click', closeAddModal);
    $('#dtf-add-overlay').on('click', function(e) { if (e.target === this) closeAddModal(); });
    $('#dtf-modal-confirm').on('click', function() {
        var field = $('#dtf-modal-field').val().trim();
        var value = $('#dtf-modal-value').val().trim();
        if (!field || !value) return;
        addFilter(field, $('#dtf-modal-op').val(), value);
        closeAddModal();
    });
    $('#dtf-modal-value').on('keydown', function(e) {
        if (e.key === 'Enter')  $('#dtf-modal-confirm').trigger('click');
        if (e.key === 'Escape') closeAddModal();
    });

    function openAddModal(preField, preValue) {
        $('#dtf-modal-field').val(preField || '');
        $('#dtf-modal-value').val(preValue || '');
        $('#dtf-modal-op').val('eq');
        $('#dtf-add-overlay').css('display', 'flex');
        setTimeout(function() {
            if (preField && preValue) {
                $('#dtf-modal-op').focus();
            } else {
                $('#dtf-modal-field').focus();
            }
        }, 50);
    }
    function closeAddModal() { $('#dtf-add-overlay').hide(); }

    // ── Save filter modal ──
    $('#dtf-save-btn').on('click', openSaveModal);
    $('#dtf-save-modal-close, #dtf-save-modal-cancel').on('click', closeSaveModal);
    $('#dtf-save-overlay').on('click', function(e) { if (e.target === this) closeSaveModal(); });
    $('#dtf-save-modal-confirm').on('click', function() {
        var name = $('#dtf-save-name').val().trim();
        if (!name) { $('#dtf-save-name').focus(); return; }
        // Check for duplicate name
        if (_.findWhere(dtfSaved, { name: name })) {
            alert('A filter set named "' + name + '" already exists.');
            return;
        }
        dtfSaved.push({
            name: name,
            filters: dtfFilters.map(function(f) { return { field: f.field, op: f.op, value: f.value }; })
        });
        persistSaved(function() { renderSaved(); });
        closeSaveModal();
    });
    $('#dtf-save-name').on('keydown', function(e) {
        if (e.key === 'Enter')  $('#dtf-save-modal-confirm').trigger('click');
        if (e.key === 'Escape') closeSaveModal();
    });

    function openSaveModal() {
        $('#dtf-save-name').val('');
        var html = dtfFilters.map(function(f) {
            return '<div><strong>' + escHtml(f.field) + '</strong> <span>' +
                   OP_LABELS[f.op] + '</span> ' + escHtml(f.value) + '</div>';
        }).join('');
        $('#dtf-save-preview').html(html);
        $('#dtf-save-overlay').css('display', 'flex');
        setTimeout(function() { $('#dtf-save-name').focus(); }, 50);
    }
    function closeSaveModal() { $('#dtf-save-overlay').hide(); }

    // ── Core filter functions ──
    function addFilter(field, op, value) {
        dtfFilters.push({ id: Date.now(), field: field, op: op, value: value });
        renderFilters();
    }

    function removeFilter(id) {
        dtfFilters = dtfFilters.filter(function(f) { return f.id !== id; });
        renderFilters();
    }

    function renderFilters() {
        var $chips = $('#dtf-chips').empty();
        dtfFilters.forEach(function(f) {
            var $chip = $('<span class="dtf-chip"></span>').html(
                '<strong>' + escHtml(f.field) + '</strong>' +
                '<span class="dtf-chip-op">' + OP_LABELS[f.op] + '</span>' +
                '<em>' + escHtml(f.value) + '</em>' +
                '<button title="Remove">&#x2715;</button>'
            );
            $chip.find('button').on('click', (function(id) {
                return function() { removeFilter(id); };
            })(f.id));
            $chips.append($chip);
        });
        $('#dtf-save-btn').prop('disabled', dtfFilters.length === 0);

        var query = buildFilterQuery();
        tokens_default.set('dtf_filter_query', query);
        tokens_submitted.set('dtf_filter_query', query);
    }

    function buildFilterQuery() {
        if (dtfFilters.length === 0) return '';
        var parts = dtfFilters.map(function(f) {
            var v = f.value.replace(/"/g, '\\"');
            switch (f.op) {
                case 'eq':       return f.field + '="' + v + '"';
                case 'neq':      return f.field + '!="' + v + '"';
                case 'gt':       return f.field + '>' + v;
                case 'lt':       return f.field + '<' + v;
                case 'gte':      return f.field + '>=' + v;
                case 'lte':      return f.field + '<=' + v;
                case 'contains': return f.field + '="*' + v + '*"';
                case 'starts':   return f.field + '="' + v + '*"';
                case 'ends':     return f.field + '="*' + v + '"';
                default:         return f.field + '="' + v + '"';
            }
        });
        return parts.join(' AND ');
    }

    // ── Lookup-based persistence for saved filters ──
    function loadSavedFiltersFromLookup(callback) {
        var sm = new SearchManager({
            preview: false,
            cache: false,
            search: '| inputlookup custom_saved_filters.csv | stats last(filters_json) as filters_json by filter_name | table filter_name filters_json',
            earliest_time: '0',
            latest_time: 'now',
            autostart: true
        });

        var fired = false;
        function done() {
            if (fired) return;
            fired = true;
            if (callback) callback();
        }

        sm.on('search:done', function(properties) {
            var resultCount = properties.content.resultCount || 0;
            if (resultCount === 0) { dtfSaved = []; done(); return; }
            var results = sm.data('results', { count: 0 });
            results.on('data', function() {
                dtfSaved = [];
                var rows   = results.data().rows;
                var fields = results.data().fields;
                var nameIdx    = fields.indexOf('filter_name');
                var jsonIdx    = fields.indexOf('filters_json');
                _.each(rows, function(row) {
                    try {
                        var filterArr = JSON.parse(row[jsonIdx]);
                        dtfSaved.push({ name: row[nameIdx], filters: filterArr });
                    } catch(e) {
                        // skip corrupt rows
                    }
                });
                done();
            });
            setTimeout(function() { done(); }, 3000);
        });
        sm.on('search:error search:failed', function() {
            // Fallback: keep dtfSaved as-is (might be empty or populated from earlier)
            done();
        });
    }

    function persistSaved(callback) {
        if (dtfSaved.length === 0) {
            runSpl(
                '| makeresults | eval filter_name="", filters_json="" | where 1=0 | outputlookup custom_saved_filters.csv',
                callback
            );
            return;
        }
        var parts = _.map(dtfSaved, function(sf) {
            var json = JSON.stringify(sf.filters || []);
            return '| append [| makeresults | eval filter_name="' + escSpl(sf.name) +
                   '", filters_json="' + escSpl(json) + '"]';
        });
        var spl = '| makeresults | eval filter_name="__init__" ' +
                  parts.join(' ') +
                  ' | where filter_name!="__init__" | outputlookup custom_saved_filters.csv';
        runSpl(spl, callback);
    }

    function renderSaved() {
        var $list = $('#dtf-saved-list').empty();
        if (dtfSaved.length === 0) {
            $list.append(
                '<div class="dtf-dropdown-item" style="color:var(--dtf-dim);font-style:italic;cursor:default;">' +
                'No saved filters</div>'
            );
            return;
        }
        dtfSaved.forEach(function(sf, idx) {
            $list.append(
                '<div class="dtf-dropdown-item" data-idx="' + idx + '">' +
                  '<span>&#128065; ' + escHtml(sf.name) + '</span>' +
                  '<span class="dtf-saved-del" data-del="' + idx + '" title="Delete">&#x2715;</span>' +
                '</div>'
            );
        });
    }

    // Load saved filters from lookup at startup
    loadSavedFiltersFromLookup(function() { renderSaved(); });

    // =========================================================================
    // FILTER MANAGER — LOGIC
    // =========================================================================
    var fmIsBusy = false;

    function showFmStatus(msg, type) {
        var $s = $('#dtf-fm-status');
        $s.text(msg).removeClass('ok err').addClass(type === 'ok' ? 'ok' : 'err').show();
        setTimeout(function() {
            $s.fadeOut(300, function() { $(this).removeClass('ok err'); });
        }, 3000);
    }

    function openFmModal() {
        loadSavedFiltersFromLookup(function() {
            renderFmList();
            $('#dtf-fm-overlay').css('display', 'flex');
        });
    }
    function closeFmModal() { $('#dtf-fm-overlay').hide(); }

    function renderFmList() {
        var $list = $('#dtf-fm-list').empty();
        if (dtfSaved.length === 0) {
            $list.html('<div class="dtf-fm-empty">No saved filter sets yet.<br>Use <b>&#128190; Save filter</b> to create one.</div>');
            return;
        }
        dtfSaved.forEach(function(sf, idx) {
            var count = (sf.filters || []).length;
            var preview = (sf.filters || []).map(function(f) {
                return f.field + ' ' + (OP_LABELS[f.op] || f.op) + ' ' + f.value;
            }).join(' | ');
            if (preview.length > 60) preview = preview.substring(0, 60) + '\u2026';

            var $row = $(
                '<div class="dtf-fm-row" data-fm-idx="' + idx + '">' +
                  '<span class="dtf-fm-name" title="' + escHtml(sf.name) + '">' + escHtml(sf.name) + '</span>' +
                  '<span class="dtf-fm-preview" title="' + escHtml(preview) + '">' + escHtml(preview) + ' (' + count + ')</span>' +
                  '<button class="dtf-fm-btn dtf-fm-btn-load dtf-fm-action-load" title="Load this filter set">Load</button>' +
                  '<button class="dtf-fm-btn dtf-fm-action-rename" title="Rename">Rename</button>' +
                  '<button class="dtf-fm-btn dtf-fm-btn-danger dtf-fm-action-delete" title="Delete">Delete</button>' +
                '</div>'
            );
            $list.append($row);
        });
    }

    // FM — Load
    $(document).on('click', '.dtf-fm-action-load', function() {
        var idx = parseInt($(this).closest('.dtf-fm-row').data('fm-idx'), 10);
        if (isNaN(idx) || !dtfSaved[idx]) return;
        dtfFilters = dtfSaved[idx].filters.map(function(f) {
            return { id: Date.now() + Math.random(), field: f.field, op: f.op, value: f.value };
        });
        renderFilters();
        closeFmModal();
    });

    // FM — Delete
    $(document).on('click', '.dtf-fm-action-delete', function() {
        if (fmIsBusy) return;
        var $row = $(this).closest('.dtf-fm-row');
        var idx  = parseInt($row.data('fm-idx'), 10);
        if (isNaN(idx) || !dtfSaved[idx]) return;
        var name = dtfSaved[idx].name;
        if (!confirm('Delete filter set "' + name + '"?')) return;
        fmIsBusy = true;
        dtfSaved.splice(idx, 1);
        persistSaved(function(err) {
            fmIsBusy = false;
            if (err) { showFmStatus('Delete failed', 'err'); return; }
            showFmStatus('Deleted "' + name + '"', 'ok');
            renderFmList();
            renderSaved();
        });
    });

    // FM — Rename (inline)
    $(document).on('click', '.dtf-fm-action-rename', function() {
        if (fmIsBusy) return;
        var $row  = $(this).closest('.dtf-fm-row');
        var idx   = parseInt($row.data('fm-idx'), 10);
        if (isNaN(idx) || !dtfSaved[idx]) return;
        var oldName = dtfSaved[idx].name;

        $row.find('.dtf-fm-name').replaceWith(
            '<input class="dtf-fm-rename-input" value="' + escHtml(oldName) + '" />'
        );
        $row.find('.dtf-fm-action-rename').replaceWith(
            '<button class="dtf-fm-btn dtf-fm-btn-primary dtf-fm-rename-confirm">OK</button>' +
            '<button class="dtf-fm-btn dtf-fm-rename-cancel">Cancel</button>'
        );
        $row.find('.dtf-fm-rename-input').focus().select();
    });

    $(document).on('click', '.dtf-fm-rename-confirm', function() {
        if (fmIsBusy) return;
        var $row    = $(this).closest('.dtf-fm-row');
        var idx     = parseInt($row.data('fm-idx'), 10);
        var newName = $row.find('.dtf-fm-rename-input').val().trim();
        if (!newName) { showFmStatus('Name cannot be empty', 'err'); return; }
        var oldName = dtfSaved[idx].name;
        if (newName === oldName) { renderFmList(); return; }
        if (_.findWhere(dtfSaved, { name: newName })) {
            showFmStatus('A filter set named "' + newName + '" already exists', 'err');
            return;
        }
        fmIsBusy = true;
        dtfSaved[idx].name = newName;
        persistSaved(function(err) {
            fmIsBusy = false;
            if (err) { dtfSaved[idx].name = oldName; showFmStatus('Rename failed', 'err'); return; }
            showFmStatus('Renamed to "' + newName + '"', 'ok');
            renderFmList();
            renderSaved();
        });
    });

    $(document).on('click', '.dtf-fm-rename-cancel', function() {
        renderFmList();
    });

    // FM — button wiring
    $('#dtf-fm-close, #dtf-fm-close-footer').on('click', closeFmModal);
    $('#dtf-fm-overlay').on('click', function(e) { if (e.target === this) closeFmModal(); });

    // =========================================================================
    // PROFILE MANAGER — LOGIC (merged from profile_manager.js)
    // =========================================================================
    var pmProfiles      = [];
    var pmAvailableFields = [];
    var pmIsBusy        = false;
    var pmCreatePicker  = null;

    // PM tab switching
    $(document).on('click', '.pm-tab', function() {
        var tab = $(this).data('tab');
        $('.pm-tab').removeClass('pm-tab-active');
        $(this).addClass('pm-tab-active');
        $('.pm-tab-panel').removeClass('pm-tab-panel-active');
        $('.pm-tab-panel[data-tab="' + tab + '"]').addClass('pm-tab-panel-active');
    });

    function showPmStatus(msg, type) {
        var $s = $('#pm-status');
        $s.text(msg).removeClass('pm-success pm-error')
          .addClass(type === 'ok' ? 'pm-success' : 'pm-error')
          .show();
        setTimeout(function() {
            $s.fadeOut(300, function() { $(this).removeClass('pm-success pm-error'); });
        }, 3000);
    }

    // PM — Load available fields from index/source
    function pmLoadAvailableFields(callback) {
        var dbIndex  = tokens_submitted.get('db_index')  || tokens_default.get('form.db_index')  || tokens_default.get('db_index');
        var dbSource = tokens_submitted.get('db_source') || tokens_default.get('form.db_source') || tokens_default.get('db_source');

        if (!dbIndex) { pmAvailableFields = []; if (callback) callback(); return; }

        var spl = 'index=' + dbIndex;
        if (dbSource) spl += ' source=' + dbSource;
        spl += ' | head 1000 | fieldsummary | table field' +
               ' | search NOT field IN ("_set_v","_si","_indextime","_confstr","_serial","_sourcetype")';

        var sm = new SearchManager({
            preview: false, cache: false, search: spl,
            earliest_time: '0', latest_time: '', autostart: true
        });

        var done = false;
        function finish() {
            if (done) return;
            done = true;
            if (callback) callback();
        }

        sm.on('search:done', function(properties) {
            var resultCount = properties.content.resultCount || 0;
            if (resultCount === 0) { pmAvailableFields = []; finish(); return; }
            var results = sm.data('results', { count: 0 });
            results.on('data', function() {
                pmAvailableFields = [];
                var rows   = results.data().rows;
                var fields = results.data().fields;
                var fieldIdx = fields.indexOf('field');
                _.each(rows, function(row) { pmAvailableFields.push(row[fieldIdx]); });
                pmAvailableFields.sort();
                finish();
            });
            setTimeout(function() { finish(); }, 5000);
        });
        sm.on('search:error search:failed', function() {
            pmAvailableFields = [];
            finish();
        });
    }

    // PM — Render field picker
    function pmRenderFieldPicker(cfg) {
        var $list   = $(cfg.listEl);
        var selected = cfg.selected || [];

        function render(filter) {
            $list.empty();
            var filtered = pmAvailableFields;
            if (filter) {
                var lc = filter.toLowerCase();
                filtered = _.filter(pmAvailableFields, function(f) {
                    return f.toLowerCase().indexOf(lc) !== -1;
                });
            }
            if (filtered.length === 0) {
                $list.html('<div class="pm-field-loading">No fields found.</div>');
                return;
            }
            _.each(filtered, function(fname) {
                var checked  = _.contains(selected, fname) ? 'checked' : '';
                var selClass = checked ? ' pm-field-selected' : '';
                $list.append(
                    '<div class="pm-field-item' + selClass + '" data-field="' + _.escape(fname) + '">' +
                    '<input type="checkbox" ' + checked + ' /> ' +
                    '<span>' + _.escape(fname) + '</span>' +
                    '</div>'
                );
            });
        }

        render('');

        $(cfg.searchEl).off('input.pm').on('input.pm', function() { render($(this).val()); });

        $list.off('click.pm').on('click.pm', '.pm-field-item', function(e) {
            var fname = $(this).data('field');
            var $cb   = $(this).find('input[type="checkbox"]');
            if (!$(e.target).is('input')) $cb.prop('checked', !$cb.prop('checked'));
            if ($cb.prop('checked')) {
                if (!_.contains(selected, fname)) selected.push(fname);
                $(this).addClass('pm-field-selected');
            } else {
                selected = _.without(selected, fname);
                $(this).removeClass('pm-field-selected');
            }
            updateSummary();
            if (cfg.onchange) cfg.onchange(selected);
        });

        function updateSummary() {
            $(cfg.summaryEl).text(selected.length + ' field' + (selected.length !== 1 ? 's' : '') + ' selected');
        }
        updateSummary();

        return {
            getSelected: function() { return selected; },
            setSelected: function(arr) { selected = arr.slice(); render($(cfg.searchEl).val()); updateSummary(); },
            selectAll:   function() { selected = pmAvailableFields.slice(); render($(cfg.searchEl).val()); updateSummary(); },
            selectNone:  function() { selected = []; render($(cfg.searchEl).val()); updateSummary(); }
        };
    }

    // PM — Init create-tab picker
    function pmInitCreatePicker() {
        pmCreatePicker = pmRenderFieldPicker({
            listEl:    '#pm-create-field-list',
            searchEl:  '#pm-create-field-search',
            summaryEl: '#pm-create-selected-summary',
            selected:  ['_time', '_raw']
        });
    }

    $('#pm-create-select-all').on('click',  function() { if (pmCreatePicker) pmCreatePicker.selectAll(); });
    $('#pm-create-select-none').on('click', function() { if (pmCreatePicker) pmCreatePicker.selectNone(); });

    // PM — Load profiles from lookup
    function pmLoadProfiles(callback) {
        var sm = new SearchManager({
            preview: false, cache: false,
            search: '| inputlookup custom_field_profiles.csv | stats last(field_list) as field_list by profile_name | table profile_name field_list',
            earliest_time: '0', latest_time: 'now', autostart: true
        });

        var fired = false;
        function done() {
            if (fired) return;
            fired = true;
            pmRenderProfiles();
            if (callback) callback();
        }

        sm.on('search:done', function(properties) {
            var resultCount = properties.content.resultCount || 0;
            if (resultCount === 0) { pmProfiles = []; done(); return; }
            var results = sm.data('results', { count: 0 });
            results.on('data', function() {
                pmProfiles = [];
                var rows   = results.data().rows;
                var fields = results.data().fields;
                var nameIdx = fields.indexOf('profile_name');
                var listIdx = fields.indexOf('field_list');
                _.each(rows, function(row) {
                    pmProfiles.push({ profile_name: row[nameIdx], field_list: row[listIdx] });
                });
                done();
            });
            setTimeout(function() { done(); }, 3000);
        });
        sm.on('search:error search:failed', function() { pmProfiles = []; done(); });
    }

    // PM — Render profile rows
    function pmRenderProfiles() {
        var $list = $('#pm-profile-list').empty();
        if (pmProfiles.length === 0) {
            $list.html('<div class="pm-empty">No profiles yet — switch to the <b>+ New Profile</b> tab to create one.</div>');
            return;
        }
        _.each(pmProfiles, function(p) {
            var fieldArr     = _.map(p.field_list.split(','), function(f) { return f.trim(); });
            var fieldsPreview = fieldArr.join(', ');
            if (fieldsPreview.length > 55) fieldsPreview = fieldsPreview.substring(0, 55) + '\u2026';

            var $row = $(
                '<div class="pm-profile-row" data-name="' + _.escape(p.profile_name) + '">' +
                  '<span class="pm-profile-name" title="' + _.escape(p.profile_name) + '">' + _.escape(p.profile_name) + '</span>' +
                  '<span class="pm-profile-fields" title="' + _.escape(p.field_list) + '">' + _.escape(fieldsPreview) + ' (' + fieldArr.length + ')</span>' +
                  '<button class="pm-btn pm-btn-load pm-action-load" title="Load this profile">Load</button>' +
                  '<button class="pm-btn pm-action-edit-fields" title="Edit fields">Fields</button>' +
                  '<button class="pm-btn pm-action-rename" title="Rename">Rename</button>' +
                  '<button class="pm-btn pm-btn-danger pm-action-delete" title="Delete">Delete</button>' +
                '</div>'
            );
            $list.append($row);
        });
    }

    // PM — Save lookup
    function pmSaveLookup(callback) {
        if (pmProfiles.length === 0) {
            runSpl(
                '| makeresults | eval profile_name="", field_list="" | where 1=0 | outputlookup custom_field_profiles.csv',
                callback
            );
            return;
        }
        var parts = _.map(pmProfiles, function(p) {
            return '| append [| makeresults | eval profile_name="' + escSpl(p.profile_name) +
                   '", field_list="' + escSpl(p.field_list) + '"]';
        });
        var spl = '| makeresults | eval profile_name="__init__" ' +
                  parts.join(' ') +
                  ' | where profile_name!="__init__" | outputlookup custom_field_profiles.csv';
        runSpl(spl, callback);
    }

    // PM — Refresh the dropdown in the XML form
    function pmRefreshDropdown() {
        var field1Comp = mvc.Components.get('field1');
        if (field1Comp) {
            var managerId = field1Comp.settings.get('managerid');
            if (managerId) {
                var field1Search = mvc.Components.get(managerId);
                if (field1Search) field1Search.startSearch();
            }
        }
    }

    // PM — DELETE
    $(document).on('click', '.pm-action-delete', function() {
        if (pmIsBusy) return;
        var name = $(this).closest('.pm-profile-row').data('name');
        if (!confirm('Delete profile "' + name + '"?')) return;
        pmIsBusy = true;
        pmProfiles = _.filter(pmProfiles, function(p) { return p.profile_name !== name; });
        pmSaveLookup(function(err) {
            pmIsBusy = false;
            if (err) { showPmStatus('Delete failed', 'err'); return; }
            showPmStatus('Profile "' + name + '" deleted', 'ok');
            pmRenderProfiles();
            pmRefreshDropdown();
        });
    });

    // PM — RENAME (inline)
    $(document).on('click', '.pm-action-rename', function() {
        if (pmIsBusy) return;
        var $row    = $(this).closest('.pm-profile-row');
        var $name   = $row.find('.pm-profile-name');
        var oldName = $row.data('name');
        $name.replaceWith('<input class="pm-rename-input" value="' + _.escape(oldName) + '" />');
        $row.find('.pm-action-rename').replaceWith(
            '<button class="pm-btn pm-btn-primary pm-rename-confirm">OK</button>' +
            '<button class="pm-btn pm-rename-cancel">Cancel</button>'
        );
        $row.find('.pm-rename-input').focus().select();
    });

    $(document).on('click', '.pm-rename-confirm', function() {
        if (pmIsBusy) return;
        var $row    = $(this).closest('.pm-profile-row');
        var oldName = $row.data('name');
        var newName = $row.find('.pm-rename-input').val().trim();
        if (!newName) { showPmStatus('Name cannot be empty', 'err'); return; }
        if (newName === oldName) { pmRenderProfiles(); return; }
        if (_.findWhere(pmProfiles, { profile_name: newName })) {
            showPmStatus('A profile named "' + newName + '" already exists', 'err');
            return;
        }
        pmIsBusy = true;
        var p = _.findWhere(pmProfiles, { profile_name: oldName });
        if (p) p.profile_name = newName;
        pmSaveLookup(function(err) {
            pmIsBusy = false;
            if (err) { showPmStatus('Rename failed', 'err'); pmLoadProfiles(); return; }
            showPmStatus('Renamed to "' + newName + '"', 'ok');
            pmRenderProfiles();
            pmRefreshDropdown();
        });
    });

    $(document).on('click', '.pm-rename-cancel', function() { pmRenderProfiles(); });

    // PM — EDIT FIELDS (inline sub-panel)
    $(document).on('click', '.pm-action-edit-fields', function() {
        if (pmIsBusy) return;
        var $row = $(this).closest('.pm-profile-row');
        var name = $row.data('name');
        var p    = _.findWhere(pmProfiles, { profile_name: name });
        if (!p) return;

        $('.pm-edit-fields-panel').remove();
        var currentFields = _.map(p.field_list.split(','), function(f) { return f.trim(); });
        var panelId = 'pm-edit-fp-' + Date.now();

        var $panel = $(
            '<div class="pm-edit-fields-panel" id="' + panelId + '">' +
              '<label style="font-size:13px;color:#aaa;margin-bottom:6px;display:block;">' +
                'Edit fields for <b>' + _.escape(name) + '</b>' +
              '</label>' +
              '<input class="pm-field-search" id="' + panelId + '-search" placeholder="Search fields\u2026" />' +
              '<div class="pm-field-list" id="' + panelId + '-list"></div>' +
              '<div class="pm-field-actions">' +
                '<span class="pm-selected-summary" id="' + panelId + '-summary">0 selected</span>' +
                '<button class="pm-btn" id="' + panelId + '-all">Select All</button>' +
                '<button class="pm-btn" id="' + panelId + '-none">Clear</button>' +
                '<button class="pm-btn pm-btn-primary" id="' + panelId + '-save">Save Fields</button>' +
                '<button class="pm-btn" id="' + panelId + '-cancel">Cancel</button>' +
              '</div>' +
            '</div>'
        );
        $row.after($panel);

        var editPicker = pmRenderFieldPicker({
            listEl:    '#' + panelId + '-list',
            searchEl:  '#' + panelId + '-search',
            summaryEl: '#' + panelId + '-summary',
            selected:  currentFields
        });

        $('#' + panelId + '-all').on('click',    function() { editPicker.selectAll(); });
        $('#' + panelId + '-none').on('click',   function() { editPicker.selectNone(); });
        $('#' + panelId + '-cancel').on('click', function() { $panel.remove(); });
        $('#' + panelId + '-save').on('click', function() {
            var sel = editPicker.getSelected();
            if (sel.length === 0) { showPmStatus('Select at least one field', 'err'); return; }
            pmIsBusy = true;
            p.field_list = sel.join(', ');
            pmSaveLookup(function(err) {
                pmIsBusy = false;
                if (err) { showPmStatus('Failed to save fields', 'err'); pmLoadProfiles(); return; }
                showPmStatus('Fields updated for "' + name + '"', 'ok');
                $panel.remove();
                pmRenderProfiles();
                pmRefreshDropdown();
            });
        });
    });

    // PM — LOAD (apply profile to field picker)
    $(document).on('click', '.pm-action-load', function() {
        var name = $(this).closest('.pm-profile-row').data('name');
        var p    = _.findWhere(pmProfiles, { profile_name: name });
        if (!p) return;
        tokens_default.set('profile_sets_fields', '1');
        tokens_default.set('form.selected_fields', p.field_list);
        tokens_submitted.set('form.selected_fields', p.field_list);
        showPmStatus('Loaded profile "' + name + '"', 'ok');
    });

    // PM — CREATE
    $('#pm-create-btn').on('click', function() {
        if (pmIsBusy) return;
        var newName = $('#pm-new-name').val().trim();
        if (!newName) { showPmStatus('Enter a profile name', 'err'); return; }
        if (_.findWhere(pmProfiles, { profile_name: newName })) {
            showPmStatus('A profile named "' + newName + '" already exists', 'err');
            return;
        }
        var selectedFields = pmCreatePicker ? pmCreatePicker.getSelected() : [];
        if (selectedFields.length === 0) { showPmStatus('Select at least one field', 'err'); return; }
        pmIsBusy = true;
        pmProfiles.push({ profile_name: newName, field_list: selectedFields.join(', ') });
        pmSaveLookup(function(err) {
            pmIsBusy = false;
            if (err) { pmProfiles.pop(); showPmStatus('Create failed', 'err'); return; }
            showPmStatus('Profile "' + newName + '" created', 'ok');
            $('#pm-new-name').val('');
            if (pmCreatePicker) pmCreatePicker.setSelected(['_time', '_raw']);
            pmRenderProfiles();
            pmRefreshDropdown();
            $('.pm-tab[data-tab="profiles"]').trigger('click');
        });
    });

    // PM — Open / close modal
    function openPmModal() {
        var profilesDone = false;
        var fieldsDone   = false;
        function checkReady() {
            if (profilesDone && fieldsDone) {
                pmInitCreatePicker();
                $('#pm-overlay').addClass('pm-visible');
            }
        }
        pmLoadProfiles(function()      { profilesDone = true; checkReady(); });
        pmLoadAvailableFields(function() { fieldsDone   = true; checkReady(); });
    }

    function closePmModal() {
        $('#pm-overlay').removeClass('pm-visible');
        $('.pm-edit-fields-panel').remove();
    }

    $('#pm-close, #pm-close-footer').on('click', closePmModal);
    $('#pm-overlay').on('click', function(e) { if (e.target === this) closePmModal(); });

    // PM — Toolbar button
    $('#dtf-manage-profiles-btn').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openPmModal();
    });

    // =========================================================================
    // EDIT MODAL (existing)
    // =========================================================================
    $('body').append(
        '<div id="edit-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;' +
        'background:rgba(0,0,0,0.4);z-index:10000;justify-content:center;align-items:center;">' +
          '<div style="background:#fff;border-radius:4px;padding:24px;width:480px;max-width:90%;' +
          'box-shadow:0 8px 32px rgba(0,0,0,.15);border:1px solid #c3cbd4;">' +
            '<h3 style="margin-top:0;color:#1a1c1e;font-size:15px;border-bottom:1px solid #eaedf0;' +
            'padding-bottom:12px;margin-bottom:16px;">Edit Event Metadata</h3>' +
            '<label style="font-size:11px;font-weight:700;text-transform:uppercase;' +
            'letter-spacing:.05em;color:#5c656e;">Status</label>' +
            '<select id="ed-status" style="width:100%;padding:6px 8px;margin-bottom:12px;margin-top:4px;' +
            'border:1px solid #c3cbd4;border-radius:3px;font-size:13px;background:#fff;">' + statusOpts + '</select>' +
            '<label style="font-size:11px;font-weight:700;text-transform:uppercase;' +
            'letter-spacing:.05em;color:#5c656e;">MITRE Tactic</label>' +
            '<select id="ed-tactic" style="width:100%;padding:6px 8px;margin-bottom:12px;margin-top:4px;' +
            'border:1px solid #c3cbd4;border-radius:3px;font-size:13px;background:#fff;">' + tacticOpts + '</select>' +
            '<label style="font-size:11px;font-weight:700;text-transform:uppercase;' +
            'letter-spacing:.05em;color:#5c656e;">Description</label>' +
            '<textarea id="ed-desc" rows="4" style="width:100%;padding:6px 8px;margin-bottom:16px;margin-top:4px;' +
            'resize:vertical;border:1px solid #c3cbd4;border-radius:3px;font-size:13px;font-family:inherit;"></textarea>' +
            '<div style="display:flex;justify-content:flex-end;gap:8px;">' +
              '<button id="ed-cancel" style="padding:6px 14px;border:1px solid #c3cbd4;border-radius:3px;' +
              'background:#fff;cursor:pointer;font-size:13px;color:#1a1c1e;">Cancel</button>' +
              '<button id="ed-save" style="padding:6px 14px;border:none;border-radius:3px;' +
              'background:#118832;color:#fff;cursor:pointer;font-size:13px;font-weight:600;">Save</button>' +
            '</div>' +
          '</div>' +
        '</div>'
    );

    var editEventId = null;

    var loadMetaSearch = new SearchManager({
        id: 'load_metadata_search',
        preview: false,
        autostart: false
    });

    function openModal(eventId) {
        editEventId = eventId;
        $('#ed-status').val('');
        $('#ed-tactic').val('');
        $('#ed-desc').val('');
        $('#ed-save').prop('disabled', true).text('Loading...');

        loadMetaSearch.set('search', '| inputlookup flagged_events | search id="' + eventId + '" | head 1');
        loadMetaSearch.startSearch();

        loadMetaSearch.off('search:done');
        loadMetaSearch.on('search:done', function(properties) {
            var resultCount = properties.content.resultCount || 0;
            if (resultCount === 0) {
                $('#ed-save').prop('disabled', false).text('Save');
                return;
            }
            var results = loadMetaSearch.data('results');
            if (results) {
                results.on('data', function() {
                    var rows   = results.data().rows;
                    var fields = results.data().fields;
                    if (rows && rows.length > 0) {
                        var row = rows[0];
                        var getField = function(name) {
                            var idx = fields.indexOf(name);
                            return idx !== -1 ? row[idx] : '';
                        };
                        $('#ed-status').val(getField('status'));
                        $('#ed-tactic').val(getField('mitre_tactic'));
                        $('#ed-desc').val(getField('description'));
                    }
                    $('#ed-save').prop('disabled', false).text('Save');
                });
            } else {
                $('#ed-save').prop('disabled', false).text('Save');
            }
        });

        $('#edit-modal').css('display', 'flex');
    }

    $('#ed-cancel').on('click', function() { editEventId = null; $('#edit-modal').hide(); });
    $('#edit-modal').on('click', function(e) {
        if (e.target === this) { editEventId = null; $(this).hide(); }
    });

    var saveMetaSearch = new SearchManager({
        id: 'save_metadata_search',
        preview: false,
        autostart: false
    });

    $('#ed-save').on('click', function() {
        if (!editEventId) { $('#edit-modal').hide(); return; }

        var desc   = $('#ed-desc').val().replace(/"/g, '\\"');
        var tactic = $('#ed-tactic').val();
        var status = $('#ed-status').val();

        var spl = '| inputlookup flagged_events' +
            ' | eval description = if(id="' + editEventId + '", "' + desc + '", description)' +
            ' | eval mitre_tactic = if(id="' + editEventId + '", "' + tactic + '", mitre_tactic)' +
            ' | eval status = if(id="' + editEventId + '", "' + status + '", status)' +
            ' | outputlookup flagged_events';

        saveMetaSearch.set('search', spl);
        saveMetaSearch.startSearch();

        saveMetaSearch.off('search:done');
        saveMetaSearch.on('search:done', function() {
            console.log("KVStore updated successfully");
            var flaggedEl = mvc.Components.getInstance("expand_with_events_flagged");
            if (flaggedEl) {
                var mgr = mvc.Components.get(flaggedEl.settings.get("managerid"));
                if (mgr) { mgr.startSearch(); }
            }
        });

        editEventId = null;
        $('#edit-modal').hide();
    });

    // =========================================================================
    // TABLE RENDERERS (existing)
    // =========================================================================
    // Capture-phase: intercept click on edit-icon before Splunk
    document.addEventListener('click', function(e) {
        var el = e.target.closest('.edit-icon');
        if (el) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            var $td = $(el).closest('td');
            var displayValue = $td.attr('title');
            if (displayValue) { openModal(displayValue.slice(0, -2)); }
        }
    }, true);

    var CustomRangeRenderer = TableView.BaseCellRenderer.extend({
        TRUNCATE_LENGTH: 0,
        canRender: function(cell) {
            return cell.field;
        },
        render: function($container, rowData) {
            var fieldValue = rowData.value;
            var fieldName  = rowData.field;
            if (fieldName === "Flag") {
                var displayValue = fieldValue.split("@@")[0];
                if (displayValue.length > this.TRUNCATE_LENGTH) {
                    var truncatedValue = displayValue.substring(0, this.TRUNCATE_LENGTH);
                    if (displayValue.endsWith("|0")) {
                        truncatedValue = truncatedValue + '\uD83C\uDFF3\uFE0F';
                    } else {
                        truncatedValue = truncatedValue + '\uD83D\uDEA9';
                    }

                    var $flagSpan = $('<span class="flag-icon">' + truncatedValue + '</span>');
                    $container.empty().append($flagSpan);

                    if (displayValue.endsWith("|1")) {
                        $container.append('<span class="edit-icon" style="cursor:pointer;margin-left:6px;font-size:14px;" title="Edit">\u270F\uFE0F</span>');
                    }

                    $container.attr('title', displayValue);
                    $container.off('click').on('click', function(e) {
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        e.preventDefault();
                        if ($(e.target).hasClass('edit-icon') || $(e.target).closest('.edit-icon').length) return;
                        if (displayValue.endsWith("|1") && !$(e.target).hasClass('flag-icon') && !$(e.target).closest('.flag-icon').length) return;

                        if (tokens_default.get("event_to_add")) {
                            console.log("Action bloquée : une mise à jour est déjà en cours.");
                            return;
                        }
                        var eventToAdd = displayValue.slice(0, -2);
                        tokens_default.set("event_to_add", eventToAdd);
                        tokens_submitted.set("event_to_add", eventToAdd);

                        var toggleSearch = mvc.Components.get('toggle');
                        var $cell = $(e.currentTarget);
                        var $flag = $cell.find('.flag-icon');
                        var currentDisplay = $flag.text();
                        var nextEmoji = currentDisplay.includes("\uD83D\uDEA9") ? "\uD83C\uDFF3\uFE0F" : "\uD83D\uDEA9";
                        $flag.html(nextEmoji);

                        if (nextEmoji.includes("\uD83D\uDEA9")) {
                            if ($cell.find('.edit-icon').length === 0) {
                                $cell.append('<span class="edit-icon" style="cursor:pointer;margin-left:6px;font-size:14px;" title="Edit">\u270F\uFE0F</span>');
                            }
                        } else {
                            $cell.find('.edit-icon').remove();
                        }

                        if (toggleSearch) { toggleSearch.startSearch(); }
                        tokens_default.unset("event_to_add");
                        tokens_submitted.unset("event_to_add");
                        console.log("Click blocked for others. Clean value:");
                    });
                } else {
                    $container.html(displayValue);
                }
            } else {
                
                $container.off('click').on('click', function(e) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    var field = rowData.field;
                    var value = rowData.value;
                    console.log("v2.0 Click on " + field + " | " + value);
                    openAddModal(field, value);
                });

                $container.html(fieldValue);
            }
        }
    });

    var EventSearchBasedRowExpansionRenderer = TableView.BaseRowExpansionRenderer.extend({
        initialize: function(args) {
            this._searchManager = new SearchManager({
                preview: false
            }, { tokens: true, tokenNamespace: "submitted" });
            this._TableView = new EventsViewer({
                managerid: this._searchManager.name,
                drilldown: 'cell',
                type: "raw"
            });
        },
        canRender: function(rowData) { return true; },
        render: function($container, rowData) {
            var metadataIndex = -1;
            for (var i = 0; i < rowData.fields.length; i++) {
                if (rowData.fields[i] === "Flag") { metadataIndex = i; break; }
            }
            var metadata = (metadataIndex !== -1) ? rowData.values[metadataIndex] : "";
            var uid = (metadata.split("|")[0]) || "";
            var search = 'index="*" uid="' + uid + '" earliest="0" | head 1 | fields *';
            this._searchManager.set({ search: search });
            $container.append(this._TableView.render().el);
        }
    });

    var local_apps    = mvc.Components.get(mvc.Components.get('expand_with_events').settings.get("managerid"));
    var flagged_event = mvc.Components.get(mvc.Components.get('expand_with_events_flagged').settings.get("managerid"));

    mvc.Components.get(mvc.Components.get('toggle').settings.get("managerid")).on('search:done', function() {
        tokens_submitted.unset('event_to_add');
        tokens_default.unset('event_to_add');
        flagged_event.startSearch();
    });

    var tableElement = mvc.Components.getInstance("expand_with_events");
    tableElement.getVisualization(function(tableView) {
        tableView.table.addCellRenderer(new CustomRangeRenderer());
        tableView.render();
        tableView.addRowExpansionRenderer(new EventSearchBasedRowExpansionRenderer());
    });

    var tableElementflagged = mvc.Components.getInstance("expand_with_events_flagged");
    tableElementflagged.getVisualization(function(tableView) {
        tableView.table.addCellRenderer(new CustomRangeRenderer());
        tableView.render();
        tableView.addRowExpansionRenderer(new EventSearchBasedRowExpansionRenderer());
    });

    $(document).on('click', function(e) {
        console.log('target:', e.target);
        console.log('classes:', $(e.target).attr('class'));
        console.log('closest drilldown:', $(e.target).closest('[class*="drill"]'));
    });
});