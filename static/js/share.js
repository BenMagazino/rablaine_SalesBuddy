/**
 * Sharing client — Socket.IO connection and share flow management.
 *
 * Connects to the Sales Buddy gateway via Socket.IO for real-time sharing
 * of directories, partners, and notes between Sales Buddy instances.
 *
 * Usage:
 *   Share.init()           — Connect to gateway (called on page load)
 *   Share.openShareModal() — Open the share modal with online users
 *   Share.getOnlineCount() — Get number of online peers
 */
const Share = (function () {
  let socket = null;
  let connected = false;
  let shareEnabled = false;  // true only after successful connect (passes allowlist)
  let onlineUsers = [];
  let pendingShareType = null;   // "directory", "partner", or "note"
  let pendingItemId = null;      // set when sharing a single partner or note
  let pendingRecipientEmail = null;
  let _pendingImport = null;     // {partners: [...], sender_name: str} awaiting user review
  let importing = false;
  let sending = false;
  let dialogsBound = false;
  let previewing = false;

  function _bindDialogs() {
    if (dialogsBound) return;
    dialogsBound = true;
    const shareDialog = document.getElementById('shareModal');
    const importDialog = document.getElementById('shareImportReviewModal');
    shareDialog.addEventListener('sb:dialog-before-close', event => {
      if (sending) event.preventDefault();
    });
    shareDialog.addEventListener('sb:dialog-closed', _resetShareState);
    importDialog.addEventListener('sb:dialog-before-close', event => {
      if (importing) event.preventDefault();
    });
    importDialog.addEventListener('sb:dialog-closed', () => { _pendingImport = null; });
    window.addEventListener('beforeunload', event => {
      if (!importing && !sending) return;
      event.preventDefault();
      event.returnValue = '';
    });
    document.addEventListener('click', event => {
      if ((importing || sending) && event.target.closest('a[href]')) event.preventDefault();
    }, true);
  }

  async function _readResponse(resp) {
    const data = await resp.json();
    if (!resp.ok || data.success === false) {
      throw new Error(data.error || `Request failed (HTTP ${resp.status}).`);
    }
    return data;
  }

  // ── Connection ──────────────────────────────────────────────────────

  async function init() {
    _bindDialogs();
    try {
      const resp = await fetch('/api/share/connection-info');
      if (!resp.ok) return;
      const info = await resp.json();
      if (!info.success) return;

      socket = io(info.gateway_url + '/share', {
        auth: { token: info.token },
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionDelay: 5000,
        reconnectionAttempts: 10,
      });

      socket.on('connect', () => {
        connected = true;
        shareEnabled = true;
        _updateBadges();
        socket.emit('get_online_users');
      });

      socket.on('disconnect', () => {
        connected = false;
        onlineUsers = [];
        _updateBadges();
        if (!sending && pendingRecipientEmail) {
          _resetShareState();
          _renderOnlineList();
          _showToast('Sharing disconnected. No data was sent.', 'warning');
        }
      });

      // Not on the allowlist — hide sharing UI entirely
      socket.on('not_allowed', () => {
        shareEnabled = false;
        _updateBadges();
      });

      socket.on('online_users', (data) => {
        onlineUsers = data.users || [];
        _updateBadges();
        _renderOnlineList();
      });

      // Incoming share offer
      socket.on('share_offer', (data) => {
        _showIncomingOffer(data);
      });

      // Our share was accepted — send the data
      socket.on('share_accepted', async (data) => {
        await _sendShareData(data.recipient_email);
      });

      // Our share was declined
      socket.on('share_declined', (data) => {
        _showToast(`${data.recipient_name} declined the share.`, 'warning');
        _resetShareState();
        window.SBDialog.close('shareModal', 'declined');
      });

      // Incoming shared data
      socket.on('share_payload', async (data) => {
        await _receiveShareData(data);
      });

      // Another tab already handled the offer
      socket.on('share_offer_handled', () => {
        const container = document.getElementById('shareOfferContainer');
        if (container) container.innerHTML = '';
      });

      socket.on('share_error', (data) => {
        _showToast(data.error || 'Share error', 'danger');
        _resetShareState();
        if (!sending) window.SBDialog.close('shareModal', 'error');
      });

    } catch (e) {
      console.warn('Sharing unavailable:', e);
    }
  }

  // ── Share initiation ────────────────────────────────────────────────

  function openShareModal(type, itemId) {
    _bindDialogs();
    if (sending || importing) return;
    pendingShareType = type || 'directory';
    pendingItemId = (type === 'partner' || type === 'note') ? (itemId || null) : null;

    if (!connected || onlineUsers.length === 0) {
      _showToast('No teammates online right now. They need to be running Sales Buddy too.', 'info');
      return;
    }

    _renderOnlineList();
    window.SBDialog.open('shareModal');
  }

  function sendShareRequest(recipientEmail) {
    if (!socket || !connected || pendingRecipientEmail || !pendingShareType) return;

    pendingRecipientEmail = recipientEmail;
    const recipient = onlineUsers.find(u => u.email === recipientEmail);

    // Update modal to show "waiting" state
    const body = document.getElementById('shareModalBody');
    body.innerHTML = `
      <div class="sb-share-waiting" role="status">
        <p>Waiting for <strong>${_esc(recipient?.name || 'recipient')}</strong> to accept...</p>
        <button class="sb-dialog-button" onclick="Share.cancelShare()">Cancel</button>
      </div>
    `;

    socket.emit('share_request', {
      recipient_email: recipientEmail,
      share_type: pendingShareType,
      item_name: pendingItemId ? document.title.replace(' - Sales Buddy', '') : null,
    });
  }

  function cancelShare() {
    if (sending) return;
    _resetShareState();
    window.SBDialog.close('shareModal', 'cancel');
  }

  // ── Sending data ────────────────────────────────────────────────────

  async function _sendShareData(recipientEmail) {
    if (sending || !pendingShareType || recipientEmail !== pendingRecipientEmail) return;
    // Capture and clear state atomically to prevent duplicate sends.
    const shareType = pendingShareType;
    const itemId = pendingItemId;
    _resetShareState();

    if (!shareType) return;
    sending = true;

    try {
      if (shareType === 'note' && itemId) {
        const resp = await fetch(`/api/share/note/${itemId}`);
        const data = await _readResponse(resp);
        if (!data.note || typeof data.note !== 'object' || !connected) {
          throw new Error('Note export unavailable or sharing disconnected.');
        }
        socket.emit('share_data', {
          recipient_email: recipientEmail,
          share_type: 'note',
          note: data.note,
        });
        _showToast('Note shared successfully!', 'success');
      } else if (shareType === 'partner' && itemId) {
        const resp = await fetch(`/api/share/partner/${itemId}`);
        const data = await _readResponse(resp);
        if (!data.partner || typeof data.partner !== 'object' || !connected) {
          throw new Error('Partner export unavailable or sharing disconnected.');
        }
        socket.emit('share_data', {
          recipient_email: recipientEmail,
          share_type: 'partner',
          partners: [data.partner],
        });
        _showToast('Sent 1 partner successfully!', 'success');
      } else if (shareType === 'directory') {
        const resp = await fetch('/api/share/directory');
        const data = await _readResponse(resp);
        const partners = data.partners;
        if (!Array.isArray(partners) || !connected) {
          throw new Error('Directory export unavailable or sharing disconnected.');
        }
        socket.emit('share_data', {
          recipient_email: recipientEmail,
          share_type: 'directory',
          partners: partners,
        });
        const count = partners.length;
        _showToast(`Sent ${count} partner${count !== 1 ? 's' : ''} successfully!`, 'success');
      }
    } catch (e) {
      _showToast('Failed to send share data: ' + e.message, 'danger');
    }
    sending = false;
    window.SBDialog.close('shareModal', 'sent');
  }

  // ── Receiving data ──────────────────────────────────────────────────

  async function _receiveShareData(data) {
    if (data.share_type === 'note' && data.note) {
      // Note import
      const customerName = data.note.customer?.name || 'General';
      _showToast(
        `Receiving note for ${customerName} from ${data.sender_name}...`,
        'info',
      );
      try {
        const resp = await fetch('/api/share/receive-note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            note: data.note,
            sender_name: data.sender_name,
          }),
        });
        const result = await _readResponse(resp);
        if (result.success) {
          // Show what was created (seller, customer, etc.)
          if (result.created && result.created.length > 0) {
            _showToast(`Created: ${result.created.join(', ')}`, 'info');
          }
          const msg = result.customer_name
            ? `Note imported for ${result.customer_name}!`
            : 'Note imported!';
          _showToast(msg, 'success');
          // Reload if on notes list or note view
          if (window.location.pathname === '/notes' ||
              window.location.pathname.startsWith('/note/')) {
            setTimeout(() => window.location.reload(), 1500);
          }
        } else {
          _showToast('Import failed: ' + (result.error || 'unknown error'), 'danger');
        }
      } catch (e) {
        _showToast('Import failed: ' + e.message, 'danger');
      }
      return;
    }

    // Partner directory / single partner import — show preview modal
    if (previewing || _pendingImport || importing) {
      _showToast('Finish or cancel the current partner review before accepting another share.',
        'warning');
      return;
    }
    previewing = true;
    const partners = data.partners || [];
    const count = partners.length;
    _showToast(
      `Received ${count} partner${count !== 1 ? 's' : ''} from ${data.sender_name}. Reviewing...`,
      'info',
    );

    try {
      const resp = await fetch('/api/share/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partners: partners,
          sender_name: data.sender_name,
        }),
      });
      const result = await _readResponse(resp);
      if (result.success) {
        _pendingImport = { partners: partners, sender_name: data.sender_name };
        const sourceIndices = partners.map((partner, index) => ({partner, index}))
          .filter(entry => (entry.partner.name || '').trim()).map(entry => entry.index);
        _showImportReviewModal(result.previews.map((preview, index) => ({
          ...preview, source_index: sourceIndices[index],
        })), data.sender_name);
      } else {
        _showToast('Preview failed: ' + (result.error || 'unknown error'), 'danger');
      }
    } catch (e) {
      _pendingImport = null;
      _showToast('Preview failed: ' + e.message, 'danger');
    } finally {
      previewing = false;
    }
  }

  // ── Incoming offer UI ───────────────────────────────────────────────

  function _showIncomingOffer(data) {
    let typeLabel;
    if (data.share_type === 'note') {
      typeLabel = `a note${data.item_name ? ' "' + _esc(data.item_name) + '"' : ''}`;
    } else if (data.share_type === 'directory') {
      typeLabel = 'their partner directory';
    } else {
      typeLabel = `"${_esc(data.item_name || 'a partner')}"`;
    }

    // Create or reuse the offer toast container
    let container = document.getElementById('shareOfferContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'shareOfferContainer';
      container.className = 'sb-share-offers';
      document.body.appendChild(container);
    }

    const offerId = 'offer-' + Date.now();
    container.innerHTML = `
      <div id="${offerId}" class="sb-share-offer" role="alert">
        <div class="sb-share-offer-heading">
          <strong>Share</strong>
          <button type="button" class="sb-dialog-close" data-share-decline aria-label="Decline share"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
        </div>
        <div>
          <p>
            <strong>${_esc(data.sender_name)}</strong> wants to share ${typeLabel} with you.
          </p>
          <div class="sb-share-commands">
            <button class="sb-dialog-button" data-share-accept>
              Accept
            </button>
            <button class="sb-dialog-button" data-share-decline>
              Decline
            </button>
          </div>
        </div>
      </div>
    `;
    container.querySelector('[data-share-accept]').addEventListener('click',
      () => acceptOffer(data.sender_email, offerId));
    container.querySelectorAll('[data-share-decline]').forEach(button =>
      button.addEventListener('click', () => declineOffer(data.sender_email, offerId)));
  }

  function acceptOffer(senderEmail, offerId) {
    if (previewing || _pendingImport || importing) {
      _showToast('Finish or cancel the current partner review before accepting another share.',
        'warning');
      return;
    }
    socket.emit('share_accept', { sender_email: senderEmail });
    document.getElementById(offerId)?.remove();
    _showToast('Accepted, waiting for data...', 'info');
  }

  function declineOffer(senderEmail, offerId) {
    socket.emit('share_decline', { sender_email: senderEmail });
    document.getElementById(offerId)?.remove();
  }

  // ── UI helpers ──────────────────────────────────────────────────────

  function _renderOnlineList() {
    const body = document.getElementById('shareModalBody');
    if (!body) return;
    if (pendingRecipientEmail || sending) return;

    if (onlineUsers.length === 0) {
      body.innerHTML = `
        <div class="sb-share-empty">
          <p>No teammates online right now.</p>
          <small>They need to be running Sales Buddy with a valid sign-in.</small>
        </div>
      `;
      return;
    }

    // Search box + user list
    body.innerHTML = `
      <div class="sb-share-search">
        <label for="shareUserSearch">Find a teammate</label>
        <input type="search" class="sb-field" id="shareUserSearch"
               placeholder="Search by name or email..." autocomplete="off" autofocus>
      </div>
      <div class="sb-share-list" id="shareUserList">
        ${onlineUsers.map(u => `
          <button class="sb-share-user share-user-item"
                  data-name="${_esc(u.name.toLowerCase())}" data-email="${_esc(u.email.toLowerCase())}"
                  data-share-email="${_esc(u.email)}">
            <i class="bi bi-person-circle" aria-hidden="true"></i>
            <div>
              <strong>${_esc(u.name)}</strong>
              <small>${_esc(u.email)}</small>
            </div>
            <i class="bi bi-send" aria-hidden="true"></i>
          </button>
        `).join('')}
      </div>
    `;
    body.querySelectorAll('[data-share-email]').forEach(button =>
      button.addEventListener('click', () => sendShareRequest(button.dataset.shareEmail)));

    // Wire up search filtering
    const searchInput = document.getElementById('shareUserSearch');
    searchInput?.addEventListener('input', function () {
      const q = this.value.toLowerCase();
      document.querySelectorAll('.share-user-item').forEach(item => {
        const match = item.dataset.name.includes(q) || item.dataset.email.includes(q);
        item.hidden = !match;
      });
    });
    searchInput?.focus();
  }

  function _updateBadges() {
    // Hide share buttons entirely if not on allowlist
    document.querySelectorAll('.btn-share').forEach(btn => {
      btn.style.display = shareEnabled ? '' : 'none';
    });

    // Update any online count badges on the page
    document.querySelectorAll('.share-online-count').forEach(el => {
      el.textContent = onlineUsers.length;
      el.style.display = (shareEnabled && onlineUsers.length > 0) ? '' : 'none';
    });

    // Broadcast allowlist state so other features can gate UI on it
    // (e.g. /metrics page hides its sign-in button for non-allowlisted users).
    document.body.classList.toggle('share-enabled', shareEnabled);
    document.dispatchEvent(new CustomEvent('share:enabled-changed', {
      detail: { enabled: shareEnabled },
    }));
  }

  function _resetShareState() {
    pendingShareType = null;
    pendingItemId = null;
    pendingRecipientEmail = null;
  }

  // ── Import review modal ───────────────────────────────────────────

  function _showImportReviewModal(previews, senderName) {
    _bindDialogs();
    const body = document.getElementById('shareImportReviewBody');
    if (!body) return;

    const creates = previews.filter(p => p.action === 'create');
    const updates = previews.filter(p => p.action === 'update' && p.has_changes);
    const noChanges = previews.filter(p => p.action === 'update' && !p.has_changes);

    let html = `<p class="sb-share-summary">From <strong>${_esc(senderName)}</strong>, ${previews.length} partner${previews.length !== 1 ? 's' : ''}</p>`;

    html += '<div class="sb-share-commands">';
    html += '<button class="sb-dialog-button" onclick="Share.toggleAllImport(true)">Select All</button>';
    html += '<button class="sb-dialog-button" onclick="Share.toggleAllImport(false)">Deselect All</button>';
    if (creates.length > 0) {
      html += '<button class="sb-dialog-button" onclick="Share.selectNewOnly()">Select New Only</button>';
    }
    html += '</div>';

    html += '<div class="sb-share-list">';

    if (creates.length > 0) {
      html += `<h3 class="sb-share-group">New (${creates.length})</h3>`;
      for (const p of creates) {
        html += _importRowCreate(p);
      }
    }

    if (updates.length > 0) {
      html += `<h3 class="sb-share-group">Updated (${updates.length})</h3>`;
      for (const p of updates) {
        html += _importRowUpdate(p);
      }
    }

    if (noChanges.length > 0) {
      html += `<h3 class="sb-share-group">No Changes (${noChanges.length})</h3>`;
      for (const p of noChanges) {
        html += _importRowNoChange(p);
      }
    }

    html += '</div>';
    body.innerHTML = html;
    document.getElementById('shareImportStatus').textContent = '';
    _updateImportBtnCount();

    window.SBDialog.open('shareImportReviewModal');
  }

  function _stars(n) {
    return n !== null && n !== undefined ? '★'.repeat(n) + '☆'.repeat(5 - n) : '';
  }

  function _importRowCreate(p) {
    const inc = p.incoming || {};
    let details = '';

    if (inc.website) details += `<div>Website: ${_esc(inc.website)}</div>`;
    if (inc.rating !== null && inc.rating !== undefined) details += `<div>Rating: ${_stars(inc.rating)}</div>`;
    if (inc.specialties && inc.specialties.length) {
      details += '<div>Specialties: ' +
        inc.specialties.map(s => `<span class="sb-share-specialty">${_esc(s)}</span>`).join(', ') + '</div>';
    }
    if (inc.contacts && inc.contacts.length) {
      details += '<div>';
      for (const c of inc.contacts) {
        const primary = c.is_primary ? ' <span class="sb-share-label">primary</span>' : '';
        details += `<div>${_esc(c.name || '')}${c.email ? ' &lt;' + _esc(c.email) + '&gt;' : ''}${primary}</div>`;
      }
      details += '</div>';
    }
    if (inc.overview) {
      const short = inc.overview.length > 120 ? inc.overview.substring(0, 120) + '…' : inc.overview;
      details += `<div class="sb-share-overview" title="${_esc(inc.overview)}">${_esc(short)}</div>`;
    }
    if (inc.favicon_b64) details += '<div>Favicon included</div>';

    return `
      <div class="sb-share-import-row">
        <label class="sb-share-import-choice">
          <input type="checkbox" class="share-import-check" data-action="create"
                 value="${p.source_index}" checked onchange="Share.updateImportBtnCount()">
          <div>
            <strong>${_esc(p.name)}</strong>
            <span class="sb-share-label">New</span>
            <div class="sb-share-details">${details || 'Name only'}</div>
          </div>
        </label>
      </div>
    `;
  }

  function _importRowUpdate(p) {
    const ch = p.changes || {};
    let details = '';

    if (ch.website) details += `<div>Website: ${_esc(ch.website)}</div>`;
    if (ch.rating !== undefined && ch.rating !== null) details += `<div>Rating: ${_stars(ch.rating)}</div>`;
    if (ch.favicon) details += '<div>New favicon</div>';
    if (ch.specialties && ch.specialties.length) {
      details += '<div>New specialties: ' +
        ch.specialties.map(s => `<span class="sb-share-specialty">${_esc(s)}</span>`).join(', ') + '</div>';
    }
    if (ch.contacts && ch.contacts.length) {
      details += '<div>New contacts:</div>';
      for (const c of ch.contacts) {
        details += `<div>${_esc(c.name || '')}${c.email ? ' &lt;' + _esc(c.email) + '&gt;' : ''}</div>`;
      }
    }
    if (ch.overview) {
      const short = ch.overview.length > 120 ? ch.overview.substring(0, 120) + '…' : ch.overview;
      details += `<div class="sb-share-overview" title="${_esc(ch.overview)}">${_esc(short)}</div>`;
    }

    return `
      <div class="sb-share-import-row">
        <label class="sb-share-import-choice">
          <input type="checkbox" class="share-import-check" data-action="update"
                 value="${p.source_index}" checked onchange="Share.updateImportBtnCount()">
          <div>
            <strong>${_esc(p.name)}</strong>
            <span class="sb-share-label">Update</span>
            <div class="sb-share-details">${details}</div>
          </div>
        </label>
      </div>
    `;
  }

  function _importRowNoChange(p) {
    return `
      <div class="sb-share-import-row">
        <label class="sb-share-import-choice">
          <input type="checkbox" class="share-import-check" data-action="update"
                 value="${p.source_index}" onchange="Share.updateImportBtnCount()">
          <div>
            <strong>${_esc(p.name)}</strong>
            <span class="sb-share-label">No changes</span>
          </div>
        </label>
      </div>
    `;
  }

  function selectNewOnly() {
    if (importing) return;
    document.querySelectorAll('.share-import-check').forEach(cb => {
      cb.checked = cb.dataset.action === 'create';
    });
    _updateImportBtnCount();
  }

  function _updateImportBtnCount() {
    const checked = document.querySelectorAll('.share-import-check:checked').length;
    const btn = document.getElementById('shareImportConfirmBtn');
    if (btn) {
      btn.textContent = `Import Selected (${checked})`;
      btn.disabled = importing || checked === 0;
    }
  }

  function toggleAllImport(selectAll) {
    if (importing) return;
    document.querySelectorAll('.share-import-check').forEach(cb => { cb.checked = selectAll; });
    _updateImportBtnCount();
  }

  async function confirmImport() {
    if (!_pendingImport || importing) return;

    // Preview names may be canonical matches, so select by original payload identity.
    const selectedIndices = new Set();
    document.querySelectorAll('.share-import-check:checked').forEach(cb => {
      selectedIndices.add(Number(cb.value));
    });

    if (selectedIndices.size === 0) {
      _showToast('No partners selected.', 'warning');
      return;
    }

    const selectedPartners = _pendingImport.partners.filter((p, index) =>
      selectedIndices.has(index)
    );

    const btn = document.getElementById('shareImportConfirmBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Importing...';
    }
    importing = true;
    const status = document.getElementById('shareImportStatus');
    status.textContent = 'Importing selected partners...';
    document.querySelectorAll('.share-import-check').forEach(cb => { cb.disabled = true; });

    try {
      const resp = await fetch('/api/share/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partners: selectedPartners,
          sender_name: _pendingImport.sender_name,
        }),
      });
      const result = await _readResponse(resp);
      importing = false;
      window.SBDialog.close('shareImportReviewModal', 'imported');
      _pendingImport = null;

      if (result.success) {
        const msg = `Import complete: ${result.created} new, ${result.updated} updated` +
          (result.skipped ? `, ${result.skipped} skipped` : '');
        _showToast(msg, 'success');
        if (window.location.pathname === '/partners' ||
            window.location.pathname.startsWith('/partners/')) {
          setTimeout(() => window.location.reload(), 1500);
        }
      } else {
        _showToast('Import failed: ' + (result.error || 'unknown error'), 'danger');
      }
    } catch (e) {
      status.textContent = 'Import failed: ' + e.message + ' Your selection is retained. Retry or Cancel.';
      _showToast('Import failed: ' + e.message, 'danger');
    } finally {
      importing = false;
      document.querySelectorAll('.share-import-check').forEach(cb => { cb.disabled = false; });
      _updateImportBtnCount();
    }
  }

  function _showToast(message, type) {
    let container = document.getElementById('shareToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'shareToastContainer';
      container.className = 'sb-share-toasts';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'sb-share-toast';
    toast.dataset.state = type;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <div class="sb-share-toast-body">
        <span>${_esc(message)}</span>
        <button type="button" class="sb-dialog-close" aria-label="Dismiss notification"
                onclick="this.closest('.sb-share-toast').remove()"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
      </div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  }

  function _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getOnlineCount() {
    return onlineUsers.length;
  }

  function isConnected() {
    return connected;
  }

  function isShareEnabled() {
    return shareEnabled;
  }

  // ── Public API ──────────────────────────────────────────────────────

  return {
    init,
    openShareModal,
    sendShareRequest,
    cancelShare,
    acceptOffer,
    declineOffer,
    getOnlineCount,
    isConnected,
    isShareEnabled,
    confirmImport,
    toggleAllImport,
    selectNewOnly,
    updateImportBtnCount: _updateImportBtnCount,
  };
})();
window.Share = Share;
