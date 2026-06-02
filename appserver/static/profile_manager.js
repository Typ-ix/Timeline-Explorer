require([
    'splunkjs/mvc',
    'splunkjs/mvc/searchmanager',
    'jquery',
    'underscore',
    'splunkjs/mvc/simplexml/ready!'
], function(mvc, SearchManager, $, _) {

    var tokens_default = mvc.Components.getInstance('default');
    var tokens_submitted = mvc.Components.getInstance('submitted');

    console.log('profile_manager.js — initializing');

    // =========================================================================
    // CSS
    // =========================================================================
    var css = `
        /* ---- overlay ---- */
        .pm-overlay {
            display: none;
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,.45);
            z-index: 10000;
            justify-content: center; align-items: center;
        }
        .pm-overlay.pm-visible { display: flex; }

        /* ---- modal ---- */
        .pm-modal {
            background: #1a1c21; color: #c3cbd6;
            border-radius: 8px; width: 680px; max-height: 85vh;
            display: flex; flex-direction: column;
            box-shadow: 0 8px 32px rgba(0,0,0,.5);
            font-family: "Splunk Platform Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
        }
        .pm-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 16px 20px; border-bottom: 1px solid #333;
        }
        .pm-header h2 { margin: 0; font-size: 18px; color: #f5f5f5; }
        .pm-close {
            background: none; border: none; color: #999; font-size: 22px;
            cursor: pointer; padding: 0 4px;
        }
        .pm-close:hover { color: #fff; }

        /* ---- tabs ---- */
        .pm-tabs {
            display: flex; border-bottom: 1px solid #333;
            padding: 0 20px; gap: 0;
        }
        .pm-tab {
            padding: 10px 18px; cursor: pointer;
            font-size: 13px; color: #888;
            border-bottom: 2px solid transparent;
            transition: all .15s;
        }
        .pm-tab:hover { color: #ccc; }
        .pm-tab.pm-tab-active {
            color: #6fb3cf; border-bottom-color: #6fb3cf;
        }

        /* ---- tab panels ---- */
        .pm-tab-panel { display: none; padding: 16px 20px; overflow-y: auto; flex: 1; }
        .pm-tab-panel.pm-tab-panel-active { display: block; }

        /* ---- body ---- */
        .pm-body { overflow-y: auto; flex: 1; display: flex; flex-direction: column; }

        /* ---- profile rows ---- */
        .pm-profile-row {
            display: flex; align-items: center; gap: 8px;
            padding: 8px 10px; border-radius: 4px;
            border: 1px solid #333; margin-bottom: 6px;
            background: #22252b;
        }
        .pm-profile-row:hover { background: #2a2e36; }
        .pm-profile-name {
            flex: 1; font-size: 14px; color: #e0e0e0;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            min-width: 100px;
        }
        .pm-profile-fields {
            flex: 2; font-size: 11px; color: #888;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .pm-btn {
            padding: 4px 10px; border-radius: 4px; border: 1px solid #555;
            background: #2c2f36; color: #ccc; cursor: pointer; font-size: 12px;
            white-space: nowrap;
        }
        .pm-btn:hover { background: #3a3e48; color: #fff; }
        .pm-btn.pm-btn-danger { border-color: #8b3a3a; color: #e88; }
        .pm-btn.pm-btn-danger:hover { background: #5c2020; color: #faa; }
        .pm-btn.pm-btn-primary { border-color: #3a7d5c; color: #6fcf97; }
        .pm-btn.pm-btn-primary:hover { background: #264d3a; color: #a0f0c0; }
        .pm-btn.pm-btn-load { border-color: #3a5c7d; color: #6fb3cf; }
        .pm-btn.pm-btn-load:hover { background: #243d4d; color: #a0d8f0; }

        /* ---- inline rename input ---- */
        .pm-rename-input {
            flex: 1; padding: 3px 6px; font-size: 13px;
            background: #111; color: #eee; border: 1px solid #555; border-radius: 3px;
        }

        /* ---- field picker ---- */
        .pm-field-picker-wrap {
            margin-top: 10px;
        }
        .pm-field-picker-wrap label {
            font-size: 13px; color: #aaa; display: block; margin-bottom: 6px;
        }
        .pm-field-search {
            width: 100%; padding: 6px 10px; font-size: 13px;
            background: #111; color: #eee; border: 1px solid #555; border-radius: 4px;
            box-sizing: border-box; margin-bottom: 6px;
        }
        .pm-field-list {
            max-height: 200px; overflow-y: auto;
            border: 1px solid #333; border-radius: 4px;
            background: #111; padding: 4px 0;
        }
        .pm-field-item {
            display: flex; align-items: center; gap: 8px;
            padding: 4px 10px; cursor: pointer; font-size: 13px; color: #ccc;
        }
        .pm-field-item:hover { background: #1e2228; }
        .pm-field-item input[type="checkbox"] {
            accent-color: #6fb3cf; cursor: pointer;
        }
        .pm-field-item.pm-field-selected { color: #6fcf97; }
        .pm-field-actions {
            display: flex; gap: 8px; margin-top: 6px; align-items: center;
        }
        .pm-field-actions .pm-selected-summary {
            font-size: 11px; color: #888; flex: 1;
        }
        .pm-field-loading {
            text-align: center; color: #666; padding: 16px; font-size: 12px;
        }

        /* ---- new profile section ---- */
        .pm-new-section {
            margin-top: 0;
        }
        .pm-new-section label { font-size: 13px; color: #aaa; display: block; margin-bottom: 4px; }
        .pm-new-input {
            width: 100%; padding: 6px 10px; font-size: 13px;
            background: #111; color: #eee; border: 1px solid #555; border-radius: 4px;
            box-sizing: border-box; margin-bottom: 8px;
        }

        /* ---- edit fields sub-panel (inline in profile row) ---- */
        .pm-edit-fields-panel {
            border: 1px solid #444; border-radius: 4px;
            background: #1a1c21; padding: 10px;
            margin-top: 6px; margin-bottom: 6px;
        }

        /* ---- status ---- */
        .pm-status {
            padding: 8px 12px; font-size: 12px; border-radius: 4px;
            margin: 10px 20px; display: none;
        }
        .pm-status.pm-success { display: block; background: #1e3a2a; color: #6fcf97; border: 1px solid #3a7d5c; }
        .pm-status.pm-error   { display: block; background: #3a1e1e; color: #e88;    border: 1px solid #8b3a3a; }

        /* ---- empty state ---- */
        .pm-empty { text-align: center; color: #666; padding: 24px 0; font-size: 13px; }

        /* ---- footer ---- */
        .pm-footer {
            padding: 12px 20px; border-top: 1px solid #333;
            display: flex; justify-content: flex-end;
        }

        /* ---- open button ---- */
        .pm-open-btn {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 6px 14px; border-radius: 4px;
            background: #2c2f36; color: #ccc; border: 1px solid #555;
            cursor: pointer; font-size: 13px; margin: 0 0 8px 10px;
        }
        .pm-open-btn:hover { background: #3a3e48; color: #fff; }
    `;
    $('<style>').html(css).appendTo('head');

    // =========================================================================
    // HTML template
    // =========================================================================
    var modalHtml = `
        <div class="pm-overlay" id="pm-overlay">
            <div class="pm-modal">
                <div class="pm-header">
                    <h2>📋 Profile Manager 📋</h2>
                    <button class="pm-close" id="pm-close">&times;</button>
                </div>
                <div class="pm-tabs">
                    <div class="pm-tab pm-tab-active" data-tab="profiles">Profiles</div>
                    <div class="pm-tab" data-tab="create">+ New Profile</div>
                </div>
                <div class="pm-body">
                    <!-- PROFILES TAB -->
                    <div class="pm-tab-panel pm-tab-panel-active" data-tab="profiles">
                        <div id="pm-profile-list"></div>
                    </div>
                    <!-- CREATE TAB -->
                    <div class="pm-tab-panel" data-tab="create">
                        <div class="pm-new-section">
                            <label>Profile Name</label>
                            <input class="pm-new-input" id="pm-new-name"
                                   placeholder="e.g. Network Logs, Auth Events…" />
                            <div class="pm-field-picker-wrap" id="pm-create-picker-wrap">
                                <label>Select Fields</label>
                                <input class="pm-field-search" id="pm-create-field-search"
                                       placeholder="Search fields…" />
                                <div class="pm-field-list" id="pm-create-field-list">
                                    <div class="pm-field-loading">Select an index &amp; source first, then open this modal.</div>
                                </div>
                                <div class="pm-field-actions">
                                    <span class="pm-selected-summary" id="pm-create-selected-summary">0 fields selected</span>
                                    <button class="pm-btn" id="pm-create-select-all">Select All</button>
                                    <button class="pm-btn" id="pm-create-select-none">Clear</button>
                                </div>
                            </div>
                            <div style="margin-top:12px;">
                                <button class="pm-btn pm-btn-primary" id="pm-create-btn">+ Create Profile</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="pm-status" id="pm-status"></div>
                <div class="pm-footer">
                    <button class="pm-btn" id="pm-close-footer">Close</button>
                </div>
            </div>
        </div>
    `;
    $('body').append(modalHtml);

    // =========================================================================
    // Tab switching
    // =========================================================================
    $(document).on('click', '.pm-tab', function() {
        var tab = $(this).data('tab');
        $('.pm-tab').removeClass('pm-tab-active');
        $(this).addClass('pm-tab-active');
        $('.pm-tab-panel').removeClass('pm-tab-panel-active');
        $('.pm-tab-panel[data-tab="' + tab + '"]').addClass('pm-tab-panel-active');
    });

    // =========================================================================
    // State
    // =========================================================================
    var profiles = [];          // [{profile_name, field_list}]
    var availableFields = [];   // ['_time', '_raw', 'host', ...]
    var isBusy = false;

    // =========================================================================
    // Helpers
    // =========================================================================
    function showStatus(msg, type) {
        var $s = $('#pm-status');
        $s.text(msg).removeClass('pm-success pm-error')
          .addClass(type === 'ok' ? 'pm-success' : 'pm-error')
          .show();
        setTimeout(function() { $s.fadeOut(300, function(){ $(this).removeClass('pm-success pm-error'); }); }, 3000);
    }

    function escSpl(str) {
        return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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
    // Load available fields from the index/source
    // =========================================================================
    function loadAvailableFields(callback) {
        var dbIndex = tokens_submitted.get('db_index') || tokens_default.get('form.db_index') || tokens_default.get('db_index');
        var dbSource = tokens_submitted.get('db_source') || tokens_default.get('form.db_source') || tokens_default.get('db_source');

        if (!dbIndex) {
            availableFields = [];
            if (callback) callback();
            return;
        }

        var spl = 'index=' + dbIndex;
        if (dbSource) {
            spl += ' source=' + dbSource;
        }
        spl += ' | head 1000 | fieldsummary | table field | search NOT field IN ("_set_v", "_si", "_indextime", "_confstr", "_serial", "_sourcetype")';

        var sm = new SearchManager({
            preview: false,
            cache: false,
            search: spl,
            earliest_time: '0',
            latest_time: '',
            autostart: true
        });

        var done = false;
        function finish() {
            if (done) return;
            done = true;
            if (callback) callback();
        }

        sm.on('search:done', function(properties) {
            var resultCount = properties.content.resultCount || 0;
            if (resultCount === 0) {
                availableFields = [];
                finish();
                return;
            }
            var results = sm.data('results', { count: 0 });
            results.on('data', function() {
                availableFields = [];
                var rows = results.data().rows;
                var fields = results.data().fields;
                var fieldIdx = fields.indexOf('field');
                _.each(rows, function(row) {
                    availableFields.push(row[fieldIdx]);
                });
                availableFields.sort();
                finish();
            });
            setTimeout(function() { finish(); }, 5000);
        });
        sm.on('search:error search:failed', function() {
            availableFields = [];
            finish();
        });
    }

    // =========================================================================
    // Render a field picker into a container
    // =========================================================================
    // pickerConfig: {
    //   listEl:    selector for the .pm-field-list div
    //   searchEl:  selector for the search input
    //   summaryEl: selector for the summary span
    //   selected:  array of currently selected field names
    //   onchange:  callback(selectedArray)
    // }
    function renderFieldPicker(cfg) {
        var $list = $(cfg.listEl);
        var selected = cfg.selected || [];

        function render(filter) {
            $list.empty();
            var filtered = availableFields;
            if (filter) {
                var lc = filter.toLowerCase();
                filtered = _.filter(availableFields, function(f) {
                    return f.toLowerCase().indexOf(lc) !== -1;
                });
            }
            if (filtered.length === 0) {
                $list.html('<div class="pm-field-loading">No fields found.</div>');
                return;
            }
            _.each(filtered, function(fname) {
                var checked = _.contains(selected, fname) ? 'checked' : '';
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

        // Search/filter
        $(cfg.searchEl).off('input.pm').on('input.pm', function() {
            render($(this).val());
        });

        // Toggle field on click
        $list.off('click.pm').on('click.pm', '.pm-field-item', function(e) {
            var fname = $(this).data('field');
            var $cb = $(this).find('input[type="checkbox"]');
            // If click wasn't on checkbox itself, toggle it
            if (!$(e.target).is('input')) {
                $cb.prop('checked', !$cb.prop('checked'));
            }
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
            setSelected: function(arr) {
                selected = arr.slice();
                render($(cfg.searchEl).val());
                updateSummary();
            },
            selectAll: function() {
                selected = availableFields.slice();
                render($(cfg.searchEl).val());
                updateSummary();
            },
            selectNone: function() {
                selected = [];
                render($(cfg.searchEl).val());
                updateSummary();
            }
        };
    }

    // =========================================================================
    // Create-tab field picker instance
    // =========================================================================
    var createPicker = null;

    function initCreatePicker() {
        createPicker = renderFieldPicker({
            listEl:    '#pm-create-field-list',
            searchEl:  '#pm-create-field-search',
            summaryEl: '#pm-create-selected-summary',
            selected:  ['_time', '_raw']
        });
    }

    $('#pm-create-select-all').on('click', function() { if (createPicker) createPicker.selectAll(); });
    $('#pm-create-select-none').on('click', function() { if (createPicker) createPicker.selectNone(); });

    // =========================================================================
    // Load profiles from lookup
    // =========================================================================
    function loadProfiles(callback) {
        var sm = new SearchManager({
            preview: false,
            cache: false,
            search: '| inputlookup custom_field_profiles.csv | stats last(field_list) as field_list by profile_name | table profile_name field_list',
            earliest_time: '0',
            latest_time: 'now',
            autostart: true
        });

        var callbackFired = false;
        function fireCallback() {
            if (callbackFired) return;
            callbackFired = true;
            renderProfiles();
            if (callback) callback();
        }

        sm.on('search:done', function(properties) {
            var resultCount = properties.content.resultCount || 0;
            if (resultCount === 0) {
                profiles = [];
                fireCallback();
                return;
            }
            var results = sm.data('results', { count: 0 });
            results.on('data', function() {
                profiles = [];
                var rows = results.data().rows;
                var fields = results.data().fields;
                var nameIdx = fields.indexOf('profile_name');
                var listIdx = fields.indexOf('field_list');
                _.each(rows, function(row) {
                    profiles.push({
                        profile_name: row[nameIdx],
                        field_list:   row[listIdx]
                    });
                });
                fireCallback();
            });
            setTimeout(function() { fireCallback(); }, 3000);
        });
        sm.on('search:error', function(msg) {
            console.error('profile_manager: search error', msg);
            profiles = [];
            fireCallback();
        });
        sm.on('search:failed', function(msg) {
            console.error('profile_manager: search failed', msg);
            profiles = [];
            fireCallback();
        });
    }

    // =========================================================================
    // Render profile rows
    // =========================================================================
    function renderProfiles() {
        var $list = $('#pm-profile-list').empty();
        if (profiles.length === 0) {
            $list.html('<div class="pm-empty">No profiles yet — switch to the <b>+ New Profile</b> tab to create one.</div>');
            return;
        }
        _.each(profiles, function(p) {
            var fieldArr = _.map(p.field_list.split(','), function(f) { return f.trim(); });
            var fieldsPreview = fieldArr.join(', ');
            if (fieldsPreview.length > 55) fieldsPreview = fieldsPreview.substring(0, 55) + '…';

            var $row = $(`
                <div class="pm-profile-row" data-name="${_.escape(p.profile_name)}">
                    <span class="pm-profile-name" title="${_.escape(p.profile_name)}">
                        ${_.escape(p.profile_name)}
                    </span>
                    <span class="pm-profile-fields" title="${_.escape(p.field_list)}">
                        ${_.escape(fieldsPreview)} (${fieldArr.length})
                    </span>
                    <button class="pm-btn pm-btn-load pm-action-load"     title="Load this profile into the dashboard">Load</button>
                    <button class="pm-btn pm-action-edit-fields"          title="Edit fields in this profile">Fields</button>
                    <button class="pm-btn pm-action-rename"               title="Rename this profile">Rename</button>
                    <button class="pm-btn pm-btn-danger pm-action-delete" title="Delete this profile">Delete</button>
                </div>
            `);
            $list.append($row);
        });
    }

    // =========================================================================
    // Rewrite the entire lookup from the local profiles array
    // =========================================================================
    function saveLookup(callback) {
        if (profiles.length === 0) {
            var spl = '| makeresults | eval profile_name="", field_list="" | where 1=0 | outputlookup custom_field_profiles.csv';
            runSpl(spl, callback);
            return;
        }
        var parts = _.map(profiles, function(p) {
            return '| append [| makeresults | eval profile_name="' + escSpl(p.profile_name) + '", field_list="' + escSpl(p.field_list) + '"]';
        });
        var spl = '| makeresults | eval profile_name="__init__" ' +
                  parts.join(' ') +
                  ' | where profile_name!="__init__" | outputlookup custom_field_profiles.csv';
        runSpl(spl, callback);
    }

    // =========================================================================
    // Actions
    // =========================================================================

    // ---- DELETE ----
    $(document).on('click', '.pm-action-delete', function() {
        if (isBusy) return;
        var name = $(this).closest('.pm-profile-row').data('name');
        if (!confirm('Delete profile "' + name + '"?')) return;
        isBusy = true;
        profiles = _.filter(profiles, function(p) { return p.profile_name !== name; });
        saveLookup(function(err) {
            isBusy = false;
            if (err) { showStatus('Delete failed', 'err'); return; }
            showStatus('Profile "' + name + '" deleted', 'ok');
            renderProfiles();
            refreshDropdown();
        });
    });

    // ---- RENAME (inline) ----
    $(document).on('click', '.pm-action-rename', function() {
        if (isBusy) return;
        var $row  = $(this).closest('.pm-profile-row');
        var $name = $row.find('.pm-profile-name');
        var oldName = $row.data('name');

        $name.replaceWith(
            '<input class="pm-rename-input" value="' + _.escape(oldName) + '" />'
        );
        $row.find('.pm-action-rename').replaceWith(
            '<button class="pm-btn pm-btn-primary pm-rename-confirm">OK</button>' +
            '<button class="pm-btn pm-rename-cancel">Cancel</button>'
        );
        $row.find('.pm-rename-input').focus().select();
    });

    $(document).on('click', '.pm-rename-confirm', function() {
        if (isBusy) return;
        var $row    = $(this).closest('.pm-profile-row');
        var oldName = $row.data('name');
        var newName = $row.find('.pm-rename-input').val().trim();

        if (!newName) { showStatus('Name cannot be empty', 'err'); return; }
        if (newName === oldName) { renderProfiles(); return; }
        if (_.findWhere(profiles, { profile_name: newName })) {
            showStatus('A profile named "' + newName + '" already exists', 'err');
            return;
        }

        isBusy = true;
        var p = _.findWhere(profiles, { profile_name: oldName });
        if (p) p.profile_name = newName;
        saveLookup(function(err) {
            isBusy = false;
            if (err) { showStatus('Rename failed', 'err'); loadProfiles(); return; }
            showStatus('Renamed to "' + newName + '"', 'ok');
            renderProfiles();
            refreshDropdown();
        });
    });

    $(document).on('click', '.pm-rename-cancel', function() {
        renderProfiles();
    });

    // ---- EDIT FIELDS (inline sub-panel) ----
    $(document).on('click', '.pm-action-edit-fields', function() {
        if (isBusy) return;
        var $row = $(this).closest('.pm-profile-row');
        var name = $row.data('name');
        var p = _.findWhere(profiles, { profile_name: name });
        if (!p) return;

        // Close any other open edit panels
        $('.pm-edit-fields-panel').remove();

        var currentFields = _.map(p.field_list.split(','), function(f) { return f.trim(); });
        var panelId = 'pm-edit-fp-' + Date.now();

        var $panel = $(`
            <div class="pm-edit-fields-panel" id="${panelId}">
                <label style="font-size:13px; color:#aaa; margin-bottom:6px; display:block;">
                    Edit fields for <b>${_.escape(name)}</b>
                </label>
                <input class="pm-field-search" id="${panelId}-search" placeholder="Search fields…" />
                <div class="pm-field-list" id="${panelId}-list"></div>
                <div class="pm-field-actions">
                    <span class="pm-selected-summary" id="${panelId}-summary">0 selected</span>
                    <button class="pm-btn" id="${panelId}-all">Select All</button>
                    <button class="pm-btn" id="${panelId}-none">Clear</button>
                    <button class="pm-btn pm-btn-primary" id="${panelId}-save">Save Fields</button>
                    <button class="pm-btn" id="${panelId}-cancel">Cancel</button>
                </div>
            </div>
        `);
        $row.after($panel);

        var editPicker = renderFieldPicker({
            listEl:    '#' + panelId + '-list',
            searchEl:  '#' + panelId + '-search',
            summaryEl: '#' + panelId + '-summary',
            selected:  currentFields
        });

        $('#' + panelId + '-all').on('click', function() { editPicker.selectAll(); });
        $('#' + panelId + '-none').on('click', function() { editPicker.selectNone(); });
        $('#' + panelId + '-cancel').on('click', function() { $panel.remove(); });
        $('#' + panelId + '-save').on('click', function() {
            var sel = editPicker.getSelected();
            if (sel.length === 0) {
                showStatus('Select at least one field', 'err');
                return;
            }
            isBusy = true;
            p.field_list = sel.join(', ');
            saveLookup(function(err) {
                isBusy = false;
                if (err) { showStatus('Failed to save fields', 'err'); loadProfiles(); return; }
                showStatus('Fields updated for "' + name + '"', 'ok');
                $panel.remove();
                renderProfiles();
                refreshDropdown();
            });
        });
    });

    // ---- LOAD (apply profile to field picker) ----
    $(document).on('click', '.pm-action-load', function() {
        var name = $(this).closest('.pm-profile-row').data('name');
        var p = _.findWhere(profiles, { profile_name: name });
        if (!p) return;

        tokens_default.set('profile_sets_fields', '1');
        tokens_default.set('form.selected_fields', p.field_list);
        tokens_submitted.set('form.selected_fields', p.field_list);

        showStatus('Loaded profile "' + name + '"', 'ok');
    });

    // ---- CREATE ----
    $('#pm-create-btn').on('click', function() {
        if (isBusy) return;
        var newName = $('#pm-new-name').val().trim();
        if (!newName) { showStatus('Enter a profile name', 'err'); return; }
        if (_.findWhere(profiles, { profile_name: newName })) {
            showStatus('A profile named "' + newName + '" already exists', 'err');
            return;
        }

        var selectedFields = createPicker ? createPicker.getSelected() : [];
        if (selectedFields.length === 0) {
            showStatus('Select at least one field', 'err');
            return;
        }

        var fieldList = selectedFields.join(', ');

        isBusy = true;
        profiles.push({ profile_name: newName, field_list: fieldList });
        saveLookup(function(err) {
            isBusy = false;
            if (err) { profiles.pop(); showStatus('Create failed', 'err'); return; }
            showStatus('Profile "' + newName + '" created', 'ok');
            $('#pm-new-name').val('');
            if (createPicker) createPicker.setSelected(['_time', '_raw']);
            renderProfiles();
            refreshDropdown();
            // Switch to profiles tab to show the new one
            $('.pm-tab[data-tab="profiles"]').trigger('click');
        });
    });

    // =========================================================================
    // Refresh the Load Profile dropdown in the XML form
    // =========================================================================
    function refreshDropdown() {
        var field1Comp = mvc.Components.get('field1');
        if (field1Comp) {
            var managerId = field1Comp.settings.get('managerid');
            if (managerId) {
                var field1Search = mvc.Components.get(managerId);
                if (field1Search) {
                    field1Search.startSearch();
                }
            }
        }
    }

    // =========================================================================
    // Open / close modal
    // =========================================================================
    function openModal() {
        // Load both profiles and available fields in parallel
        var profilesDone = false;
        var fieldsDone = false;

        function checkReady() {
            if (profilesDone && fieldsDone) {
                initCreatePicker();
                $('#pm-overlay').addClass('pm-visible');
            }
        }

        loadProfiles(function() {
            profilesDone = true;
            checkReady();
        });

        loadAvailableFields(function() {
            fieldsDone = true;
            checkReady();
        });
    }

    function closeModal() {
        $('#pm-overlay').removeClass('pm-visible');
        // Clean up any open edit panels
        $('.pm-edit-fields-panel').remove();
    }

    $('#pm-close, #pm-close-footer').on('click', closeModal);
    $('#pm-overlay').on('click', function(e) {
        if (e.target === this) closeModal();
    });

    // =========================================================================
    // Insert the "Manage Profiles" button next to the Events panel title
    // =========================================================================
    var $btn = $('<button class="pm-open-btn" id="pm-open-trigger">📋 Manage Profiles</button>');

    // Target: the title of the panel containing #expand_with_events
    // Splunk renders panel titles as <h2 class="panel-title"> or <h3>
    function placeButton() {
        var $eventsTable = $('#expand_with_events');
        if ($eventsTable.length) {
            // Walk up to the panel, find its title
            var $panel = $eventsTable.closest('.dashboard-panel');
            if ($panel.length) {
                var $title = $panel.find('.panel-title, .panel-head h3, .panel-head h2').first();
                if ($title.length) {
                    $title.css('display', 'inline-block');
                    $title.after($btn);
                    return true;
                }
                // If no title element, prepend to the panel head
                var $head = $panel.find('.panel-head');
                if ($head.length) {
                    $head.append($btn);
                    return true;
                }
            }
        }
        return false;
    }

    // Try immediately, then retry after a short delay (Splunk may not have rendered yet)
    if (!placeButton()) {
        setTimeout(function() {
            if (!placeButton()) {
                // Fallback: place after the fieldset submit button area
                var $submit = $('.form-submit');
                if ($submit.length) {
                    $submit.after($btn);
                } else {
                    $('body').prepend($btn);
                }
            }
            console.log('profile_manager.js — button placed (delayed)');
        }, 1500);
    }

    console.log('profile_manager.js loaded');

    $btn.on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Manage Profiles button clicked');
        openModal();
    });

    // Also support opening via a token
    tokens_default.on('change:open_profile_manager', function(model, value) {
        if (value === 'true' || value === '1') {
            openModal();
            tokens_default.unset('open_profile_manager');
        }
    });
});