(() => {
  const SELECTOR = 'select.form-control, select.premium-select';
  let openDropdown = null;

  const visibleOptions = (select) => Array.from(select.options).filter(option => {
    if (option.hidden) return false;
    if (option.style && option.style.display === 'none') return false;
    return true;
  });

  const selectedLabel = (select) => {
    const option = select.options[select.selectedIndex];
    return option ? option.textContent.trim() : 'Select';
  };

  const closeDropdown = () => {
    if (!openDropdown) return;
    openDropdown.classList.remove('is-open');
    const button = openDropdown.querySelector('.app-select-button');
    if (button) button.setAttribute('aria-expanded', 'false');
    openDropdown = null;
  };

  const setValue = (select, value) => {
    select.value = value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const renderMenu = (wrapper) => {
    const select = wrapper.querySelector('select');
    const menu = wrapper.querySelector('.app-select-menu');
    const buttonText = wrapper.querySelector('.app-select-value');
    const button = wrapper.querySelector('.app-select-button');
    if (!select || !menu || !buttonText) return;

    buttonText.textContent = selectedLabel(select);
    if (button) button.disabled = select.disabled;
    menu.innerHTML = '';

    visibleOptions(select).forEach(option => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'app-select-option';
      item.textContent = option.textContent.trim();
      item.dataset.value = option.value;
      item.disabled = option.disabled;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', option.selected ? 'true' : 'false');
      if (option.selected) item.classList.add('is-selected');
      if (!option.value && option.disabled) item.classList.add('is-placeholder');
      menu.appendChild(item);
    });
  };

  const enhanceSelect = (select) => {
    if (!select || select.dataset.dropdownEnhanced === '1' || select.multiple || select.size > 1) return;
    select.dataset.dropdownEnhanced = '1';

    const wrapper = document.createElement('div');
    wrapper.className = `app-select ${select.classList.contains('premium-select') ? 'app-select-premium' : ''}`;
    ['width', 'minWidth', 'maxWidth', 'flex', 'flexGrow', 'flexShrink', 'flexBasis'].forEach(prop => {
      if (select.style[prop]) wrapper.style[prop] = select.style[prop];
    });
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    select.classList.add('app-native-select');
    select.setAttribute('tabindex', '-1');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'app-select-button';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<span class="app-select-value"></span><span class="app-select-caret" aria-hidden="true"></span>';

    const menu = document.createElement('div');
    menu.className = 'app-select-menu';
    menu.setAttribute('role', 'listbox');

    wrapper.appendChild(button);
    wrapper.appendChild(menu);
    renderMenu(wrapper);

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (openDropdown && openDropdown !== wrapper) closeDropdown();
      renderMenu(wrapper);
      const isOpen = wrapper.classList.toggle('is-open');
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      openDropdown = isOpen ? wrapper : null;
    });

    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.app-select-option');
      if (!item || item.disabled) return;
      e.preventDefault();
      setValue(select, item.dataset.value);
      renderMenu(wrapper);
      closeDropdown();
    });

    button.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDropdown();
        return;
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (!wrapper.classList.contains('is-open')) {
          renderMenu(wrapper);
          wrapper.classList.add('is-open');
          button.setAttribute('aria-expanded', 'true');
          openDropdown = wrapper;
        }
      }
    });

    select.addEventListener('change', () => renderMenu(wrapper));

    const observer = new MutationObserver(() => renderMenu(wrapper));
    observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['selected', 'disabled', 'hidden', 'style'] });
  };

  const enhanceAll = (root = document) => {
    root.querySelectorAll(SELECTOR).forEach(enhanceSelect);
  };

  document.addEventListener('click', (e) => {
    if (openDropdown && !openDropdown.contains(e.target)) closeDropdown();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });

  document.addEventListener('DOMContentLoaded', () => {
    enhanceAll();
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches(SELECTOR)) enhanceSelect(node);
          if (node.querySelectorAll) enhanceAll(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  document.addEventListener('softnav:load', () => enhanceAll());
  window.AppDropdownEnhancer = { enhanceAll };
})();
