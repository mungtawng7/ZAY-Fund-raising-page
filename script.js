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

  // Set current year
  if (currentYearEl) {
    currentYearEl.textContent = new Date().getFullYear();
  }

  // ==========================================
  // 3. Date Restrictions for Lawn Booking
  // ==========================================
  if (bookDateInput) {
    const today = new Date();
    const minDateStr = today.toISOString().split('T')[0];
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

  function updateCartUI() {
    const itemIds = Object.keys(cart);
    let totalItems = 0;

    if (itemIds.length === 0) {
      if (emptyCartState) emptyCartState.style.display = 'block';
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
    foodOrderForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (Object.keys(cart).length === 0) {
        showToast('Please add at least one food item to your order before submitting.', 'warning');
        return;
      }

      const customerName = document.getElementById('foodCustomerName').value.trim();
      const customerPhone = document.getElementById('foodCustomerPhone').value.trim();
      const customerEmail = document.getElementById('foodCustomerEmail').value.trim();
      const preferredTime = document.getElementById('foodPreferredTime').value.trim();
      const deliveryAddress = fulfillmentType === 'delivery' ? foodDeliveryAddress.value.trim() : 'Church Pickup: 1437 S 129th E Ave';
      const notes = document.getElementById('foodNotes').value.trim();

      // Compute summary
      let subtotal = 0;
      let itemsListStr = '';
      Object.keys(cart).forEach(id => {
        const item = menuItems[id];
        const qty = cart[id];
        const total = (item.price * qty).toFixed(2);
        subtotal += item.price * qty;
        itemsListStr += `<div class="summary-row"><span>${qty}x ${item.name}</span><strong>$${total}</strong></div>`;
      });

      const deliveryFee = (fulfillmentType === 'delivery') ? deliveryFeeRate : 0.00;
      const grandTotal = (subtotal + deliveryFee + selectedTip).toFixed(2);
      const orderId = 'ZAY-FOOD-' + Math.floor(100000 + Math.random() * 900000);

      if (successModalTitle) successModalTitle.textContent = 'Food Order Confirmed!';
      if (successModalDesc) successModalDesc.textContent = `Thank you, ${customerName}! Your order has been placed with ZAY Youth Kitchen.`;

      if (confirmationSummaryBox) {
        confirmationSummaryBox.innerHTML = `
          <div class="summary-row"><span>Order ID:</span><strong>#${orderId}</strong></div>
          <div class="summary-row"><span>Fulfillment:</span><strong>${fulfillmentType === 'delivery' ? 'Local Delivery' : 'Church Pickup'}</strong></div>
          <div class="summary-row"><span>Location:</span><span>${deliveryAddress}</span></div>
          <div class="summary-row"><span>Scheduled Time:</span><strong>${preferredTime}</strong></div>
          <div class="summary-row"><span>Contact:</span><span>${customerPhone} (${customerEmail})</span></div>
          <hr style="margin: 10px 0; border: none; border-top: 1px dashed #CBD5E1;">
          ${itemsListStr}
          ${deliveryFee > 0 ? `<div class="summary-row"><span>Delivery Fee:</span><span>+$${deliveryFee.toFixed(2)}</span></div>` : ''}
          ${selectedTip > 0 ? `<div class="summary-row"><span>Youth Donation:</span><span>+$${selectedTip.toFixed(2)}</span></div>` : ''}
          <div class="summary-row" style="font-size: 1.05rem; margin-top: 8px; font-weight: 800; color: #FF5D73;">
            <span>Estimated Total:</span>
            <span>$${grandTotal}</span>
          </div>
          ${notes ? `<div style="margin-top: 8px; font-size: 0.8rem; color: #64748B;"><em>Note: ${notes}</em></div>` : ''}
        `;
      }

      // Reset form & cart
      cart = {};
      foodOrderForm.reset();
      selectedTip = 0;
      fulfillmentType = 'pickup';
      fulfillmentCards.forEach(c => c.classList.remove('active'));
      if (fulfillmentCards[0]) fulfillmentCards[0].classList.add('active');
      deliveryAddressGroup.style.display = 'none';
      tipButtons.forEach(b => b.classList.remove('active'));
      if (tipButtons[0]) tipButtons[0].classList.add('active');

      updateCartUI();
      openModal(successModal);
    });
  }

  // ==========================================
  // 6. Lawn Mowing Booking Modal & Form
  // ==========================================
  document.querySelectorAll('.open-booking-btn').forEach(button => {
    button.addEventListener('click', () => {
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
    lawnBookingForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('bookName').value.trim();
      const phone = document.getElementById('bookPhone').value.trim();
      const email = document.getElementById('bookEmail').value.trim();
      const address = document.getElementById('bookAddress').value.trim();
      const yardSize = document.getElementById('bookYardSize').value;
      const date = document.getElementById('bookDate').value;
      const time = document.getElementById('bookTime').value;
      const notes = document.getElementById('bookNotes').value.trim();

      const bookingId = 'ZAY-LAWN-' + Math.floor(100000 + Math.random() * 900000);

      closeModal(bookingModal);

      if (successModalTitle) successModalTitle.textContent = 'Lawn Mowing Booked!';
      if (successModalDesc) successModalDesc.textContent = `Thank you, ${name}! Your lawn care appointment has been reserved with the ZAY Youth Team.`;

      if (confirmationSummaryBox) {
        confirmationSummaryBox.innerHTML = `
          <div class="summary-row"><span>Booking ID:</span><strong>#${bookingId}</strong></div>
          <div class="summary-row"><span>Package:</span><strong>${yardSize}</strong></div>
          <div class="summary-row"><span>Property Address:</span><span>${address}</span></div>
          <div class="summary-row"><span>Preferred Date:</span><strong>${date}</strong></div>
          <div class="summary-row"><span>Preferred Time:</span><strong>${time}</strong></div>
          <div class="summary-row"><span>Customer Contact:</span><span>${phone} (${email})</span></div>
          ${notes ? `<div style="margin-top: 8px; font-size: 0.8rem; color: #64748B;"><em>Instructions: ${notes}</em></div>` : ''}
          <div style="margin-top: 12px; padding: 8px; background: #ECFDF5; color: #047857; border-radius: 8px; font-size: 0.8rem; font-weight: 700;">
            <i class="fa-solid fa-circle-check"></i> Our team supervisor will call/text (918) 346-4561 to confirm weather & arrival time!
          </div>
        `;
      }

      lawnBookingForm.reset();
      openModal(successModal);
    });
  }

  // General Contact Form
  if (generalContactForm) {
    generalContactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('contactName').value.trim();
      generalContactForm.reset();
      showToast(`Thank you, ${name}! Your message has been sent to ZAY Youth Ministry.`, 'success');
    });
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
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
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
    mobileMenuBtn.classList.add('active');
    mobileMenuBtn.setAttribute('aria-expanded', 'true');
    navMenu.classList.add('open');
    drawerBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu() {
    mobileMenuBtn.classList.remove('active');
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
    navMenu.classList.remove('open');
    drawerBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      if (navMenu.classList.contains('open')) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });
  }

  if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', closeMobileMenu);
  }

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeMobileMenu();
    });
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
