/* =========================================================
   B.K ENTERPRISE — ADMIN DASHBOARD
========================================================= */


/* =========================================================
   FIREBASE IMPORTS
========================================================= */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  auth,
  db,
  ADMIN_UIDS,
  CLOUDINARY_UPLOAD_URL,
  CLOUDINARY_UPLOAD_PRESET,
  firebaseReady
} from "../firebase-config.js";


import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";


import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


/* =========================================================
   BRYCHI ENTERPRISES — SOURCE DATABASE
========================================================= */

const brychiFirebaseConfig = {
  apiKey: "AIzaSyCM-JZA63wNyzYM4C3vaUiciwYOmWd6Vhc",
  authDomain: "brychim-enterprises2.firebaseapp.com",
  projectId: "brychim-enterprises2",
  storageBucket: "brychim-enterprises2.firebasestorage.app",
  messagingSenderId: "596161124096",
  appId: "1:596161124096:web:8f48278c43db2891a305e5"
};

const brychiSourceApp = initializeApp(
  brychiFirebaseConfig,
  "brychiSource"
);

const brychiSourceDb = getFirestore(brychiSourceApp);


/* =========================================================
   PAGE ELEMENTS
========================================================= */

const loginForm = document.getElementById("login-form");

const emailInput = document.getElementById("email");

const passwordInput = document.getElementById("password");

const loginMessage = document.getElementById("login-message");

const loginButton = loginForm
  ? loginForm.querySelector('button[type="submit"]')
  : null;


/* Dashboard elements */

const productForm = document.getElementById("product-form");

const productIdInput = document.getElementById("product-id");

const productNameInput = document.getElementById("product-name");

const productPriceInput = document.getElementById("product-price");

const productDescriptionInput =
  document.getElementById("product-description");

const productImageInput =
  document.getElementById("product-image");

const productActiveInput =
  document.getElementById("product-active");

const productMessage =
  document.getElementById("product-message");

const productList =
  document.getElementById("product-list");

const productCount =
  document.getElementById("product-count");

const productSearch =
  document.getElementById("product-search");

const pagination =
  document.getElementById("pagination");

const imagePreviewWrap =
  document.getElementById("image-preview-wrap");

const imagePreview =
  document.getElementById("image-preview");

const saveProductButton =
  document.getElementById("save-product");

const cancelEditButton =
  document.getElementById("cancel-edit");

const formTitle =
  document.getElementById("form-title");

const adminEmail =
  document.getElementById("admin-email");

const logoutButton =
  document.getElementById("logout-btn");


/* =========================================================
   PRODUCT IMPORT ELEMENTS
========================================================= */

const importBrychiButton =
  document.getElementById("import-brychi-products");

const importMessage =
  document.getElementById("import-message");


/* =========================================================
   DASHBOARD STATE
========================================================= */

let allProducts = [];

let currentPage = 1;

const productsPerPage = 20;

let editingProductId = null;

let editingProductImage = "";


/* =========================================================
   HELPER — SHOW MESSAGE
========================================================= */

function showMessage(element, message, type = "") {

  if (!element) return;

  element.textContent = message;

  element.className = "form-message";

  if (type) {
    element.classList.add(type);
  }

}


/* =========================================================
   FAST PRODUCT IMPORT — BRYCHI TO B.K ENTERPRISE
========================================================= */

