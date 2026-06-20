(() => {
  const contentSelector = '.page-content';
  const topbarTitleSelector = '.topbar-title span';
  let isNavigating = false;

  const isPlainLeftClick = event =>
    event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

  const isSkippableUrl = url =>
    !url ||
    url.origin !== window.location.origin ||
    url.pathname.startsWith('/files/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/logout');

  const shouldSkipLink = link => {
    if (!link) return true;
    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || link.target === '_blank') return true;
    if (link.hasAttribute('download') || link.dataset.noSoftNav === 'true') return true;
    return isSkippableUrl(new URL(href, window.location.href));
  };

  const shouldSkipForm = form => {
    if (!form || form.dataset.noSoftNav === 'true') return true;
    const method = (form.getAttribute('method') || 'GET').toUpperCase();
    const action = new URL(form.getAttribute('action') || window.location.href, window.location.href);
    if (isSkippableUrl(action)) return true;
    if (!['GET', 'POST'].includes(method)) return true;
    if (form.target && form.target !== '_self') return true;
    return false;
  };

  const showProgress = () => {
    if (window.NProgress) window.NProgress.start();
    document.documentElement.classList.add('soft-nav-loading');
  };

  const hideProgress = () => {
    if (window.NProgress) window.NProgress.done();
    document.documentElement.classList.remove('soft-nav-loading');
  };

  const stripFlashParams = () => {
    const flashKeys = [
      'created', 'updated', 'saved', 'posted', 'success', 'paid', 'converted', 'followup',
      'submitted', 'graded', 'verified', 'deleted', 'walkin', 'request_submitted',
      'profile_approved', 'profile_rejected', 'extended', 'bulk_empty', 'bulk_graded',
      'pwd_reset', 'pwd_changed', 'pwd_request', 'exists', 'already', 'error'
    ];
    const url = new URL(window.location.href);
    let changed = false;
    flashKeys.forEach(key => {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    });
    if (changed) {
      const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') + url.hash;
      window.history.replaceState({ softNav: true }, document.title, clean);
    }
  };

  const refreshActiveNav = () => {
    const path = window.location.pathname;
    let bestMatch = null;
    let bestLength = -1;

    document.querySelectorAll('.sidebar a.nav-item').forEach(link => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const linkPath = new URL(href, window.location.origin).pathname;
      const matches = path === linkPath || (linkPath !== '/' && path.startsWith(linkPath + '/'));
      link.classList.remove('active');
      if (matches && linkPath.length > bestLength) {
        bestMatch = link;
        bestLength = linkPath.length;
      }
    });

    bestMatch?.classList.add('active');
  };

  const initSoftContentBehaviors = () => {
    document.querySelectorAll('.alert[data-auto-dismiss]').forEach(el => {
      if (el.dataset.softDismissReady === 'true') return;
      el.dataset.softDismissReady = 'true';
      const delay = Number(el.dataset.autoDismiss) || 4500;
      setTimeout(() => {
        if (!el || el.dataset.dismissing === '1') return;
        el.dataset.dismissing = '1';
        el.classList.add('is-dismissing');
        setTimeout(() => el.remove(), 260);
      }, delay);
    });

    document.querySelectorAll('textarea').forEach(textarea => {
      if (textarea.dataset.softTextareaReady === 'true') return;
      textarea.dataset.softTextareaReady = 'true';
      const autoResize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      };
      textarea.addEventListener('input', autoResize);
      if (textarea.value) autoResize();
    });
  };

  const replaceTopbarTitle = doc => {
    const current = document.querySelector(topbarTitleSelector);
    const next = doc.querySelector(topbarTitleSelector);
    if (current && next) current.textContent = next.textContent;
  };

  const loadedScriptUrls = new Set(Array.from(document.scripts).map(script => script.src).filter(Boolean));

  const getInlineHandlerNames = container => {
    const names = new Set();
    container.querySelectorAll('[onclick], [onchange], [onsubmit], [oninput]').forEach(el => {
      ['onclick', 'onchange', 'onsubmit', 'oninput'].forEach(attr => {
        const value = el.getAttribute(attr) || '';
        value.replace(/\b([A-Za-z_$][\w$]*)\s*\(/g, (_, name) => {
          if (!['if', 'for', 'while', 'switch', 'return', 'confirm', 'alert'].includes(name)) {
            names.add(name);
          }
        });
      });
    });
    return Array.from(names);
  };

  const runContentScripts = async container => {
    const scripts = Array.from(container.querySelectorAll('script'));
    const handlerNames = getInlineHandlerNames(container);

    for (const oldScript of scripts) {
      const src = oldScript.getAttribute('src');
      oldScript.remove();

      if (src) {
        const fullSrc = new URL(src, window.location.href).href;
        if (loadedScriptUrls.has(fullSrc)) continue;

        await new Promise(resolve => {
          const script = document.createElement('script');
          Array.from(oldScript.attributes).forEach(attr => script.setAttribute(attr.name, attr.value));
          script.onload = () => {
            loadedScriptUrls.add(fullSrc);
            resolve();
          };
          script.onerror = resolve;
          document.body.appendChild(script);
        });
        continue;
      }

      const script = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => script.setAttribute(attr.name, attr.value));
      const exposeHandlers = handlerNames
        .map(name => `try { if (typeof ${name} !== "undefined") window.${name} = ${name}; } catch (_) {}`)
        .join('\n');
      script.textContent = `(function(){\n${oldScript.textContent}\n${exposeHandlers}\n})();`;
      document.body.appendChild(script);
      script.remove();
    }
  };

  const reinitializePage = () => {
    refreshActiveNav();
    initSoftContentBehaviors();
    stripFlashParams();
    window.dispatchEvent(new CustomEvent('softnav:load'));
    document.dispatchEvent(new CustomEvent('softnav:load'));
  };

  const applyDocument = async (html, url, pushState = true) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nextContent = doc.querySelector(contentSelector);
    const currentContent = document.querySelector(contentSelector);

    if (!nextContent || !currentContent) {
      window.location.href = url;
      return;
    }

    document.title = doc.title || document.title;
    replaceTopbarTitle(doc);
    currentContent.replaceChildren(...Array.from(nextContent.childNodes));
    await runContentScripts(currentContent);

    if (pushState) {
      window.history.pushState({ softNav: true }, document.title, url);
    }

    window.scrollTo(0, 0);
    reinitializePage();
  };

  const navigateTo = async (url, options = {}) => {
    if (isNavigating) return;
    isNavigating = true;
    showProgress();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'X-Soft-Nav': '1', 'Accept': 'text/html' },
        credentials: 'same-origin'
      });

      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
        window.location.href = url;
        return;
      }

      await applyDocument(await response.text(), response.url || url, options.pushState !== false);
    } catch (err) {
      console.error('Soft navigation failed:', err);
      window.location.href = url;
    } finally {
      isNavigating = false;
      hideProgress();
    }
  };

  const submitFormSoftly = async form => {
    if (isNavigating) return;
    isNavigating = true;
    showProgress();

    const method = (form.getAttribute('method') || 'GET').toUpperCase();
    const action = new URL(form.getAttribute('action') || window.location.href, window.location.href);

    try {
      let targetUrl = action.href;
      const fetchOptions = {
        method,
        headers: { 'X-Soft-Nav': '1', 'Accept': 'text/html' },
        credentials: 'same-origin'
      };

      if (method === 'GET') {
        const params = new URLSearchParams(new FormData(form));
        targetUrl = action.pathname + (params.toString() ? `?${params.toString()}` : '');
      } else {
        const formData = new FormData(form);
        const enctype = form.getAttribute('enctype') || '';
        if (enctype.includes('multipart/form-data')) {
          fetchOptions.body = formData;
        } else {
          fetchOptions.body = new URLSearchParams(formData);
          fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      }

      const response = await fetch(targetUrl, fetchOptions);
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
        form.submit();
        return;
      }

      await applyDocument(await response.text(), response.url || targetUrl, true);
    } catch (err) {
      console.error('Soft form submit failed:', err);
      form.submit();
    } finally {
      isNavigating = false;
      hideProgress();
    }
  };

  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!isPlainLeftClick(event) || shouldSkipLink(link)) return;
    event.preventDefault();
    navigateTo(new URL(link.getAttribute('href'), window.location.href).href);
  });

  document.addEventListener('submit', event => {
    const form = event.target;
    if (shouldSkipForm(form) || form.dataset.nativeSubmit === 'true') return;
    event.preventDefault();
    submitFormSoftly(form);
  });

  window.addEventListener('popstate', () => {
    navigateTo(window.location.href, { pushState: false });
  });

  window.AppSoftNav = { navigateTo, refreshActiveNav };
})();
