<<<<<<< HEAD
import { openModal, closeModal } from "./modal.js";
import * as firebaseService from "./firebaseService.js";
let settingsModal = null,
  settingsForm = null,
  titleInput = null,
  tagsInput = null,
  filtersInput = null,
  defaultCurrencyInput = null,
  fabSettings = null,
  submitButton = null;
function populateForm(t) {
  t &&
    ((titleInput.value = t.siteTitle || ""),
    (tagsInput.value = (t.recommendedTags || []).join(", ")),
    (filtersInput.value = JSON.stringify(t.filters || [], null, 2)),
    (defaultCurrencyInput.value = t.defaultCurrency || ""));
}
async function openSettingsModal() {
  try {
    populateForm(await firebaseService.getSettings()), openModal(settingsModal);
  } catch (t) {
    console.error("Falha ao carregar configurações para o modal:", t),
      alert("Não foi possível carregar as configurações.");
  }
}
async function handleSave(t) {
  t.preventDefault(), submitButton.classList.add("is-loading");
  const e = tagsInput.value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  let n;
  try {
    if (((n = JSON.parse(filtersInput.value)), !Array.isArray(n)))
      throw new Error("O formato dos filtros deve ser um array JSON.");
  } catch (t) {
    return (
      alert(`Erro no formato JSON dos filtros: ${t.message}`),
      void submitButton.classList.remove("is-loading")
    );
  }
  const s = {
    siteTitle: titleInput.value,
    recommendedTags: e,
    filters: n,
    defaultCurrency: defaultCurrencyInput.value.trim(),
  };
  try {
    await firebaseService.saveSettings(s),
      closeModal(settingsModal),
      window.location.reload();
  } catch (t) {
    console.error("Falha ao salvar as configurações:", t),
      alert("Ocorreu um erro ao salvar as configurações.");
  } finally {
    submitButton.classList.remove("is-loading");
  }
}
export function initializeSettings() {
  (settingsModal = document.getElementById("settings-modal")),
    (fabSettings = document.getElementById("fab-settings")),
    (settingsForm = document.getElementById("form-settings")),
    (titleInput = document.getElementById("settings-title")),
    (tagsInput = document.getElementById("settings-recommended-tags")),
    (filtersInput = document.getElementById("settings-filters")),
    (defaultCurrencyInput = document.getElementById(
      "settings-default-currency"
    )),
    settingsModal &&
      fabSettings &&
      settingsForm &&
      ((submitButton = settingsForm
        .closest(".modal-card")
        .querySelector('button[type="submit"]')),
      fabSettings.addEventListener("click", openSettingsModal),
      settingsForm.addEventListener("submit", handleSave));
}
=======
import { openModal, closeModal } from './modal.js';
import * as firebaseService from './firebaseService.js';

// DOM Elements
let settingsModal = null;
let settingsForm = null;
let titleInput = null;
let tagsInput = null;
let filtersInput = null;
let defaultCurrencyInput = null; // Novo campo
let fabSettings = null;
let submitButton = null;

/**
 * Populates the settings form with data from Firebase.
 * @param {object} settings - The settings object.
 */
function populateForm(settings) {
    if (!settings) return;
    titleInput.value = settings.siteTitle || '';
    tagsInput.value = (settings.recommendedTags || []).join(', ');
    // Pretty-print the JSON for better readability in the textarea
    filtersInput.value = JSON.stringify(settings.filters || [], null, 2);
    defaultCurrencyInput.value = settings.defaultCurrency || ''; // Popula o novo campo
}

/**
 * Handles the opening of the settings modal.
 */
async function openSettingsModal() {
    try {
        const settings = await firebaseService.getSettings();
        populateForm(settings);
        openModal(settingsModal);
    } catch (error) {
        console.error("Falha ao carregar configurações para o modal:", error);
        alert("Não foi possível carregar as configurações.");
    }
}

/**
 * Handles saving the settings form.
 * @param {Event} event
 */
async function handleSave(event) {
    event.preventDefault();
    submitButton.classList.add('is-loading');

    // 1. Parse Tags
    const recommendedTags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);

    // 2. Parse and Validate Filters JSON
    let filters;
    try {
        filters = JSON.parse(filtersInput.value);
        if (!Array.isArray(filters)) {
            throw new Error("O formato dos filtros deve ser um array JSON.");
        }
    } catch (error) {
        alert(`Erro no formato JSON dos filtros: ${error.message}`);
        submitButton.classList.remove('is-loading');
        return;
    }

    const newSettings = {
        siteTitle: titleInput.value,
        recommendedTags: recommendedTags,
        filters: filters,
        defaultCurrency: defaultCurrencyInput.value.trim() // Salva a moeda padrão
    };

    try {
        await firebaseService.saveSettings(newSettings);
        closeModal(settingsModal);
        window.location.reload();
    } catch (error) {
        console.error("Falha ao salvar as configurações:", error);
        alert("Ocorreu um erro ao salvar as configurações.");
    } finally {
        submitButton.classList.remove('is-loading');
    }
}

/**
 * Initializes the settings module.
 */
export function initializeSettings() {
    settingsModal = document.getElementById('settings-modal');
    fabSettings = document.getElementById('fab-settings');
    settingsForm = document.getElementById('form-settings');
    titleInput = document.getElementById('settings-title');
    tagsInput = document.getElementById('settings-recommended-tags');
    filtersInput = document.getElementById('settings-filters');
    defaultCurrencyInput = document.getElementById('settings-default-currency');

    if (!settingsModal || !fabSettings || !settingsForm) return;

    submitButton = settingsForm.closest('.modal-card').querySelector('button[type="submit"]');

    fabSettings.addEventListener('click', openSettingsModal);
    settingsForm.addEventListener('submit', handleSave);
}
>>>>>>> 104b23cfc07483eae944d9e675e87949d0da4616