if (importBrychiButton) {

  importBrychiButton.addEventListener("click", async () => {

    const confirmed = window.confirm(
      "Import all products from Brychi Enterprises into B.K Enterprise? Existing B.K products will not be overwritten."
    );

    if (!confirmed) return;

    importBrychiButton.disabled = true;

    importBrychiButton.textContent = "Importing...";

    try {

      await firebaseReady;

      /* Verify B.K administrator */

      showMessage(
        importMessage,
        "Checking administrator access..."
      );

      if (
        !auth.currentUser ||
        !ADMIN_UIDS.includes(auth.currentUser.uid)
      ) {

        throw new Error(
          "Administrator authentication required."
        );

      }


      /* Read both product catalogues */

      showMessage(
        importMessage,
        "Reading Brychi and B.K product catalogues..."
      );

      const [
        brychiSnapshot,
        bkSnapshot
      ] = await Promise.all([

        getDocs(
          collection(
            brychiSourceDb,
            "products"
          )
        ),

        getDocs(
          collection(
            db,
            "products"
          )
        )

      ]);


      if (brychiSnapshot.empty) {

        showMessage(
          importMessage,
          "No products were found in the Brychi database.",
          "error"
        );

        return;

      }


      /* Identify products already in B.K */

      const existingIds = new Set(
        bkSnapshot.docs.map(
          document => document.id
        )
      );

      const productsToImport = [];

      let skipped = 0;

      brychiSnapshot.docs.forEach(sourceDocument => {

        if (existingIds.has(sourceDocument.id)) {

          skipped++;

          return;

        }

        productsToImport.push({

          id: sourceDocument.id,

          data: sourceDocument.data()

        });

      });


      /* Handle an empty import */

      if (productsToImport.length === 0) {

        const refreshed = await loadProducts();

        showMessage(
          importMessage,

          refreshed
            ? `Import checked successfully. No new products were needed. ${skipped} existing products were preserved.`
            : `No new products were needed. ${skipped} existing products were preserved, but the dashboard could not refresh.`,

          refreshed ? "success" : "error"
        );

        return;

      }


      /* Import products in batches */

      let imported = 0;

      const batchSize = 450;

      const total = productsToImport.length;

      for (
        let i = 0;
        i < total;
        i += batchSize
      ) {

        const batch = writeBatch(db);

        const currentBatch =
          productsToImport.slice(
            i,
            i + batchSize
          );


        currentBatch.forEach(product => {

          const destinationRef = doc(
            db,
            "products",
            product.id
          );

          /*
            Preserve the original document ID
            and every original product field.
          */

          batch.set(
            destinationRef,
            product.data
          );

        });


        showMessage(
          importMessage,
          `Preparing batch... ${imported} of ${total} products completed.`
        );


        await batch.commit();

        imported += currentBatch.length;


        showMessage(
          importMessage,
          `Imported ${imported} of ${total} products...`
        );

      }


      /* Refresh B.K admin catalogue */

      const refreshed = await loadProducts();


      if (refreshed) {

        showMessage(
          importMessage,

          `Import successful! ${imported} products imported. ${skipped} existing B.K products preserved.`,

          "success"
        );

      } else {

        showMessage(
          importMessage,

          `${imported} products were imported, and ${skipped} existing products were preserved. However, the dashboard could not refresh. Reload the dashboard to check the catalogue.`,

          "error"
        );

      }

    } catch (error) {

      console.error(
        "Brychi product import failed:",
        error
      );

      showMessage(
        importMessage,

        `Import failed: ${error.message || "Please try again."}`,

        "error"
      );

    } finally {

      importBrychiButton.disabled = false;

      importBrychiButton.textContent =
        "Import Products";

    }

  });

}


/* =========================================================
   AUTHENTICATION — LOGIN PAGE
========================================================= */

if (loginForm) {

  loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email = emailInput.value.trim();

    const password = passwordInput.value;

    if (!email || !password) {

      showMessage(
        loginMessage,
        "Please enter your email and password.",
        "error"
      );

      return;

    }


    if (loginButton) {

      loginButton.disabled = true;

      loginButton.textContent = "Signing in...";

    }


    showMessage(
      loginMessage,
      "Signing you in..."
    );


    try {

      await firebaseReady;

      const result =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

      const user = result.user;


      if (!ADMIN_UIDS.includes(user.uid)) {

        await signOut(auth);

        showMessage(
          loginMessage,
          "Access denied. This account is not an administrator.",
          "error"
        );

        return;

      }


      showMessage(
        loginMessage,
        "Login successful. Opening dashboard..."
      );

      window.location.href = "dashboard.html";


    } catch (error) {

      console.error(
        "Login error:",
        error
      );

      let message =
        "Unable to sign in. Please check your details.";


      if (error.code === "auth/invalid-credential") {

        message = "Incorrect email or password.";

      } else if (error.code === "auth/user-not-found") {

        message = "No account was found with this email.";

      } else if (error.code === "auth/wrong-password") {

        message = "Incorrect password.";

      } else if (error.code === "auth/too-many-requests") {

        message = "Too many attempts. Please wait and try again.";

      } else if (error.code === "auth/network-request-failed") {

        message = "Network error. Please check your internet connection.";

      }


      showMessage(
        loginMessage,
        message,
        "error"
      );


    } finally {

      if (loginButton) {

        loginButton.disabled = false;

        loginButton.textContent = "Log In";

      }

    }

  });

}


