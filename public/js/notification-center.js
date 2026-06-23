document.addEventListener('DOMContentLoaded', () => {
  const dropdown = document.getElementById('notificationDropdown');
  if (!dropdown) return;
  const bellBtn = document.getElementById('notificationBellBtn');
  const closeBtn = document.getElementById('notificationCloseBtn');
  const emptyStateHtml = '<div class="notification-empty">No unread notifications</div>';
  let activeNotificationFilter = 'all';
  let latestNotifications = [];
  let knownNotificationIds = new Set();
  let hasLoadedNotifications = false;
  let liveToastTimer = null;

  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  const iconForType = (type) => ({
    message: 'MSG',
    reset_request: 'KEY',
    fee_overdue: 'FEE',
    fee_due_soon: 'FEE',
    schedule: 'CLS',
    class_completion_due: 'CLS',
    low_attendance: 'ATT',
    homework_due: 'HW',
    homework_overdue: 'HW',
    assignment_graded: 'GRD',
    grading_pending: 'GRD',
    ready_to_convert: 'CRM',
    followup_gap: 'CRM',
    profile_request: 'PRF',
    leave_request: 'LVE',
    announcement: 'ANN'
  }[type] || 'NEW');

  const categoryForType = (type) => {
    if (['message'].includes(type)) return 'messages';
    if (['assignment_graded', 'grading_pending', 'homework_due', 'homework_overdue', 'schedule', 'class_completion_due', 'profile_request', 'leave_request'].includes(type)) return 'tasks';
    if (['fee_overdue', 'fee_due_soon', 'low_attendance', 'ready_to_convert', 'followup_gap', 'reset_request'].includes(type)) return 'alerts';
    return 'updates';
  };

  const priorityForType = (type) => {
    if (['fee_overdue', 'low_attendance', 'homework_overdue', 'reset_request', 'profile_request', 'leave_request'].includes(type)) return 'high';
    if (['fee_due_soon', 'ready_to_convert', 'followup_gap', 'grading_pending', 'assignment_graded'].includes(type)) return 'medium';
    return 'normal';
  };

  const actionForType = (type) => ({
    message: 'Reply',
    assignment_graded: 'View result',
    grading_pending: 'Grade',
    homework_due: 'Open',
    homework_overdue: 'Review',
    fee_overdue: 'Open ledger',
    fee_due_soon: 'Open ledger',
    schedule: 'View class',
    class_completion_due: 'Complete class',
    ready_to_convert: 'Convert',
    followup_gap: 'Open lead',
    reset_request: 'Review',
    profile_request: 'Review',
    leave_request: 'Review',
    announcement: 'Open'
  }[type] || 'Open');

  const showLiveToast = (notifications) => {
    if (!notifications.length) return;
    const first = notifications[0];
    let toast = document.getElementById('notificationLiveToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'notificationLiveToast';
      toast.className = 'notification-live-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light'
      || document.body.classList.contains('light-theme')
      || localStorage.getItem('theme') !== 'dark';
    toast.classList.toggle('is-light', isLightTheme);

    const more = notifications.length > 1 ? `<span>${notifications.length - 1} more new notification${notifications.length > 2 ? 's' : ''}</span>` : '';
    toast.innerHTML = `
      <button type="button" class="notification-live-toast-body">
        <strong>${escapeHtml(first.title || 'New notification')}</strong>
        <small>${escapeHtml(first.message || '')}</small>
        ${more}
      </button>
    `;
    toast.classList.add('show');

    toast.querySelector('button')?.addEventListener('click', () => {
      toast.classList.remove('show');
      if (first.link && first.link !== '#') {
        window.location.href = first.link;
      } else {
        openDropdown();
      }
    }, { once: true });

    clearTimeout(liveToastTimer);
    liveToastTimer = setTimeout(() => toast.classList.remove('show'), 6500);
  };

  const announceNewNotifications = (notifications) => {
    if (!hasLoadedNotifications) {
      knownNotificationIds = new Set(notifications.map(n => String(n.id)));
      hasLoadedNotifications = true;
      return [];
    }

    const incoming = notifications.filter(n => !knownNotificationIds.has(String(n.id)));
    knownNotificationIds = new Set(notifications.map(n => String(n.id)));
    if (incoming.length === 0) return [];

    bellBtn?.classList.remove('has-new-notification');
    void bellBtn?.offsetWidth;
    bellBtn?.classList.add('has-new-notification');
    setTimeout(() => bellBtn?.classList.remove('has-new-notification'), 1800);
    showLiveToast(incoming);
    return incoming.map(n => String(n.id));
  };

  const relativeTime = (value) => {
    if (!value) return '';
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return new Date(value).toLocaleDateString();
  };

  const filterNotifications = (notifications) => {
    if (activeNotificationFilter === 'all') return notifications;
    return notifications.filter(n => categoryForType(n.type) === activeNotificationFilter);
  };

  const renderFilterCounts = (notifications) => {
    const counts = { all: notifications.length, tasks: 0, messages: 0, alerts: 0 };
    notifications.forEach(n => {
      const category = categoryForType(n.type);
      if (Object.prototype.hasOwnProperty.call(counts, category)) counts[category]++;
    });
    Object.entries(counts).forEach(([key, count]) => {
      const target = dropdown.querySelector(`[data-count-for="${key}"]`);
      if (target) target.textContent = count;
    });
  };

  const setActiveFilter = (filter) => {
    activeNotificationFilter = filter;
    dropdown.querySelectorAll('.notification-filter').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderNotifications(latestNotifications);
  };

  const adjustMobilePosition = () => {
    if (window.innerWidth <= 900) {
      const topbar = document.querySelector('.topbar');
      if (topbar && dropdown.classList.contains('is-open')) {
        dropdown.style.top = `${topbar.offsetHeight + 6}px`;
      }
    } else {
      dropdown.style.top = '';
    }
  };

  const closeDropdown = () => {
    dropdown.classList.remove('is-open');
    dropdown.style.display = 'none';
  };

  const openDropdown = () => {
    dropdown.classList.add('is-open');
    dropdown.style.display = 'block';
    adjustMobilePosition();
  };

  if (bellBtn) {
    bellBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (dropdown.classList.contains('is-open')) closeDropdown();
      else openDropdown();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeDropdown();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && !bellBtn?.contains(e.target)) {
      closeDropdown();
    }
  });

  dropdown.addEventListener('click', (e) => {
    const filterBtn = e.target.closest('.notification-filter');
    if (!filterBtn) return;
    e.preventDefault();
    e.stopPropagation();
    setActiveFilter(filterBtn.dataset.filter || 'all');
  });

  window.addEventListener('resize', adjustMobilePosition);

  document.addEventListener('softnav:load', () => {
    closeDropdown();
  });

  const updateBellBadge = (newCount) => {
    if (!bellBtn) return;
    let badge = bellBtn.querySelector('.notification-badge');
    if (newCount > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notification-badge';
        bellBtn.appendChild(badge);
      }
      badge.textContent = newCount > 99 ? '99+' : newCount;
    } else if (badge) {
      badge.remove();
    }
    
    // Update header label too
    const headerUnread = dropdown.querySelector('.header-unread-count');
    if (headerUnread) {
      if (newCount > 0) {
        headerUnread.textContent = newCount + ' Unread';
        headerUnread.style.display = 'inline';
      } else {
        headerUnread.style.display = 'none';
      }
    }
  };

  const renderNotifications = (notifications, newIds = []) => {
    latestNotifications = Array.isArray(notifications) ? notifications : [];
    renderFilterCounts(latestNotifications);
    const visibleNotifications = filterNotifications(latestNotifications);
    const listContainer = dropdown.querySelector('.notification-list');
    if (!listContainer) return;
    
    if (!visibleNotifications || visibleNotifications.length === 0) {
      listContainer.innerHTML = latestNotifications.length === 0
        ? emptyStateHtml
        : '<div class="notification-empty">No notifications in this filter</div>';
      const markAllBtn = document.getElementById('markAllNotificationsReadBtn');
      if (markAllBtn && latestNotifications.length === 0) markAllBtn.remove();
      return;
    }
    
    // Ensure mark all read button exists if there are notifications
    let markAllBtn = document.getElementById('markAllNotificationsReadBtn');
    const headerRight = dropdown.querySelector('.notification-dropdown-header .d-flex');
    if (headerRight && !markAllBtn) {
      markAllBtn = document.createElement('button');
      markAllBtn.id = 'markAllNotificationsReadBtn';
      markAllBtn.style.cssText = 'background: none; border: none; color: var(--gold-light); font-size: 0.72rem; cursor: pointer; font-weight: 600; padding: 2px 4px; border-radius: 4px; transition: background 0.2s;';
      markAllBtn.textContent = 'Mark all read';
      headerRight.insertBefore(markAllBtn, headerRight.firstChild);
      
      markAllBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const wrappers = listContainer.querySelectorAll('.notification-wrapper');
        const ids = latestNotifications.map(n => String(n.id));
        if (ids.length === 0) return;
        wrappers.forEach((w) => {
          w.style.transition = 'all 0.3s ease';
          w.style.opacity = '0';
          w.style.transform = 'translateX(20px)';
        });
        setTimeout(() => {
          latestNotifications = [];
          listContainer.innerHTML = emptyStateHtml;
          renderFilterCounts(latestNotifications);
          updateBellBadge(0);
          markAllBtn.remove();
        }, 300);
        try {
          await fetch('/auth/notifications/read-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
          });
        } catch (err) {
          console.error('Error marking all notifications read:', err);
        }
      });
    }
    
    const sanitizedNotifications = visibleNotifications.map(n => ({
      ...n,
      id: escapeHtml(n.id),
      title: escapeHtml(n.title),
      message: escapeHtml(n.message),
      link: escapeHtml(n.link || '#')
    }));

    const newIdSet = new Set(newIds.map(String));
    listContainer.innerHTML = sanitizedNotifications.map(n => {
      let icon = '🔔';
      if (n.type === 'message') icon = '💬';
      else if (n.type === 'reset_request') icon = '🔑';
      else if (n.type === 'fee_overdue' || n.type === 'fee_due_soon') icon = '💵';
      else if (n.type === 'schedule') icon = '🗓️';
      else if (n.type === 'low_attendance') icon = '🔴';
      
      const timeStr = n.date ? new Date(n.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
      const dateStr = n.date ? new Date(n.date).toLocaleDateString() : '';
      const category = categoryForType(n.type);
      const priority = priorityForType(n.type);
      const action = actionForType(n.type);
      const timeLabel = relativeTime(n.date);
      
      return `
        <div class="notification-wrapper priority-${priority}${newIdSet.has(String(n.id)) ? ' is-new' : ''}" data-id="${n.id}" data-category="${category}">
          <a href="${n.link || '#'}" class="notification-item">
            <div class="notification-item-title">
              <span class="notification-unread-dot"></span>
              <span class="notification-type-chip">${iconForType(n.type)}</span>
              <span class="notification-title-text">${n.title}</span>
            </div>
            <div class="notification-item-body">${n.message}</div>
            <div class="notification-item-meta">
              <span>${timeLabel}</span>
              <span class="notification-action-label">${action}</span>
            </div>
            ${n.date ? `<div class="notification-item-time">${timeStr} — ${dateStr}</div>` : ''}
          </a>
          <button class="dismiss-btn dismiss-notification-btn" data-id="${n.id}" aria-label="Dismiss">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `;
    }).join('');
  };

  const updateSidebarBadges = (badges) => {
    if (!badges) return;
    // 1. Reset Requests
    const resetItem = document.querySelector('a[href="/admin/dashboard"]');
    if (resetItem) {
      let b = resetItem.querySelector('.badge');
      if (badges.resetRequests > 0) {
        if (!b) {
          b = document.createElement('span');
          b.className = 'badge badge-gold';
          b.style.cssText = 'margin-left: auto; font-size: 10px; font-weight: 700; padding: 1px 5px;';
          resetItem.appendChild(b);
        }
        b.textContent = badges.resetRequests;
      } else if (b) {
        b.remove();
      }
    }

    const profileRequestsItem = document.querySelector('a[href="/admin/profile-requests"]');
    if (profileRequestsItem) {
      let b = profileRequestsItem.querySelector('.badge');
      if (badges.profileRequests > 0) {
        if (!b) {
          b = document.createElement('span');
          b.className = 'badge badge-gold';
          b.style.cssText = 'margin-left: auto; font-size: 10px; font-weight: 700; padding: 1px 5px;';
          profileRequestsItem.appendChild(b);
        }
        b.textContent = badges.profileRequests;
      } else if (b) {
        b.remove();
      }
    }

    const leavesItem = document.querySelector('a[href="/admin/holidays-leaves"]');
    if (leavesItem) {
      let b = leavesItem.querySelector('.badge');
      if (badges.pendingLeaves > 0) {
        if (!b) {
          b = document.createElement('span');
          b.className = 'badge badge-gold';
          b.style.cssText = 'margin-left: auto; font-size: 10px; font-weight: 700; padding: 1px 5px;';
          leavesItem.appendChild(b);
        }
        b.textContent = badges.pendingLeaves;
      } else if (b) {
        b.remove();
      }
    }

    // 2. Fees Overdue
    const feesItem = document.querySelector('a[href="/admin/fees"]');
    if (feesItem) {
      let b = feesItem.querySelector('.badge');
      if (badges.feesOverdue > 0) {
        if (!b) {
          b = document.createElement('span');
          b.className = 'badge badge-gold';
          b.style.cssText = 'margin-left: auto; font-size: 10px; font-weight: 700; padding: 1px 5px;';
          feesItem.appendChild(b);
        }
        b.textContent = badges.feesOverdue;
      } else if (b) {
        b.remove();
      }
    }

    // 3. Stale Leads (counsellor)
    const leadsItem = document.querySelector('a[href="/counsellor/leads"]');
    if (leadsItem) {
      let b = leadsItem.querySelector('.badge');
      if (badges.staleLeads > 0) {
        if (!b) {
          b = document.createElement('span');
          b.className = 'badge badge-gold';
          b.style.cssText = 'margin-left: auto; font-size: 10px; font-weight: 700; padding: 1px 5px;';
          leadsItem.appendChild(b);
        }
        b.textContent = badges.staleLeads;
      } else if (b) {
        b.remove();
      }
    }

    // 4. Ungraded Assignments (teacher)
    const assignmentsItem = document.querySelector('a[href="/teacher/assignments"]');
    if (assignmentsItem) {
      let b = assignmentsItem.querySelector('.badge');
      if (badges.ungradedAssignments > 0) {
        if (!b) {
          b = document.createElement('span');
          b.className = 'badge badge-gold';
          b.style.cssText = 'margin-left: auto; font-size: 10px; font-weight: 700; padding: 1px 5px;';
          assignmentsItem.appendChild(b);
        }
        b.textContent = badges.ungradedAssignments;
      } else if (b) {
        b.remove();
      }
    }

    // 5. Unread Messages (Inbox)
    const inboxItem = document.querySelector('a[href="/auth/inbox"]');
    if (inboxItem) {
      let b = inboxItem.querySelector('.badge');
      if (badges.unreadMessages > 0) {
        if (!b) {
          b = document.createElement('span');
          b.className = 'badge badge-gold';
          b.style.cssText = 'margin-left: auto; font-size: 10px; font-weight: 700; padding: 1px 5px;';
          inboxItem.appendChild(b);
        }
        b.textContent = badges.unreadMessages;
      } else if (b) {
        b.remove();
      }
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        const notifications = data.notifications || [];
        const newIds = announceNewNotifications(notifications);
        updateBellBadge(data.notifications ? data.notifications.length : 0);
        renderNotifications(notifications, newIds);
        updateSidebarBadges(data.sidebarBadges || {});
      }
    } catch (err) {
      console.error('Error fetching notifications asynchronously:', err);
    }
  };

  // Initial fetch
  fetchNotifications();

  // Keep the UI feeling alive while avoiding background noise on hidden tabs.
  setInterval(() => {
    if (!document.hidden) fetchNotifications();
  }, 5000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) fetchNotifications();
  });

  // Mark single notification as read
  dropdown.addEventListener('click', async (e) => {
    const dismissBtn = e.target.closest('.dismiss-notification-btn');
    const notificationLink = e.target.closest('.notification-item');

    if (dismissBtn) {
      e.preventDefault();
      e.stopPropagation();

      const id = dismissBtn.getAttribute('data-id');
      const wrapper = dismissBtn.closest('.notification-wrapper');
      if (!wrapper) return;

      // Visual feedback (fade out and slide out)
      wrapper.style.transition = 'all 0.3s ease';
      wrapper.style.opacity = '0';
      wrapper.style.transform = 'translateX(20px)';

      setTimeout(() => {
        latestNotifications = latestNotifications.filter(n => String(n.id) !== String(id));
        renderFilterCounts(latestNotifications);
        wrapper.remove();
        const list = dropdown.querySelector('.notification-list');
        const items = list.querySelectorAll('.notification-wrapper');
        updateBellBadge(latestNotifications.length);

        if (items.length === 0) {
          list.innerHTML = latestNotifications.length === 0
            ? emptyStateHtml
            : '<div class="notification-empty">No notifications in this filter</div>';
          const markAllBtn = document.getElementById('markAllNotificationsReadBtn');
          if (markAllBtn && latestNotifications.length === 0) markAllBtn.remove();
        }
      }, 300);

      try {
        await fetch(`/auth/notifications/${id}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.error('Error marking notification read:', err);
      }
    } else if (notificationLink) {
      e.preventDefault();
      const wrapper = notificationLink.closest('.notification-wrapper');
      const id = wrapper ? wrapper.getAttribute('data-id') : null;
      const targetUrl = notificationLink.getAttribute('href');

      if (id) {
        try {
          await fetch(`/auth/notifications/${id}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err) {
          console.error('Error marking notification read on click:', err);
        }
      }
      window.location.href = targetUrl;
    }
  });
});
