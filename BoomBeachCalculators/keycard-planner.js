(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.KeycardPlanner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  const VERIFIED_DATE = '2026-07-26';
  const CARD_PIECES_PER_KEYCARD = 200;
  const DAILY_TASK_CARD_PIECES = 100;
  const FREE_PULL_HOURS = 22;
  const MAX_PLANNED_PULLS = 200;
  const PRUNE_EPSILON = 1e-14;

  const CATEGORIES = ['rare', 'sergeant', 'epic', 'lieutenant'];
  const PRIORITY = ['rare', 'sergeant', 'epic', 'lieutenant'];
  const MAX_ATTEMPT = {rare:10, sergeant:40, epic:55, lieutenant:80};

  const RATES = Object.freeze({
    rare: expandRates(10, [
      [1,1,0.005],[2,2,0.06],[3,3,0.08],[4,4,0.10],[5,5,0.12],
      [6,6,0.14],[7,9,0.20],[10,10,1]
    ]),
    sergeant: expandRates(40, [
      [1,1,0.024],[2,4,0.006],[5,6,0.007],[7,11,0.008],[12,15,0.009],
      [16,21,0.01],[22,22,0.013],[23,23,0.015],[24,24,0.017],
      [25,25,0.019],[26,26,0.021],[27,27,0.023],[28,28,0.025],
      [29,29,0.04],[30,31,0.06],[32,32,0.08],[33,33,0.09],
      [34,34,0.10],[35,35,0.15],[36,36,0.20],[37,38,0.25],[39,40,1]
    ]),
    epic: expandRates(55, [
      [1,1,0.016],[2,5,0.002],[6,9,0.004],[10,14,0.006],[15,19,0.007],
      [20,24,0.009],[25,29,0.011],[30,34,0.013],[35,39,0.015],
      [40,40,0.024],[41,41,0.03],[42,42,0.06],[43,43,0.10],
      [44,44,0.12],[45,45,0.14],[46,46,0.16],[47,47,0.18],
      [48,48,0.20],[49,52,0.25],[53,55,1]
    ]),
    lieutenant: expandRates(80, [
      [1,1,0.01],[2,5,0.002],[6,9,0.0025],[10,14,0.003],[15,19,0.0035],
      [20,24,0.004],[25,29,0.0045],[30,34,0.005],[35,39,0.0055],
      [40,44,0.006],[45,49,0.0065],[50,54,0.007],[55,58,0.0075],
      [59,59,0.027],[60,60,0.041],[61,61,0.025],[62,62,0.03],
      [63,63,0.04],[64,64,0.05],[65,65,0.07],[66,66,0.09],
      [67,67,0.11],[68,68,0.13],[69,69,0.15],[70,70,0.17],
      [71,71,0.19],[72,72,0.21],[73,73,0.23],[74,74,0.25],
      [75,75,0.27],[76,77,0.30],[78,80,1]
    ])
  });

  function expandRates(max, ranges){
    const values = new Array(max + 1).fill(0);
    ranges.forEach(([from,to,chance])=>{
      for(let i=from;i<=to;i++) values[i] = chance;
    });
    return Object.freeze(values);
  }

  function finiteNonNegative(value){
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function wholeNonNegative(value){
    return Math.floor(finiteNonNegative(value));
  }

  function clamp(value, min, max){
    return Math.min(max, Math.max(min, value));
  }

  function convertCardPieces(cardPieces){
    const pieces = wholeNonNegative(cardPieces);
    return {
      keycards: Math.floor(pieces / CARD_PIECES_PER_KEYCARD),
      remainder: pieces % CARD_PIECES_PER_KEYCARD
    };
  }

  function attemptFromRemaining(category, remaining){
    const max = MAX_ATTEMPT[category];
    const left = clamp(wholeNonNegative(remaining), 1, max);
    return max - left + 1;
  }

  function normalizeProbabilityConfig(config){
    const banner = config && config.banner === 'elite' ? 'elite' : 'field';
    const remaining = (config && config.remaining) || {};
    return {
      banner,
      featuredRate: clamp(finiteNonNegative(config && config.featuredRate) / 100, 0, 1),
      eliteGuaranteed: Boolean(config && config.eliteGuaranteed),
      attempts: {
        rare: attemptFromRemaining('rare', remaining.rare == null ? 10 : remaining.rare),
        sergeant: attemptFromRemaining('sergeant', remaining.sergeant == null ? 40 : remaining.sergeant),
        epic: attemptFromRemaining('epic', remaining.epic == null ? 55 : remaining.epic),
        lieutenant: attemptFromRemaining('lieutenant', remaining.lieutenant == null ? 80 : remaining.lieutenant)
      }
    };
  }

  function stateKey(state){
    return `${state.rare},${state.sergeant},${state.epic},${state.lieutenant},${state.eliteGuaranteed ? 1 : 0}`;
  }

  function parseState(key){
    const values = key.split(',').map(Number);
    return {rare:values[0], sergeant:values[1], epic:values[2], lieutenant:values[3], eliteGuaranteed:values[4] === 1};
  }

  function incrementState(state, selected, banner, eliteGuaranteed){
    const next = {eliteGuaranteed};
    CATEGORIES.forEach(category=>{
      if(category === 'epic' && banner === 'elite') next[category] = state[category];
      else if(category === selected) next[category] = 1;
      else next[category] = Math.min(MAX_ATTEMPT[category], state[category] + 1);
    });
    return next;
  }

  function rewardBranches(state, config){
    const active = config.banner === 'elite'
      ? ['rare','sergeant','lieutenant']
      : CATEGORIES;
    const guaranteed = PRIORITY.find(category=>active.includes(category) && RATES[category][state[category]] >= 1);
    const base = guaranteed
      ? {[guaranteed]:1}
      : active.reduce((result,category)=>{
          result[category] = RATES[category][state[category]];
          return result;
        }, {});

    if(!guaranteed){
      const used = Object.values(base).reduce((sum,value)=>sum + value, 0);
      base.common = Math.max(0, 1 - used);
    }

    const branches = [];
    Object.entries(base).forEach(([reward,probability])=>{
      if(probability <= 0) return;
      if(reward === 'lieutenant' && config.banner === 'elite'){
        const featuredChance = state.eliteGuaranteed ? 1 : config.featuredRate;
        if(featuredChance > 0){
          branches.push({reward:'featured', probability:probability * featuredChance,
            next:incrementState(state, 'lieutenant', config.banner, false)});
        }
        if(featuredChance < 1){
          branches.push({reward:'lieutenant', probability:probability * (1 - featuredChance),
            next:incrementState(state, 'lieutenant', config.banner, true)});
        }
      }else{
        branches.push({reward, probability,
          next:incrementState(state, reward === 'common' ? null : reward, config.banner, state.eliteGuaranteed)});
      }
    });
    return branches;
  }

  function rewardMatchesTarget(reward, target){
    if(target === 'lieutenant') return reward === 'lieutenant' || reward === 'featured';
    return reward === target;
  }

  function simulateTarget(config, target, pulls){
    const normalized = normalizeProbabilityConfig(config || {});
    const count = clamp(wholeNonNegative(pulls), 0, MAX_PLANNED_PULLS);
    if(target === 'featured' && normalized.banner !== 'elite') return emptySimulation(count);
    if(target === 'epic' && normalized.banner === 'elite') return emptySimulation(count);

    const initial = Object.assign({}, normalized.attempts, {eliteGuaranteed:normalized.eliteGuaranteed});
    let states = new Map([[stateKey(initial), 1]]);
    let cumulative = 0;
    let discarded = 0;
    let expectedPulls = 0;
    const cdf = [0];

    for(let pull=1;pull<=count;pull++){
      const survivalBefore = Math.max(0, 1 - cumulative - discarded);
      expectedPulls += survivalBefore;
      const nextStates = new Map();
      for(const [key,stateProbability] of states){
        const state = parseState(key);
        for(const branch of rewardBranches(state, normalized)){
          const probability = stateProbability * branch.probability;
          if(rewardMatchesTarget(branch.reward, target)){
            cumulative += probability;
            continue;
          }
          if(probability < PRUNE_EPSILON){
            discarded += probability;
            continue;
          }
          const nextKey = stateKey(branch.next);
          nextStates.set(nextKey, (nextStates.get(nextKey) || 0) + probability);
        }
      }
      states = nextStates;
      cdf.push(clamp(cumulative, 0, 1));
    }

    return {
      target,
      pulls:count,
      cdf,
      probability:cdf[count],
      expectedPulls,
      remainingProbability:Math.max(0, 1 - cumulative - discarded),
      discardedProbability:discarded,
      median:firstThreshold(cdf, 0.5),
      p90:firstThreshold(cdf, 0.9),
      p95:firstThreshold(cdf, 0.95)
    };
  }

  function emptySimulation(pulls){
    return {pulls, cdf:new Array(pulls + 1).fill(0), probability:0, expectedPulls:null,
      remainingProbability:1, discardedProbability:0, median:null, p90:null, p95:null};
  }

  function firstThreshold(cdf, threshold){
    for(let i=0;i<cdf.length;i++) if(cdf[i] >= threshold) return i;
    return null;
  }

  function simulateAll(config, pulls){
    const normalized = normalizeProbabilityConfig(config || {});
    const targets = normalized.banner === 'elite'
      ? ['rare','sergeant','lieutenant','featured']
      : ['rare','sergeant','epic','lieutenant'];
    return targets.reduce((result,target)=>{
      result[target] = simulateTarget(config, target, pulls);
      return result;
    }, {});
  }

  function normalizeIncome(config){
    const input = config || {};
    return {
      banner:input.banner === 'elite' ? 'elite' : 'field',
      keycards:wholeNonNegative(input.keycards),
      cardPieces:wholeNonNegative(input.cardPieces),
      dailyTaskDaysPerWeek:clamp(finiteNonNegative(input.dailyTaskDaysPerWeek), 0, 7),
      cycleKeycardsPerWeek:clamp(finiteNonNegative(input.cycleKeycardsPerWeek), 0, 7),
      cycleRewardsRemaining:wholeNonNegative(input.cycleRewardsRemaining),
      manualOneTimeKeycards:wholeNonNegative(input.manualOneTimeKeycards),
      manualWeeklyKeycards:finiteNonNegative(input.manualWeeklyKeycards),
      useFreePulls:Boolean(input.useFreePulls),
      nextFreePullHours:finiteNonNegative(input.nextFreePullHours)
    };
  }

  function projectIncome(config, hours){
    const input = normalizeIncome(config);
    const horizonHours = finiteNonNegative(hours);
    const weeks = horizonHours / (24 * 7);
    const earnedPieces = input.dailyTaskDaysPerWeek * DAILY_TASK_CARD_PIECES * weeks;
    const pieceConversion = convertCardPieces(input.cardPieces + Math.floor(earnedPieces));
    const cycleKeycards = Math.min(input.cycleRewardsRemaining,
      Math.floor(input.cycleKeycardsPerWeek * weeks + 1e-9));
    const manualWeekly = input.manualWeeklyKeycards * weeks;
    const paidPulls = Math.floor(input.keycards + input.manualOneTimeKeycards +
      manualWeekly + cycleKeycards + pieceConversion.keycards);
    let freePulls = 0;
    if(input.banner === 'field' && input.useFreePulls && horizonHours >= input.nextFreePullHours){
      freePulls = 1 + Math.floor((horizonHours - input.nextFreePullHours) / FREE_PULL_HOURS);
    }
    return {
      paidPulls,
      freePulls,
      totalPulls:paidPulls + freePulls,
      cardPieceKeycards:pieceConversion.keycards,
      cardPiecesRemaining:pieceConversion.remainder,
      earnedCardPieces:Math.floor(earnedPieces),
      cycleKeycards,
      manualOneTimeKeycards:input.manualOneTimeKeycards,
      manualWeeklyKeycards:manualWeekly
    };
  }

  function hoursToPulls(config, desiredPulls, maxHours){
    const goal = clamp(wholeNonNegative(desiredPulls), 0, MAX_PLANNED_PULLS);
    if(goal === 0) return 0;
    const limit = wholeNonNegative(maxHours == null ? 24 * 365 * 10 : maxHours);
    if(projectIncome(config, limit).totalPulls < goal) return null;
    let low = 0, high = limit;
    while(low < high){
      const mid = Math.floor((low + high) / 2);
      if(projectIncome(config, mid).totalPulls >= goal) high = mid;
      else low = mid + 1;
    }
    return low;
  }

  return Object.freeze({
    VERIFIED_DATE,
    CARD_PIECES_PER_KEYCARD,
    DAILY_TASK_CARD_PIECES,
    FREE_PULL_HOURS,
    MAX_PLANNED_PULLS,
    MAX_ATTEMPT:Object.freeze(MAX_ATTEMPT),
    RATES,
    convertCardPieces,
    attemptFromRemaining,
    normalizeProbabilityConfig,
    rewardBranches,
    simulateTarget,
    simulateAll,
    projectIncome,
    hoursToPulls,
    firstThreshold
  });
});
