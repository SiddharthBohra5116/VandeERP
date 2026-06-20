(function() {
  console.log('[RESET_PASSWORD_DEBUG] admin-password-reset.js loaded');
  let resetTarget = {
    id: '',
    phone: '',
    name: ''
  };

  function normalizeWhatsappPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10) return '91' + digits;
    return digits;
  }

  function buildPasswordResetWhatsappUrl(name, phone, password) {
    const whatsappPhone = normalizeWhatsappPhone(phone);
    if (!whatsappPhone) return '';

    const message = [
      `Hello ${name || 'there'},`,
      '',
      'Your forgot password request has been approved by Vande Digital Academy.',
      `Temporary password: ${password}`,
      '',
      'Please login with this password and set your own new password immediately.'
    ].join('\n');

    return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
  }

  function showResetError(message) {
    const errorBox = document.getElementById('resetPasswordError');
    if (!errorBox) return;
    errorBox.textContent = message || 'Password reset failed. Please try again.';
    errorBox.hidden = false;
  }

  function clearResetError() {
    const errorBox = document.getElementById('resetPasswordError');
    if (!errorBox) return;
    errorBox.textContent = '';
    errorBox.hidden = true;
  }

  function currentPasswordValue() {
    const passwordInput = document.getElementById('resetPasswordInput');
    return passwordInput ? passwordInput.value : '';
  }

  window.triggerPasswordReset = function(userId, userName, userPhone) {
    const form = document.getElementById('resetForm');
    const modal = document.getElementById('resetModal');
    const resetUserName = document.getElementById('resetUserName');
    if (!form || !modal || !resetUserName) return;

    form.action = '/admin/users/' + userId + '/reset-password';
    resetTarget = {
      id: userId || '',
      phone: userPhone || '',
      name: userName || ''
    };
    clearResetError();
    resetUserName.innerText = userName;
    modal.classList.add('open');
  };

  window.closeResetModal = function() {
    const modal = document.getElementById('resetModal');
    const passwordInput = document.getElementById('resetPasswordInput');
    if (modal) modal.classList.remove('open');
    if (passwordInput) passwordInput.value = '';
    clearResetError();
    resetTarget = { id: '', phone: '', name: '' };
  };

  document.querySelectorAll('.reset-password-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.triggerPasswordReset(btn.dataset.userId, btn.dataset.userName, btn.dataset.userPhone);
    });
  });

  const form = document.getElementById('resetForm');
  const passwordField = document.getElementById('resetPasswordInput');
  const passwordToggleBtn = document.getElementById('toggleResetPasswordVisibility');

  if (passwordToggleBtn && passwordField) {
    passwordToggleBtn.addEventListener('click', () => {
      const isHidden = passwordField.type === 'password';
      passwordField.type = isHidden ? 'text' : 'password';
      passwordToggleBtn.textContent = isHidden ? 'Hide' : 'Show';
      passwordToggleBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
      passwordToggleBtn.setAttribute('aria-pressed', String(isHidden));
      passwordField.focus();
    });
  }

  if (passwordField) {
    passwordField.addEventListener('input', () => {
      if (currentPasswordValue().length >= 8) {
        clearResetError();
      }
    });
  }

  if (form) {
    window.handleResetPasswordSubmit = async function(e) {
      e.preventDefault();
      e.stopImmediatePropagation();

      const passwordInput = document.getElementById('resetPasswordInput');
      const submitBtn = form.querySelector('button[type="submit"]');
      const password = currentPasswordValue();
      console.log('[RESET_PASSWORD_DEBUG] submit captured password:', {
        value: password,
        length: password.length,
        action: form.action
      });
      clearResetError();

      if (!password || password.length < 8) {
        console.log('[RESET_PASSWORD_DEBUG] frontend rejected password length:', password.length);
        showResetError('Password must be at least 8 characters.');
        passwordInput?.focus();
        return;
      }

      const originalText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Updating...';
      }

      try {
        const redirectInput = form.querySelector('input[name="redirect"]');
        const body = {
          newPassword: password,
          redirect: redirectInput?.value || '/admin/dashboard'
        };
        console.log('[RESET_PASSWORD_DEBUG] request body:', body);

        const res = await fetch(form.action, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        console.log('[RESET_PASSWORD_DEBUG] response:', {
          status: res.status,
          ok: res.ok,
          data
        });

        if (!res.ok || !data.ok) {
          throw new Error(data.message || 'Password reset failed. Please try again.');
        }

        const whatsappUrl = buildPasswordResetWhatsappUrl(resetTarget.name, resetTarget.phone, password);
        if (whatsappUrl) {
          window.open(whatsappUrl, '_blank', 'noopener');
        }

        const requestRow = document.querySelector(`[data-reset-request-row="${resetTarget.id}"]`);
        if (requestRow) requestRow.remove();

        window.closeResetModal();
        window.location.assign(data.redirectUrl || form.querySelector('input[name="redirect"]')?.value || '/admin/dashboard?pwd_reset=1');
      } catch (err) {
        showResetError(err.message || 'Password reset failed. Please try again.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    };

    form.addEventListener('submit', window.handleResetPasswordSubmit);
  }

  const modal = document.getElementById('resetModal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        window.closeResetModal();
      }
    });
  }
})();
