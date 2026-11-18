// Display/report joins only. Never use this expression to authenticate a token,
// authorize a request, select a remote action target, or change incident evidence.
function historicalStaffId(store, column) {
  const columns = new Set(['actor_id','target_id','a.target_id','h.actor_id','r.creator_id','i.user_id']);
  if (!columns.has(column)) throw Error('Unsupported historical identity column');
  if (!store.one("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='staff_id_reconciliations'")) return column;
  return `COALESCE((SELECT m.new_id FROM staff_id_reconciliations m WHERE m.old_id=${column}),${column})`;
}
module.exports={historicalStaffId};
