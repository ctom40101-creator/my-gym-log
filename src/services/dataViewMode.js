export function dataViewMode(targetUid, loadedUid, currentUid) {
  if (!targetUid || loadedUid !== targetUid) return 'loading';
  return targetUid === currentUid ? 'editable' : 'read_only';
}
