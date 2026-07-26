'use strict';

const assert = require('assert');
const planner = require('../keycard-planner.js');

function approx(actual, expected, epsilon = 1e-10){
  assert(Math.abs(actual - expected) <= epsilon, `expected ${expected}, received ${actual}`);
}

assert.deepStrictEqual(planner.convertCardPieces(199), {keycards:0,remainder:199});
assert.deepStrictEqual(planner.convertCardPieces(200), {keycards:1,remainder:0});
assert.deepStrictEqual(planner.convertCardPieces(450), {keycards:2,remainder:50});
assert.deepStrictEqual(planner.convertCardPieces(-20), {keycards:0,remainder:0});

const expectedRates = {
  rare:[0.005,0.06,0.08,0.10,0.12,0.14,0.20,0.20,0.20,1],
  sergeant:[0.024,0.006,0.006,0.006,0.007,0.007,0.008,0.008,0.008,0.008,0.008,
    0.009,0.009,0.009,0.009,0.01,0.01,0.01,0.01,0.01,0.01,0.013,0.015,0.017,
    0.019,0.021,0.023,0.025,0.04,0.06,0.06,0.08,0.09,0.10,0.15,0.20,0.25,0.25,1,1],
  epic:[0.016,0.002,0.002,0.002,0.002,0.004,0.004,0.004,0.004,0.006,0.006,0.006,0.006,0.006,
    0.007,0.007,0.007,0.007,0.007,0.009,0.009,0.009,0.009,0.009,0.011,0.011,0.011,0.011,0.011,
    0.013,0.013,0.013,0.013,0.013,0.015,0.015,0.015,0.015,0.015,0.024,0.03,0.06,0.10,0.12,
    0.14,0.16,0.18,0.20,0.25,0.25,0.25,0.25,1,1,1],
  lieutenant:[0.01,0.002,0.002,0.002,0.002,0.0025,0.0025,0.0025,0.0025,0.003,0.003,0.003,0.003,0.003,
    0.0035,0.0035,0.0035,0.0035,0.0035,0.004,0.004,0.004,0.004,0.004,0.0045,0.0045,0.0045,0.0045,0.0045,
    0.005,0.005,0.005,0.005,0.005,0.0055,0.0055,0.0055,0.0055,0.0055,0.006,0.006,0.006,0.006,0.006,
    0.0065,0.0065,0.0065,0.0065,0.0065,0.007,0.007,0.007,0.007,0.007,0.0075,0.0075,0.0075,0.0075,
    0.027,0.041,0.025,0.03,0.04,0.05,0.07,0.09,0.11,0.13,0.15,0.17,0.19,0.21,0.23,0.25,0.27,
    0.30,0.30,1,1,1]
};
Object.entries(expectedRates).forEach(([category,rates])=>{
  assert.deepStrictEqual(planner.RATES[category].slice(1), rates, `${category} official rates differ`);
});

const freshField = {banner:'field', featuredRate:50,
  remaining:{rare:10,sergeant:40,epic:55,lieutenant:80}};
const firstBranches = planner.rewardBranches({rare:1,sergeant:1,epic:1,lieutenant:1,eliteGuaranteed:false},
  planner.normalizeProbabilityConfig(freshField));
approx(firstBranches.reduce((sum,branch)=>sum + branch.probability, 0), 1);

const priorityBranches = planner.rewardBranches({rare:10,sergeant:40,epic:55,lieutenant:80,eliteGuaranteed:false},
  planner.normalizeProbabilityConfig(freshField));
assert.strictEqual(priorityBranches.length, 1);
assert.strictEqual(priorityBranches[0].reward, 'rare');
assert.strictEqual(priorityBranches[0].next.rare, 1);
assert.strictEqual(priorityBranches[0].next.sergeant, 40);

const rareGuarantee = planner.simulateTarget({banner:'field',remaining:{rare:1,sergeant:40,epic:55,lieutenant:80}},'rare',1);
approx(rareGuarantee.probability, 1);

const eliteFifty = planner.simulateTarget({banner:'elite',featuredRate:50,
  remaining:{rare:10,sergeant:40,epic:55,lieutenant:1}},'featured',1);
approx(eliteFifty.probability, 0.5);
const eliteGuaranteed = planner.simulateTarget({banner:'elite',featuredRate:50,eliteGuaranteed:true,
  remaining:{rare:10,sergeant:40,epic:55,lieutenant:1}},'featured',1);
approx(eliteGuaranteed.probability, 1);
assert.strictEqual(planner.simulateTarget({banner:'elite'},'epic',20).probability, 0);
assert.strictEqual(planner.simulateTarget({banner:'field'},'featured',20).probability, 0);

const lieutenant = planner.simulateTarget(freshField,'lieutenant',80);
for(let i=1;i<lieutenant.cdf.length;i++) assert(lieutenant.cdf[i] >= lieutenant.cdf[i-1]);
assert(lieutenant.probability > 0.99 && lieutenant.probability <= 1);

const dailyIncome = {
  banner:'field', keycards:0, cardPieces:0, dailyTaskDaysPerWeek:7,
  cycleKeycardsPerWeek:0, cycleRewardsRemaining:0, manualOneTimeKeycards:0,
  manualWeeklyKeycards:0, useFreePulls:false, nextFreePullHours:0
};
const twoWeeks = planner.projectIncome(dailyIncome, 14 * 24);
assert.strictEqual(twoWeeks.earnedCardPieces, 1400);
assert.strictEqual(twoWeeks.cardPieceKeycards, 7);
assert.strictEqual(twoWeeks.paidPulls, 7);
assert.strictEqual(planner.hoursToPulls(dailyIncome, 1), 48);

const freeIncome = Object.assign({}, dailyIncome, {useFreePulls:true,nextFreePullHours:5});
assert.strictEqual(planner.projectIncome(freeIncome, 4).freePulls, 0);
assert.strictEqual(planner.projectIncome(freeIncome, 5).freePulls, 1);
assert.strictEqual(planner.projectIncome(freeIncome, 27).freePulls, 2);
assert.strictEqual(planner.projectIncome(Object.assign({},freeIncome,{banner:'elite'}), 100).freePulls, 0);

const cappedCycle = planner.projectIncome(Object.assign({},dailyIncome,{
  cycleKeycardsPerWeek:7,cycleRewardsRemaining:3
}), 14 * 24);
assert.strictEqual(cappedCycle.cycleKeycards, 3);

assert.strictEqual(planner.projectIncome({keycards:'',cardPieces:-1}, -20).paidPulls, 0);
assert.strictEqual(planner.simulateTarget(freshField,'rare',999).pulls, 200);

console.log('Keycard planner tests passed.');
