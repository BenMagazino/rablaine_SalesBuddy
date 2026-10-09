/** Entry-local meeting review recovery. No fetch, AI or writes on page load or Back. */
function setFillPending(pending) {
    fillPending = pending;
    document.getElementById('meetingCards').inert = pending;
    document.getElementById('fillDate').disabled = pending;
    document.getElementById('startBtn').disabled = pending;
}

function confirmFill() {
    const dialog = document.getElementById('fillGuard');
    if (dialog.open) return Promise.resolve(false);
    document.getElementById('fillGuardTitle').textContent =
        totalCards > savedCount ? 'Replace this review?' : 'Fetch and enrich meetings?';
    document.getElementById('fillGuardMessage').textContent = totalCards > savedCount ?
        'Fetching again replaces the current review and unsaved edits. Tasks already created in MSX are not undone.' :
        'Fetch external meetings for the selected date, match customers, and request WorkIQ summaries and AI enrichment. Notes are saved only when you choose Save Note.';
    return new Promise(resolve => {
        let accepted = false;
        const confirm = document.getElementById('fillGuardConfirm');
        const accept = () => {
            accepted = true;
            window.SBDialog.close(dialog, 'fetch');
        };
        confirm.addEventListener('click', accept, {once: true});
        dialog.addEventListener('sb:dialog-closed', () => {
            confirm.removeEventListener('click', accept);
            resolve(accepted);
        }, {once: true});
        window.SBDialog.open(dialog);
    });
}

function rememberFillReview() {
    if (fillPending) return;
    try {
        const root = document.querySelector('.fill-workbench');
        const reading = root.querySelector('.fill-reading');
        window.history.replaceState({...window.history.state, sbFillDay: {
            date: document.getElementById('fillDate').value,
            meetings, customerMap, enrichedData, savedCount, totalCards,
            html: document.getElementById('meetingCards').innerHTML,
            fields: Array.from(root.querySelectorAll('#meetingCards input, #meetingCards textarea, #meetingCards select'),
                field => [field.id, field.value]),
            panels: ['progressPanel', 'completionSummary', 'noMeetingsMsg', 'errorArea'].map(id =>
                [id, document.getElementById(id).style.display]),
            error: document.getElementById('errorText').textContent,
            progress: ['Fetch', 'Match', 'Enrich'].map(step => [
                step, document.getElementById(`step${step}Badge`).className,
                document.getElementById(`step${step}Badge`).innerHTML,
                document.getElementById(`step${step}Label`).textContent]),
            empty: document.getElementById('fillEmpty').hidden,
            top: reading.scrollTop, left: reading.scrollLeft,
        }}, '');
    } catch (error) {
        console.error('Fill My Day history:', error);
        showError('Could not remember this review for Back.');
    }
}

function restoreFillReview() {
    const saved = window.history.state?.sbFillDay;
    if (!saved || fillPending) return;
    try {
        if (!Array.isArray(saved.meetings) || !Array.isArray(saved.fields) ||
                typeof saved.html !== 'string' || typeof saved.date !== 'string' ||
                !Number.isFinite(saved.top) || saved.top < 0 ||
                !Number.isFinite(saved.left) || saved.left < 0 ||
                !Number.isInteger(saved.savedCount) || !Number.isInteger(saved.totalCards)) {
            throw new Error('Invalid saved meeting review.');
        }
        meetings = saved.meetings;
        customerMap = saved.customerMap;
        enrichedData = saved.enrichedData;
        savedCount = saved.savedCount;
        totalCards = saved.totalCards;
        document.getElementById('fillDate').value = saved.date;
        const container = document.getElementById('meetingCards');
        container.innerHTML = saved.html;
        // Sorter owns its buttons/listeners; rebuild only its unmounted header markup.
        container.querySelectorAll('[data-sb-table-sort]').forEach(button => {
            const header = button.parentElement;
            button.querySelector('i')?.remove();
            header.textContent = button.textContent;
        });
        saved.fields.forEach(([id, value]) => {
            const field = document.getElementById(id);
            if (!field || typeof value !== 'string') throw new Error('Missing saved meeting field.');
            field.value = value;
            if (field.classList.contains('task-category-select') && field.options.length <= 1) {
                field.onfocus = () => {
                    field.onfocus = null;
                    populateCardTaskCategories(Number(id.replace('taskCategory-', '')));
                };
            }
        });
        saved.panels.forEach(([id, display]) => { document.getElementById(id).style.display = display; });
        saved.progress.forEach(([step, classes, html, label]) => {
            const badge = document.getElementById(`step${step}Badge`);
            badge.className = classes;
            badge.innerHTML = html;
            document.getElementById(`step${step}Label`).textContent = label;
        });
        document.getElementById('errorText').textContent = saved.error;
        document.getElementById('fillEmpty').hidden = saved.empty;
        updateCompletionStatus();
        window.SBTableSort.mount(container);
        const reading = document.querySelector('.fill-reading');
        reading.scrollTop = saved.top;
        reading.scrollLeft = saved.left;
    } catch (error) {
        console.error('Fill My Day history restore:', error);
        showError('Could not restore this review for Back.');
    }
}

(() => {
    const root = document.querySelector('.fill-workbench');
    if (!root) return;
    let timer;
    function schedule() {
        window.clearTimeout(timer);
        timer = window.setTimeout(rememberFillReview, 120);
    }
    function flush() {
        window.clearTimeout(timer);
        rememberFillReview();
    }
    for (const event of ['input', 'change', 'click', 'toggle']) {
        root.addEventListener(event, schedule, true);
    }
    root.querySelector('.fill-reading').addEventListener('scroll', schedule, {passive: true});
    root.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if (fillPending && link) {
            event.preventDefault();
            showError('Wait for the current operation to finish before leaving this review.');
        }
    });
    window.addEventListener('beforeunload', event => {
        if (fillPending) {
            event.preventDefault();
            event.returnValue = '';
        }
    });
    window.addEventListener('pagehide', flush);
    window.addEventListener('pageshow', restoreFillReview);
    restoreFillReview();
})();
