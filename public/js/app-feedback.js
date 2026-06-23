(() => {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const ensureToastStack = () => {
    let stack = document.getElementById('appToastStack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'appToastStack';
      stack.className = 'app-toast-stack';
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    return stack;
  };

  const toast = (message, type = 'info', options = {}) => {
    if (!message) return null;
    const item = document.createElement('div');
    item.className = `app-toast app-toast-${type}`;
    item.setAttribute('role', type === 'error' ? 'alert' : 'status');
    item.innerHTML = `<div class="app-toast-mark" aria-hidden="true"></div><div class="app-toast-copy"><strong>${escapeHtml(options.title || ({ success:'Done', error:'Could not complete', warning:'Check this', info:'Update' }[type] || 'Update'))}</strong><span>${escapeHtml(message)}</span></div><button type="button" class="app-toast-close" aria-label="Dismiss">&times;</button>`;
    const dismiss = () => {
      if (item.dataset.closing) return;
      item.dataset.closing = '1';
      item.classList.add('is-leaving');
      setTimeout(() => item.remove(), 180);
    };
    item.querySelector('.app-toast-close').addEventListener('click', dismiss);
    ensureToastStack().appendChild(item);
    requestAnimationFrame(() => item.classList.add('is-visible'));
    setTimeout(dismiss, Number(options.duration) || (type === 'error' ? 7000 : 4500));
    return item;
  };

  const confirmAction = ({ message, title = 'Confirm action', confirmLabel = 'Continue', danger = false } = {}) => new Promise(resolve => {
    const overlay = document.getElementById('confirmModalOverlay');
    const body = document.getElementById('confirmModalBody');
    const submit = document.getElementById('confirmModalSubmitBtn');
    if (!overlay || !body || !submit) return resolve(false);

    const titleNode = overlay.querySelector('.modal-title');
    if (titleNode) titleNode.textContent = title;
    body.textContent = message || 'Continue with this action?';
    submit.textContent = confirmLabel;
    submit.className = danger ? 'btn btn-red btn-sm' : 'btn btn-primary btn-sm';
    overlay.classList.add('open');

    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      overlay.classList.remove('open');
      submit.removeEventListener('click', approve);
      overlay.removeEventListener('click', cancelFromOverlay);
      document.removeEventListener('keydown', cancelFromKeyboard);
      resolve(result);
    };
    const approve = () => finish(true);
    const cancelFromOverlay = event => { if (event.target === overlay || event.target.closest('[data-confirm-cancel]')) finish(false); };
    const cancelFromKeyboard = event => { if (event.key === 'Escape') finish(false); };
    submit.addEventListener('click', approve);
    overlay.addEventListener('click', cancelFromOverlay);
    document.addEventListener('keydown', cancelFromKeyboard);
    setTimeout(() => submit.focus(), 0);
  });

  window.AppFeedback = { toast, confirm: confirmAction };
  window.showToast = toast;
  window.alert = message => toast(message, 'warning');

  document.addEventListener('click', async event => {
    const trigger = event.target.closest('[data-confirm]');
    if (!trigger || trigger.dataset.confirmApproved === '1') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const message = trigger.dataset.confirm || 'Continue with this action?';
    const danger = trigger.dataset.confirmDanger !== 'false';
    const approved = await confirmAction({
      title: trigger.dataset.confirmTitle || (danger ? 'Confirm deletion' : 'Confirm action'),
      message,
      confirmLabel: trigger.dataset.confirmLabel || (danger ? 'Delete' : 'Continue'),
      danger
    });
    if (!approved) return;
    const form = trigger.matches('form') ? trigger : trigger.closest('form');
    if (form) {
      form.dataset.confirmApproved = '1';
      form.requestSubmit(trigger.matches('[type="submit"]') ? trigger : undefined);
      setTimeout(() => delete form.dataset.confirmApproved, 0);
      return;
    }
    trigger.dataset.confirmApproved = '1';
    trigger.click();
    delete trigger.dataset.confirmApproved;
  }, true);
})();
