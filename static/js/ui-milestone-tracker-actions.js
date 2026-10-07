/** Shared inline team action for the standalone tracker and seller fragment. */
async function toggleTrackerTeam(btn, milestoneId) {
    if (window.isVpnBlocked && window.isVpnBlocked()) {
        window.showVpnBanner();
        return;
    }
    const onTeam = btn.dataset.onTeam === '1';
    if (onTeam && !confirm('Leave this milestone team?')) return;
    if (!onTeam && !confirm('Join the milestone team in MSX? This will add you to the access team for this milestone.')) return;
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split" aria-hidden="true"></i>';
    const url = onTeam ? '/api/msx/leave-milestone-team' : '/api/msx/join-milestone-team';
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({milestone_id: milestoneId})
        });
        const data = await resp.json();
        if (data.success) {
            const newOnTeam = !onTeam;
            const cell = btn.closest('td');
            const row = cell.closest('tr');
            if (row) row.setAttribute('data-on-my-team', newOnTeam ? 'true' : 'false');
            cell.setAttribute('data-sb-sort-value', newOnTeam ? '1' : '0');
            const label = newOnTeam ? 'Leave milestone team' : 'Join milestone team';
            const title = newOnTeam ? 'On milestone team (click to leave)' : 'Join milestone team';
            const icon = newOnTeam ? 'bi-people-fill' : 'bi-person-plus';
            cell.innerHTML = `<button class="mt-command team-toggle${newOnTeam ? ' on-team' : ''}"
                data-id="${milestoneId}" data-on-team="${newOnTeam ? 1 : 0}"
                title="${title}" aria-label="${label}"
                onclick="toggleTrackerTeam(this, ${milestoneId})">
                <i class="bi ${icon} icon-default"></i><i class="bi bi-person-dash icon-leave"></i>
                </button>`;
        } else {
            btn.disabled = false;
            btn.innerHTML = origHtml;
            alert(data.error || 'Failed');
        }
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
        alert('Network error: ' + err.message);
    }
}
