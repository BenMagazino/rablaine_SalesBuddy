/** The existing Quill formats and exact manual content payload, without autosave. */
(function (root) {
    'use strict';
    const document = root.document, form = document.getElementById('templateForm');
    if (!form) return;
    const content = form.elements.content;
    const notice = document.getElementById('templateFormNotice');
    const quill = new root.Quill('#editor', {
        theme: 'snow', modules: {toolbar: '#templateToolbar'},
    });
    quill.root.setAttribute('role', 'textbox');
    quill.root.setAttribute('aria-multiline', 'true');
    quill.root.setAttribute('aria-labelledby', 'templateContentLabel');
    quill.root.setAttribute('aria-describedby', 'templateContentHelp');
    let restoring = false;
    function restore(view) {
        restoring = true;
        quill.setContents(quill.clipboard.convert(
            root.SBTemplateHTML.sanitize(content.value)), 'silent');
        restoring = false;
        if (view?.selection) {
            quill.setSelection(view.selection.index, view.selection.length, 'silent');
        }
        quill.root.scrollTop = view?.scroll ?? 0;
    }
    restore();
    quill.on('text-change', () => {
        if (restoring) return;
        content.value = quill.root.innerHTML;
        quill.root.removeAttribute('aria-invalid');
        content.dispatchEvent(new Event('input', {bubbles: true}));
    });
    form.addEventListener('submit', event => {
        if (!quill.getText().trim()) {
            event.preventDefault();
            notice.textContent = 'Template content cannot be empty.';
            notice.hidden = false;
            quill.root.setAttribute('aria-invalid', 'true');
            quill.focus();
        }
    });
    root.SBTemplateEditor = {restore, view: () => ({
        scroll: quill.root.scrollTop,
        selection: quill.getSelection(),
    })};
    ['scroll', 'keyup', 'mouseup'].forEach(type => quill.root.addEventListener(type, () =>
        form.dispatchEvent(new Event('sb:template-view'))));
})(window);
