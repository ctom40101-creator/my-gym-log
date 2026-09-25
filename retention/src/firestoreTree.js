const BUDGET = Symbol('request_budget');
const validSegment = value => typeof value === 'string' && value.length > 0
  && value.length <= 1500 && !value.includes('/');

export async function deletePrivateTree(root, io, requestBudget = 12, cursor = root) {
  if (!/^artifacts\/[A-Za-z0-9-]+\/users\/[A-Za-z0-9_-]{1,128}$/.test(root)
    || !Number.isInteger(requestBudget) || requestBudget < 1
    || typeof cursor !== 'string' || (cursor !== root && !cursor.startsWith(`${root}/`))
    || (cursor.length - root.length > 6144)
    || (cursor !== root && cursor.slice(root.length + 1).split('/').length % 2 !== 0)) {
    throw new Error('invalid_private_root');
  }
  let remaining = requestBudget;
  let deleted = 0;
  const counted = async (method, ...args) => {
    if (remaining <= 0) throw BUDGET;
    remaining--;
    return io[method](...args);
  };
  try {
    while (true) {
      const depth = cursor === root ? 0 : cursor.slice(root.length + 1).split('/').length / 2;
      if (depth > 100) throw new Error('nested_depth_exceeded');
      const collections = await counted('listCollections', cursor);
      if (!Array.isArray(collections)) throw new Error('collection_inventory_ambiguous');
      let child = null;
      for (const collectionId of collections) {
        if (!validSegment(collectionId)) throw new Error('invalid_collection_id');
        const collectionPath = `${cursor}/${collectionId}`;
        const documents = await counted('listDocuments', collectionPath);
        if (!Array.isArray(documents)) throw new Error('document_inventory_ambiguous');
        for (const document of documents) {
          if (!document || typeof document.path !== 'string'
            || !document.path.startsWith(`${collectionPath}/`)
            || document.path.slice(collectionPath.length + 1).includes('/')) {
            throw new Error('document_scope_mismatch');
          }
        }
        if (documents.length) { child = documents[0].path; break; }
      }
      if (child) {
        cursor = child;
        continue;
      }
      if (await counted('documentExists', cursor)) {
        await counted('deleteDocument', cursor);
        deleted++;
      }
      if (cursor === root) return { complete: true, deleted, cursor: root };
      cursor = cursor.slice(0, cursor.lastIndexOf('/', cursor.lastIndexOf('/') - 1));
    }
  } catch (error) {
    if (error === BUDGET) return { complete: false, deleted, cursor };
    throw error;
  }
}
