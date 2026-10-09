/** Remove executable markup at template display boundaries, not from stored payloads. */
(function (root) {
    'use strict';
    function sanitize(html) {
        const fragment = root.document.createElement('template');
        fragment.innerHTML = html;
        fragment.content.querySelectorAll(
            'script,iframe,object,embed,style,link,meta,base,form,input,button,textarea,select,svg,math'
        ).forEach(node => node.remove());
        fragment.content.querySelectorAll('*').forEach(node => {
            [...node.attributes].forEach(attribute => {
                const name = attribute.name.toLowerCase();
                const value = attribute.value.replace(/[\u0000-\u0020]/g, '').toLowerCase();
                if (name.startsWith('on') || name === 'srcdoc'
                    || (['href', 'src', 'xlink:href', 'action'].includes(name)
                        && /^(javascript|vbscript|data):/.test(value))
                    || (name === 'style' && /url\s*\(|expression\s*\(/i.test(value))) {
                    node.removeAttribute(attribute.name);
                }
            });
        });
        return fragment.innerHTML;
    }
    root.SBTemplateHTML = {sanitize};
    if (typeof module !== 'undefined') module.exports = {sanitize};
})(typeof window === 'undefined' ? globalThis : window);