/* =========================================================
   AUTHENTICATION — CHECK ADMIN
========================================================= */

onAuthStateChanged(auth, async (user) => {

  if (loginForm) {

    if (user && ADMIN_UIDS.includes(user.uid)) {

      window.location.href = "dashboard.html";

    }

    return;

  }


  if (productForm) {

    if (!user) {

      window.location.href = "login.html";

      return;

    }


    if (!ADMIN_UIDS.includes(user.uid)) {

      await signOut(auth);

      window.location.href = "login.html";

      return;

    }


    if (adminEmail) {

      adminEmail.textContent =
        user.email || "Administrator";

    }


    await loadProducts();

  }

});


/* =========================================================
   LOGOUT
========================================================= */

if (logoutButton) {

  logoutButton.addEventListener("click", async () => {

    try {

      await signOut(auth);

      window.location.href = "login.html";

    } catch (error) {

      console.error(
        "Logout error:",
        error
      );

    }

  });

}


/* =========================================================
   IMAGE PREVIEW
========================================================= */

if (productImageInput) {

  productImageInput.addEventListener("change", () => {

    const file =
      productImageInput.files[0];

    if (!file) {

      imagePreviewWrap?.classList.add("hidden");

      return;

    }


    const imageURL =
      URL.createObjectURL(file);


    if (imagePreview) {

      imagePreview.src = imageURL;

    }


    imagePreviewWrap?.classList.remove("hidden");

  });

}


/* =========================================================
   CLOUDINARY IMAGE UPLOAD
========================================================= */

