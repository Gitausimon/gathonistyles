/**
 * db.js
 * Manages connections to Firestore or falls back gracefully to LocalStorage
 */

// Firebase Configuration. Replace with your actual credentials.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "1:YOUR_MESSAGING_SENDER_ID:web:47dfed6a1a02296eaecab8",
  measurementId: "YOUR_MEASUREMENT_ID"
};

// Check if firebase config is populated with real credentials
const isFirebaseConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== "YOUR_PROJECT_ID";

let db = null;
let auth = null;
let useLocalStorage = true;

// Attempt Firebase initialization
if (isFirebaseConfigured) {
  try {
    // Dynamically import Firebase SDKs via CDN
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
    
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    useLocalStorage = false;
    console.log("Firebase initialized successfully (Firestore & Auth).");
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
  ORDERS: "boutique_orders"
};

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

// Event system for local updates simulation (pub-sub)
const localChangeListeners = {
  queue: [],
  orders: []
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
    // Local fallback: assume not logged in, or implement a fake login if desired
    callback(null);
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
    return Promise.reject(new Error("Authentication is only available with live Firebase connection."));
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
  }
}
