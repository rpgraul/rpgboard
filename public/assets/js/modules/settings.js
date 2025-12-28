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
