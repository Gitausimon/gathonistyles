/**
 * db.js
 * Manages connections to Firestore or falls back gracefully to LocalStorage
 */

// Default config placeholders or local load
let tempConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

try {
  const localConfig = await import("./config.js");
  if (localConfig && localConfig.firebaseConfig) {
    tempConfig = { ...tempConfig, ...localConfig.firebaseConfig };
  }
} catch (e) {
  // Silence error, config.js is gitignored and optional
}

export const firebaseConfig = tempConfig;

// Check if firebase config is populated with real credentials, and support developer offline testing
const forceOffline = localStorage.getItem("force_offline") === "true" || window.location.search.includes("mode=offline");
const isFirebaseConfigured = 
  !forceOffline &&
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== "YOUR_PROJECT_ID";

let db = null;
let auth = null;
let storage = null;
let useLocalStorage = true;

// Attempt Firebase initialization
if (isFirebaseConfigured) {
  try {
    // Dynamically import Firebase SDKs via CDN
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
    const { getStorage } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js");
    
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    useLocalStorage = false;
    console.log("Firebase initialized successfully (Firestore, Auth & Storage).");
  } catch (error) {
    console.warn("Failed to initialize Firebase SDK, falling back to LocalStorage simulator:", error);
    useLocalStorage = true;
  }
} else {
  console.log("Firebase credentials not set. Operating in Offline/LocalStorage Mode.");
}

// -------------------------------------------------------------
// LOCAL STORAGE SIMULATOR (Fallback Database)
// -------------------------------------------------------------

const LS_KEYS = {
  QUEUE: "boutique_queue_wait_time",
  ORDERS: "boutique_orders",
  CATALOG: "boutique_catalog"
};

// Default lookbook items to seed if empty
const DEFAULT_CATALOG = [
  {
    id: "signature-column-dress",
    name: "Signature Column Dress",
    category: "dresses",
    price: 7200,
    type: "dress",
    image: "assets/dress_editorial.png",
    description: "An elegant, floor-skimming column gown sculpted for a dramatic yet minimal silhouette. Crafted from premium breathable cotton-linen blend, perfect for both corporate elegance and formal evening dinners in Nairobi."
  },
  {
    id: "wool-blend-power-suit",
    name: "Wool-Blend Power Suit",
    category: "official",
    price: 12500,
    type: "official",
    image: "assets/official_editorial.png",
    description: "A sharp, structured double-breasted blazer and high-waisted trouser set. Designed to empower. Made with high-grade tropical wool-blend fabric, tailored precisely to sit flat on the shoulders and waist."
  },
  {
    id: "pleated-wrap-skirt",
    name: "Pleated Wrap Skirt",
    category: "casual",
    price: 4800,
    type: "skirt",
    image: "assets/casual_editorial.png",
    description: "A versatile modern wrap skirt featuring hand-pressed pleats and an adjustable waist tie. Cut in a flattering mid-length silhouette that flows naturally. Can be dressed up for weddings or down for brunch."
  },
  {
    id: "cowl-neck-slip-dress",
    name: "Cowl-Neck Slip Dress",
    category: "dresses",
    price: 6900,
    type: "dress",
    image: "assets/hero_editorial.png",
    description: "A bias-cut cowl neck slip dress that fluidly contours your body curves. Features thin adjustable straps and an open back design. Extremely luxurious feel, hand-finished using high-end Nairobi silk-satin."
  }
];

// Seed mock data if empty
if (!localStorage.getItem(LS_KEYS.QUEUE)) {
  localStorage.setItem(LS_KEYS.QUEUE, "4"); // Default 4 days
}
if (!localStorage.getItem(LS_KEYS.ORDERS)) {
  localStorage.setItem(LS_KEYS.ORDERS, JSON.stringify([
    {
      id: "mock-1",
      customerName: "Wanjiku Njoroge",
      productName: "Bespoke Royal Midi Dress",
      price: 6500,
      measurements: { bust: 92, waist: 74, hips: 100, length: 110 },
      status: "consultation",
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString() // 2 hours ago
    },
    {
      id: "mock-2",
      customerName: "Amina Mohamed",
      productName: "Tailored Linen Silhouette Skirt",
      price: 4200,
      measurements: { waist: 68, hips: 94, length: 80 },
      status: "in-production",
      timestamp: new Date(Date.now() - 3600000 * 24).toISOString() // 24 hours ago
    }
  ]));
}
if (!localStorage.getItem(LS_KEYS.CATALOG)) {
  localStorage.setItem(LS_KEYS.CATALOG, JSON.stringify(DEFAULT_CATALOG));
}

