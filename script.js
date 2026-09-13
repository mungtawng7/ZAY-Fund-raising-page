/**
 * ZAY Youth Fundraiser - Interactive Logic & Order Management System
 * Zomi SDA Church Tulsa, OK
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. App State & Data Definitions
  // ==========================================
  const menuItems = {
    'africa-donuts': {
      id: 'africa-donuts',
      name: 'Africa Donuts',
      price: 3.00,
      image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=300&q=80'
    },
    'shwe-yin-aye': {
      id: 'shwe-yin-aye',
      name: 'Shwe Yin Aye',
      price: 5.00,
      image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=300&q=80'
    },
    'fried-rice': {
      id: 'fried-rice',
      name: 'Fried Rice',
      price: 10.00,
      image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=300&q=80'
    },
    'fruit-juice': {
      id: 'fruit-juice',
      name: 'Fruit Juice',
      price: 4.00,
      image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=300&q=80'
    }
  };

  // Cart state: { itemId: quantity }
  let cart = {};
  let selectedTip = 0;
  let fulfillmentType = 'pickup'; // 'pickup' | 'delivery'
  const deliveryFeeRate = 3.00;

  // ==========================================
  // 2. DOM Elements
  // ==========================================
  const cartCountBadge = document.getElementById('cartCountBadge');
  const openCartBtn = document.getElementById('openCartBtn');
  const cartItemsList = document.getElementById('cartItemsList');
  const emptyCartState = document.getElementById('emptyCartState');
  const clearCartBtn = document.getElementById('clearCartBtn');
  const calcSubtotal = document.getElementById('calcSubtotal');
  const calcDeliveryFee = document.getElementById('calcDeliveryFee');
  const calcGrandTotal = document.getElementById('calcGrandTotal');
  const foodOrderForm = document.getElementById('foodOrderForm');
  const deliveryAddressGroup = document.getElementById('deliveryAddressGroup');
  const foodDeliveryAddress = document.getElementById('foodDeliveryAddress');
  const tipButtons = document.querySelectorAll('.tip-btn');
  const fulfillmentCards = document.querySelectorAll('.fulfillment-card');

  // Modals & Navigation
  const bookingModal = document.getElementById('bookingModal');
  const closeBookingModalBtn = document.getElementById('closeBookingModalBtn');
  const cancelBookingBtn = document.getElementById('cancelBookingBtn');
  const lawnBookingForm = document.getElementById('lawnBookingForm');
  const bookYardSizeSelect = document.getElementById('bookYardSize');
  const bookDateInput = document.getElementById('bookDate');

  const successModal = document.getElementById('successModal');
  const closeSuccessModalBtn = document.getElementById('closeSuccessModalBtn');
  const successModalTitle = document.getElementById('successModalTitle');
  const successModalDesc = document.getElementById('successModalDesc');
  const confirmationSummaryBox = document.getElementById('confirmationSummaryBox');

  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navMenu');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const navLinks = document.querySelectorAll('.nav-link');
  const mainHeader = document.getElementById('mainHeader');

  const tulsaClockEl = document.getElementById('tulsaClock');
  const liveStatusBadge = document.getElementById('liveStatusBadge');
  const currentYearEl = document.getElementById('currentYear');
  const generalContactForm = document.getElementById('generalContactForm');

  // Auth & Account UI
  const accountBtn = document.getElementById('accountBtn');
  const accountBtnLabel = document.getElementById('accountBtnLabel');
  const accountDropdown = document.getElementById('accountDropdown');
  const accountName = document.getElementById('accountName');
  const accountEmail = document.getElementById('accountEmail');
  const myOrdersBtn = document.getElementById('myOrdersBtn');
  const signOutBtn = document.getElementById('signOutBtn');
  const authModal = document.getElementById('authModal');
  const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
  const signInTab = document.getElementById('signInTab');
  const signUpTab = document.getElementById('signUpTab');
  const signInForm = document.getElementById('signInForm');
  const signUpForm = document.getElementById('signUpForm');
  const myOrdersModal = document.getElementById('myOrdersModal');
  const closeMyOrdersModalBtn = document.getElementById('closeMyOrdersModalBtn');
  const myOrdersLoading = document.getElementById('myOrdersLoading');
  const myOrdersList = document.getElementById('myOrdersList');

  const sessionStorageKey = 'zayAuthToken';
  let currentUser = null;
  let countdownInterval = null;

  // ==========================================
  // 2b. Dark Mode Toggle
  // ==========================================
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeToggleIcon = document.getElementById('themeToggleIcon');
  const mobileThemeToggleBtn = document.getElementById('mobileThemeToggleBtn');
  const mobileThemeIcon = document.getElementById('mobileThemeIcon');
  const mobileThemeLabel = document.getElementById('mobileThemeLabel');
  const themeStorageKey = 'zayTheme';

  function syncThemeIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (themeToggleIcon) {
      themeToggleIcon.className = isDark ? 'fa-solid fa-lightbulb' : 'fa-solid fa-moon';
    }
    if (themeToggleBtn) {
      themeToggleBtn.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    }
    if (mobileThemeIcon) {
      mobileThemeIcon.className = isDark ? 'fa-solid fa-lightbulb' : 'fa-solid fa-moon';
    }
    if (mobileThemeLabel) {
      mobileThemeLabel.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(themeStorageKey, next);
    syncThemeIcon();
    showToast(next === 'dark' ? 'Dark mode enabled' : 'Light mode enabled', 'info');
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  if (mobileThemeToggleBtn) {
    mobileThemeToggleBtn.addEventListener('click', toggleTheme);
  }

  syncThemeIcon();

  // Set current year
  if (currentYearEl) {
    currentYearEl.textContent = new Date().getFullYear();
  }

  // ==========================================
  // 3. Date Restrictions for Lawn Booking & Food Order
  // ==========================================
  const foodOrderDateInput = document.getElementById('foodOrderDate');
  const today = new Date();
  const minDateStr = today.toISOString().split('T')[0];

  if (bookDateInput) {
    bookDateInput.min = minDateStr;
    
    // Default to tomorrow or next valid day
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 1);
    bookDateInput.value = defaultDate.toISOString().split('T')[0];

    bookDateInput.addEventListener('change', (e) => {
      const selected = new Date(e.target.value + 'T00:00:00');
      const dayOfWeek = selected.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        showToast('Notice: We are closed on Friday & Saturday for Sabbath worship. Please select Sunday–Thursday.', 'warning');
      }
    });
  }

  if (foodOrderDateInput) {
    foodOrderDateInput.min = minDateStr;
    foodOrderDateInput.value = minDateStr; // Default to today

    foodOrderDateInput.addEventListener('change', (e) => {
      const selected = new Date(e.target.value + 'T00:00:00');
      const dayOfWeek = selected.getDay();
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        showToast('Notice: Kitchen is closed on Friday & Saturday for Sabbath worship. Please select Sunday–Thursday.', 'warning');
      }
    });
  }

  // ==========================================
  // 4. Food Quantity Buttons (+ / -)
  // ==========================================
  document.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      let val = parseInt(input.value, 10) || 1;
      if (btn.classList.contains('qty-plus')) {
        val = Math.min(val + 1, 50);
      } else if (btn.classList.contains('qty-minus')) {
        val = Math.max(val - 1, 1);
      }
      input.value = val;
    });
  });

  // ==========================================
  // 5. Add to Cart / Order Logic
  // ==========================================
  document.querySelectorAll('.add-to-cart-btn').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-id');
      const input = document.getElementById(`qty-${id}`);
      const qtyToAdd = input ? (parseInt(input.value, 10) || 1) : 1;

      if (!menuItems[id]) return;

      cart[id] = (cart[id] || 0) + qtyToAdd;
      updateCartUI();
      showToast(`Added ${qtyToAdd}x ${menuItems[id].name} to your order!`, 'success');

      // Visual button feedback
      const originalHtml = button.innerHTML;
      button.innerHTML = '<i class="fa-solid fa-check"></i> Added!';
      button.style.background = 'linear-gradient(135deg, #10B981, #059669)';
      setTimeout(() => {
        button.innerHTML = originalHtml;
        button.style.background = '';
      }, 1200);

      // Scroll smoothly to order summary on first add or if below view
      const orderSummaryPanel = document.getElementById('orderSummaryPanel');
      if (orderSummaryPanel && Object.keys(cart).length === 1 && qtyToAdd === 1) {
        // Just highlight summary
        orderSummaryPanel.style.transition = 'box-shadow 0.5s';
        orderSummaryPanel.style.boxShadow = '0 0 0 3px #FF5D73, 0 10px 30px rgba(255, 93, 115, 0.2)';
        setTimeout(() => {
          orderSummaryPanel.style.boxShadow = '';
        }, 1500);
      }
    });
  });

  // Open Cart CTA in header
  if (openCartBtn) {
    openCartBtn.addEventListener('click', () => {
      const orderPanel = document.getElementById('orderSummaryPanel');
      if (orderPanel) {
        orderPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  // Clear Cart
  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear your current food order?')) {
        cart = {};
        updateCartUI();
        showToast('Your order has been cleared.', 'info');
      }
    });
  }

  // Fulfillment selector (Pickup vs Delivery)
  fulfillmentCards.forEach(card => {
    const radio = card.querySelector('input[type="radio"]');
    card.addEventListener('click', () => {
      fulfillmentCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      radio.checked = true;
      fulfillmentType = radio.value;

      if (fulfillmentType === 'delivery') {
        deliveryAddressGroup.style.display = 'block';
        foodDeliveryAddress.setAttribute('required', 'true');
        showToast('Delivery selected (+$3.00 youth driver fee)', 'info');
      } else {
        deliveryAddressGroup.style.display = 'none';
        foodDeliveryAddress.removeAttribute('required');
      }
      calculateTotals();
    });
  });

  // Tip Selector
  tipButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tipButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTip = parseFloat(btn.getAttribute('data-tip')) || 0;
      calculateTotals();
      if (selectedTip > 0) {
        showToast(`Thank you for your $${selectedTip.toFixed(2)} ministry donation!`, 'success');
      }
    });
  });

  function handleEmptyCartAlert() {
    showToast('⚠️ Alert: Your cart is empty! Please select at least 1 food item from the menu above before ordering.', 'warning');

    if (emptyCartState) {
      emptyCartState.innerHTML = `
        <div class="empty-cart-alert-box">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <strong>No Food Items Selected!</strong>
          <p>Please click <strong>"+ Add to Order"</strong> on any food item above to start your order.</p>
        </div>
      `;
    }

    const foodMenuSection = document.getElementById('food-menu');
    if (foodMenuSection) {
      foodMenuSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const foodGrid = document.querySelector('.food-menu-grid');
    if (foodGrid) {
      foodGrid.classList.add('alert-pulse-grid');
      setTimeout(() => {
        foodGrid.classList.remove('alert-pulse-grid');
      }, 2500);
    }
  }

  function updateCartUI() {
    const itemIds = Object.keys(cart);
    let totalItems = 0;

    if (itemIds.length === 0) {
      if (emptyCartState) {
        emptyCartState.style.display = 'block';
        emptyCartState.innerHTML = `
          <div class="empty-cart-icon"><i class="fa-solid fa-utensils"></i></div>
          <p>Your food order is empty right now.</p>
          <span class="sub-text">Click <strong>"Add to Order"</strong> on any menu item above to start your order!</span>
        `;
      }
      if (cartItemsList) {
        cartItemsList.style.display = 'none';
        cartItemsList.innerHTML = '';
      }
      if (clearCartBtn) clearCartBtn.style.display = 'none';
    } else {
      if (emptyCartState) emptyCartState.style.display = 'none';
      if (cartItemsList) {
        cartItemsList.style.display = 'block';
        cartItemsList.innerHTML = '';

        itemIds.forEach(id => {
          const item = menuItems[id];
          const qty = cart[id];
          totalItems += qty;
          const itemTotal = (item.price * qty).toFixed(2);

          const row = document.createElement('div');
          row.className = 'cart-item-row';
          row.innerHTML = `
            <div class="cart-item-info">
              <div>
                <span class="cart-item-name">${item.name}</span>
                <span class="cart-item-unit-price"> ($${item.price.toFixed(2)} each)</span>
              </div>
            </div>
            <div class="cart-item-controls">
              <div class="qty-selector">
                <button type="button" class="qty-btn" onclick="window.updateCartItemQty('${id}', -1)">-</button>
                <input type="number" class="qty-input" value="${qty}" readonly>
                <button type="button" class="qty-btn" onclick="window.updateCartItemQty('${id}', 1)">+</button>
              </div>
              <span class="cart-item-price-total">$${itemTotal}</span>
              <button type="button" class="cart-remove-btn" onclick="window.removeCartItem('${id}')" title="Remove item">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          `;
          cartItemsList.appendChild(row);
        });
      }
      if (clearCartBtn) clearCartBtn.style.display = 'inline-flex';
    }

    if (cartCountBadge) {
      cartCountBadge.textContent = totalItems;
      if (totalItems > 0) {
        cartCountBadge.style.transform = 'scale(1.2)';
        setTimeout(() => { cartCountBadge.style.transform = 'scale(1)'; }, 200);
      }
    }

    calculateTotals();
  }

  // Global helpers for inline onclicks
  window.updateCartItemQty = function(id, delta) {
    if (!cart[id]) return;
    cart[id] += delta;
    if (cart[id] <= 0) {
      delete cart[id];
    }
    updateCartUI();
  };

  window.removeCartItem = function(id) {
    if (cart[id]) {
      const name = menuItems[id] ? menuItems[id].name : 'Item';
      delete cart[id];
      updateCartUI();
      showToast(`Removed ${name} from your order`, 'info');
    }
  };

  function calculateTotals() {
    let subtotal = 0;
    Object.keys(cart).forEach(id => {
      const item = menuItems[id];
      if (item && cart[id]) {
        subtotal += item.price * cart[id];
      }
    });

    const deliveryFee = (fulfillmentType === 'delivery' && subtotal > 0) ? deliveryFeeRate : 0.00;
    const grandTotal = subtotal > 0 ? (subtotal + deliveryFee + selectedTip) : 0.00;

    if (calcSubtotal) calcSubtotal.textContent = `$${subtotal.toFixed(2)}`;
    if (calcDeliveryFee) {
      if (fulfillmentType === 'delivery') {
        calcDeliveryFee.textContent = `+$${deliveryFee.toFixed(2)} (Tulsa Delivery)`;
        calcDeliveryFee.style.color = '#B45309';
      } else {
        calcDeliveryFee.textContent = 'FREE (Church Pickup)';
        calcDeliveryFee.style.color = '#10B981';
      }
    }
    if (calcGrandTotal) calcGrandTotal.textContent = `$${grandTotal.toFixed(2)}`;
  }

  // Submit Food Order Form
  if (foodOrderForm) {
    foodOrderForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (Object.keys(cart).length === 0) {
        handleEmptyCartAlert();
        return;
      }

      if (!currentUser) {
        showToast('🔐 Sign In Required: Please sign in or create an account to place your order and track it!', 'warning');
        switchAuthTab('signin');
        openModal(authModal);
        return;
      }

      const customerName = document.getElementById('foodCustomerName').value.trim();
      const customerPhone = document.getElementById('foodCustomerPhone').value.trim();
      const customerEmail = document.getElementById('foodCustomerEmail').value.trim();
      
      const orderDateVal = document.getElementById('foodOrderDate')?.value || '';
      const orderTimeVal = document.getElementById('foodOrderTimeSlot')?.value || '';
      const preferredTime = `${orderDateVal} at ${orderTimeVal}`;

      const deliveryAddress = fulfillmentType === 'delivery' ? foodDeliveryAddress.value.trim() : 'Church Pickup: 1437 S 129th E Ave';
      const notes = document.getElementById('foodNotes').value.trim();

      const submitButton = document.getElementById('submitFoodOrderBtn');
      setButtonLoading(submitButton, 'Saving order...');

      try {
        const result = await apiRequest('/api/orders', {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          address: deliveryAddress,
          preferredTime,
          notes,
          fulfillmentType,
          donation: selectedTip,
          items: Object.entries(cart).map(([id, quantity]) => ({ id, quantity }))
        });

        if (result.paymentMode === 'stripe' && result.checkoutUrl) {
          window.location.assign(result.checkoutUrl);
          return;
        }

        showFoodConfirmation(result.orderId, customerName, fulfillmentType, preferredTime, result.totalCents, result.message);
        resetFoodOrder();
        notifyDeliveryToast(result.notifications);
        openModal(successModal);
      } catch (error) {
        showToast(error.message, 'warning');
      } finally {
        resetButtonLoading(submitButton);
      }
    });
  }

  // ==========================================
  // 6. Lawn Mowing Booking Modal & Form
  // ==========================================
  document.querySelectorAll('.open-booking-btn').forEach(button => {
    button.addEventListener('click', () => {
      if (!currentUser) {
        showToast('🔐 Sign In Required: Please sign in or create an account to book lawn mowing and track your service!', 'info');
        switchAuthTab('signin');
        openModal(authModal);
        return;
      }
      const yardSize = button.getAttribute('data-yard-size');
      if (yardSize && bookYardSizeSelect) {
        for (let i = 0; i < bookYardSizeSelect.options.length; i++) {
          if (bookYardSizeSelect.options[i].text.includes(yardSize) || bookYardSizeSelect.options[i].value.includes(yardSize)) {
            bookYardSizeSelect.selectedIndex = i;
            break;
          }
        }
      }
      openModal(bookingModal);
    });
  });

  if (closeBookingModalBtn) {
    closeBookingModalBtn.addEventListener('click', () => closeModal(bookingModal));
  }

  if (cancelBookingBtn) {
    cancelBookingBtn.addEventListener('click', () => closeModal(bookingModal));
  }

  if (lawnBookingForm) {
    lawnBookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!currentUser) {
        showToast('🔐 Sign In Required: Please sign in or create an account to book lawn mowing and track your booking!', 'warning');
        closeModal(bookingModal);
        switchAuthTab('signin');
        openModal(authModal);
        return;
      }

      const name = document.getElementById('bookName').value.trim();
      const phone = document.getElementById('bookPhone').value.trim();
      const email = document.getElementById('bookEmail').value.trim();
      const address = document.getElementById('bookAddress').value.trim();
      const yardSize = document.getElementById('bookYardSize').value;
      const date = document.getElementById('bookDate').value;
      const time = document.getElementById('bookTime').value;
      const notes = document.getElementById('bookNotes').value.trim();

      const submitButton = lawnBookingForm.querySelector('button[type="submit"]');
      setButtonLoading(submitButton, 'Saving booking...');

      try {
        const result = await apiRequest('/api/bookings', {
          name,
          email,
          phone,
          address,
          yardSize,
          preferredDate: date,
          preferredTime: time,
          notes
        });

        closeModal(bookingModal);
        if (successModalTitle) successModalTitle.textContent = 'Lawn Mowing Booked!';
        if (successModalDesc) successModalDesc.textContent = `Thank you, ${name}! Your lawn care appointment has been saved for confirmation.`;
        if (confirmationSummaryBox) {
          confirmationSummaryBox.innerHTML = `
            <div class="summary-row"><span>Booking ID:</span><strong>#${result.bookingId}</strong></div>
            <div class="summary-row"><span>Package:</span><strong>${yardSize}</strong></div>
            <div class="summary-row"><span>Preferred Date:</span><strong>${date}</strong></div>
            <div class="summary-row"><span>Preferred Time:</span><strong>${time}</strong></div>
            <div style="margin-top: 12px; padding: 8px; background: #ECFDF5; color: #047857; border-radius: 8px; font-size: 0.8rem; font-weight: 700;">
              <i class="fa-solid fa-circle-check"></i> ${result.message}
            </div>
          `;
        }
        lawnBookingForm.reset();
        notifyDeliveryToast(result.notifications);
        openModal(successModal);
      } catch (error) {
        showToast(error.message, 'warning');
      } finally {
        resetButtonLoading(submitButton);
      }
    });
  }

  // General Contact Form
  if (generalContactForm) {
    generalContactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('contactName').value.trim();
      const submitButton = generalContactForm.querySelector('button[type="submit"]');
      setButtonLoading(submitButton, 'Sending message...');
      try {
        const result = await apiRequest('/api/messages', {
          name,
          email: document.getElementById('contactEmail').value.trim(),
          phone: document.getElementById('contactPhone').value.trim(),
          subject: document.getElementById('contactSubject').value,
          message: document.getElementById('contactMessage').value.trim()
        });
        generalContactForm.reset();
        showToast(result.message, 'success');
      } catch (error) {
        showToast(error.message, 'warning');
      } finally {
        resetButtonLoading(submitButton);
      }
    });
  }

  async function apiRequest(endpoint, payload, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem(sessionStorageKey);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(endpoint, {
      method: options.method || 'POST',
      headers,
      body: options.method === 'GET' ? undefined : JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || 'We could not process your request. Please try again.');
    }
    return result;
  }

  // ==========================================
  // 5b. User Authentication & Account UI
  // ==========================================
  function getToken() {
    return localStorage.getItem(sessionStorageKey);
  }

  function setAuthSession(token, user) {
    if (token) {
      localStorage.setItem(sessionStorageKey, token);
    } else {
      localStorage.removeItem(sessionStorageKey);
    }
    currentUser = user;
    renderAccountUI();
    prefillCustomerForms();
  }

  function renderAccountUI() {
    if (!accountBtn) return;
    if (currentUser) {
      accountBtnLabel.textContent = currentUser.name.split(' ')[0];
      if (accountName) accountName.textContent = currentUser.name;
      if (accountEmail) accountEmail.textContent = currentUser.email;
    } else {
      accountBtnLabel.textContent = 'Sign In';
      if (accountDropdown) accountDropdown.hidden = true;
    }
  }

  function prefillCustomerForms() {
    if (!currentUser) return;
    const mapping = [
      ['foodCustomerName', currentUser.name],
      ['foodCustomerEmail', currentUser.email],
      ['foodCustomerPhone', currentUser.phone],
      ['bookName', currentUser.name],
      ['bookEmail', currentUser.email],
      ['bookPhone', currentUser.phone]
    ];
    mapping.forEach(([id, value]) => {
      const field = document.getElementById(id);
      if (field && value && !field.value) field.value = value;
    });
  }

  function switchAuthTab(tab) {
    const showSignIn = tab === 'signin';
    if (signInTab) signInTab.classList.toggle('active', showSignIn);
    if (signUpTab) signUpTab.classList.toggle('active', !showSignIn);
    if (signInForm) signInForm.hidden = !showSignIn;
    if (signUpForm) signUpForm.hidden = showSignIn;
  }

  if (accountBtn) {
    accountBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentUser) {
        accountDropdown.hidden = !accountDropdown.hidden;
      } else {
        switchAuthTab('signin');
        openModal(authModal);
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (accountDropdown && !accountDropdown.hidden &&
        !accountDropdown.contains(e.target) && e.target !== accountBtn) {
      accountDropdown.hidden = true;
    }
  });

  if (signInTab) signInTab.addEventListener('click', () => switchAuthTab('signin'));
  if (signUpTab) signUpTab.addEventListener('click', () => switchAuthTab('signup'));
  document.querySelectorAll('[data-switch-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.getAttribute('data-switch-tab')));
  });
  if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', () => closeModal(authModal));

  if (signInForm) {
    signInForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitButton = document.getElementById('signInSubmitBtn');
      setButtonLoading(submitButton, 'Signing in...');
      try {
        const result = await apiRequest('/api/auth/login', {
          email: document.getElementById('signInEmail').value.trim(),
          password: document.getElementById('signInPassword').value
        });
        setAuthSession(result.token, result.user);
        closeModal(authModal);
        signInForm.reset();
        showToast(`Welcome back, ${result.user.name.split(' ')[0]}!`, 'success');
      } catch (error) {
        showToast(error.message, 'warning');
      } finally {
        resetButtonLoading(submitButton);
      }
    });
  }

  if (signUpForm) {
    signUpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitButton = document.getElementById('signUpSubmitBtn');
      setButtonLoading(submitButton, 'Creating account...');
      try {
        const result = await apiRequest('/api/auth/signup', {
          name: document.getElementById('signUpName').value.trim(),
          email: document.getElementById('signUpEmail').value.trim(),
          phone: document.getElementById('signUpPhone').value.trim(),
          password: document.getElementById('signUpPassword').value
        });
        setAuthSession(result.token, result.user);
        closeModal(authModal);
        signUpForm.reset();
        showToast(`Account created. Welcome, ${result.user.name.split(' ')[0]}!`, 'success');
      } catch (error) {
        showToast(error.message, 'warning');
      } finally {
        resetButtonLoading(submitButton);
      }
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      try {
        await apiRequest('/api/auth/logout', {});
      } catch (error) {
        // Session may already be gone; sign out locally anyway.
      }
      setAuthSession(null, null);
      showToast('You have been signed out.', 'info');
    });
  }

  // Restore session on page load
  (async function restoreSession() {
    if (!getToken()) return;
    try {
      const result = await apiRequest('/api/auth/me', {}, { method: 'GET' });
      setAuthSession(getToken(), result.user);
    } catch (error) {
      setAuthSession(null, null);
    }
  })();

  // ==========================================
  // 5c. My Orders: Cancel & Add More (2-hour window)
  // ==========================================
  function formatRemaining(ms) {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  function formatDateTime(value) {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      .format(new Date(`${value}Z`));
  }

  function orderItemsText(items) {
    return (items || []).map(i => `${i.quantity}x ${i.item_name}`).join(', ');
  }

  function orderCardHtml(order) {
    const editableBlock = order.editable ? `
      <div class="edit-window-bar">
        <span class="edit-countdown" data-countdown-for="${order.id}" data-expires="${Date.parse(order.created_at + 'Z') + 2 * 3600000}">
          <i class="fa-solid fa-hourglass-half"></i> Changes allowed for ${formatRemaining(order.edit_remaining_ms)}
        </span>
      </div>
      <div class="order-actions">
        <button type="button" class="btn btn-sm btn-outline" onclick="window.startAddItems('${order.id}')">
          <i class="fa-solid fa-plus"></i> Add More Items
        </button>
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.cancelOrder('${order.id}')">
          <i class="fa-solid fa-xmark"></i> Cancel Order
        </button>
      </div>
      <div class="add-items-panel" id="addItems-${order.id}" hidden>
        <p class="add-items-title"><i class="fa-solid fa-utensils"></i> Add more items to this order:</p>
        ${Object.values(menuItems).map(item => `
          <div class="add-items-row">
            <span>${item.name} ($${item.price.toFixed(2)})</span>
            <div class="qty-selector">
              <button type="button" class="qty-btn" onclick="window.adjustAddItemQty('${order.id}', '${item.id}', -1)">-</button>
              <input type="number" class="qty-input" id="addqty-${order.id}-${item.id}" value="0" min="0" max="50" readonly>
              <button type="button" class="qty-btn" onclick="window.adjustAddItemQty('${order.id}', '${item.id}', 1)">+</button>
            </div>
          </div>
        `).join('')}
        <div class="add-items-actions">
          <button type="button" class="btn btn-sm btn-primary" onclick="window.submitAddItems('${order.id}')">
            <i class="fa-solid fa-check"></i> Confirm Add Items
          </button>
          <button type="button" class="btn btn-sm btn-outline" onclick="window.cancelAddItems('${order.id}')">Close</button>
        </div>
      </div>` : '';

    const expiredBlock = (!order.editable && order.status === 'active') ? `
      <div class="edit-window-bar expired">
        <span><i class="fa-solid fa-lock"></i> 2-hour change window ended. Call (918) 346-4561 for changes.</span>
      </div>` : '';

    return `
      <article class="my-order-card ${order.status === 'cancelled' ? 'cancelled' : ''}">
        <div class="my-order-head">
          <div>
            <strong class="my-order-id">#${order.id}</strong>
            <span class="my-order-date">${formatDateTime(order.created_at)}</span>
          </div>
          <span class="status-badge ${order.status}">${order.status}</span>
        </div>
        <p class="my-order-items">${escapeHtml(orderItemsText(order.items))}</p>
        <div class="my-order-meta">
          <span><i class="fa-solid fa-${order.fulfillment_type === 'delivery' ? 'car-side' : 'store'}"></i> ${order.fulfillment_type}</span>
          <span><i class="fa-solid fa-clock"></i> ${escapeHtml(order.preferred_time)}</span>
          <span class="my-order-total">$${(order.total_cents / 100).toFixed(2)}</span>
        </div>
        ${editableBlock}
        ${expiredBlock}
      </article>`;
  }

  function bookingCardHtml(booking) {
    const editableBlock = booking.editable ? `
      <div class="edit-window-bar">
        <span class="edit-countdown" data-countdown-for="${booking.id}" data-expires="${Date.parse(booking.created_at + 'Z') + 2 * 3600000}">
          <i class="fa-solid fa-hourglass-half"></i> Cancellation allowed for ${formatRemaining(booking.edit_remaining_ms)}
        </span>
      </div>
      <div class="order-actions">
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.cancelBooking('${booking.id}')">
          <i class="fa-solid fa-xmark"></i> Cancel Booking
        </button>
      </div>` : '';

    return `
      <article class="my-order-card ${booking.status === 'cancelled' ? 'cancelled' : ''}">
        <div class="my-order-head">
          <div>
            <strong class="my-order-id">#${booking.id}</strong>
            <span class="my-order-date">${formatDateTime(booking.created_at)}</span>
          </div>
          <span class="status-badge ${booking.status}">${booking.status}</span>
        </div>
        <p class="my-order-items">${escapeHtml(booking.yard_size)} — Lawn Mowing</p>
        <div class="my-order-meta">
          <span><i class="fa-solid fa-calendar"></i> ${escapeHtml(booking.preferred_date)}</span>
          <span><i class="fa-solid fa-clock"></i> ${escapeHtml(booking.preferred_time)}</span>
        </div>
        ${editableBlock}
      </article>`;
  }

  async function loadMyOrders() {
    if (!myOrdersList) return;
    if (myOrdersLoading) myOrdersLoading.style.display = 'block';
    myOrdersList.innerHTML = '';
    try {
      const result = await apiRequest('/api/my/orders', {}, { method: 'GET' });
      const cards = [
        ...result.orders.map(orderCardHtml),
        ...result.bookings.map(bookingCardHtml)
      ];
      myOrdersList.innerHTML = cards.length
        ? cards.join('')
        : '<p class="empty-state">You have no orders or bookings yet. Place one and it will appear here!</p>';
      startCountdownTicker();
    } catch (error) {
      myOrdersList.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    } finally {
      if (myOrdersLoading) myOrdersLoading.style.display = 'none';
    }
  }

  function startCountdownTicker() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      const countdowns = document.querySelectorAll('[data-expires]');
      if (countdowns.length === 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        return;
      }
      let anyExpired = false;
      countdowns.forEach(el => {
        const remaining = Number(el.getAttribute('data-expires')) - Date.now();
        if (remaining <= 0) {
          anyExpired = true;
        } else {
          const verb = el.textContent.includes('Cancellation') ? 'Cancellation allowed for' : 'Changes allowed for';
          el.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> ${verb} ${formatRemaining(remaining)}`;
        }
      });
      // Reload the list so expired windows lock their buttons.
      if (anyExpired) loadMyOrders();
    }, 30000);
  }

  if (myOrdersBtn) {
    myOrdersBtn.addEventListener('click', () => {
      if (accountDropdown) accountDropdown.hidden = true;
      openModal(myOrdersModal);
      loadMyOrders();
    });
  }
  if (closeMyOrdersModalBtn) {
    closeMyOrdersModalBtn.addEventListener('click', () => closeModal(myOrdersModal));
  }

  window.cancelOrder = async function(orderId) {
    if (!confirm(`Cancel order ${orderId}? This cannot be undone.`)) return;
    try {
      const result = await apiRequest(`/api/orders/${orderId}/cancel`, {});
      showToast(result.message || 'Order cancelled.', 'success');
      notifyDeliveryToast(result.notifications);
      loadMyOrders();
    } catch (error) {
      showToast(error.message, 'warning');
      loadMyOrders();
    }
  };

  window.cancelBooking = async function(bookingId) {
    if (!confirm(`Cancel booking ${bookingId}? This cannot be undone.`)) return;
    try {
      const result = await apiRequest(`/api/bookings/${bookingId}/cancel`, {});
      showToast(result.message || 'Booking cancelled.', 'success');
      notifyDeliveryToast(result.notifications);
      loadMyOrders();
    } catch (error) {
      showToast(error.message, 'warning');
      loadMyOrders();
    }
  };

  window.startAddItems = function(orderId) {
    const panel = document.getElementById(`addItems-${orderId}`);
    if (panel) panel.hidden = false;
  };

  window.cancelAddItems = function(orderId) {
    const panel = document.getElementById(`addItems-${orderId}`);
    if (panel) {
      panel.querySelectorAll('.qty-input').forEach(input => { input.value = 0; });
      panel.hidden = true;
    }
  };

  window.adjustAddItemQty = function(orderId, itemId, delta) {
    const input = document.getElementById(`addqty-${orderId}-${itemId}`);
    if (!input) return;
    const next = Math.min(50, Math.max(0, (parseInt(input.value, 10) || 0) + delta));
    input.value = next;
  };

  window.submitAddItems = async function(orderId) {
    const panel = document.getElementById(`addItems-${orderId}`);
    if (!panel) return;
    const items = Object.keys(menuItems)
      .map(id => ({ id, quantity: parseInt(document.getElementById(`addqty-${orderId}-${id}`)?.value, 10) || 0 }))
      .filter(item => item.quantity > 0);

    if (items.length === 0) {
      showToast('Choose at least one item to add.', 'warning');
      return;
    }

    try {
      const result = await apiRequest(`/api/orders/${orderId}/add-items`, { items });
      showToast(`Items added! New total: $${(result.totalCents / 100).toFixed(2)}`, 'success');
      notifyDeliveryToast(result.notifications);
      loadMyOrders();
    } catch (error) {
      showToast(error.message, 'warning');
      loadMyOrders();
    }
  };

  function notifyDeliveryToast(notifications) {
    if (!notifications) return;
    const channels = [];
    if (notifications.emailSent) channels.push('email');
    if (notifications.smsSent) channels.push('SMS');
    if (channels.length) {
      showToast(`Confirmation sent via ${channels.join(' & ')}.`, 'info');
    }
  }

  function setButtonLoading(button, label) {
    if (!button) return;
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${label}`;
  }

  function resetButtonLoading(button) {
    if (!button) return;
    button.disabled = false;
    if (button.dataset.label) {
      button.innerHTML = button.dataset.label;
      delete button.dataset.label;
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    })[character]);
  }

  function showFoodConfirmation(orderId, customerName, fulfillment, preferredTime, totalCents, message) {
    if (successModalTitle) successModalTitle.textContent = 'Food Order Saved!';
    if (successModalDesc) successModalDesc.textContent = `Thank you, ${customerName}! Your order has been saved for the ZAY Youth Kitchen.`;
    if (confirmationSummaryBox) {
      confirmationSummaryBox.innerHTML = `
        <div class="summary-row"><span>Order ID:</span><strong>#${escapeHtml(orderId)}</strong></div>
        <div class="summary-row"><span>Fulfillment:</span><strong>${fulfillment === 'delivery' ? 'Local Delivery' : 'Church Pickup'}</strong></div>
        <div class="summary-row"><span>Requested time:</span><strong>${escapeHtml(preferredTime)}</strong></div>
        <div class="summary-row" style="font-size: 1.05rem; margin-top: 8px; font-weight: 800; color: #FF5D73;">
          <span>Estimated Total:</span><span>$${(totalCents / 100).toFixed(2)}</span>
        </div>
        <div style="margin-top: 12px; padding: 8px; background: #ECFDF5; color: #047857; border-radius: 8px; font-size: 0.8rem; font-weight: 700;">
          <i class="fa-solid fa-circle-check"></i> ${escapeHtml(message)}
        </div>
      `;
    }
  }

  function resetFoodOrder() {
    cart = {};
    foodOrderForm.reset();
    selectedTip = 0;
    fulfillmentType = 'pickup';
    fulfillmentCards.forEach(card => card.classList.remove('active'));
    if (fulfillmentCards[0]) fulfillmentCards[0].classList.add('active');
    deliveryAddressGroup.style.display = 'none';
    tipButtons.forEach(button => button.classList.remove('active'));
    if (tipButtons[0]) tipButtons[0].classList.add('active');
    updateCartUI();
  }

  // Close Success Modal
  if (closeSuccessModalBtn) {
    closeSuccessModalBtn.addEventListener('click', () => closeModal(successModal));
  }

  // ==========================================
  // 7. Modal Open & Close Utility
  // ==========================================
  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    const hasOtherModals = document.querySelector('.modal-overlay.active');
    const hasDrawer = navMenu && navMenu.classList.contains('open');
    if (!hasOtherModals && !hasDrawer) {
      document.body.classList.remove('modal-open');
      document.documentElement.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
  }

  // Close modals on overlay backdrop click
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  });

  // ESC key listener for modals & drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(modal => closeModal(modal));
      closeMobileMenu();
    }
  });

  // ==========================================
  // 8. Mobile Drawer Menu & Navigation Scroll
  // ==========================================
  function openMobileMenu() {
    if (!mobileMenuBtn || !navMenu) return;
    mobileMenuBtn.classList.add('active');
    mobileMenuBtn.setAttribute('aria-expanded', 'true');
    const icon = mobileMenuBtn.querySelector('.mobile-toggle-icon');
    if (icon) {
      icon.classList.remove('fa-bars');
      icon.classList.add('fa-xmark');
    }
    navMenu.classList.add('open');
    if (drawerBackdrop) {
      drawerBackdrop.classList.add('active');
    }
    document.body.classList.add('drawer-open');
    document.documentElement.classList.add('drawer-open');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu() {
    if (!mobileMenuBtn || !navMenu) return;
    mobileMenuBtn.classList.remove('active');
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
    const icon = mobileMenuBtn.querySelector('.mobile-toggle-icon');
    if (icon) {
      icon.classList.remove('fa-xmark');
      icon.classList.add('fa-bars');
    }
    navMenu.classList.remove('open');
    if (drawerBackdrop) {
      drawerBackdrop.classList.remove('active');
    }
    const hasActiveModals = document.querySelector('.modal-overlay.active');
    if (!hasActiveModals) {
      document.body.classList.remove('drawer-open');
      document.documentElement.classList.remove('drawer-open');
      document.body.style.overflow = '';
    }
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      if (navMenu && navMenu.classList.contains('open')) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });
  }

  const closeDrawerBtn = document.getElementById('closeDrawerBtn');
  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener('click', closeMobileMenu);
  }

  if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', closeMobileMenu);
    drawerBackdrop.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });
  }

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeMobileMenu();
    });
  });

  const mobileBookBtn = document.querySelector('.btn-mobile-book');
  if (mobileBookBtn) {
    mobileBookBtn.addEventListener('click', () => {
      closeMobileMenu();
    });
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024 && navMenu && navMenu.classList.contains('open')) {
      closeMobileMenu();
    }
  });

  // ScrollSpy & Sticky Header Shadow
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      mainHeader.classList.add('scrolled');
    } else {
      mainHeader.classList.remove('scrolled');
    }

    // ScrollSpy active link detection
    const sections = document.querySelectorAll('section[id]');
    const scrollY = window.pageYOffset;

    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 120;
      const sectionId = current.getAttribute('id');

      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
          }
        });
      }
    });
  });

  // ==========================================
  // 9. Live Tulsa Time & Operating Hours Status
  // ==========================================
  function updateTulsaStatus() {
    try {
      const now = new Date();
      // Format to America/Chicago (Tulsa, OK)
      const options = {
        timeZone: 'America/Chicago',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        weekday: 'short'
      };

      const tulsaFormatter = new Intl.DateTimeFormat('en-US', options);
      const parts = tulsaFormatter.formatToParts(now);
      
      let weekday = '';
      let hour = 0;
      let minute = 0;
      let dayPeriod = 'AM';
      let formattedTime = '';

      parts.forEach(part => {
        if (part.type === 'weekday') weekday = part.value;
        if (part.type === 'hour') hour = parseInt(part.value, 10);
        if (part.type === 'minute') minute = parseInt(part.value, 10);
        if (part.type === 'dayPeriod') dayPeriod = part.value.toUpperCase();
      });

      formattedTime = tulsaFormatter.format(now);

      if (tulsaClockEl) {
        tulsaClockEl.textContent = formattedTime;
      }

      // Operating check: Sun, Mon, Tue, Wed, Thu between 8:00 AM and 4:00 PM
      const isOpenDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].includes(weekday);
      let hour24 = hour;
      if (dayPeriod === 'PM' && hour !== 12) hour24 += 12;
      if (dayPeriod === 'AM' && hour === 12) hour24 = 0;

      const isOpenHour = (hour24 >= 8 && hour24 < 16);
      const isOpen = isOpenDay && isOpenHour;

      if (liveStatusBadge) {
        if (isOpen) {
          liveStatusBadge.className = 'status-pill status-open';
          liveStatusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Open for Orders';
        } else {
          liveStatusBadge.className = 'status-pill status-closed';
          if (weekday === 'Fri' || weekday === 'Sat') {
            liveStatusBadge.innerHTML = '<i class="fa-solid fa-church"></i> Sabbath Worship';
          } else {
            liveStatusBadge.innerHTML = '<i class="fa-solid fa-clock"></i> Opens Sun–Thu 8am';
          }
        }
      }
    } catch (err) {
      console.warn('Clock format error:', err);
    }
  }

  updateTulsaStatus();
  setInterval(updateTulsaStatus, 1000);

  // ==========================================
  // 10. Toast Notification Helper
  // ==========================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${icon}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3500);
  }
});
