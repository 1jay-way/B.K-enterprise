import { db, firebaseReady } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const WHATSAPP_NUMBER = "2347065489297";
const PRODUCTS_PER_PAGE = 6;
const CART_KEY = "bk_enterprise_cart";

let PRODUCTS = [];
let displayedProductCount = PRODUCTS_PER_PAGE;
let currentProductList = [];

/* =========================================================
   LOAD PRODUCTS
   ========================================================= */

async function getProducts() {
  try {
    if (!firebaseReady || !db) {
      throw new Error("Firebase is not ready.");
    }

    const productsQuery = query(
      collection(db, "products")
    );

    const snapshot = await getDocs(productsQuery);

    PRODUCTS = snapshot.docs
      .map(document => ({
        id: document.id,
        ...document.data()
      }))
      .filter(product => product.active !== false)
      .sort((a, b) => {
        const orderA = Number(a.sortOrder);
        const orderB = Number(b.sortOrder);

        if (
          Number.isFinite(orderA) &&
          Number.isFinite(orderB)
        ) {
          return orderA - orderB;
        }

        if (Number.isFinite(orderA)) return -1;
        if (Number.isFinite(orderB)) return 1;

        return 0;
      });

    return PRODUCTS;

  } catch (error) {
    console.error(
      "Unable to load products:",
      error
    );

    PRODUCTS = [];

    return PRODUCTS;
  }
}

/* =========================================================
   CART STORAGE
   ========================================================= */

function getCart() {
  try {
    const savedCart = localStorage.getItem(CART_KEY);

    if (!savedCart) return [];

    const cart = JSON.parse(savedCart);

    return Array.isArray(cart) ? cart : [];

  } catch (error) {
    console.error("Unable to read cart:", error);

    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(
    CART_KEY,
    JSON.stringify(cart)
  );

  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById("cart-badge");

  if (!badge) return;

  const count = getCart().reduce(
    (total, item) =>
      total + Number(item.quantity || 0),
    0
  );

  badge.textContent = count;
}

/* =========================================================
   PRICE HELPERS
   ========================================================= */

function formatNaira(amount) {
  return `₦${Number(amount).toLocaleString("en-NG")}`;
}

function getProductPrice(item) {
  if (
    item.priceType === "range" &&
    Number.isFinite(Number(item.priceMin)) &&
    Number.isFinite(Number(item.priceMax))
  ) {
    return {
      type: "range",
      min: Number(item.priceMin),
      max: Number(item.priceMax)
    };
  }

  const price = Number(item.price);

  if (
    item.price == null ||
    item.price === "" ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    return {
      type: "unknown"
    };
  }

  return {
    type: "fixed",
    price
  };
}

function formatPrice(product) {
  const price = getProductPrice(product);

  if (price.type === "range") {
    return (
      `${formatNaira(price.min)} - ` +
      `${formatNaira(price.max)}`
    );
  }

  if (price.type === "fixed") {
    return formatNaira(price.price);
  }

  return "Price on request";
}

/* =========================================================
   HTML SECURITY HELPER
   ========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================================================
   CLOUDINARY IMAGE OPTIMIZATION
   ========================================================= */

function optimizeImage(url) {
  if (!url) return "";

  if (!url.includes("res.cloudinary.com")) {
    return url;
  }

  // Avoid adding the same optimization twice.
  if (
    url.includes("/f_auto,") ||
    url.includes("/q_auto,")
  ) {
    return url;
  }

  return url.replace(
    "/image/upload/",
    "/image/upload/f_auto,q_auto/"
  );
}

/* =========================================================
   ADD TO CART
   ========================================================= */

function addToCart(productId) {
  if (!productId) return;

  const product = PRODUCTS.find(
    item => String(item.id) === String(productId)
  );

  if (!product) return;

  const cart = getCart();

  const existing = cart.find(
    item => String(item.id) === String(productId)
  );

  if (existing) {
    existing.quantity =
      Number(existing.quantity || 0) + 1;

  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      priceType: product.priceType || "fixed",
      priceMin: product.priceMin,
      priceMax: product.priceMax,
      image: product.image,
      quantity: 1
    });
  }

  saveCart(cart);
}

