import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, runTransaction } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

async function startStore() {
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let products = [];
let cart = [];
let user = null;
let stopCart = null;
let category = new URLSearchParams(location.search).get('category') || 'All';
let search = '';
let sorting = 'featured';
let signup = false;
let ready = false;
const page = document.body.dataset.page;
const money = amount => 'R ' + amount.toFixed(2);

function message(text) {
  document.getElementById('message').textContent = text;
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function picture(product) {
  const img = element('img', 'product-image');
  img.alt = product.name;
  img.loading = 'lazy';
  try {
    const url = new URL(product.imageURL, location.href);
    if (url.protocol === 'https:' || url.origin === location.origin) img.src = url.href;
  } catch { /* Basic fallback for an invalid picture URL. */ }
  img.onerror = () => { img.onerror = null; img.src = 'assets/placeholder.svg'; };
  if (!img.getAttribute('src')) img.src = 'assets/placeholder.svg';
  return img;
}

function showProducts() {
  const grid = document.getElementById('products');
  if (!grid) return;
  grid.replaceChildren();
  let list = products.filter(p => (category === 'All' || p.category === category) && (p.name + ' ' + p.description).toLowerCase().includes(search.toLowerCase()));
  if (sorting === 'low') list.sort((a,b) => a.price - b.price);
  if (sorting === 'high') list.sort((a,b) => b.price - a.price);
  if (page === 'home') list = list.slice(0,4);
  const count = document.getElementById('result-count');
  if (count) count.textContent = list.length + ' pieces';
  if (!list.length) grid.append(element('p', 'empty', products.length ? 'No pieces match. Try another search or category.' : 'No products yet. Add documents to products in Firebase Console.'));
  for (let p of list) {
    const card = element('article', 'product-card');
    const imageBox = element('div', 'image-box');
    imageBox.append(picture(p), element('span', 'product-label', p.category));
    const info = element('div', 'product-info');
    info.append(element('h3', '', p.name), element('strong', '', money(p.price)));
    const button = element('button', 'add-button', '+ Add to bag');
    button.addEventListener('click', async () => {
      if (!user) { location.href = 'login.html?next=shop'; return; }
      button.disabled = true;
      try {
        const ref = doc(db, 'users', user.uid, 'cart', p.id);
        await runTransaction(db, async transaction => {
          const old = await transaction.get(ref);
          let quantity = old.exists() ? old.data().quantity + 1 : 1;
          if (quantity > 99) throw new Error('limit');
          transaction.set(ref, { quantity });
        });
        message(p.name + ' added to your bag.');
      } catch { message('Could not add item. Check your connection or quantity limit.'); }
      button.disabled = false;
    });
    card.append(imageBox, info, element('p', 'description', p.description), button);
    grid.append(card);
  }
}

function showCart() {
  if (page !== 'cart') return;
  const list = document.getElementById('cart-items');
  list.replaceChildren();
  let total = 0;
  let count = 0;
  for (let item of cart) {
    let p = products.find(product => product.id === item.id);
    const row = element('article', 'cart-row');
    const details = element('div', 'cart-details');
    if (p) {
      row.append(picture(p));
      details.append(element('h3', '', p.name), element('p', 'muted', p.category), element('strong', '', money(p.price)));
      total = total + Math.round(p.price * 100) * item.quantity;
      count = count + item.quantity;
      const controls = element('div', 'quantity');
      const minus = element('button', '', '−');
      minus.setAttribute('aria-label', 'Decrease ' + p.name);
      const plus = element('button', '', '+');
      plus.setAttribute('aria-label', 'Increase ' + p.name);
      minus.onclick = () => changeQuantity(item, item.quantity - 1, minus);
      plus.onclick = () => changeQuantity(item, item.quantity + 1, plus);
      plus.disabled = item.quantity >= 99;
      controls.append(minus, element('span', '', String(item.quantity)), plus);
      details.append(controls);
      row.append(details, element('strong', 'line-total', money(Math.round(p.price * 100) * item.quantity / 100)));
    } else {
      details.append(element('p', '', 'This product is no longer available. Remove it to continue.'));
      row.append(details);
    }
    const remove = element('button', 'text-button', 'Remove');
    remove.onclick = () => changeQuantity(item, 0, remove);
    row.append(remove);
    list.append(row);
  }
  if (!cart.length) list.append(element('p', 'empty', 'Your bag is waiting for a fresh fit. Explore the shop to get started.'));
  document.getElementById('subtotal').textContent = money(total / 100);
  document.getElementById('total').textContent = money(total / 100 + 0);
  document.getElementById('item-count').textContent = count + ' items';
  document.getElementById('checkout').disabled = !cart.length || !ready || cart.some(item => !products.find(p => p.id === item.id));
}

async function changeQuantity(item, amount, button) {
  if (!user) return;
  button.disabled = true;
  try {
    const ref = doc(db, 'users', user.uid, 'cart', item.id);
    if (amount === 0) await deleteDoc(ref);
    else await setDoc(ref, { quantity: amount });
    message('Bag updated.');
  } catch { message('Could not update your bag.'); button.disabled = false; }
}

onAuthStateChanged(auth, async currentUser => {
  if (stopCart) stopCart();
  user = currentUser;
  cart = [];
  document.getElementById('bag-count').textContent = '0';
  const account = document.getElementById('account');
  const logout = document.getElementById('logout');
  account.textContent = user ? user.email : 'Log in';
  logout.hidden = !user;
  document.getElementById('cart-link').href = user ? 'cart.html' : 'login.html?next=cart';
  if (page === 'cart') {
    document.getElementById('cart-content').hidden = !user;
    document.getElementById('cart-gate').hidden = !!user;
    showCart();
  }
  if (page === 'login') {
    document.getElementById('auth-form').hidden = !!user;
    document.getElementById('signed-in').hidden = !user;
  }
  if (user) {
    stopCart = onSnapshot(collection(db, 'users', user.uid, 'cart'), snapshot => {
      cart = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      document.getElementById('bag-count').textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
      showCart();
    }, () => { message('Could not load your bag. Check Firebase rules and your connection.'); });
    try { await setDoc(doc(db, 'users', user.uid), { email: user.email }); }
    catch { message('Could not save your profile. Check Firebase rules.'); }
  }
}, () => message('Authentication is unavailable. Check Firebase setup.'));

document.getElementById('logout').onclick = async () => {
  try { await signOut(auth); message('You are logged out.'); }
  catch { message('Could not log out.'); }
};

if (page === 'login') {
  document.getElementById('toggle-auth').onclick = () => {
    signup = !signup;
    document.getElementById('auth-title').textContent = signup ? 'Join the movement.' : 'Welcome back.';
    document.getElementById('auth-submit').textContent = signup ? 'Create account →' : 'Log in →';
    document.getElementById('toggle-auth').textContent = signup ? 'Already a member? Log in' : 'New here? Create an account';
    document.getElementById('password').autocomplete = signup ? 'new-password' : 'current-password';
  };
  document.getElementById('auth-form').onsubmit = async event => {
    event.preventDefault();
    const button = document.getElementById('auth-submit');
    button.disabled = true;
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    try {
      if (signup === true) await createUserWithEmailAndPassword(auth, email, password);
      if (signup === false) await signInWithEmailAndPassword(auth, email, password);
      location.href = new URLSearchParams(location.search).get('next') === 'cart' ? 'cart.html' : 'shop.html';
    } catch { message('Could not sign in or create account. Check your details and Firebase setup.'); }
    button.disabled = false;
  };
}

document.querySelectorAll('[data-category]').forEach(button => {
  button.classList.toggle('active', button.dataset.category === category);
  button.onclick = () => {
    category = button.dataset.category;
    document.querySelectorAll('[data-category]').forEach(b => b.classList.toggle('active', b === button));
    showProducts();
  };
});
if (document.getElementById('search')) document.getElementById('search').oninput = event => { search = event.target.value; showProducts(); };
if (document.getElementById('sort')) document.getElementById('sort').onchange = event => { sorting = event.target.value; showProducts(); };
if (document.getElementById('checkout')) document.getElementById('checkout').onclick = () => {

  document.getElementById('checkout-dialog').showModal();
};
if (document.getElementById('close-dialog')) document.getElementById('close-dialog').onclick = () => document.getElementById('checkout-dialog').close();

if (page === 'home' || page === 'shop' || page === 'cart') {
  try {
    const snapshot = await getDocs(collection(db, 'products'));
    products = snapshot.docs.map(d => ({ ...d.data(), id: d.id })).filter(p => typeof p.name === 'string' && typeof p.description === 'string' && typeof p.category === 'string' && Number.isFinite(p.price) && p.price >= 0);
    ready = true;
    showProducts();
    showCart();
  } catch { message('Could not load products. Check your Firebase Console configuration and Firestore rules.'); }
}
}


const configured = ['apiKey', 'authDomain', 'projectId', 'appId'].every(key =>
  typeof firebaseConfig[key] === 'string' && firebaseConfig[key].trim() && !firebaseConfig[key].startsWith('REPLACE_')
);
if (configured) {
  startStore().catch(() => {
    document.getElementById('message').textContent = 'Firebase could not start. Check your web app configuration in Firebase Console.';
  });
} else {
  document.getElementById('message').textContent = 'Setup needed: copy your web app configuration from Firebase Console into public/firebase-config.js. Follow STEP-BY-STEP-GUIDE.txt.';
  const grid = document.getElementById('products');
  if (grid) grid.textContent = 'Connect your Firebase project to load products.';
  const submit = document.getElementById('auth-submit');
  if (submit) submit.disabled = true;
}