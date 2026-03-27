import * as firebaseService from './firebaseService.js';

export async function initializeApp({ pageTitle, initFirebase = true }) {
    const appSettings = await firebaseService.getSettings();
    window.appSettings = appSettings;
    
    if (initFirebase) {
        firebaseService.initFirebaseService({ imgbbApiKey: appSettings.imgbbApiKey });
    }
    
    if (appSettings.siteTitle) {
        document.title = pageTitle 
            ? `${appSettings.siteTitle} - ${pageTitle}`
            : appSettings.siteTitle;
    }
    
    const { renderHeader } = await import('./components/header.js');
    renderHeader?.();
    
    return appSettings;
}
