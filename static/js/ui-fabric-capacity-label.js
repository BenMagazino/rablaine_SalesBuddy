/* Capacity identity lives in a top-layer popover, not in the comparison columns. */
(() => {
    'use strict';
    const popup = document.createElement('div');
    popup.className = 'sb-fabric-capacity-popup';
    popup.id = 'fabricCapacityPopover';
    popup.setAttribute('popover', 'manual');
    popup.setAttribute('role', 'tooltip');
    document.body.append(popup);
    let active = null;
    let timer = null;
    const percent = value => value == null ? '-' : value > 0 && value < 0.01 ? '<0.01%' :
        `${value.toLocaleString(undefined, {maximumFractionDigits: 2})}%`;
    function close() {
        clearTimeout(timer);
        if (popup.matches(':popover-open')) popup.hidePopover();
        active?.removeAttribute('aria-describedby');
        active = null;
    }
    function scheduleClose() {
        clearTimeout(timer);
        timer = setTimeout(() => {
            if (!popup.matches(':hover') && active !== document.activeElement) close();
        }, 160);
    }
    function position() {
        const rect = active.getBoundingClientRect();
        const triggers = [...active.closest('table').querySelectorAll('.sb-fabric-capacity-label')]
            .map(button => button.getBoundingClientRect());
        const laneLeft = Math.min(...triggers.map(bounds => bounds.left));
        const laneRight = Math.max(...triggers.map(bounds => bounds.right));
        const isChart = popup.classList.contains('sb-fabric-chart-popup');
        const rightAnchor = isChart ? rect.right : laneRight;
        const leftAnchor = isChart ? laneLeft : rect.left;
        const rightSpace = innerWidth - rightAnchor - 20;
        const leftSpace = leftAnchor - 20;
        const useRight = isChart ? rightSpace >= 240 || rightSpace >= leftSpace :
            leftSpace < 240 && rightSpace > leftSpace;
        const available = useRight ? rightSpace : leftSpace;
        const preferredWidth = isChart ? 760 : 390;
        popup.style.width = `${Math.min(preferredWidth, Math.max(0, available))}px`;
        const bounds = popup.getBoundingClientRect();
        popup.style.left = `${useRight ? rightAnchor + 12 : leftAnchor - bounds.width - 12}px`;
        popup.style.top = `${Math.max(8, Math.min(rect.top, innerHeight - bounds.height - 8))}px`;
    }
    function create(capacity, index, total, customer = '', chart = null, seller = null) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sb-fabric-capacity-label';
        button.textContent = chart ? percent(capacity.utilization_pct) : `${index}/${total}`;
        button.setAttribute('aria-label', chart ?
            `Capacity ${index} of ${total}, average utilization ${button.textContent}, show utilization graph` :
            `Capacity ${index} of ${total}, show details`);
        function show() {
            clearTimeout(timer);
            if (active === button && popup.matches(':popover-open')) return;
            close();
            active = button;
            const title = document.createElement('strong');
            title.textContent = `${customer ? customer + ' / ' : ''}Capacity ${index} of ${total}`;
            const sellerLine = document.createElement('div');
            sellerLine.className = 'sb-fabric-popup-seller';
            if (seller) {
                const badge = document.createElement('span');
                badge.className = 'sb-fabric-seller-badge';
                const icon = document.createElement('i');
                icon.className = 'bi bi-person';
                icon.setAttribute('aria-hidden', 'true');
                badge.append(icon, document.createTextNode(` ${seller.name}`));
                sellerLine.append(badge);
            } else {
                sellerLine.textContent = 'No seller assigned';
            }
            popup.classList.toggle('sb-fabric-chart-popup', Boolean(chart));
            if (chart) {
                const graph = document.createElement('div');
                graph.className = 'sb-fabric-series';
                chart(graph);
                const note = document.createElement('p');
                note.textContent = `${capacity.sku ?? 'Unknown SKU'} / saved utilization history / dotted = 80% scale-up / dashed = 100%`;
                popup.replaceChildren(title, sellerLine, note, graph);
                button.setAttribute('aria-describedby', popup.id);
                popup.showPopover();
                position();
                return;
            }
            const details = document.createElement('dl');
            for (const [name, value] of [
                ['SKU', capacity.sku], ['Tenant', capacity.tenant_id],
                ['Capacity', capacity.capacity_id],
                ['History utilization', percent(capacity.utilization_pct)],
                ['Latest hour', percent(capacity.latest_utilization_pct)],
            ]) {
                const dt = document.createElement('dt');
                dt.textContent = name;
                const dd = document.createElement('dd');
                dd.textContent = value ?? '-';
                details.append(dt, dd);
            }
            popup.replaceChildren(title, sellerLine, details);
            button.setAttribute('aria-describedby', popup.id);
            popup.showPopover();
            position();
        }
        button.addEventListener('pointerenter', show);
        button.addEventListener('pointerleave', scheduleClose);
        button.addEventListener('focus', show);
        button.addEventListener('blur', scheduleClose);
        button.addEventListener('click', show);
        return button;
    }
    popup.addEventListener('pointerenter', () => clearTimeout(timer));
    popup.addEventListener('pointerleave', scheduleClose);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') close();
    });
    document.addEventListener('scroll', () => {
        if (active === document.activeElement && popup.matches(':popover-open')) position();
        else close();
    }, true);
    window.addEventListener('resize', close);
    window.SBFabricCapacityLabel = { create, close };
})();