async function uploadImageToCloudinary(file) {

  if (!file) {

    return null;

  }


  const formData =
    new FormData();


  formData.append(
    "file",
    file
  );


  formData.append(
    "upload_preset",
    CLOUDINARY_UPLOAD_PRESET
  );


  const response =
    await fetch(
      CLOUDINARY_UPLOAD_URL,
      {
        method: "POST",
        body: formData
      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    console.error(
      "Cloudinary error:",
      data
    );

    throw new Error(
      data.error?.message ||
      "Image upload failed."
    );

  }


  return data.secure_url;

}


/* =========================================================
   PRODUCT FORM SUBMISSION
========================================================= */

if (productForm) {

  productForm.addEventListener("submit", async (event) => {

    event.preventDefault();


    const name =
      productNameInput.value.trim();

    const price =
      Number(productPriceInput.value);

    const description =
      productDescriptionInput.value.trim();

    const active =
      productActiveInput.checked;

    const imageFile =
      productImageInput.files[0];


    if (!name) {

      showMessage(
        productMessage,
        "Please enter a product name.",
        "error"
      );

      productNameInput.focus();

      return;

    }


    if (!Number.isFinite(price) || price < 0) {

      showMessage(
        productMessage,
        "Please enter a valid price.",
        "error"
      );

      productPriceInput.focus();

      return;

    }


    if (!description) {

      showMessage(
        productMessage,
        "Please enter a product description.",
        "error"
      );

      productDescriptionInput.focus();

      return;

    }


    if (!editingProductId && !imageFile) {

      showMessage(
        productMessage,
        "Please select a product image.",
        "error"
      );

      return;

    }


    saveProductButton.disabled = true;

    saveProductButton.textContent =
      editingProductId
        ? "Updating..."
        : "Saving...";


    showMessage(
      productMessage,
      editingProductId
        ? "Updating product..."
        : "Saving product..."
    );


    try {

      await firebaseReady;

      let imageURL =
        editingProductImage;


      if (imageFile) {

        showMessage(
          productMessage,
          "Uploading product image..."
        );

        imageURL =
          await uploadImageToCloudinary(
            imageFile
          );

      }


      const productData = {

        name: name,

        price: price,

        description: description,

        image: imageURL,

        active: active,

        updatedAt: serverTimestamp()

      };


      if (editingProductId) {

        const productRef =
          doc(
            db,
            "products",
            editingProductId
          );

        await updateDoc(
          productRef,
          productData
        );


        showMessage(
          productMessage,
          "Product updated successfully.",
          "success"
        );


      } else {

        productData.createdAt =
          serverTimestamp();


        await addDoc(
          collection(db, "products"),
          productData
        );


        showMessage(
          productMessage,
          "Product added successfully.",
          "success"
        );

      }


      resetProductForm();

      await loadProducts();


    } catch (error) {

      console.error(
        "Product save error:",
        error
      );


      showMessage(
        productMessage,
        error.message ||
        "Something went wrong while saving the product.",
        "error"
      );


    } finally {

      saveProductButton.disabled = false;

      saveProductButton.textContent =
        editingProductId
          ? "Update Product"
          : "Save Product";

    }

  });

}


/* =========================================================
   LOAD PRODUCTS FROM FIRESTORE
========================================================= */

async function loadProducts() {

  if (!productList) return false;


  productList.innerHTML = `

    <div class="empty-state">
      Loading products...
    </div>

  `;


  try {

    await firebaseReady;


    const snapshot =
      await getDocs(
        collection(db, "products")
      );


    const loadedProducts =
      snapshot.docs.map(document => ({

        id: document.id,

        ...document.data()

      }));


    allProducts = loadedProducts;


    if (productCount) {

      productCount.textContent =
        loadedProducts.length;

    }


    currentPage = 1;

    renderProducts();

    return true;


  } catch (error) {

    console.error(
      "Loading products failed:",
      error
    );


    if (productCount) {

      productCount.textContent = "—";

    }


    productList.innerHTML = `

      <div class="empty-state">

        Unable to load products.

        <br><br>

        Please check your Firestore connection
        and security rules.

        <br><br>

        Error: ${escapeHTML(error.message)}

      </div>

    `;


    return false;

  }

}


/* =========================================================
   SEARCH PRODUCTS
========================================================= */

if (productSearch) {

  productSearch.addEventListener(
    "input",
    () => {

      currentPage = 1;

      renderProducts();

    }
  );

}


/* =========================================================
   FILTER PRODUCTS
========================================================= */

function getFilteredProducts() {

  const search =
    productSearch?.value
      .trim()
      .toLowerCase() || "";


  if (!search) {

    return allProducts;

  }


  return allProducts.filter((product) => {

    const name =
      String(product.name || "")
        .toLowerCase();

    const description =
      String(product.description || "")
        .toLowerCase();


    return (
      name.includes(search) ||
      description.includes(search)
    );

  });

}


/* =========================================================
   RENDER PRODUCTS
========================================================= */

function renderProducts() {

  if (!productList) return;


  const filteredProducts =
    getFilteredProducts();


  if (filteredProducts.length === 0) {

    productList.innerHTML = `

      <div class="empty-state">

        No products found.

      </div>

    `;

    renderPagination(0);

    return;

  }


  const start =
    (currentPage - 1) *
    productsPerPage;

  const end =
    start +
    productsPerPage;


  const pageProducts =
    filteredProducts.slice(
      start,
      end
    );


  productList.innerHTML = "";


  pageProducts.forEach((product) => {

    const item =
      document.createElement("div");


    item.className =
      "admin-product";


    const price =
      Number(product.price || 0);


    item.innerHTML = `

      <div class="admin-product-image">

        ${
          product.image
            ? `
              <img
                src="${escapeHTML(product.image)}"
                alt="${escapeHTML(product.name || "Product")}"
              >
            `
            : `
              <div class="no-image">
                No image
              </div>
            `
        }

      </div>


      <div class="admin-product-info">

        <h3>
          ${escapeHTML(product.name || "Unnamed product")}
        </h3>


        <strong>
          ₦${price.toLocaleString("en-NG")}
        </strong>


        <p>
          ${escapeHTML(product.description || "")}
        </p>


        <small>
          ${
            product.active
              ? "Available for sale"
              : "Hidden from customers"
          }
        </small>


        <div class="admin-product-actions">

          <button
            type="button"
            class="ghost-btn edit-product"
            data-id="${escapeHTML(product.id)}"
          >
            Edit
          </button>


          <button
            type="button"
            class="ghost-btn delete-product"
            data-id="${escapeHTML(product.id)}"
          >
            Delete
          </button>

        </div>

      </div>

    `;


    productList.appendChild(item);

  });


  productList
    .querySelectorAll(".edit-product")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          editProduct(
            button.dataset.id
          );

        }
      );

    });


  productList
    .querySelectorAll(".delete-product")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          deleteProduct(
            button.dataset.id
          );

        }
      );

    });


  renderPagination(
    filteredProducts.length
  );

}


/* =========================================================
   EDIT PRODUCT
========================================================= */

