document.addEventListener('DOMContentLoaded', () => {
  // Find search/filter form and the results target container
  const filterForm = document.querySelector('form.filter-bar') || document.querySelector('form[action][method="GET"]');
  const resultsContainer = document.getElementById('results-container');

  if (!filterForm || !resultsContainer) return;

  let debounceTimer;

  const updateResults = async () => {
    const formData = new FormData(filterForm);
    const params = new URLSearchParams();
    
    for (const [key, value] of formData.entries()) {
      if (value.trim()) {
        params.set(key, value);
      }
    }

    const queryString = params.toString();
    const targetUrl = window.location.pathname + (queryString ? '?' + queryString : '');

    // Push new history state so browser forward/backward buttons work
    window.history.pushState(null, '', targetUrl);

    try {
      const response = await fetch(targetUrl);
      if (!response.ok) throw new Error('Fetch failed');
      const htmlText = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      const newResults = doc.getElementById('results-container');

      if (newResults) {
        resultsContainer.innerHTML = newResults.innerHTML;
      }
    } catch (err) {
      console.error('❌ Error updating search results:', err);
    }
  };

  // Debounced input handler for text fields
  filterForm.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updateResults, 200);
    }
  });

  // Instant handler for dropdown options changes
  filterForm.addEventListener('change', (e) => {
    if (e.target.tagName === 'SELECT') {
      updateResults();
    }
  });

  // Intercept form submissions
  filterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    updateResults();
  });
});