// Event system for local updates simulation (pub-sub)
const localChangeListeners = {
  queue: [],
  orders: [],
  catalog: [],
  auth: []
};

function triggerLocalChange(type, data) {
  localChangeListeners[type].forEach(cb => cb(data));
}

// -------------------------------------------------------------
// DATABASE INTERFACE ACTIONS
// -------------------------------------------------------------

/**
 * Subscribes to the wait time queue status (in real-time)
 * @param {function} callback - Receives the wait time in days (number)
 * @returns {function} unsubscribe function
 */
export async function subscribeQueueStatus(callback) {
  if (!useLocalStorage && db) {
    try {
      const { doc, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const docRef = doc(db, "settings", "queue");
      
      return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          callback(Number(snapshot.data().days || 4));
        } else {
          callback(4);
        }
      }, (error) => {
        console.error("Firestore onSnapshot error:", error);
      });
    } catch (e) {
      console.error("Error loading Firestore functions, falling back:", e);
    }
  }

  // LocalStorage fallback path
  const currentVal = Number(localStorage.getItem(LS_KEYS.QUEUE) || 4);
  callback(currentVal);
  
  const cbWrapper = (val) => callback(Number(val));
  localChangeListeners.queue.push(cbWrapper);
  
  return () => {
    localChangeListeners.queue = localChangeListeners.queue.filter(cb => cb !== cbWrapper);
  };
}

/**
 * Updates the wait time queue status
 * @param {number} days 
 */
export async function updateQueueStatus(days) {
  const numericDays = Number(days);
  if (!useLocalStorage && db) {
    try {
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const docRef = doc(db, "settings", "queue");
      await setDoc(docRef, { days: numericDays }, { merge: true });
      return;
    } catch (e) {
      console.error("Firestore write failed, updating LocalStorage:", e);
    }
  }

  localStorage.setItem(LS_KEYS.QUEUE, String(numericDays));
  triggerLocalChange("queue", numericDays);
}

/**
 * Subscribes to orders (in real-time)
 * @param {function} callback - Receives list of orders
 * @returns {function} unsubscribe function
 */
export async function subscribeOrders(callback) {
  if (!useLocalStorage && db) {
    try {
      const { collection, onSnapshot, query, orderBy } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const collRef = collection(db, "orders");
      const q = query(collRef, orderBy("timestamp", "desc"));
      
      return onSnapshot(q, (snapshot) => {
        const orders = [];
        snapshot.forEach(doc => {
          orders.push({ id: doc.id, ...doc.data() });
        });
        callback(orders);
      }, (error) => {
        console.error("Firestore orders query failed, falling back to local:", error);
      });
    } catch (e) {
      console.error("Error loading Firestore functions, falling back:", e);
    }
  }

  // LocalStorage fallback path
  const getLocalOrders = () => JSON.parse(localStorage.getItem(LS_KEYS.ORDERS) || "[]");
  callback(getLocalOrders());

  const cbWrapper = () => callback(getLocalOrders());
  localChangeListeners.orders.push(cbWrapper);

  return () => {
    localChangeListeners.orders = localChangeListeners.orders.filter(cb => cb !== cbWrapper);
  };
}

/**
 * Adds a new order record
 * @param {object} orderData 
 */
export async function addOrder(orderData) {
  const newOrder = {
    customerName: orderData.customerName,
    productName: orderData.productName,
    price: Number(orderData.price),
    measurements: orderData.measurements,
    status: orderData.status || "consultation",
    timestamp: new Date().toISOString()
  };

  if (!useLocalStorage && db) {
    try {
      const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const collRef = collection(db, "orders");
      const docRef = await addDoc(collRef, newOrder);
      return docRef.id;
    } catch (e) {
      console.error("Firestore order write failed, writing to LocalStorage:", e);
    }
  }

  const orders = JSON.parse(localStorage.getItem(LS_KEYS.ORDERS) || "[]");
  newOrder.id = "order-" + Date.now();
  orders.unshift(newOrder); // Newest first
  localStorage.setItem(LS_KEYS.ORDERS, JSON.stringify(orders));
  
  triggerLocalChange("orders", orders);
  return newOrder.id;
}

