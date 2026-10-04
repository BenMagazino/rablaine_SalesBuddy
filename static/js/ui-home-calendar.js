/* Approved calendar presentation; data loading and actions stay with Home. */
(() => {
    'use strict';

    function customerColors(data) {
        const ids = new Set();
        for (const entries of [...Object.values(data.days || {}),
            ...Object.values(data.ghosts || {})]) {
            for (const entry of entries) if (entry.customer_id) ids.add(entry.customer_id);
        }
        return Object.fromEntries([...ids].map((id, index) => [id, index % 15 + 1]));
    }

    function workStatus(note) {
        return note.has_hva ? 'hva' : note.has_task ? 'task' :
            note.has_milestone ? 'milestone' : 'plain';
    }

    function color(entry, index) {
        if (index == null) return;
        if (!Number.isInteger(index) || index < 1 || index > 15) {
            throw new Error('Invalid calendar customer color: ' + index);
        }
        entry.dataset.customerColor = String(index);
    }

    function marker(name, title) {
        const icon = document.createElement('i');
        icon.className = 'bi bi-' + name;
        icon.title = title;
        icon.setAttribute('aria-hidden', 'true');
        return icon;
    }

    function copy(entry, time, label) {
        if (time) {
            const stamp = document.createElement('span');
            stamp.className = 'sb-home-entry-time';
            stamp.textContent = time;
            entry.appendChild(stamp);
        }
        const title = document.createElement('span');
        title.className = 'sb-home-entry-title';
        title.textContent = label;
        entry.appendChild(title);
    }

    function note(entry, data, index) {
        entry.className = 'sb-home-entry sb-home-note';
        entry.dataset.workStatus = workStatus(data);
        color(entry, data.is_general ? null : index);
        if (data.is_general) entry.appendChild(marker('sticky', 'General note'));
        copy(entry, data.time, data.customer_name);
        if (data.has_engagement) {
            entry.appendChild(marker('diagram-3', 'Linked engagement'));
        }
        const status = [
            data.is_general ? 'General note' : 'Saved note',
            data.has_milestone ? 'Milestone linked' : '',
            data.has_task ? 'MSX task linked' : '',
            data.has_hva ? 'HVA task' : '',
            data.has_engagement ? 'Engagement linked' : '',
        ].filter(Boolean).join(' / ');
        entry.title = [data.time, data.customer_name, status].filter(Boolean).join(' / ');
        entry.setAttribute('aria-label', entry.title);
    }

    function ghost(entry, data, index, time) {
        entry.className = 'sb-home-entry cal-ghost' +
            (data.customer_id ? '' : ' cal-ghost-unmatched');
        color(entry, index);
        const opener = document.createElement(data.customer_id ? 'a' : 'button');
        opener.className = 'sb-home-ghost-open';
        if (!data.customer_id) opener.type = 'button';
        const label = data.customer_id ? data.customer_name || data.subject : data.subject;
        opener.appendChild(marker('calendar-event', 'Cached meeting; no note yet'));
        copy(opener, time, label);
        opener.setAttribute('aria-label', [time, label, data.subject !== label ? data.subject : '',
            'Cached meeting; no saved note', !data.customer_id ? 'Customer not matched' : '']
            .filter(Boolean).join(' / '));
        if (!data.customer_id) {
            opener.appendChild(marker('question-circle', 'Customer not matched'));
        }
        entry.appendChild(opener);
        if (data.is_recurring) {
            const recur = document.createElement('button');
            recur.type = 'button';
            recur.className = 'cal-ghost-recur';
            recur.dataset.role = 'recur';
            recur.setAttribute('aria-label', 'Hide recurring meeting series: ' + data.subject);
            recur.title = 'Recurring meeting - hover to dismiss series';
            recur.appendChild(marker('arrow-repeat', 'Recurring meeting'));
            entry.appendChild(recur);
        }
        return opener;
    }

    function bindHighlight(entry) {
        function update() {
            const body = document.getElementById('calendarBody');
            const hovered = body.querySelector('.sb-home-entry[data-customer-id]:hover');
            const focused = document.activeElement?.closest('.sb-home-entry[data-customer-id]');
            const active = hovered || (focused && body.contains(focused) ? focused : null);
            for (const item of body.querySelectorAll('.sb-home-entry[data-customer-id]')) {
                item.classList.toggle('cal-highlight',
                    !!active && item.dataset.customerId === active.dataset.customerId);
            }
        }
        for (const name of ['mouseenter', 'mouseleave', 'focusin', 'focusout']) {
            entry.addEventListener(name, update);
        }
    }

    function clearRefreshError(date) {
        document.getElementById('homeMeetingRefreshError-' + date)
            ?.querySelector('[data-sb-notice-dismiss]').click();
    }

    function showRefreshError(date, message) {
        const id = 'homeMeetingRefreshError-' + date;
        let notice = document.getElementById(id);
        if (!notice) {
            notice = document.createElement('div');
            notice.id = id;
            notice.className = 'sb-notice';
            notice.setAttribute('data-sb-tone', 'danger');
            notice.setAttribute('data-sb-category', 'error');
            notice.setAttribute('role', 'alert');
            notice.setAttribute('aria-label', 'Meeting refresh error');
            const icon = marker('exclamation-circle', 'Error');
            icon.className += ' sb-notice-icon';
            notice.appendChild(icon);
            const body = document.createElement('div');
            body.className = 'sb-notice-body';
            notice.appendChild(body);
            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'sb-notice-dismiss';
            close.setAttribute('data-sb-notice-dismiss', '');
            close.setAttribute('aria-label', 'Dismiss notification');
            close.appendChild(marker('x-lg', 'Close'));
            notice.appendChild(close);
            document.getElementById('homeMeetingNotices').appendChild(notice);
        }
        notice.querySelector('.sb-notice-body').textContent =
            'Meeting refresh failed for ' + date + '. ' + message;
    }

    window.SBHomeCalendar = Object.freeze({
        customerColors, workStatus, note, ghost, bindHighlight, showRefreshError, clearRefreshError,
    });
})();
