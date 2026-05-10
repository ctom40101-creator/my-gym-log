// V1.0
// databaseService.js
// Firestore 資料庫路徑管理

export const getMovementDBPath = (appId, userId) =>
  `artifacts/${appId}/users/${userId}/MovementDB`;

export const getPlansDBPath = (appId, userId) =>
  `artifacts/${appId}/users/${userId}/PlansDB`;

export const getLogDBPath = (appId, userId) =>
  `artifacts/${appId}/users/${userId}/LogDB`;

export const getBodyMetricsDBPath = (appId, userId) =>
  `artifacts/${appId}/users/${userId}/BodyMetricsDB`;