export type ShellUser = {
  name: string;
  username: string;
  roleName: string;
};

/** Server action passed down from the (app) layout — components never import server/. */
export type LogoutAction = () => Promise<void>;

export type BranchChoice = { id: string; code: string; name: string };

/** Sets the header branch scope; `null` = all branches. */
export type SetBranchAction = (branchId: string | null) => Promise<void>;

export type ShellBranch = {
  canSwitch: boolean;
  current: BranchChoice | null;
  options: BranchChoice[];
  setBranch: SetBranchAction;
};
