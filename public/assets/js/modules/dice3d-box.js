import DiceBox from '@3d-dice/dice-box';

let diceBox = null;
let currentRollResolve = null;
let currentRollData = null;

export async function initDice3D(containerSelector = '#dice-container') {
  diceBox = new DiceBox(containerSelector, {
    assetPath: '/assets/dice-box',
    scale: 6,
    gravity: 1,
    friction: 0.8,
    restitution: 0,
    settleTimeout: 3000,
    theme: 'default',
    onBeforeRoll: (notation) => {
      console.log('[Dice3D] Rolling:', notation);
    },
    onDieComplete: (dieResult) => {
      console.log('[Dice3D] Die complete:', dieResult);
    },
    onRollComplete: (rollResult) => {
      console.log('[Dice3D] Roll complete:', rollResult);
      if (currentRollResolve && currentRollData) {
        const result = {
          total: rollResult.value,
          rolls: rollResult.rolls.map(r => r.value),
          formula: currentRollData.formula,
          userName: currentRollData.userName,
          diceType: extractDiceType(currentRollData.formula)
        };
        currentRollResolve(result);
        currentRollResolve = null;
        currentRollData = null;
      }
    },
    onRemoveComplete: (dieResult) => {
      console.log('[Dice3D] Die removed:', dieResult);
    }
  });

  await diceBox.init();
}

function extractDiceType(formula) {
  const match = formula.match(/(\d+)d(\d+)/i);
  if (match) {
    return `d${match[2]}`;
  }
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

export function clearDice() {
  if (diceBox) {
    diceBox.clear();
  }
}

export function hideDice() {
  if (diceBox) {
    diceBox.hide();
  }
}

export function showDice() {
  if (diceBox) {
    diceBox.show();
  }
}
