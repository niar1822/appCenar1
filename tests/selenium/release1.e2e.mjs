import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

// Cobertura Selenium alineada al Plan de Pruebas GestionCenar Release 1.0.
const BASE_URL = process.env.BASE_URL?.replace(/\/$/, '');
const CLIENT_USERNAME = process.env.CLIENT_USERNAME ?? process.env.TEST_USERNAME;
const CLIENT_PASSWORD = process.env.CLIENT_PASSWORD ?? process.env.TEST_PASSWORD;
const COMMERCE_USERNAME = process.env.COMMERCE_USERNAME;
const COMMERCE_PASSWORD = process.env.COMMERCE_PASSWORD;
const TEST_MENU_PATH = process.env.TEST_MENU_PATH; // /cliente/menu/<id-comercio-pruebas>
const HEADLESS = process.env.HEADLESS !== 'false';
const CHROMEDRIVER_PATH = process.env.CHROMEDRIVER_PATH;
const TIMEOUT = Number(process.env.SELENIUM_TIMEOUT ?? 10000);
const RESULTS_DIR = path.resolve('test-results', 'selenium');

if (!BASE_URL) throw new Error('Define BASE_URL. Ejemplo: $env:BASE_URL="https://tu-aplicacion.com"');
if (CHROMEDRIVER_PATH && !existsSync(CHROMEDRIVER_PATH)) {
  throw new Error(`CHROMEDRIVER_PATH no existe: ${CHROMEDRIVER_PATH}. Elimina la variable para usar Selenium Manager o indica la ruta real de chromedriver.exe.`);
}

let driver;

async function capture(name) {
  await mkdir(RESULTS_DIR, { recursive: true });
  await writeFile(path.join(RESULTS_DIR, `${name}.png`), Buffer.from(await driver.takeScreenshot(), 'base64'));
}

async function login(username, password, expectedPath) {
  await driver.get(`${BASE_URL}/`);
  await driver.wait(until.elementLocated(By.name('username')), TIMEOUT);
  await driver.findElement(By.name('username')).sendKeys(username);
  await driver.findElement(By.name('password')).sendKeys(password);
  await driver.findElement(By.css('form[action="/login"] button.btn-success')).click();
  await driver.wait(async () => new URL(await driver.getCurrentUrl()).pathname === expectedPath, TIMEOUT);
}

async function logout() {
  await driver.get(`${BASE_URL}/logout`);
  await driver.wait(async () => new URL(await driver.getCurrentUrl()).pathname === '/', TIMEOUT);
}

function moneyToNumber(value) {
  const compact = value.replace(/[^0-9.,]/g, '');
  return Number(compact.includes(',') && compact.includes('.') ? compact.replace(/,/g, '') : compact.replace(',', '.'));
}

test.before(async () => {
  const options = new chrome.Options();
  if (HEADLESS) options.addArguments('--headless=new', '--window-size=1440,1000');
  options.addArguments('--disable-gpu', '--no-sandbox');
  const builder = new Builder().forBrowser('chrome').setChromeOptions(options);
  if (CHROMEDRIVER_PATH) builder.setChromeService(new chrome.ServiceBuilder(CHROMEDRIVER_PATH));
  driver = await builder.build();
  await driver.manage().setTimeouts({ implicit: 0, pageLoad: TIMEOUT, script: TIMEOUT });
});

test.after(async () => { if (driver) await driver.quit(); });

test('HU-02 / RF-02: un cliente no puede acceder a categorías del comercio', {
  skip: !CLIENT_USERNAME || !CLIENT_PASSWORD ? 'Define CLIENT_USERNAME y CLIENT_PASSWORD.' : false
}, async () => {
  await login(CLIENT_USERNAME, CLIENT_PASSWORD, '/cliente');
  await driver.get(`${BASE_URL}/comercio/categories`);
  assert.match(await driver.findElement(By.css('body')).getText(), /no autorizado/i);
  await capture('hu02-acceso-restringido');
  await logout();
});

test('HU-03 / RF-03: el formulario de categoría exige nombre y descripción', {
  skip: !COMMERCE_USERNAME || !COMMERCE_PASSWORD ? 'Define COMMERCE_USERNAME y COMMERCE_PASSWORD.' : false
}, async () => {
  await login(COMMERCE_USERNAME, COMMERCE_PASSWORD, '/comercio');
  await driver.get(`${BASE_URL}/comercio/categories/new`);
  const isValid = await driver.executeScript('return document.querySelector("form[action=\\"/comercio/categories\\"]").checkValidity();');
  assert.equal(isValid, false);
  await capture('hu03-categoria-requerida');
  await logout();
});

