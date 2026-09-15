/**
 * Groups public API (Phase 8).
 */
export {
  createGroup,
  listGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  listMembers,
  addContactToGroup,
  bulkAddContactsToGroup,
  removeContactFromGroup,
  normalizeGroupName,
  MAX_GROUP_NAME,
  MAX_GROUP_DESCRIPTION,
  MAX_BULK_ADD,
  type GroupRow,
  type MembershipRow,
} from "./service";
