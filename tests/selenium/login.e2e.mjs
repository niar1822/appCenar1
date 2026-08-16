import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

const BASE_URL = process.env.BASE_URL?.replace(/\/$/, '');
const TEST_USERNAME = process.env.TEST_USERNAME;
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const TEST_SUCCESS_PATH = process.env.TEST_SUCCESS_PATH;
const HEADLESS = process.env.HEADLESS !== 'false';
const TIMEOUT = Number(process.env.SELENIUM_TIMEOUT ?? 10000);
const RESULTS_DIR = path.resolve('test-results', 'selenium');

if (!BASE_URL) {
  throw new Error('Define BASE_URL antes de ejecutar. Ejemplo: $env:BASE_URL="https://tu-app.com"');
}

let driver;

async function capture(name) {
  await mkdir(RESULTS_DIR, { recursive: true });
  const image = await driver.takeScreenshot();
  await writeFile(path.join(RESULTS_DIR, `${name}.png`), Buffer.from(image, 'base64'));
}

async function openLogin() {
  await driver.get(`${BASE_URL}/`);
  await driver.wait(until.elementLocated(By.name('username')), TIMEOUT);
  await driver.wait(until.elementLocated(By.name('password')), TIMEOUT);
}

async function login(username, password) {
  const usernameInput = await driver.findElement(By.name('username'));
  const passwordInput = await driver.findElement(By.name('password'));
  await usernameInput.clear();
  await passwordInput.clear();
  await usernameInput.sendKeys(username);
  await passwordInput.sendKeys(password);
  const submitButton = await driver.wait(
    until.elementLocated(By.css('form[action="/login"] button.btn-success')),
    TIMEOUT
  );
  await driver.wait(until.elementIsVisible(submitButton), TIMEOUT);
  await submitButton.click();
}

test.before(async () => {
  const options = new chrome.Options();
  if (HEADLESS) options.addArguments('--headless=new', '--window-size=1440,1000');
  options.addArguments('--disable-gpu', '--no-sandbox');
  driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
  await driver.manage().setTimeouts({ implicit: 0, pageLoad: TIMEOUT, script: TIMEOUT });
});

test.after(async () => {
  if (driver) await driver.quit();
});

test('HU-01: el formulario exige usuario y contraseña', async () => {
  await openLogin();
  const formIsValid = await driver.executeScript(
    'return document.querySelector("form[action=\\"/login\\"]").checkValidity();'
  );
  assert.equal(formIsValid, false, 'El formulario debe requerir los dos campos.');
  await capture('hu01-campos-obligatorios');
});

test('HU-01: credenciales inválidas muestran un mensaje controlado', async () => {
  await openLogin();
  await login('usuario_que_no_existe_selenium', 'ClaveInvalida123!');

  const alert = await driver.wait(until.elementLocated(By.css('.alert.alert-danger')), TIMEOUT);
  const message = await alert.getText();
  assert.match(message, /credenciales ingresadas no son validas/i);
  await capture('hu01-credenciales-invalidas');
});

test('HU-01: un usuario activo puede iniciar sesión', {
  skip: !TEST_USERNAME || !TEST_PASSWORD
    ? 'Define TEST_USERNAME y TEST_PASSWORD para ejecutar este caso contra una cuenta de pruebas.'
    : false
}, async () => {
  await openLogin();
  await login(TEST_USERNAME, TEST_PASSWORD);

  await driver.wait(async () => (await driver.getCurrentUrl()) !== `${BASE_URL}/`, TIMEOUT);
  const currentUrl = new URL(await driver.getCurrentUrl());
  if (TEST_SUCCESS_PATH) {
    assert.equal(currentUrl.pathname, TEST_SUCCESS_PATH, 'La redirección no coincide con el rol de la cuenta de pruebas.');
  } else {
    assert.notEqual(currentUrl.pathname, '/', 'El usuario no fue redirigido después del inicio de sesión.');
  }
  await capture('hu01-login-correcto');
});
