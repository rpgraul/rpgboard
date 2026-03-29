import DiceBox from '@3d-dice/dice-box';

let diceBox = null;
let currentRollResolve = null;
let currentRollData = null;
let diceDismissLocked = false;
let dismissLockTimeout = null;
let dismissHandler = null;

export async function initDice3D(containerSelector = '#dice-container') {
  const containerId = containerSelector.replace('#', '');
  
  diceBox = new DiceBox({
    id: containerId,
    assetPath: '/assets/dice-box/',
    origin: window.location.origin,
    scale: 6,
    gravity: 1,
    friction: 0.8,
    restitution: 0,
    settleTimeout: 3000,
    theme: 'default',
    onBeforeRoll: () => {
      diceDismissLocked = true;
    },
    onRollComplete: (rollResult) => {
      const firstGroup = Array.isArray(rollResult) ? rollResult[0] : rollResult;
      
      if (firstGroup && currentRollResolve && currentRollData) {
        const rolls = (firstGroup.rolls || []).map(r => r.value || r.result || 0);
        const result = {
          total: firstGroup.value || 0,
          rolls: rolls,
          formula: currentRollData.formula,
          userName: currentRollData.userName,
          diceType: extractDiceType(currentRollData.formula)
        };
        currentRollResolve(result);
        currentRollResolve = null;
        currentRollData = null;
      }
      
      if (dismissLockTimeout) clearTimeout(dismissLockTimeout);
      diceDismissLocked = true;
      
      dismissLockTimeout = setTimeout(() => {
        diceDismissLocked = false;
        enableDiceDismiss();
      }, 3000);
    }
  });

  await diceBox.init();
  enableDiceDismiss();
}

function extractDiceType(formula) {
  const match = formula.match(/(\d+)d(\d+)/i);
  if (match) return `d${match[2]}`;
  return 'd20';
}

export function rollDice(formula, userName) {
  return new Promise((resolve, reject) => {
    if (!diceBox) {
      reject(new Error('DiceBox not initialized'));
      return;
    }

    currentRollResolve = resolve;
    currentRollData = { formula, userName };

    try {
      diceBox.roll(formula);
    } catch (error) {
      console.error('[Dice3D] Roll error:', error);
      currentRollResolve = null;
      currentRollData = null;
      reject(error);
    }
  });
}

function enableDiceDismiss() {
  if (diceDismissLocked) return;
  if (dismissHandler) return;
  
  dismissHandler = (e) => {
    if (diceDismissLocked) return;
    if (e.target.closest('.dice-notification')) return;
    
    if (diceBox) diceBox.clear();
    document.querySelectorAll('.dice-notification').forEach(n => n.remove());
    
    document.removeEventListener('click', dismissHandler);
    dismissHandler = null;
  };
  
  document.addEventListener('click', dismissHandler);
}

export function clearDice() {
  if (diceBox) diceBox.clear();
  document.querySelectorAll('.dice-notification').forEach(n => n.remove());
}

export function hideDice() {
  if (diceBox) diceBox.hide();
}

export function showDice() {
  if (diceBox) diceBox.show();
}
