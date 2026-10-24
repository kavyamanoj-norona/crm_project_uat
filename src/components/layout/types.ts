export type ShellUser = {
  name: string;
  username: string;
  roleName: string;
  imageUrl?: string | null;
  /** Field role with a single screen: no branch switcher, no assistant. */
  restricted?: boolean;
};

/** Server action passed down from the (app) layout — components never import server/. */
export type LogoutAction = () => Promise<void>;

export type ShellNotifications = {
  /** Unread alerts (drives the red dot). */
  count: number;
  /** Newest alerts, read and unread. */
  items: { id: string; category: string; title: string; body: string; url: string; createdAt: string; read: boolean }[];
  /** Marks one alert (or all, with no id) as read. */
  markRead: (id?: string) => Promise<unknown>;
  /** Hides one alert. */
  archive: (id: string) => Promise<unknown>;
  /** Saves this browser for push notifications (server action). */
  registerDevice: (token: string, userAgent: string) => Promise<unknown>;
};

export type BranchChoice = { id: string; code: string; name: string };

/** Sets the header branch scope; `null` = all branches. */
export type SetBranchAction = (branchId: string | null) => Promise<void>;

export type ShellBranch = {
  canSwitch: boolean;
  current: BranchChoice | null;
  options: BranchChoice[];
  setBranch: SetBranchAction;
};
