/** Activate the complete opportunity fragment with the approved scoped record lifecycle. */
(() => {
    'use strict';
    function activate(container) {
        const root = container.querySelector('[data-sb-opportunity-detail]');
        const source = root?.querySelector('script[data-sb-opportunity-controller]');
        if (!source || source.src) throw new Error('Opportunity initializer is missing or invalid.');
        const script = document.createElement('script');
        script.textContent = source.textContent;
        source.replaceWith(script);
        return SBMilestoneWorkflow.attach(root, () => {
            throw new Error('Opportunity initializer did not mount.');
        });
    }
    window.SBOpportunityWorkflow = Object.freeze({activate});
})();