function editProduct(productId) {

  const product =
    allProducts.find(
      (item) =>
        item.id === productId
    );


  if (!product) return;


  editingProductId =
    product.id;

  editingProductImage =
    product.image || "";


  productIdInput.value =
    product.id;

  productNameInput.value =
    product.name || "";

  productPriceInput.value =
    product.price ?? "";

  productDescriptionInput.value =
    product.description || "";

  productActiveInput.checked =
    product.active !== false;


  if (product.image) {

    imagePreview.src =
      product.image;

    imagePreviewWrap.classList.remove(
      "hidden"
    );

  }


  formTitle.textContent =
    "Edit Product";

  saveProductButton.textContent =
    "Update Product";

  cancelEditButton.classList.remove(
    "hidden"
  );


  showMessage(
    productMessage,
    "Editing product. Make your changes and save."
  );


  productForm.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });


  setTimeout(() => {

    productNameInput.focus();

  }, 400);

}


/* =========================================================
   CANCEL EDIT
========================================================= */

if (cancelEditButton) {

  cancelEditButton.addEventListener(
    "click",
    () => {

      resetProductForm();

    }
  );

}


/* =========================================================
   RESET PRODUCT FORM
========================================================= */

function resetProductForm() {

  editingProductId = null;

  editingProductImage = "";


  productForm.reset();


  productActiveInput.checked =
    true;


  productIdInput.value =
    "";


  formTitle.textContent =
    "Add Product";


  saveProductButton.textContent =
    "Save Product";


  cancelEditButton.classList.add(
    "hidden"
  );


  imagePreviewWrap?.classList.add(
    "hidden"
  );


  if (imagePreview) {

    imagePreview.removeAttribute(
      "src"
    );

  }


  productImageInput.value =
    "";


  showMessage(
    productMessage,
    ""
  );

}


/* =========================================================
   DELETE PRODUCT
========================================================= */

async function deleteProduct(productId) {

  const product =
    allProducts.find(
      (item) =>
        item.id === productId
    );


  if (!product) return;


  const confirmed =
    window.confirm(
      `Delete "${product.name || "this product"}"?`
    );


  if (!confirmed) return;


  try {

    await firebaseReady;


    await deleteDoc(
      doc(
        db,
        "products",
        productId
      )
    );


    if (editingProductId === productId) {

      resetProductForm();

    }


    await loadProducts();


  } catch (error) {

    console.error(
      "Delete product error:",
      error
    );


    alert(
      "Unable to delete the product. Please try again."
    );

  }

}


/* =========================================================
   PAGINATION
========================================================= */

function renderPagination(totalProducts) {

  if (!pagination) return;


  pagination.innerHTML = "";


  const totalPages =
    Math.ceil(
      totalProducts /
      productsPerPage
    );


  if (totalPages <= 1) {

    return;

  }


  const previous =
    document.createElement("button");


  previous.type =
    "button";

  previous.className =
    "ghost-btn";

  previous.textContent =
    "Previous";

  previous.disabled =
    currentPage === 1;


  previous.addEventListener(
    "click",
    () => {

      if (currentPage > 1) {

        currentPage--;

        renderProducts();

      }

    }
  );


  pagination.appendChild(
    previous
  );


  for (
    let page = 1;
    page <= totalPages;
    page++
  ) {

    const button =
      document.createElement("button");


    button.type =
      "button";

    button.className =
      "ghost-btn";

    button.textContent =
      page;


    if (page === currentPage) {

      button.classList.add(
        "active"
      );

    }


    button.addEventListener(
      "click",
      () => {

        currentPage =
          page;

        renderProducts();

      }
    );


    pagination.appendChild(
      button
    );

  }


  const next =
    document.createElement("button");


  next.type =
    "button";

  next.className =
    "ghost-btn";

  next.textContent =
    "Next";

  next.disabled =
    currentPage === totalPages;


  next.addEventListener(
    "click",
    () => {

      if (currentPage < totalPages) {

        currentPage++;

        renderProducts();

      }

    }
  );


  pagination.appendChild(
    next
  );

}


/* =========================================================
   BASIC HTML ESCAPING
========================================================= */

function escapeHTML(value) {

  return String(value)

    .replaceAll("&", "&amp;")

    .replaceAll("<", "&lt;")

    .replaceAll(">", "&gt;")

    .replaceAll('"', "&quot;")

    .replaceAll("'", "&#039;");

}