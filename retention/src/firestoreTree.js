const BUDGET = Symbol('request_budget');
const validSegment = value => typeof value === 'string' && value.length > 0
  && value.length <= 1500 && !value.includes('/');

export async function deletePrivateTree(root, io, requestBudget = 25) {
  if (!/^artifacts\/[A-Za-z0-9-]+\/users\/[A-Za-z0-9_-]{1,128}$/.test(root)
    || !Number.isInteger(requestBudget) || requestBudget < 1) throw new Error('invalid_private_root');
  let remaining = requestBudget;
  let deleted = 0;
  const counted = async (method, ...args) => {
    if (remaining <= 0) throw BUDGET;
    remaining--;
    return io[method](...args);
  };
  const visit = async (path, knownExists, depth) => {
    if (depth > 100) throw new Error('nested_depth_exceeded');
    const collections = await counted('listCollections', path);
    if (!Array.isArray(collections)) throw new Error('collection_inventory_ambiguous');
    for (const collectionId of collections) {
      if (!validSegment(collectionId)) throw new Error('invalid_collection_id');
      const collectionPath = `${path}/${collectionId}`;
      const documents = await counted('listDocuments', collectionPath);
      if (!Array.isArray(documents)) throw new Error('document_inventory_ambiguous');
      for (const document of documents) {
        if (!document || typeof document.path !== 'string'
          || !document.path.startsWith(`${collectionPath}/`)
          || document.path.slice(collectionPath.length + 1).includes('/')) {
          throw new Error('document_scope_mismatch');
        }
        await visit(document.path, document.exists === true, depth + 1);
      }
    }
    const exists = knownExists === null ? await counted('documentExists', path) : knownExists;
    if (exists) {
      await counted('deleteDocument', path);
      deleted++;
    }
  };
  try {
    await visit(root, null, 0);
    return { complete: true, deleted };
  } catch (error) {
    if (error === BUDGET) return { complete: false, deleted };
    throw error;
  }
}
