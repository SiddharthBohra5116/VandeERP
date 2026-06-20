(() => {
  const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
  const monthOnlyFmt = new Intl.DateTimeFormat('en-US', { month: 'long' });
  let activeInput = null;
  let viewDate = new Date();
  let picker = null;
  let pickerMode = 'day';
  let ignoreNextDocumentClick = false;

  const pad = (n) => String(n).padStart(2, '0');
  const toISODate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const toISOMonth = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  const parseISODate = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  };
  const parseISOMonth = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, 1);
  };
  const isMonthInput = () => activeInput && activeInput.type === 'month';

  const closePicker = () => {
    if (picker) picker.remove();
    picker = null;
    if (activeInput) activeInput.classList.remove('is-date-picker-open');
    activeInput = null;
  };

  const selectDate = (date) => {
    if (!activeInput) return;
    activeInput.value = isMonthInput() ? toISOMonth(date) : toISODate(date);
    activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    activeInput.dispatchEvent(new Event('change', { bubbles: true }));
    closePicker();
  };

  const positionPicker = () => {
    if (!picker || !activeInput) return;
    const rect = activeInput.getBoundingClientRect();
    const gap = 14;
    const top = rect.bottom + gap + picker.offsetHeight > window.innerHeight
      ? Math.max(8, rect.top - picker.offsetHeight - gap)
      : rect.bottom + gap;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - picker.offsetWidth - 8);
    picker.style.top = `${top}px`;
    picker.style.left = `${left}px`;
  };

  const handlePickerAction = (e) => {
    const target = e.target.closest('button');
    if (!target || !picker || !picker.contains(target)) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (target.hasAttribute('data-month-view')) {
      pickerMode = 'month';
      renderPicker();
      return;
    }

    if (target.hasAttribute('data-year-view')) {
      pickerMode = 'year';
      renderPicker();
      return;
    }

    if (target.hasAttribute('data-prev')) {
      if (pickerMode === 'day') {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
      } else if (pickerMode === 'month') {
        viewDate = new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1);
      } else {
        viewDate = new Date(viewDate.getFullYear() - 12, viewDate.getMonth(), 1);
      }
      renderPicker();
      return;
    }

    if (target.hasAttribute('data-next')) {
      if (pickerMode === 'day') {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
      } else if (pickerMode === 'month') {
        viewDate = new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1);
      } else {
        viewDate = new Date(viewDate.getFullYear() + 12, viewDate.getMonth(), 1);
      }
      renderPicker();
      return;
    }

    if (target.hasAttribute('data-month')) {
      viewDate = new Date(viewDate.getFullYear(), Number(target.dataset.month), 1);
      if (isMonthInput()) {
        selectDate(viewDate);
      } else {
        pickerMode = 'day';
        renderPicker();
      }
      return;
    }

    if (target.hasAttribute('data-year')) {
      viewDate = new Date(Number(target.dataset.year), viewDate.getMonth(), 1);
      pickerMode = 'month';
      renderPicker();
      return;
    }

    if (target.hasAttribute('data-date')) {
      selectDate(parseISODate(target.dataset.date));
      return;
    }

    if (target.hasAttribute('data-clear')) {
      if (activeInput) {
        activeInput.value = '';
        activeInput.dispatchEvent(new Event('input', { bubbles: true }));
        activeInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      closePicker();
      return;
    }

    if (target.hasAttribute('data-today')) {
      selectDate(new Date());
      return;
    }

    if (target.hasAttribute('data-this-month')) {
      selectDate(new Date());
    }
  };

  const renderPicker = () => {
    if (!picker) return;
    const selected = isMonthInput() ? parseISOMonth(activeInput.value) : parseISODate(activeInput.value);
    const today = new Date();
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const changeMonth = (offset) => {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
      renderPicker();
    };
    const changeYear = (offset) => {
      viewDate = new Date(viewDate.getFullYear() + offset, viewDate.getMonth(), 1);
      renderPicker();
    };

    if (pickerMode === 'month') {
      picker.innerHTML = `
        <div class="app-date-picker-head">
          <button type="button" class="app-date-picker-title is-clickable" data-year-view>${year}</button>
          <div class="app-date-picker-nav">
            <button type="button" data-prev aria-label="Previous year">&lsaquo;</button>
            <button type="button" data-next aria-label="Next year">&rsaquo;</button>
          </div>
        </div>
        <div class="app-date-picker-month-grid">
          ${Array.from({ length: 12 }, (_, i) => `
            <button type="button" class="app-date-picker-month${i === month ? ' is-selected' : ''}" data-month="${i}">
              ${monthOnlyFmt.format(new Date(year, i, 1)).slice(0, 3)}
            </button>
          `).join('')}
        </div>
        <div class="app-date-picker-foot">
          <button type="button" data-clear>Clear</button>
          <button type="button" data-this-month>This month</button>
        </div>
      `;

      picker.querySelector('[data-year-view]').addEventListener('click', () => {
        pickerMode = 'year';
        renderPicker();
      });
      picker.querySelector('[data-prev]').addEventListener('click', () => changeYear(-1));
      picker.querySelector('[data-next]').addEventListener('click', () => changeYear(1));
      picker.querySelectorAll('[data-month]').forEach(btn => {
        btn.addEventListener('click', () => {
          viewDate = new Date(viewDate.getFullYear(), Number(btn.dataset.month), 1);
          if (isMonthInput()) {
            selectDate(viewDate);
          } else {
            pickerMode = 'day';
            renderPicker();
          }
        });
      });
      picker.querySelector('[data-clear]').addEventListener('click', () => {
        if (activeInput) {
          activeInput.value = '';
          activeInput.dispatchEvent(new Event('input', { bubbles: true }));
          activeInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        closePicker();
      });
      picker.querySelector('[data-this-month]').addEventListener('click', () => selectDate(new Date()));
      positionPicker();
      return;
    }

    if (pickerMode === 'year') {
      const startYear = Math.floor(year / 12) * 12;
      picker.innerHTML = `
        <div class="app-date-picker-head">
          <div class="app-date-picker-title">${startYear} - ${startYear + 11}</div>
          <div class="app-date-picker-nav">
            <button type="button" data-prev aria-label="Previous years">&lsaquo;</button>
            <button type="button" data-next aria-label="Next years">&rsaquo;</button>
          </div>
        </div>
        <div class="app-date-picker-year-grid">
          ${Array.from({ length: 12 }, (_, i) => {
            const y = startYear + i;
            return `
              <button type="button" class="app-date-picker-year${y === year ? ' is-selected' : ''}" data-year="${y}">
                ${y}
              </button>
            `;
          }).join('')}
        </div>
      `;

      picker.querySelector('[data-prev]').addEventListener('click', () => {
        viewDate = new Date(viewDate.getFullYear() - 12, viewDate.getMonth(), 1);
        renderPicker();
      });
      picker.querySelector('[data-next]').addEventListener('click', () => {
        viewDate = new Date(viewDate.getFullYear() + 12, viewDate.getMonth(), 1);
        renderPicker();
      });
      picker.querySelectorAll('[data-year]').forEach(btn => {
        btn.addEventListener('click', () => {
          viewDate = new Date(Number(btn.dataset.year), viewDate.getMonth(), 1);
          pickerMode = 'month';
          renderPicker();
        });
      });
      positionPicker();
      return;
    }

    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());

    const days = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const isCurrentMonth = day.getMonth() === month;
      const isToday = toISODate(day) === toISODate(today);
      const isSelected = selected && toISODate(day) === toISODate(selected);
      days.push(`
        <button type="button" class="app-date-picker-day${isCurrentMonth ? '' : ' is-muted'}${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}" data-date="${toISODate(day)}">
          ${day.getDate()}
        </button>
      `);
    }

    picker.innerHTML = `
      <div class="app-date-picker-head">
        <button type="button" class="app-date-picker-title is-clickable" data-month-view>${monthFmt.format(viewDate)}</button>
        <div class="app-date-picker-nav">
          <button type="button" data-prev aria-label="Previous month">&lsaquo;</button>
          <button type="button" data-next aria-label="Next month">&rsaquo;</button>
        </div>
      </div>
      <div class="app-date-picker-grid">
        ${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => `<div class="app-date-picker-weekday">${d}</div>`).join('')}
        ${days.join('')}
      </div>
      <div class="app-date-picker-foot">
        <button type="button" data-clear>Clear</button>
        <button type="button" data-today>Today</button>
      </div>
    `;

    picker.querySelector('[data-month-view]').addEventListener('click', () => {
      pickerMode = 'month';
      renderPicker();
    });
    picker.querySelector('[data-prev]').addEventListener('click', () => {
      changeMonth(-1);
    });
    picker.querySelector('[data-next]').addEventListener('click', () => {
      changeMonth(1);
    });
    picker.querySelector('[data-clear]').addEventListener('click', () => {
      if (activeInput) {
        activeInput.value = '';
        activeInput.dispatchEvent(new Event('input', { bubbles: true }));
        activeInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      closePicker();
    });
    picker.querySelector('[data-today]').addEventListener('click', () => selectDate(new Date()));
    picker.querySelectorAll('[data-date]').forEach(btn => {
      btn.addEventListener('click', () => selectDate(parseISODate(btn.dataset.date)));
    });
    positionPicker();
  };

  const openPicker = (input) => {
    if (activeInput && activeInput !== input) {
      activeInput.classList.remove('is-date-picker-open');
    }
    activeInput = input;
    activeInput.classList.add('is-date-picker-open');
    activeInput.blur();
    ignoreNextDocumentClick = true;
    viewDate = input.type === 'month' ? (parseISOMonth(input.value) || new Date()) : (parseISODate(input.value) || new Date());
    pickerMode = input.type === 'month' ? 'month' : 'day';
    if (!picker) {
      picker = document.createElement('div');
      picker.className = 'app-date-picker';
      picker.addEventListener('click', handlePickerAction, true);
      picker.addEventListener('pointerdown', (e) => e.stopPropagation());
      document.body.appendChild(picker);
    }
    renderPicker();
    requestAnimationFrame(positionPicker);
  };

  const initDatePickers = () => {
    document.querySelectorAll('input[type="date"], input[type="month"]').forEach(input => {
      if (input.dataset.appDatePickerReady === 'true') return;
      input.dataset.appDatePickerReady = 'true';

    input.setAttribute('readonly', 'readonly');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-haspopup', 'dialog');
    input.addEventListener('selectstart', (e) => e.preventDefault());
    input.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPicker(input);
    });

    let wrapper = input.parentElement;
    if (!wrapper.classList.contains('date-input-wrap')) {
      wrapper = document.createElement('span');
      wrapper.className = 'date-input-wrap';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
    }

    wrapper.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPicker(input);
    });
    wrapper.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    input.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPicker(input);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        openPicker(input);
      }
    });
    });
  };

  initDatePickers();
  document.addEventListener('softnav:load', initDatePickers);
  document.addEventListener('resultsUpdated', initDatePickers);

  document.addEventListener('click', (e) => {
    if (ignoreNextDocumentClick) {
      ignoreNextDocumentClick = false;
      return;
    }
    if (!picker) return;
    if (
      picker.contains(e.target) ||
      e.target === activeInput ||
      e.target.closest('.date-input-wrap')
    ) {
      return;
    }
    closePicker();
  });
  window.addEventListener('resize', positionPicker);
  window.addEventListener('scroll', positionPicker, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePicker();
  });
})();

