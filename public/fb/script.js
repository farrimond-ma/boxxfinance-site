(function () {
  const STEPS = 3;
  let current = 1;
  const data = {};

  // DOM refs
  const steps = document.querySelectorAll('.form-step');
  const dots = document.querySelectorAll('.progress-dot');
  const fill = document.querySelector('.progress-line-fill');
  const label = document.querySelector('.step-label');
  const card = document.querySelector('.form-card');
  const success = document.querySelector('.success-state');

  const labels = ['Funding Type', 'Your Business', 'Your Details'];

  function updateProgress() {
    dots.forEach((d, i) => {
      const step = i + 1;
      d.classList.toggle('active', step === current);
      d.classList.toggle('completed', step < current);
    });
    const pct = ((current - 1) / (STEPS - 1)) * 100;
    fill.style.width = pct + '%';
    label.textContent = labels[current - 1] || '';
  }

  function showStep(n, shouldScroll = true) {
    steps.forEach(s => s.classList.remove('active'));
    const target = document.querySelector('[data-step="' + n + '"]');
    if (target) target.classList.add('active');
    current = n;
    updateProgress();
    if (shouldScroll) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Option card selection
  document.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('click', function () {
      const group = this.closest('.option-grid');
      group.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');
      // Clear error on parent
      const fg = group.closest('.field-group');
      if (fg) fg.classList.remove('has-error');
    });
  });

  // Validation
  function clearErrors(stepEl) {
    stepEl.querySelectorAll('.field-group').forEach(fg => fg.classList.remove('has-error'));
  }

  function setError(el, msg) {
    const fg = el.closest('.field-group');
    if (!fg) return;
    fg.classList.add('has-error');
    const errEl = fg.querySelector('.field-error');
    if (errEl) errEl.textContent = msg;
  }

  function validateStep(n) {
    const stepEl = document.querySelector('[data-step="' + n + '"]');
    clearErrors(stepEl);
    let valid = true;

    if (n === 1) {
      const selected = stepEl.querySelector('.option-card.selected');
      if (!selected) {
        const fg = stepEl.querySelector('.option-grid').closest('.field-group');
        if (fg) { fg.classList.add('has-error'); }
        valid = false;
      } else {
        data.fundingType = selected.dataset.value;
      }
      const amount = stepEl.querySelector('[name="amount"]');
      if (!amount.value.trim()) {
        setError(amount, 'Please enter an approximate amount');
        valid = false;
      } else {
        data.amount = amount.value.trim();
      }
    }

    if (n === 2) {
      const sector = stepEl.querySelector('[name="sector"]');
      if (!sector.value) {
        setError(sector, 'Please select your sector');
        valid = false;
      } else {
        data.sector = sector.value;
      }
      const years = stepEl.querySelector('[name="yearsTrading"]');
      if (!years.value) {
        setError(years, 'Please select years trading');
        valid = false;
      } else {
        data.yearsTrading = years.value;
      }
    }

    if (n === 3) {
      const name = stepEl.querySelector('[name="fullName"]');
      if (!name.value.trim()) {
        setError(name, 'Please enter your name');
        valid = false;
      } else {
        data.fullName = name.value.trim();
      }
      const phone = stepEl.querySelector('[name="phone"]');
      if (!phone.value.trim() || phone.value.trim().length < 10) {
        setError(phone, 'Please enter a valid phone number');
        valid = false;
      } else {
        data.phone = phone.value.trim();
      }
      const email = stepEl.querySelector('[name="email"]');
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.value.trim() || !emailRe.test(email.value.trim())) {
        setError(email, 'Please enter a valid email address');
        valid = false;
      } else {
        data.email = email.value.trim();
      }
    }

    return valid;
  }

  // Navigation
  document.querySelectorAll('.btn-next').forEach(btn => {
    btn.addEventListener('click', function () {
      if (validateStep(current)) {
        showStep(current + 1);
      }
    });
  });

  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', function () {
      if (current > 1) showStep(current - 1);
    });
  });

  // Submit
  const submitBtn = document.querySelector('.btn-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      if (!validateStep(current)) return;
      data.Campaign = 'General Business';

      // Google Apps Script Web App URL
      // REPLACE THIS with your actual Google Apps Script Deployment URL
      const scriptURL = 'https://script.google.com/macros/s/AKfycbwj5erD7zIMZ5VXsM5GLzEYBxsYSS6k4pPxOtxDTzYeHc_5RAIGJ7zIoMANUArtSA6Z/exec';

      console.log('Sending data to Google:', data);
      
      fetch(scriptURL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(data)
      }).then(() => {
        console.log('Request sent successfully!');
        window.location.href = 'thank-you/';
      }).catch(error => {
        console.error('Submission error:', error);
        window.location.href = 'thank-you/';
      });
    });
  }

  // Amount formatting (commas)
  const amountInput = document.getElementById('amount');
  if (amountInput) {
    amountInput.addEventListener('input', function(e) {
      // Remove all non-digits
      let value = this.value.replace(/\D/g, '');
      if (value) {
        // Format with commas
        this.value = parseInt(value, 10).toLocaleString('en-GB');
      } else {
        this.value = '';
      }
    });
  }

  // Init
  showStep(1, false);
})();