/* =========================================================
   REMOVE FROM CART
   ========================================================= */

function removeFromCart(productId) {
  const cart = getCart().filter(
    item => String(item.id) !== String(productId)
  );

  saveCart(cart);

  renderCart();
}

/* =========================================================
   CHANGE QUANTITY
   ========================================================= */

function changeQty(productId, change) {
  const cart = getCart();

  const item = cart.find(
    product => String(product.id) === String(productId)
  );

  if (!item) return;

  item.quantity =
    Number(item.quantity || 0) + Number(change);

  if (item.quantity <= 0) {
    const index = cart.indexOf(item);

    if (index !== -1) {
      cart.splice(index, 1);
    }
  }

  saveCart(cart);

  renderCart();
}

/* =========================================================
   WHATSAPP HELPERS
   ========================================================= */

function waLink(message) {
  return (
    `https://wa.me/${WHATSAPP_NUMBER}?text=` +
    encodeURIComponent(message)
  );
}

window.waLink = waLink;

function getWhatsAppUrl(product) {
  const message =
    `Hello B.K. Enterprise, I am interested in ${product.name}. Please provide more information.`;

  return waLink(message);
}

/* =========================================================
   PRODUCT RENDERING
   ========================================================= */

function renderProducts(
  list = PRODUCTS,
  resetCount = false
) {
  const container = document.getElementById("product-list");

  if (!container) return;

  if (resetCount) {
    displayedProductCount = PRODUCTS_PER_PAGE;
  }

  currentProductList = list;

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No products found</h3>
        <p>Try searching for another product.</p>
      </div>
    `;

    return;
  }

  const visibleProducts = list.slice(
    0,
    displayedProductCount
  );

  container.innerHTML = visibleProducts.map(
    (product, index) => {

      const optimizedImage = optimizeImage(
        product.image || ""
      );

      return `
        <article class="product-card reveal">

          <div
            class="product-image-wrap"
            data-description-toggle="${escapeHTML(product.id)}"
            role="button"
            tabindex="0"
          >

            <img
              src="${escapeHTML(optimizedImage)}"
              alt="${escapeHTML(product.name)}"
              class="product-image"
              loading="${index < 2 ? "eager" : "lazy"}"
              decoding="async"
            >

            <div class="image-hint">
              Tap image for details
            </div>

          </div>

          <div class="product-content">

            <h3 class="product-title">
              ${escapeHTML(product.name)}
            </h3>

            <div
              class="product-description"
              id="description-${escapeHTML(product.id)}"
              hidden
            >
              ${escapeHTML(product.description || "")}
            </div>

            <div class="product-bottom">

              <div class="product-price">
                ${formatPrice(product)}
              </div>

              <div class="product-actions">

                <button
                  class="btn btn-primary add-cart-btn"
                  type="button"
                  data-product-id="${escapeHTML(product.id)}"
                >
                  Add to Cart
                </button>

                <a
                  class="btn btn-secondary"
                  href="${getWhatsAppUrl(product)}"
                  target="_blank"
                  rel="noopener"
                >
                  WhatsApp
                </a>

              </div>

            </div>

          </div>

        </article>
      `;
    }
  ).join("");

  if (visibleProducts.length < list.length) {
    container.insertAdjacentHTML(
      "beforeend",
      `
        <div class="see-more-wrap">

          <button
            id="see-more-products"
            class="btn btn-primary"
            type="button"
          >
            See More Products
          </button>

        </div>
      `
    );
  }

  bindProductEvents();

  observeReveals();
}

/* =========================================================
   PRODUCT EVENTS
   ========================================================= */

function bindProductEvents() {
  const container = document.getElementById("product-list");

  if (!container) return;

  if (container.dataset.eventsBound === "true") return;

  container.dataset.eventsBound = "true";

  container.addEventListener("click", event => {

    const addButton = event.target.closest(".add-cart-btn");

    if (addButton) {
      event.preventDefault();

      addToCart(addButton.dataset.productId);

      const originalText = addButton.textContent;

      addButton.textContent = "Added ✓";

      setTimeout(() => {
        if (addButton.isConnected) {
          addButton.textContent = originalText;
        }
      }, 1000);

      return;
    }

    const seeMore = event.target.closest("#see-more-products");

    if (seeMore) {
      displayedProductCount += PRODUCTS_PER_PAGE;

      renderProducts(currentProductList);

      return;
    }

    const imageElement = event.target.closest(
      "[data-description-toggle]"
    );

    if (imageElement) {
      toggleDescription(imageElement);
    }

  });

  container.addEventListener("keydown", event => {

    const imageElement = event.target.closest(
      "[data-description-toggle]"
    );

    if (!imageElement) return;

    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();

    toggleDescription(imageElement);

  });
}

function toggleDescription(element) {
  const id = element.dataset.descriptionToggle;

  const description = document.getElementById(
    `description-${CSS.escape(id)}`
  );

  if (!description) return;

  description.hidden = !description.hidden;

  element.classList.toggle(
    "description-open",
    !description.hidden
  );
}

/* =========================================================
   SHOP SEARCH
   ========================================================= */

function initializeShop() {
  const searchInput = document.getElementById("search-input");

  if (!searchInput) return;

  if (searchInput.dataset.eventsBound === "true") return;

  searchInput.dataset.eventsBound = "true";

  searchInput.addEventListener("input", event => {

    const searchTerm = event.target.value
      .trim()
      .toLowerCase();

    const filteredProducts = PRODUCTS.filter(product => {

      const name = String(product.name || "").toLowerCase();

      const description = String(
        product.description || ""
      ).toLowerCase();

      return (
        name.includes(searchTerm) ||
        description.includes(searchTerm)
      );

    });

    renderProducts(filteredProducts, true);

  });
}

/* =========================================================
   CART PRODUCT DISPLAY
   ========================================================= */

function renderCart() {
  const cartList = document.getElementById("cart-list");

  if (!cartList) return;

  const cart = getCart();

  if (!cart.length) {

    cartList.innerHTML = `
      <div class="empty-state">

        <h3>Your cart is empty</h3>

        <p>Add products from the shop to get started.</p>

        <a href="shop.html" class="btn btn-primary">
          Explore Products
        </a>

      </div>
    `;

    updateCartSummary();

    return;
  }

  cartList.innerHTML = cart.map(item => {

    const price = getProductPrice(item);

    const quantity = Number(item.quantity || 0);

    let priceDisplay = "";
    let subtotalDisplay = "";

    if (price.type === "fixed") {

      priceDisplay = formatNaira(price.price);

      subtotalDisplay = formatNaira(
        price.price * quantity
      );

    } else {

      priceDisplay = formatPrice(item);

      subtotalDisplay = "To be confirmed";

    }

    const optimizedImage = optimizeImage(
      item.image || ""
    );

    return `
      <div class="cart-item">

        <div class="cart-item-image">

          <img
            src="${escapeHTML(optimizedImage)}"
            alt="${escapeHTML(item.name)}"
            loading="lazy"
            decoding="async"
          >

        </div>

        <div class="cart-item-info">

          <h3>
            ${escapeHTML(item.name)}
          </h3>

          <p>${priceDisplay}</p>

          <div class="cart-quantity">

            <button
              type="button"
              class="qty-btn"
              data-product-id="${escapeHTML(item.id)}"
              data-change="-1"
              aria-label="Decrease quantity"
            >
              −
            </button>

            <span>${quantity}</span>

            <button
              type="button"
              class="qty-btn"
              data-product-id="${escapeHTML(item.id)}"
              data-change="1"
              aria-label="Increase quantity"
            >
              +
            </button>

          </div>

          <strong>
            ${subtotalDisplay}
          </strong>

          <button
            type="button"
            class="remove-cart-btn"
            data-product-id="${escapeHTML(item.id)}"
          >
            Remove
          </button>

        </div>

      </div>
    `;

  }).join("");

  cartList.querySelectorAll(".qty-btn").forEach(button => {

    button.addEventListener("click", () => {

      changeQty(
        button.dataset.productId,
        Number(button.dataset.change)
      );

    });

  });

  cartList.querySelectorAll(".remove-cart-btn").forEach(button => {

    button.addEventListener("click", () => {

      removeFromCart(button.dataset.productId);

    });

  });

  updateCartSummary();
}

/* =========================================================
   CART TOTAL CALCULATION
   ========================================================= */

function calculateCart() {
  const cart = getCart();

  let subtotal = 0;

  let hasUnconfirmedPrice = false;

  cart.forEach(item => {

    const price = getProductPrice(item);

    const quantity = Number(item.quantity || 0);

    if (price.type === "fixed") {

      subtotal += price.price * quantity;

    } else {

      hasUnconfirmedPrice = true;

    }

  });

  return {
    subtotal,
    hasUnconfirmedPrice,
    total: subtotal
  };
}

/* =========================================================
   CHECKOUT SUMMARY
   ========================================================= */

function updateCartSummary() {
  const summary = document.getElementById("cart-summary");

  if (!summary) return;

  const cart = getCart();

  if (!cart.length) {

    summary.innerHTML = `
      <h2>Order Summary</h2>
      <p>Your cart is currently empty.</p>
    `;

    return;
  }

  const calculation = calculateCart();

  const subtotalText = formatNaira(calculation.subtotal);

  const totalText = calculation.hasUnconfirmedPrice
    ? "To be confirmed"
    : subtotalText;

  summary.innerHTML = `

    <div class="checkout-container">

      <!-- ORDER SUMMARY -->

      <div class="checkout-section">

        <h2>Order Summary</h2>

        <div class="summary-row">
          <span>Subtotal</span>
          <strong>${subtotalText}</strong>
        </div>

        <div class="summary-row">
          <span>Delivery Fee</span>
          <span>Confirmed after order</span>
        </div>

        <div class="summary-row total-row">
          <span>Total</span>
          <strong>${totalText}</strong>
        </div>

        ${
          calculation.hasUnconfirmedPrice
            ? `
              <p class="checkout-note">
                Some product prices require confirmation
                before your final total can be determined.
              </p>
            `
            : ""
        }

      </div>

      <!-- CUSTOMER INFORMATION -->

      <form id="checkout-form">

        <div class="checkout-section">

          <h2>Customer Information</h2>

          <p class="checkout-description">
            Please provide your correct contact details.
          </p>

          <div class="form-group">

            <label for="customer-name">
              Full Name *
            </label>

            <input
              type="text"
              id="customer-name"
              name="customerName"
              placeholder="Enter your full name"
              autocomplete="name"
              required
            >

          </div>

          <div class="form-group">

            <label for="customer-email">
              Email Address *
            </label>

            <input
              type="email"
              id="customer-email"
              name="email"
              placeholder="example@email.com"
              autocomplete="email"
              required
            >

          </div>

          <div class="form-group">

            <label for="customer-phone">
              Phone Number *
            </label>

            <input
              type="tel"
              id="customer-phone"
              name="phone"
              placeholder="Your phone number"
              autocomplete="tel"
              required
            >

          </div>

          <div class="form-group">

            <label for="customer-whatsapp">
              WhatsApp Number *
            </label>

            <input
              type="tel"
              id="customer-whatsapp"
              name="whatsapp"
              placeholder="Your WhatsApp number"
              required
            >

          </div>

        </div>

        <!-- DELIVERY OR PICKUP -->

        <div class="checkout-section">

          <h2>Fulfilment Method</h2>

          <p class="checkout-description">
            How would you like to receive your order?
          </p>

          <div class="fulfilment-options">

            <label class="fulfilment-option">

              <input
                type="radio"
                name="fulfilment"
                value="Delivery"
                checked
              >

              <span>
                🚚 Home Delivery
              </span>

            </label>

            <label class="fulfilment-option">

              <input
                type="radio"
                name="fulfilment"
                value="Pickup"
              >

              <span>
                📦 Pickup
              </span>

            </label>

          </div>

          <!-- DELIVERY ADDRESS -->

          <div id="delivery-fields">

            <div class="form-group">

              <label for="delivery-address">
                Full Delivery Address *
              </label>

              <textarea
                id="delivery-address"
                name="address"
                rows="3"
                placeholder="House number, street and area"
                required
              ></textarea>

            </div>

            <div class="form-group">

              <label for="delivery-state">
                State *
              </label>

              <input
                type="text"
                id="delivery-state"
                name="state"
                placeholder="e.g. Lagos"
                required
              >

            </div>

            <div class="form-group">

              <label for="delivery-city">
                City / Town *
              </label>

              <input
                type="text"
                id="delivery-city"
                name="city"
                placeholder="Enter your city or town"
                required
              >

            </div>

            <div class="form-group">

              <label for="delivery-landmark">
                Nearest Landmark *
              </label>

              <input
                type="text"
                id="delivery-landmark"
                name="landmark"
                placeholder="Nearest bus stop or landmark"
                required
              >

            </div>

          </div>

        </div>

        <!-- ORDER BUTTON -->

        <div class="checkout-section">

          <button
            type="submit"
            id="checkout-btn"
            class="btn btn-primary checkout-submit"
          >
            Place Order via WhatsApp
          </button>

          <p class="checkout-note">
            Your order details will be prepared in WhatsApp.
            Review and send the message to complete your order.
            Delivery charges and final prices will be confirmed
            by B.K. Enterprise.
          </p>

        </div>

      </form>

    </div>

  `;

  initializeCheckout();

  initializeFulfilment();
}

/* =========================================================
   DELIVERY / PICKUP SWITCHING
   ========================================================= */

function initializeFulfilment() {

  const options = document.querySelectorAll(
    'input[name="fulfilment"]'
  );

  const deliveryFields = document.getElementById(
    "delivery-fields"
  );

  if (!deliveryFields) return;

  function updateFulfilment() {

    const selected = document.querySelector(
      'input[name="fulfilment"]:checked'
    );

    const isDelivery =
      selected?.value === "Delivery";

    deliveryFields.hidden = !isDelivery;

    deliveryFields
      .querySelectorAll("input, textarea")
      .forEach(field => {

        field.required = isDelivery;

        field.disabled = !isDelivery;

      });

  }

  options.forEach(option => {

    option.addEventListener(
      "change",
      updateFulfilment
    );

  });

  updateFulfilment();
}

/* =========================================================
   PLACE ORDER
   ========================================================= */

function initializeCheckout() {

  const form = document.getElementById("checkout-form");

  if (!form) return;

  if (form.dataset.eventsBound === "true") return;

  form.dataset.eventsBound = "true";

  form.addEventListener("submit", event => {

    event.preventDefault();

    const cart = getCart();

    if (!cart.length) {

      alert("Your cart is empty.");

      return;
    }

    if (!form.reportValidity()) return;

    const formData = new FormData(form);

    const customerName =
      formData.get("customerName");

    const email =
      formData.get("email");

    const phone =
      formData.get("phone");

    const whatsapp =
      formData.get("whatsapp");

    const fulfilment =
      formData.get("fulfilment");

    const calculation = calculateCart();

    let message =

      `🛍️ *NEW ORDER — B.K. ENTERPRISE*\n\n` +

      `*CUSTOMER INFORMATION*\n` +

      `Name: ${customerName}\n` +
      `Email: ${email}\n` +
      `Phone: ${phone}\n` +
      `WhatsApp: ${whatsapp}\n\n` +

      `*ORDER DETAILS*\n`;

    cart.forEach((item, index) => {

      const price = getProductPrice(item);

      let priceText;

      if (price.type === "fixed") {

        priceText = formatNaira(
          price.price * Number(item.quantity)
        );

      } else {

        priceText = "Price to be confirmed";

      }

      message +=

        `${index + 1}. ${item.name}\n` +
        `Quantity: ${item.quantity}\n` +
        `Subtotal: ${priceText}\n\n`;

    });

    message +=

      `*FULFILMENT METHOD*\n` +
      `${fulfilment}\n\n`;

    if (fulfilment === "Delivery") {

      message +=

        `*DELIVERY INFORMATION*\n` +

        `Address: ${formData.get("address")}\n` +
        `State: ${formData.get("state")}\n` +
        `City: ${formData.get("city")}\n` +
        `Nearest Landmark: ${formData.get("landmark")}\n\n`;

    }

    message +=

      `*ORDER SUMMARY*\n` +

      `Subtotal: ${formatNaira(calculation.subtotal)}\n` +

      `Total: ${
        calculation.hasUnconfirmedPrice
          ? "To be confirmed"
          : formatNaira(calculation.total)
      }\n` +

      `Delivery fee: To be confirmed\n\n` +

      `Please confirm my order and provide the final amount.`;

    const url = waLink(message);

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );

  });

}

/* =========================================================
   MOBILE NAVIGATION
   ========================================================= */

function initializeMenu() {

  const menuButton = document.getElementById("menu-btn");

  const navLinks = document.getElementById("nav-links");

  if (!menuButton || !navLinks) return;

  if (menuButton.dataset.eventsBound === "true") return;

  menuButton.dataset.eventsBound = "true";

  menuButton.addEventListener("click", () => {

    const isOpen = navLinks.classList.toggle("open");

    menuButton.setAttribute(
      "aria-expanded",
      String(isOpen)
    );

  });

  navLinks.querySelectorAll("a").forEach(link => {

    link.addEventListener("click", () => {

      navLinks.classList.remove("open");

      menuButton.setAttribute(
        "aria-expanded",
        "false"
      );

    });

  });

}

/* =========================================================
   REVEAL ANIMATIONS
   ========================================================= */

function observeReveals() {

  const elements = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {

    elements.forEach(element => {

      element.classList.add("visible");

    });

    return;
  }

  const observer = new IntersectionObserver(

    entries => {

      entries.forEach(entry => {

        if (entry.isIntersecting) {

          entry.target.classList.add("visible");

          observer.unobserve(entry.target);

        }

      });

    },

    {
      threshold: 0.08
    }

  );

  elements.forEach(element => {

    if (!element.classList.contains("visible")) {

      observer.observe(element);

    }

  });

}

/* =========================================================
   INITIALIZE WEBSITE
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",

  async () => {

    initializeMenu();

    updateCartBadge();

    observeReveals();

    const productList = document.getElementById("product-list");

    if (productList) {

      productList.innerHTML = `
        <div class="loading-state">
          Loading products...
        </div>
      `;

      await getProducts();

      renderProducts(PRODUCTS);

      initializeShop();

    }

    const cartList = document.getElementById("cart-list");

    if (cartList) {

      await getProducts();

      renderCart();

    }

  }

);

/* =========================================================
   GLOBAL CART FUNCTIONS
   ========================================================= */

window.addToCart = addToCart;

window.removeFromCart = removeFromCart;

window.changeQty = changeQty;