/**
 * Updates the status of an order
 * @param {string} orderId 
 * @param {string} newStatus 
 */
export async function updateOrderStatus(orderId, newStatus) {
  if (!useLocalStorage && db) {
    try {
      const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const docRef = doc(db, "orders", orderId);
      await updateDoc(docRef, { status: newStatus });
      return;
    } catch (e) {
      console.error("Firestore status write failed, writing to LocalStorage:", e);
    }
  }

  const orders = JSON.parse(localStorage.getItem(LS_KEYS.ORDERS) || "[]");
  const target = orders.find(o => o.id === orderId);
  if (target) {
    target.status = newStatus;
    localStorage.setItem(LS_KEYS.ORDERS, JSON.stringify(orders));
    triggerLocalChange("orders", orders);
  }
}

// -------------------------------------------------------------
// AUTHENTICATION INTERFACE
// -------------------------------------------------------------

/**
 * Monitors the authentication state and triggers the callback
 * @param {function} callback - Receives the user object or null
 */
export async function monitorAuthState(callback) {
  if (!useLocalStorage && auth) {
    const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
    onAuthStateChanged(auth, (user) => {
      callback(user);
    });
  } else {
    // Local fallback: verify if simulated authentication exists
    const logged = localStorage.getItem("boutique_admin_logged") === "true";
    if (logged) {
      callback({ email: "admin@gathoni.com", displayName: "Simulated Nairobi Admin" });
    } else {
      callback(null);
    }

    const cbWrapper = (user) => callback(user);
    localChangeListeners.auth.push(cbWrapper);

    return () => {
      localChangeListeners.auth = localChangeListeners.auth.filter(cb => cb !== cbWrapper);
    };
  }
}

/**
 * Logs in the admin user using email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<any>}
 */
export async function loginAdmin(email, password) {
  if (!useLocalStorage && auth) {
    const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
    return signInWithEmailAndPassword(auth, email, password);
  } else {
    return Promise.reject(new Error("Login requires online mode and Firebase Auth to be configured. Offline login is disabled for security."));
  }
}

/**
 * Logs out the current user
 * @returns {Promise<void>}
 */
export async function logoutAdmin() {
  if (!useLocalStorage && auth) {
    const { signOut } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
    return signOut(auth);
  } else {
    localStorage.removeItem("boutique_admin_logged");
    triggerLocalChange("auth", null);
  }
}

// -------------------------------------------------------------
// LOOKBOOK CATALOG ACTIONS
// -------------------------------------------------------------

/**
 * Subscribes to the boutique lookbook catalog in real-time
 * @param {function} callback - Receives the list of catalog products
 * @returns {function} unsubscribe function
 */
