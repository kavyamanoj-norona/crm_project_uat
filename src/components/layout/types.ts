export type ShellUser = {
  name: string;
  username: string;
  roleName: string;
};

/** Server action passed down from the (app) layout — components never import server/. */
export type LogoutAction = () => Promise<void>;