test('HU-04 / RF-04: el formulario de producto exige datos y precio no negativo', {
  skip: !COMMERCE_USERNAME || !COMMERCE_PASSWORD ? 'Define COMMERCE_USERNAME y COMMERCE_PASSWORD.' : false
}, async () => {
  await login(COMMERCE_USERNAME, COMMERCE_PASSWORD, '/comercio');
  await driver.get(`${BASE_URL}/comercio/products/new`);
  const state = await driver.executeScript(`const form=document.querySelector('form[action="/comercio/products"]');const price=document.querySelector('input[name="precio"]');return {valid:form.checkValidity(),min:price.min,step:price.step};`);
  assert.equal(state.valid, false); assert.equal(state.min, '0'); assert.equal(state.step, '0.01');
  await capture('hu04-producto-validaciones');
  await logout();
});

test('HU-05 / RF-05: el menú muestra productos disponibles', {
  skip: !CLIENT_USERNAME || !CLIENT_PASSWORD || !TEST_MENU_PATH ? 'Define CLIENT_USERNAME, CLIENT_PASSWORD y TEST_MENU_PATH.' : false
}, async () => {
  await login(CLIENT_USERNAME, CLIENT_PASSWORD, '/cliente');
  await driver.get(`${BASE_URL}${TEST_MENU_PATH}`);
  assert.ok((await driver.findElements(By.css('.card-title'))).length > 0);
  assert.ok((await driver.findElements(By.css('form[action^="/cliente/cart/add/"] button.btn-success'))).length > 0);
  await capture('hu05-menu-disponible');
  await logout();
});

test('HU-06 y HU-07 / RF-06-RF-07: agregar producto actualiza carrito y subtotal', {
  skip: !CLIENT_USERNAME || !CLIENT_PASSWORD || !TEST_MENU_PATH ? 'Define CLIENT_USERNAME, CLIENT_PASSWORD y TEST_MENU_PATH.' : false
}, async () => {
  await login(CLIENT_USERNAME, CLIENT_PASSWORD, '/cliente');
  await driver.get(`${BASE_URL}${TEST_MENU_PATH}`);
  const product = await driver.findElement(By.css('.card:has(form[action^="/cliente/cart/add/"])'));
  const expected = moneyToNumber(await product.findElement(By.css('.fw-semibold')).getText());
  await product.findElement(By.css('form[action^="/cliente/cart/add/"] button.btn-success')).click();
  await driver.wait(until.elementLocated(By.css('form[action^="/cliente/cart/remove/"]')), TIMEOUT);
  const subtotal = moneyToNumber(await driver.findElement(By.css('.sticky-top strong')).getText());
  assert.equal(subtotal, expected, 'El subtotal debe coincidir con el único producto agregado.');
  await capture('hu06-hu07-carrito-subtotal');
  await driver.get(`${BASE_URL}/cliente/cart`);
  await driver.findElement(By.css('form[action="/cliente/cart/clear"] button')).click();
  await driver.wait(until.elementLocated(By.css('.alert.alert-info')), TIMEOUT);
  await logout();
});

test('HU-08 / RF-08: el comercio visualiza estados de sus pedidos', {
  skip: !COMMERCE_USERNAME || !COMMERCE_PASSWORD ? 'Define COMMERCE_USERNAME y COMMERCE_PASSWORD.' : false
}, async () => {
  await login(COMMERCE_USERNAME, COMMERCE_PASSWORD, '/comercio');
  await driver.get(`${BASE_URL}/comercio/orders`);
  assert.match(await driver.findElement(By.css('body')).getText(), /(estado:|no hay pedidos registrados)/i);
  await capture('hu08-estados-pedidos');
  await logout();
});

test('HU-09 / RF-09: reporte diario de ventas', { skip: 'La aplicación actual no expone una ruta o vista de reporte diario de ventas; debe implementarse antes de automatizar RF-09.' }, () => {});

test('HU-10 / RF-10: el cliente consulta su historial de pedidos', {
  skip: !CLIENT_USERNAME || !CLIENT_PASSWORD ? 'Define CLIENT_USERNAME y CLIENT_PASSWORD.' : false
}, async () => {
  await login(CLIENT_USERNAME, CLIENT_PASSWORD, '/cliente');
  await driver.get(`${BASE_URL}/cliente/orders`);
  assert.match(await driver.findElement(By.css('body')).getText(), /(mis pedidos|aun no has realizado pedidos)/i);
  await capture('hu10-historial-pedidos');
  await logout();
});

test('RNF-04: compatibilidad con Chrome mediante Selenium', async () => {
  assert.equal((await driver.getCapabilities()).get('browserName'), 'chrome');
  await capture('rnf04-compatibilidad-chrome');
});

test('RNF-02: rendimiento bajo 3 segundos', { skip: 'Debe ejecutarse con k6/JMeter y 20 usuarios virtuales; Selenium no mide carga.' }, () => {});
test('RNF-03: hash de contraseñas y escaneo web', { skip: 'La autorización se cubre en HU-02; el hash y escaneo requieren backend y OWASP ZAP.' }, () => {});