export async function subscribeCatalog(callback) {
  if (!useLocalStorage && db) {
    try {
      const { collection, onSnapshot, doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const collRef = collection(db, "catalog");
      
      return onSnapshot(collRef, async (snapshot) => {
        if (snapshot.empty) {
          console.log("Firestore catalog collection empty. Seeding DEFAULT_CATALOG items...");
          // Seed Firestore with default items so it's not barren
          for (const item of DEFAULT_CATALOG) {
            const docRef = doc(db, "catalog", item.id);
            await setDoc(docRef, item);
          }
          // The snapshot listener will trigger again on the additions
          return;
        }
        
        const catalog = [];
        snapshot.forEach(doc => {
          catalog.push({ id: doc.id, ...doc.data() });
        });
        callback(catalog);
      }, (error) => {
        console.error("Firestore catalog query failed, falling back to LocalStorage:", error);
      });
    } catch (e) {
      console.error("Error loading Firestore catalog functions, falling back:", e);
    }
  }

  // LocalStorage fallback path
  const getLocalCatalog = () => JSON.parse(localStorage.getItem(LS_KEYS.CATALOG) || "[]");
  callback(getLocalCatalog());

  const cbWrapper = () => callback(getLocalCatalog());
  localChangeListeners.catalog.push(cbWrapper);

  return () => {
    localChangeListeners.catalog = localChangeListeners.catalog.filter(cb => cb !== cbWrapper);
  };
}

/**
 * Adds a new product to the catalog
 * @param {object} productData 
 * @returns {Promise<string>} Created product ID
 */
export async function addProduct(productData) {
  const newProduct = {
    name: productData.name,
    category: productData.category,
    price: Number(productData.price),
    type: productData.type,
    image: productData.image,
    description: productData.description
  };

  if (!useLocalStorage && db) {
    try {
      const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const collRef = collection(db, "catalog");
      const docRef = await addDoc(collRef, newProduct);
      return docRef.id;
    } catch (e) {
      console.error("Firestore product write failed, updating LocalStorage:", e);
    }
  }

  const catalog = JSON.parse(localStorage.getItem(LS_KEYS.CATALOG) || "[]");
  newProduct.id = "product-" + Date.now();
  catalog.push(newProduct);
  localStorage.setItem(LS_KEYS.CATALOG, JSON.stringify(catalog));
  
  triggerLocalChange("catalog", catalog);
  return newProduct.id;
}

/**
 * Deletes a product from the catalog
 * @param {string} productId 
 */
export async function deleteProduct(productId) {
  if (!useLocalStorage && db) {
    try {
      const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const docRef = doc(db, "catalog", productId);
      await deleteDoc(docRef);
      return;
    } catch (e) {
      console.error("Firestore product delete failed, deleting from LocalStorage:", e);
    }
  }

  let catalog = JSON.parse(localStorage.getItem(LS_KEYS.CATALOG) || "[]");
  catalog = catalog.filter(p => p.id !== productId);
  localStorage.setItem(LS_KEYS.CATALOG, JSON.stringify(catalog));
  triggerLocalChange("catalog", catalog);
}

/**
 * Uploads an image blob to Firebase Storage, or falls back to inline Base64
 * @param {Blob} fileBlob
 * @returns {Promise<string>} Public URL or base64 data url
 */
export async function uploadProductImage(fileBlob) {
  if (!useLocalStorage && storage) {
    try {
      const { ref, uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js");
      const filename = `catalog/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
      const storageRef = ref(storage, filename);
      const snapshot = await uploadBytes(storageRef, fileBlob);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (err) {
      console.warn("Storage upload failed, falling back to Inline Base64:", err);
    }
  }

  // Fallback: Read file to base64 Data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(fileBlob);
  });
}

/**
 * Subscribes to home page text content and imagery configuration updates
 */
export async function subscribeHomepageSettings(callback) {
  if (!useLocalStorage && db) {
    try {
      const { doc, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const docRef = doc(db, "settings", "homepage");
      
      return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data());
        } else {
          // Fallback defaults if database document hasn't been initialized yet
          callback({
            heroTitle: "Tailored to\nFit Perfectly",
            heroSubtext: "Skip the standard sizes. Experience editorial fashion customized to your exact silhouette."
          });
        }
      });
    } catch (e) {
      console.error("Firestore home settings read failed:", e);
    }
  }

  // LocalStorage Fallback Configuration Mode
  const getLocalSettings = () => JSON.parse(localStorage.getItem("boutique_homepage_settings") || JSON.stringify({
    heroTitle: "Tailored to\nFit Perfectly",
    heroSubtext: "Skip the standard sizes. Experience editorial fashion customized to your exact silhouette."
  }));
  
  callback(getLocalSettings());
  window.addEventListener("localHomepageSettingsUpdate", () => callback(getLocalSettings()));
}

/**
 * Updates global homepage configuration metrics
 */
export async function updateHomepageSettings(settingsData) {
  if (!useLocalStorage && db) {
    try {
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
      const docRef = doc(db, "settings", "homepage");
      await setDoc(docRef, settingsData, { merge: true });
      return;
    } catch (e) {
      console.error("Firestore settings write failed:", e);
    }
  }

  localStorage.setItem("boutique_homepage_settings", JSON.stringify(settingsData));
  window.dispatchEvent(new Event("localHomepageSettingsUpdate"));
}
