// V1.0
// calculations.js
// 健身計算工具函式

export const calculateTotalVolume = (log) => {
  return log.reduce(
    (total, set) => total + (set.reps * set.weight),
    0
  );
};

export const estimate1RM = (weight, reps) => {
  if (weight === 0) return 0;

  if (reps === 1) return weight;

  if (reps >= 15) return weight;

  return Math.round(
    weight * (1 + reps / 30) * 10
  ) / 10;
};